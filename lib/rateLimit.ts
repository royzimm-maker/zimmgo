import { NextRequest, NextResponse } from "next/server";

// Every route in app/api that calls the Anthropic API shares one server-side
// key with no per-user auth — without this, anyone with the URL can hammer
// those routes in a loop and run up the bill with no limit at all. This is a
// simple in-memory, per-IP fixed-window limiter: good enough to stop casual/
// scripted abuse of a beta app on a single server instance. It resets on
// cold start and doesn't share state across instances/regions, so it's not
// a substitute for a real distributed limiter (e.g. Upstash Redis) if this
// ever runs multi-instance — swap the store below for that when it does.
const buckets = new Map<string, { count: number; resetAt: number }>();

// Reclaim memory from expired entries opportunistically rather than running
// a timer — a beta app's traffic is low enough that this map never gets
// large, so a cheap sweep on the (rare) new-bucket-key path is sufficient.
let lastSweep = Date.now();
function sweepExpired(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  buckets.forEach((entry, key) => {
    if (entry.resetAt <= now) buckets.delete(key);
  });
}

function getClientIp(request: NextRequest): string {
  // Vercel (and most proxies) set x-forwarded-for to "client, proxy1, proxy2"
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

interface RateLimitOptions {
  /** Distinguishes routes with different limits — e.g. "chat", "generate". */
  bucket: string;
  /** Max requests allowed per window, per client IP. */
  limit: number;
  windowMs: number;
}

/**
 * Returns a 429 NextResponse if the caller has exceeded the limit, or null
 * if the request is allowed (and has been counted against the window).
 * Call this first thing in a route handler: `const limited = rateLimit(...); if (limited) return limited;`
 */
export function rateLimit(request: NextRequest, { bucket, limit, windowMs }: RateLimitOptions): NextResponse | null {
  const now = Date.now();
  sweepExpired(now);

  const key = `${bucket}:${getClientIp(request)}`;
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (entry.count >= limit) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: `Too many requests — please wait about ${Math.max(1, Math.ceil(retryAfterSec / 60))} minute${retryAfterSec > 90 ? "s" : ""} and try again.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  entry.count += 1;
  return null;
}
