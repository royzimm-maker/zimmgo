// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGroupBy } = vi.hoisted(() => ({ mockGroupBy: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { apiUsageEvent: { groupBy: mockGroupBy } } }));

import { GET } from "@/app/api/admin/usage-summary/route";

function req(headers: Record<string, string> = {}, days = "7") {
  return new NextRequest(`http://localhost/api/admin/usage-summary?days=${days}`, { headers });
}
const group = (route: string, calls: number, sums: Partial<Record<"inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens", number>>) => ({
  route, model: "claude-sonnet-5", _count: { _all: calls },
  _sum: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, ...sums },
});

const ORIGINAL_ADMIN_TOKEN = process.env.ADMIN_TOKEN;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_TOKEN = "secret";
  mockGroupBy.mockResolvedValue([]);
});

afterEach(() => {
  process.env.ADMIN_TOKEN = ORIGINAL_ADMIN_TOKEN;
});

describe("GET /api/admin/usage-summary", () => {
  it("refuses every request when ADMIN_TOKEN isn't configured", async () => {
    delete process.env.ADMIN_TOKEN;
    const res = await GET(req({ "x-admin-token": "anything" }));
    expect(res.status).toBe(503);
    expect(mockGroupBy).not.toHaveBeenCalled();
  });

  it("rejects a missing, wrong, or prefix-only token", async () => {
    for (const headers of [{} as Record<string, string>, { "x-admin-token": "wrong" }, { "x-admin-token": "secre" }, { "x-admin-token": "secret!" }]) {
      expect((await GET(req(headers))).status).toBe(401);
    }
    expect(mockGroupBy).not.toHaveBeenCalled();
  });

  it("totals calls, tokens and estimated cost by route from the database's sums", async () => {
    mockGroupBy.mockResolvedValue([
      group("itinerary-generate", 2, { inputTokens: 2_000_000 }),
      group("chat", 1, { outputTokens: 1_000_000 }),
    ]);

    const res = await GET(req({ "x-admin-token": "secret" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGroupBy).toHaveBeenCalledWith(expect.objectContaining({ by: ["route", "model"] }));
    expect(body.totalCalls).toBe(3);
    expect(body.totalCostUsd).toBeCloseTo(14, 5); // 2M input at $2/M + 1M output at $10/M
    expect(body.byRoute["itinerary-generate"]).toMatchObject({ calls: 2, inputTokens: 2_000_000 });
    expect(body.byRoute.chat.outputTokens).toBe(1_000_000);
  });

  it("falls back to 30 days for a nonsense window and caps a huge one", async () => {
    expect((await (await GET(req({ "x-admin-token": "secret" }, "abc"))).json()).windowDays).toBe(30);
    expect((await (await GET(req({ "x-admin-token": "secret" }, "-5"))).json()).windowDays).toBe(30);
    expect((await (await GET(req({ "x-admin-token": "secret" }, "99999"))).json()).windowDays).toBe(366);
  });
});
