// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

const m = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/ai/usageLog", () => ({ logApiUsage: vi.fn() }));
vi.mock("@/lib/ai/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/client")>()),
  getAnthropicClient: () => ({ messages: { create: m.create } }),
}));

import { runGeneration, withCacheBreakpoint, toolResultForModel } from "@/lib/itinerary/runGeneration";
import type { TripPreferences } from "@/types/trip";

const prefs = {
  activities: [], activityRankings: {}, vibes: [], transportation: [],
  destination: { cities: ["Lisbon"], displayName: "Lisbon" },
  dates: { type: "exact", startDate: "2026-10-01", endDate: "2026-10-03" },
} as unknown as TripPreferences;
const usage = { input_tokens: 1, output_tokens: 1 };

// Every cache_control marker in a request, wherever it sits.
function breakpoints(req: Anthropic.MessageCreateParams): string[] {
  const found: string[] = [];
  if (Array.isArray(req.system)) req.system.forEach((b, i) => b.cache_control && found.push(`system[${i}]`));
  (req.tools ?? []).forEach((t, i) => (t as { cache_control?: unknown }).cache_control && found.push(`tools[${i}]`));
  req.messages.forEach((msg, i) => {
    if (typeof msg.content !== "string") msg.content.forEach((b, j) => (b as { cache_control?: unknown }).cache_control && found.push(`messages[${i}][${j}]`));
  });
  return found;
}

beforeEach(() => vi.clearAllMocks());

describe("runGeneration prompt caching", () => {
  it("caches the tools + system prefix and the conversation so far, every round, within the breakpoint limit", async () => {
    m.create
      .mockResolvedValueOnce({
        stop_reason: "tool_use", usage,
        content: [{ type: "tool_use", id: "t1", name: "search_hotels", input: { destination: "Lisbon" } }],
      })
      .mockResolvedValueOnce({
        stop_reason: "tool_use", usage,
        content: [{ type: "tool_use", id: "t2", name: "search_activities", input: { destination: "Lisbon" } }],
      })
      .mockResolvedValueOnce({ stop_reason: "end_turn", usage, content: [{ type: "text", text: "A lovely trip.", citations: null }] });

    await runGeneration("trip-1", prefs);

    const requests = m.create.mock.calls.map((c) => c[0] as Anthropic.MessageCreateParams);
    expect(requests).toHaveLength(3);
    for (const req of requests) {
      const last = req.messages.length - 1;
      const lastBlock = (req.messages[last].content as unknown[]).length - 1;
      // Exactly two: the system block (covers the tool schemas before it) and the newest message.
      expect(breakpoints(req)).toEqual(["system[0]", `messages[${last}][${lastBlock}]`]);
    }
  });

  it("doesn't mutate the conversation it's given", () => {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: "plan a trip" }];
    const marked = withCacheBreakpoint(messages);
    expect(messages[0].content).toBe("plan a trip");
    expect(marked[0].content).toEqual([{ type: "text", text: "plan a trip", cache_control: { type: "ephemeral" } }]);
  });
});

describe("toolResultForModel", () => {
  it("drops UI-only URLs from what's re-sent to the model, keeping ids and details", () => {
    const json = toolResultForModel([{ id: "h1", name: "Hotel", pricePerNight: 200, bookingUrl: "https://x", imageUrl: "https://y", menuUrl: "https://z" }]);
    expect(JSON.parse(json)).toEqual([{ id: "h1", name: "Hotel", pricePerNight: 200 }]);
  });
});
