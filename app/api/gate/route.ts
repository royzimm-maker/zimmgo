import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { GATE_COOKIE_NAME, expectedGateCookieValue } from "@/lib/gateAuth";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // ~90 days

export async function POST(request: NextRequest) {
  // Cheap insurance against brute-forcing a shared password.
  const limited = rateLimit(request, { bucket: "gate", limit: 10, windowMs: 5 * 60_000 });
  if (limited) return limited;

  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    const { password } = (await request.json()) as { password?: string };
    if (!password || password !== sitePassword) {
      return NextResponse.json({ error: "wrong_password" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(GATE_COOKIE_NAME, await expectedGateCookieValue(sitePassword), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
    return res;
  } catch (error: unknown) {
    console.error("[gate]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
