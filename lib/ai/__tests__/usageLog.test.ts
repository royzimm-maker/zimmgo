// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { apiUsageEvent: { create: mockCreate } } }));

import { estimateCostUsd, priceForModel, logApiUsage } from "@/lib/ai/usageLog";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("priceForModel / estimateCostUsd", () => {
  it("prices a plain (uncached) call at the published Sonnet 5 rate", () => {
    const price = priceForModel("claude-sonnet-5");
    expect(price).toEqual({ input: 2, output: 10 });

    const cost = estimateCostUsd("claude-sonnet-5", {
      inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0,
    });
    expect(cost).toBeCloseTo(12, 5); // $2 + $10
  });

  it("falls back to Sonnet 5 pricing for an unknown model rather than throwing", () => {
    expect(priceForModel("some-future-model")).toEqual({ input: 2, output: 10 });
  });

  it("prices a cache read cheaper than a fresh input token", () => {
    const cheap = estimateCostUsd("claude-sonnet-5", {
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0,
    });
    const full = estimateCostUsd("claude-sonnet-5", {
      inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
    });
    expect(cheap).toBeLessThan(full);
  });
});

describe("logApiUsage", () => {
  it("writes route, model, and every usage field to the database", async () => {
    mockCreate.mockResolvedValue({});
    await logApiUsage("itinerary-generate", "claude-sonnet-5", {
      input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 20, cache_creation_input_tokens: 5,
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        route: "itinerary-generate",
        model: "claude-sonnet-5",
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 20,
        cacheWriteTokens: 5,
      },
    });
  });

  it("treats null cache fields as zero", async () => {
    mockCreate.mockResolvedValue({});
    await logApiUsage("chat", "claude-sonnet-5", {
      input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null, cache_creation_input_tokens: null,
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cacheReadTokens: 0, cacheWriteTokens: 0 }) })
    );
  });

  it("swallows a database failure instead of throwing into the caller", async () => {
    mockCreate.mockRejectedValue(new Error("no DATABASE_URL"));
    await expect(
      logApiUsage("chat", "claude-sonnet-5", { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 })
    ).resolves.toBeUndefined();
  });
});
