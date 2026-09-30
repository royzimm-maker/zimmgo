// Error reporting (Sentry), shared by the browser, server and edge setups
// (instrumentation-client.ts, instrumentation.ts). It is off until
// NEXT_PUBLIC_SENTRY_DSN is set — with no DSN the SDK sends nothing.
//
// Errors only: no performance tracing or session replay. Reports carry the
// error and its stack, the page or API path, and the browser — never
// cookies, request bodies, IP addresses or trip content (see
// app/privacy/page.tsx, which says the same).
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

function scrub(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
    if (event.request.headers) {
      event.request.headers = Object.fromEntries(
        Object.entries(event.request.headers).filter(([k]) => ["user-agent", "referer"].includes(k.toLowerCase()))
      );
    }
  }
  if (event.user) event.user = { id: event.user.id };
  return event;
}

export const sentryOptions = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend: scrub,
  // Console output can include whatever a component logged; keep it out.
  beforeBreadcrumb: (b: Breadcrumb) => (b.category === "console" ? null : b),
  // Browser session tracking reports every page visit and asks Sentry to
  // record the visitor's IP address with it. Errors are all this is for.
  integrations: <T extends { name: string }>(defaults: T[]) => defaults.filter((i) => i.name !== "BrowserSession"),
};
