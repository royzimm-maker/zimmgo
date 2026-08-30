// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { apiUsageEvent: { findMany: mockFindMany } } }));

import { GET } from "@/app/api/admin/usage-summary/route";

function req(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/admin/usage-summary?days=7", { headers });
}

const ORIGINAL_ADMIN_TOKEN = process.env.ADMIN_TOKEN;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_TOKEN = "secret";
});

afterEach(() => {
  process.env.ADMIN_TOKEN = ORIGINAL_ADMIN_TOKEN;
});

describe("GET /api/admin/usage-summary", () => {
  it("refuses every request when ADMIN_TOKEN isn't configured", async () => {
    delete process.env.ADMIN_TOKEN;
    const res = await GET(req({ "x-admin-token": "anything" }));
    expect(res.status).toBe(503);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong token", async () => {
    const res = await GET(req({ "x-admin-token": "wrong" }));
    expect(res.status).toBe(401);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("aggregates calls, tokens, and estimated cost by route", async () => {
    mockFindMany.mockResolvedValue([
      { route: "itinerary-generate", model: "claude-sonnet-5", inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      { route: "itinerary-generate", model: "claude-sonnet-5", inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      { route: "chat", model: "claude-sonnet-5", inputTokens: 0, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
    ]);

    const res = await GET(req({ "x-admin-token": "secret" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalCalls).toBe(3);
    expect(body.totalCostUsd).toBeCloseTo(14, 5); // 2 * $2 (input) + $10 (output)
    expect(body.byRoute["itinerary-generate"].calls).toBe(2);
    expect(body.byRoute["itinerary-generate"].inputTokens).toBe(2_000_000);
    expect(body.byRoute.chat.outputTokens).toBe(1_000_000);
  });
});
