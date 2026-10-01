import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inBackground } from "@/lib/background";

// Per-IP fixed-window limiter, counted in Postgres so every serverless
// instance shares one count — an in-memory Map gave each instance its own,
// which made the limits largely fictional on Vercel. One atomic upsert per
// check; negligible next to the multi-second AI calls these routes make.
//
// If the database is unreachable, falls back to the old per-instance
// in-memory counter rather than failing open entirely.

interface RateLimitOptions {
  /** Distinguishes routes with different limits — e.g. "chat", "itinerary-generate". */
  bucket: string;
  /** Max requests allowed per window, per client IP. */
  limit: number;
  windowMs: number;
}

function getClientIp(request: NextRequest): string {
  // Vercel sets x-forwarded-for to "client, proxy1, proxy2"
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function tooMany(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: `Too many requests — please wait about ${Math.max(1, Math.ceil(retryAfterSec / 60))} minute${retryAfterSec > 90 ? "s" : ""} and try again.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

// ── In-memory fallback ────────────────────────────────────────────────────────
const buckets = new Map<string, { count: number; resetAt: number }>();
let lastSweep = Date.now();
let warnedFallback = false;

function memoryLimit(key: string, limit: number, windowMs: number, now: number): NextResponse | null {
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    buckets.forEach((entry, k) => {
      if (entry.resetAt <= now) buckets.delete(k);
    });
  }
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (entry.count >= limit) return tooMany(Math.ceil((entry.resetAt - now) / 1000));
  entry.count += 1;
  return null;
}

// ── Shared (database) limiter ─────────────────────────────────────────────────
async function sharedCount(key: string, windowStart: Date): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitWindow" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart")
    DO UPDATE SET "count" = "RateLimitWindow"."count" + 1
    RETURNING "count"`;
  return Number(rows[0]?.count ?? 1);
}

function sweepOldWindows() {
  // Opportunistic cleanup instead of a cron job — ~1% of checks.
  if (Math.random() > 0.01) return;
  inBackground("rateLimit", () => prisma.$executeRaw`DELETE FROM "RateLimitWindow" WHERE "windowStart" < ${new Date(Date.now() - 86_400_000)}`);
}

/**
 * Returns a 429 NextResponse if the caller has exceeded the limit, or null
 * if the request is allowed (and has been counted against the window).
 * Call this first thing in a route handler:
 * `const limited = await rateLimit(...); if (limited) return limited;`
 */
export async function rateLimit(
  request: NextRequest,
  { bucket, limit, windowMs }: RateLimitOptions
): Promise<NextResponse | null> {
  const now = Date.now();
  const key = `${bucket}:${getClientIp(request)}`;
  const windowStartMs = Math.floor(now / windowMs) * windowMs;

  try {
    const count = await sharedCount(key, new Date(windowStartMs));
    sweepOldWindows();
    if (count > limit) return tooMany(Math.ceil((windowStartMs + windowMs - now) / 1000));
    return null;
  } catch (error) {
    if (!warnedFallback) {
      warnedFallback = true;
      console.error("[rateLimit] shared store unavailable, using per-instance fallback", error);
    }
    return memoryLimit(key, limit, windowMs, now);
  }
}
