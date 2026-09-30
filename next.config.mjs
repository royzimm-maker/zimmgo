import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cf.bstatic.com" },
    ],
  },
};

// Error reporting (lib/monitoring/sentryOptions.ts). Source maps, which turn
// minified stack traces back into real file/line numbers, are uploaded only
// when SENTRY_AUTH_TOKEN (plus SENTRY_ORG and SENTRY_PROJECT) is set on
// Vercel; without them the build is unchanged apart from a skipped upload.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
