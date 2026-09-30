import { describe, it, expect } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { sentryOptions } from "@/lib/monitoring/sentryOptions";

describe("sentryOptions", () => {
  it("is off without a DSN", () => {
    expect(sentryOptions.enabled).toBe(false);
  });

  it("strips cookies, bodies, query strings, identifying headers and user details from a report", () => {
    const event = {
      request: {
        url: "https://zimmgo.vercel.app/api/ai/chat",
        cookies: { "zimmgo-device": "abc" },
        data: '{"message":"my trip"}',
        query_string: "q=Lisbon",
        headers: { "User-Agent": "Firefox", Cookie: "zimmgo-gate=x", "X-Forwarded-For": "1.2.3.4" },
      },
      user: { id: "u1", ip_address: "1.2.3.4", email: "a@b.c" },
    } as unknown as ErrorEvent;

    const scrubbed = sentryOptions.beforeSend(event);

    expect(scrubbed.request).toEqual({ url: "https://zimmgo.vercel.app/api/ai/chat", headers: { "User-Agent": "Firefox" } });
    expect(sentryOptions.beforeSend({ request: { url: "https://x.app/plan?q=Lisbon" } } as unknown as ErrorEvent).request?.url).toBe("https://x.app/plan");
    expect(scrubbed.user).toEqual({ id: "u1" });
  });

  it("leaves out browser session tracking, which would record visitors' IP addresses", () => {
    const defaults = [{ name: "BrowserSession" }, { name: "GlobalHandlers" }] as never;
    expect(sentryOptions.integrations(defaults).map((i) => i.name)).toEqual(["GlobalHandlers"]);
  });

  it("drops console breadcrumbs", () => {
    expect(sentryOptions.beforeBreadcrumb({ category: "console", message: "trip: Lisbon" })).toBeNull();
    expect(sentryOptions.beforeBreadcrumb({ category: "navigation" })).toEqual({ category: "navigation" });
  });
});
