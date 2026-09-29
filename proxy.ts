import { NextRequest, NextResponse } from "next/server";
import { GATE_COOKIE_NAME, gateAccounts, verifyGateToken } from "@/lib/gateAuth";

// Site-wide "friends and family" gate, run by Next.js's proxy (what earlier
// versions called middleware) — active only when SITE_PASSWORDS or
// SITE_PASSWORD is set (see lib/gateAuth.ts). Unset (the default for local
// dev) means this proxy no-ops entirely, so `npm run dev` never requires
// a password unless you opt in via .env.local. In production they must be
// set in the Vercel project's environment variables for this to actually
// protect anything — it does nothing on its own.
//
// The session is re-checked on every request, so removing or changing a
// person's password locks them out immediately.
export async function proxy(request: NextRequest) {
  const accounts = gateAccounts();
  if (!accounts.length) return NextResponse.next();

  if (await verifyGateToken(request.cookies.get(GATE_COOKIE_NAME)?.value, accounts)) return NextResponse.next();

  const gateUrl = new URL("/gate", request.url);
  gateUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  const res = NextResponse.redirect(gateUrl);
  // Clear a revoked or expired session rather than re-sending it every time.
  if (request.cookies.has(GATE_COOKIE_NAME)) res.cookies.delete(GATE_COOKIE_NAME);
  return res;
}

export const config = {
  // Everything except the gate page/API route, Next's own static/image
  // machinery, and any request for a static file under /public (matched by
  // "ends in a file extension" rather than naming each asset — an allowlist
  // of specific filenames missed new ones, and Next's image optimizer
  // fetches assets like /logo-lockup.png from the app itself, so gating
  // them broke every <Image> on this page with "unable to optimize image").
  matcher: ["/((?!gate|api/gate|_next/static|_next/image|.*\\.\\w+$).*)"],
};
