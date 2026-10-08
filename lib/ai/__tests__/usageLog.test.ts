// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate, mockWaitUntil } = vi.hoisted(() => ({ mockCreate: vi.fn(), mockWaitUntil: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { apiUsageEvent: { create: mockCreate } } }));
vi.mock("@vercel/functions", () => ({ waitUntil: mockWaitUntil }));
const { mockLogServerError } = vi.hoisted(() => ({ mockLogServerError: vi.fn() }));
vi.mock("@/lib/http/errors", () => ({ logServerError: mockLogServerError }));

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

  it("runs the write in the background instead of making the caller wait on the database", async () => {
    let finishWrite!: () => void;
    mockCreate.mockReturnValue(new Promise<void>((r) => { finishWrite = r; }));

    const write = logApiUsage("chat", "claude-sonnet-5", { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });

    // Returned synchronously while the DB write is still pending, and handed
    // to waitUntil so the platform keeps it alive past the response.
    expect(mockWaitUntil).toHaveBeenCalledWith(write);
    let settled = false;
    write.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    finishWrite();
    await write;
    expect(settled).toBe(true);
  });

  it("swallows a database failure instead of throwing into the caller", async () => {
    mockCreate.mockRejectedValue(new Error("no DATABASE_URL"));
    await expect(
      logApiUsage("chat", "claude-sonnet-5", { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 })
    ).resolves.toBeUndefined();
  });
});

describe("logApiUsage — cut-off replies", () => {
  const usage = { input_tokens: 10, output_tokens: 16000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

  it("reports a reply that hit max_tokens as an error, and still logs its usage", async () => {
    mockCreate.mockResolvedValue({});
    await logApiUsage("itinerary-generate", "claude-sonnet-5", usage, "max_tokens");
    expect(mockLogServerError).toHaveBeenCalledWith("itinerary-generate", expect.objectContaining({ message: expect.stringContaining("hit max_tokens after 16000 output tokens") }));
    expect(mockCreate).toHaveBeenCalled();
  });

  it("says nothing for replies that finished or stopped to call a tool", async () => {
    mockCreate.mockResolvedValue({});
    await logApiUsage("chat", "claude-sonnet-5", usage, "end_turn");
    await logApiUsage("chat", "claude-sonnet-5", usage, "tool_use");
    await logApiUsage("chat", "claude-sonnet-5", usage);
    expect(mockLogServerError).not.toHaveBeenCalled();
  });
});
