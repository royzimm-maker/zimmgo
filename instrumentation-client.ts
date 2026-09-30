import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/monitoring/sentryOptions";

// Browser error reporting (lib/monitoring/sentryOptions.ts). Off until
// NEXT_PUBLIC_SENTRY_DSN is set.
Sentry.init(sentryOptions);
