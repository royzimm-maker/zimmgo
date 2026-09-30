// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { toPublicError, serverError } from "@/lib/http/errors";
import { AIDeadlineError, withinDeadline } from "@/lib/ai/client";

const sentry = vi.hoisted(() => ({ isEnabled: vi.fn(() => false), captureException: vi.fn(), flush: vi.fn(async () => true) }));
vi.mock("@sentry/nextjs", () => sentry);
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));

const apiError = (status: number) => Anthropic.APIError.generate(status, { type: "error", error: { type: "x", message: "raw body" } }, "raw", new Headers());

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("toPublicError", () => {
  it.each([
    ["a job running out of time", new AIDeadlineError(), 504, /longer than expected/],
    ["an AI call timing out", new Anthropic.APIConnectionTimeoutError(), 504, /longer than expected/],
    ["the AI service being unreachable", new Anthropic.APIConnectionError({ message: "ECONNRESET" }), 503, /Couldn't reach/],
    ["rate limiting", apiError(429), 503, /very busy/],
    ["the API being overloaded (529)", apiError(529), 503, /very busy/],
    ["a bad API key", apiError(401), 502, /AI service had a problem/],
    ["an unexpected bug", new TypeError("Cannot read properties of undefined"), 500, /Something went wrong/],
  ])("maps %s to a safe message", (_label, error, status, message) => {
    const out = toPublicError(error);
    expect(out.status).toBe(status);
    expect(out.message).toMatch(message);
  });
});

describe("serverError", () => {
  it("never sends the raw error to the client, and logs it with a matching reference", async () => {
    const raw = new Error("Can't reach database server at ep-secret-host.neon.tech:5432");

    const res = serverError("trip-sync GET", raw);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("neon.tech");
    expect(body.ref).toMatch(/^\w{8}$/);
    expect(console.error).toHaveBeenCalledWith(`[trip-sync GET] ref=${body.ref}`, raw);
  });
});

describe("withinDeadline", () => {
  const now = 1_000_000;
  beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(now));

  it("allows a retry only when two full attempts fit", () => {
    expect(withinDeadline(now + 200_000, 75_000)).toEqual({ timeout: 75_000, maxRetries: 1 });
    expect(withinDeadline(now + 100_000, 75_000)).toEqual({ timeout: 75_000, maxRetries: 0 });
  });

  it("shrinks the timeout to what's left", () => {
    expect(withinDeadline(now + 40_000, 75_000)).toEqual({ timeout: 40_000, maxRetries: 0 });
  });

  it("refuses to start a call there isn't time for", () => {
    expect(() => withinDeadline(now + 5_000, 75_000)).toThrow(AIDeadlineError);
  });
});

describe("error reporting", () => {
  it("reports a server error to Sentry with its route and the ref the client sees", async () => {
    sentry.isEnabled.mockReturnValue(true);
    const error = new Error("boom");
    const { ref } = await serverError("itinerary/generate", error).json();
    expect(sentry.captureException).toHaveBeenCalledWith(error, { tags: { route: "itinerary/generate", ref } });
    expect(sentry.flush).toHaveBeenCalled();
  });

  it("sends nothing while Sentry isn't configured", () => {
    sentry.isEnabled.mockReturnValue(false);
    sentry.captureException.mockClear();
    serverError("chat", new Error("boom"));
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});
