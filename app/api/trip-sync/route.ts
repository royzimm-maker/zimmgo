import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api/errors";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { rateLimit } from "@/lib/rateLimit";
import { prisma } from "@/lib/db";
import { SCHEMA_VERSION, migrateSyncBlob } from "@/lib/sync/schema";

const COOKIE_NAME = "zimmgo-device";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // ~1 year
// Generous for a device's trips + chat, well under Vercel's 4.5MB body limit.
const MAX_BODY_BYTES = 2_000_000;

// GET creates the device cookie if it's missing — this is the only place
// that happens, since the client always GETs once on mount before it ever
// PUTs, so by the time a PUT fires the cookie is guaranteed to exist.
export async function GET() {
  try {
    const store = await cookies();
    let deviceId = store.get(COOKIE_NAME)?.value;
    const isNew = !deviceId;
    if (!deviceId) deviceId = randomUUID();

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    const res = NextResponse.json({ data: device?.data ?? null, version: device?.version ?? 0 });
    if (isNew) {
      res.cookies.set(COOKIE_NAME, deviceId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });
    }
    return res;
  } catch (error: unknown) {
    return serverError("trip-sync GET", error);
  }
}

// Compare-and-set: the write only applies if the stored version still equals
// the client's baseVersion. Otherwise another tab saved first — return 409
// with the current server copy so the client can merge and retry, instead of
// silently overwriting newer work.
export async function PUT(request: NextRequest) {
  const limited = await rateLimit(request, { bucket: "trip-sync", limit: 60, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const deviceId = (await cookies()).get(COOKIE_NAME)?.value;
    if (!deviceId) {
      return NextResponse.json({ error: "No device cookie — GET /api/trip-sync first" }, { status: 400 });
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { baseVersion, data } = (body ?? {}) as { baseVersion?: unknown; data?: unknown };
    if (typeof baseVersion !== "number" || !Number.isInteger(baseVersion) || baseVersion < 0) {
      return NextResponse.json({ error: "Invalid sync payload" }, { status: 400 });
    }
    // Stored data is always the current schema: a tab still running older
    // code has its payload upgraded here. A payload from newer code than this
    // server (mid-rollback) is refused rather than stored in a shape this
    // version can't read.
    const migrated = migrateSyncBlob(data);
    if (migrated.status === "too-new") {
      return NextResponse.json(
        { error: `Unsupported schema version ${migrated.schemaVersion} (server supports ${SCHEMA_VERSION})` },
        { status: 422 }
      );
    }
    if (migrated.status === "invalid") {
      return NextResponse.json({ error: "Invalid sync payload" }, { status: 400 });
    }
    const json = migrated.blob as unknown as Prisma.InputJsonValue;

    const updated = await prisma.device.updateMany({
      where: { id: deviceId, version: baseVersion },
      data: { data: json, version: { increment: 1 } },
    });
    if (updated.count === 1) {
      return NextResponse.json({ ok: true, version: baseVersion + 1 });
    }

    const existing = await prisma.device.findUnique({ where: { id: deviceId } });
    if (existing) {
      return NextResponse.json(
        { error: "conflict", data: existing.data, version: existing.version },
        { status: 409 }
      );
    }

    try {
      await prisma.device.create({ data: { id: deviceId, data: json, version: 1 } });
      return NextResponse.json({ ok: true, version: 1 });
    } catch (error: unknown) {
      // Another tab created the row between our update and create — same
      // situation as a version mismatch.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await prisma.device.findUnique({ where: { id: deviceId } });
        return NextResponse.json(
          { error: "conflict", data: winner?.data ?? null, version: winner?.version ?? 0 },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error: unknown) {
    return serverError("trip-sync PUT", error);
  }
}
