import { NextRequest, NextResponse } from "next/server";
import { GATE_COOKIE_NAME, expectedGateCookieValue } from "@/lib/gateAuth";

// Site-wide "friends and family" gate — active only when SITE_PASSWORD is
// set. Unset (the default for local dev) means this middleware no-ops
// entirely, so `npm run dev` never requires a password unless you opt in by
// setting SITE_PASSWORD in .env.local. In production, SITE_PASSWORD must be
// set in the Vercel project's environment variables for this to actually
// protect anything — it does nothing on its own.
export async function middleware(request: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) return NextResponse.next();

  const cookie = request.cookies.get(GATE_COOKIE_NAME)?.value;
  if (cookie === (await expectedGateCookieValue(sitePassword))) return NextResponse.next();

  const gateUrl = new URL("/gate", request.url);
  gateUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(gateUrl);
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
