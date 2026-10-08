// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockQueryRaw, mockExecuteRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: mockQueryRaw, $executeRaw: mockExecuteRaw } }));

import { claimDailyQuota, rateLimit } from "@/lib/rateLimit";

function req(ip = "1.2.3.4") {
  return new NextRequest("http://localhost/api/x", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });
}
const opts = { bucket: "test", limit: 3, windowMs: 60_000 };

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(0);
});

describe("rateLimit — shared store", () => {
  it("allows requests while the shared count is within the limit", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 3 }]);
    expect(await rateLimit(req(), opts)).toBeNull();
  });

  it("returns 429 with Retry-After once the shared count exceeds the limit", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 4 }]);
    const res = await rateLimit(req(), opts);
    expect(res?.status).toBe(429);
    expect(Number(res?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("keys the count by bucket and the first forwarded IP", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 1 }]);
    await rateLimit(req("9.9.9.9"), opts);
    // Tagged-template call: first arg is the strings array, then the values.
    const values = mockQueryRaw.mock.calls[0].slice(1);
    expect(values[0]).toBe("test:9.9.9.9");
    expect(values[1]).toBeInstanceOf(Date);
  });
});

describe("rateLimit — fallback", () => {
  it("falls back to a per-instance limit when the shared store is unavailable", async () => {
    mockQueryRaw.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(req("5.5.5.5"), opts));

    expect(results.slice(0, 3).every((r) => r === null)).toBe(true);
    expect(results[3]?.status).toBe(429);
  });
});

describe("claimDailyQuota", () => {
  it("allows calls up to the day's allowance, counted per allowance and UTC day", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 30 }]);
    expect(await claimDailyQuota("google-places-search", 30)).toBe(true);
    mockQueryRaw.mockResolvedValue([{ count: 31 }]);
    expect(await claimDailyQuota("google-places-search", 30)).toBe(false);
    const values = mockQueryRaw.mock.calls[0].slice(1);
    expect(values[0]).toBe("quota:google-places-search");
    expect((values[1] as Date).getTime() % 86_400_000).toBe(0);
  });

  it("fails closed: if the count can't be read, the paid call isn't made", async () => {
    mockQueryRaw.mockRejectedValue(new Error("db down"));
    expect(await claimDailyQuota("google-places-search", 30)).toBe(false);
  });
});
