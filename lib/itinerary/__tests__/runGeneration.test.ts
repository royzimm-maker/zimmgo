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

describe("runGeneration — Claude writes the day-by-day schedule", () => {
  it("uses the days and why-this-works from Claude's generate_itinerary call, keeping the app's dates and cities", async () => {
    m.create
      .mockResolvedValueOnce({
        stop_reason: "tool_use", usage,
        content: [{
          type: "tool_use", id: "g1", name: "generate_itinerary",
          input: {
            destination: "Lisbon",
            days: [{ day_number: 1, theme: "Alfama & the Castle", morning: ["Castelo de São Jorge"], afternoon: ["Alfama lanes"], evening: ["Fado"], dinner: "A tasca in Alfama" }],
            why_this_works: "- Built around your love of history",
          },
        }],
      })
      .mockResolvedValueOnce({ stop_reason: "end_turn", usage, content: [{ type: "text", text: "A lovely trip.", citations: null }] });

    const itinerary = await runGeneration("trip-1", prefs);

    expect(itinerary.days).toHaveLength(2);
    expect(itinerary.days[0]).toMatchObject({ dayNumber: 1, date: "2026-10-01", location: "Lisbon", theme: "Alfama & the Castle", morning: ["Castelo de São Jorge"] });
    expect(itinerary.days[0].meals.find((x) => x.type === "dinner")?.suggestion).toBe("A tasca in Alfama");
    expect(itinerary.days[1]).toMatchObject({ dayNumber: 2, date: "2026-10-02", location: "Lisbon" }); // not written: template
    expect(itinerary.whyThisWorks).toBe("- Built around your love of history");
  });

  it("asks Claude for every day of the app's day plan", async () => {
    m.create.mockResolvedValueOnce({ stop_reason: "end_turn", usage, content: [{ type: "text", text: "Trip.", citations: null }] });
    await runGeneration("trip-1", prefs);
    const content = (m.create.mock.calls[0][0] as Anthropic.MessageCreateParams).messages[0].content;
    const prompt = typeof content === "string" ? content : content.map((b) => (b.type === "text" ? b.text : "")).join("");
    expect(prompt).toContain("Day 1 (2026-10-01) in Lisbon; Day 2 (2026-10-02) in Lisbon.");
  });
});

describe("runGeneration — running out of time after the searches", () => {
  it("finishes with what it gathered (and the templates) instead of failing, and says it's writing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { default: AnthropicSDK } = await import("@anthropic-ai/sdk");
    m.create
      .mockResolvedValueOnce({
        stop_reason: "tool_use", usage,
        content: [{ type: "tool_use", id: "t1", name: "search_restaurants", input: { destination: "Lisbon" } }],
      })
      .mockRejectedValueOnce(new AnthropicSDK.APIConnectionTimeoutError());
    const stages: string[] = [];

    const itinerary = await runGeneration("trip-1", prefs, async (s) => { stages.push(s); });

    expect(itinerary.days).toHaveLength(2);
    expect(itinerary.restaurants?.length).toBeGreaterThan(0);
    expect(stages).toContain("Writing your day-by-day plan…");
  });

  it("still fails when the very first round times out — there's nothing to build on", async () => {
    const { default: AnthropicSDK } = await import("@anthropic-ai/sdk");
    m.create.mockRejectedValueOnce(new AnthropicSDK.APIConnectionTimeoutError());
    await expect(runGeneration("trip-1", prefs)).rejects.toThrow();
  });
});
