import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/rateLimit";
import { readJsonBody } from "@/lib/api/readJsonBody";
import {
  GATE_COOKIE_NAME, GATE_SESSION_MAX_AGE_S, createGateToken, gateAccounts, matchGatePassword,
} from "@/lib/gateAuth";

export async function POST(request: NextRequest) {
  // Cheap insurance against brute-forcing a password.
  const limited = await rateLimit(request, { bucket: "gate", limit: 10, windowMs: 5 * 60_000 });
  if (limited) return limited;

  const accounts = gateAccounts();
  if (!accounts.length) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    const parsed = await readJsonBody<{ password?: unknown }>(request, 2_000);
    if (!parsed.ok) return parsed.response;
    const { password } = parsed.body;

    const account = typeof password === "string" && password ? await matchGatePassword(password, accounts) : null;
    if (!account) {
      return NextResponse.json({ error: "wrong_password" }, { status: 401 });
    }

    // Which person signed in — never their password — so access can be
    // traced back to a name if it ever needs revoking.
    console.info("[gate] signed in:", account.label);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(GATE_COOKIE_NAME, await createGateToken(account), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: GATE_SESSION_MAX_AGE_S,
      path: "/",
    });
    return res;
  } catch (error: unknown) {
    return serverError("gate", error);
  }
}
