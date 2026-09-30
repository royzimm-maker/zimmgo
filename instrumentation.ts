import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/monitoring/sentryOptions";

// Server and edge error reporting (lib/monitoring/sentryOptions.ts). Off
// until NEXT_PUBLIC_SENTRY_DSN is set.
export function register() {
  Sentry.init(sentryOptions);
}

// Errors thrown while rendering or in a route that nothing caught.
export const onRequestError = Sentry.captureRequestError;
