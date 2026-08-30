import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "zimmgo-device";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // ~1 year

// GET creates the device cookie if it's missing — this is the only place
// that happens, since the client always GETs once on mount before it ever
// PUTs, so by the time a PUT fires the cookie is guaranteed to exist.
export async function GET() {
  try {
    const store = cookies();
    let deviceId = store.get(COOKIE_NAME)?.value;
    const isNew = !deviceId;
    if (!deviceId) deviceId = randomUUID();

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    const res = NextResponse.json({ data: device?.data ?? null });
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
    console.error("[trip-sync GET]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const limited = rateLimit(request, { bucket: "trip-sync", limit: 60, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const deviceId = cookies().get(COOKIE_NAME)?.value;
    if (!deviceId) {
      return NextResponse.json({ error: "No device cookie — GET /api/trip-sync first" }, { status: 400 });
    }

    const data = await request.json();
    await prisma.device.upsert({
      where: { id: deviceId },
      create: { id: deviceId, data },
      update: { data },
    });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("[trip-sync PUT]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
