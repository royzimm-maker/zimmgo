import { describe, it, expect } from "vitest";
import { parseToolInput, findToolInput } from "@/lib/ai/toolInput";
import {
  PARSE_FULL_TRIP_TOOL, SMART_PICK_TOOL, UPDATE_LODGING_PREFERENCES_TOOL, ADD_TO_WANDERLOG_TOOL, TRAVEL_TOOLS,
} from "@/lib/ai/tools";
import type Anthropic from "@anthropic-ai/sdk";

const base = { cities: ["Rome"], displayName: "Rome", likelyRoadTrip: false, flightsObviouslyRequired: true, summary: "Rome for two." };

describe("parseToolInput", () => {
  it("coerces harmless mismatches: numeric strings, 'true', a lone value for a list", () => {
    const out = parseToolInput<Record<string, unknown>>(UPDATE_LODGING_PREFERENCES_TOOL, {
      types: "boutique", min_stars: "4", reply: "Done!",
    });
    expect(out).toEqual({ types: ["boutique"], min_stars: 4, reply: "Done!" });
  });

  it("drops invalid optional fields and array items instead of saving them", () => {
    const out = parseToolInput<Record<string, unknown>>(UPDATE_LODGING_PREFERENCES_TOOL, {
      types: ["hotel", "castle", 7], min_stars: 6, amenities: { pool: true }, reply: "Done!", extra: "ignored",
    });
    expect(out).toEqual({ types: ["hotel"], reply: "Done!" });
  });

  it("treats a list of only invalid items as unusable, but keeps a deliberately empty one", () => {
    // Full-replacement updates: [] would clear the traveller's lodging types.
    expect(parseToolInput(UPDATE_LODGING_PREFERENCES_TOOL, { types: ["castle"], reply: "ok" })).toEqual({ reply: "ok" });
    expect(parseToolInput(UPDATE_LODGING_PREFERENCES_TOOL, { types: [], reply: "ok" })).toEqual({ types: [], reply: "ok" });
  });

  it("rejects the whole input when a required field is missing or unusable", () => {
    expect(parseToolInput(UPDATE_LODGING_PREFERENCES_TOOL, { types: ["hotel"] })).toBeNull();
    expect(parseToolInput(SMART_PICK_TOOL, { picks: [{ id: "h1", reason: "r" }] })).toBeNull();
    expect(parseToolInput(SMART_PICK_TOOL, { picks: [], summary: { text: "s" } })).toBeNull();
    expect(parseToolInput(SMART_PICK_TOOL, "not an object")).toBeNull();
  });

  it("keeps valid picks and drops malformed ones", () => {
    const out = parseToolInput<{ picks: unknown[] }>(SMART_PICK_TOOL, {
      summary: "ok",
      picks: [{ id: "a", reason: "r", dayNumber: "2" }, { reason: "no id" }, { id: "b", reason: "r", dayNumber: 0 }],
    });
    // dayNumber 0 is below the minimum, so it's dropped from that pick — the pick itself stays.
    expect(out?.picks).toEqual([{ id: "a", reason: "r", dayNumber: 2 }, { id: "b", reason: "r" }]);
  });

  it("enforces ranges and formats on parsed trips", () => {
    const out = parseToolInput<Record<string, unknown>>(PARSE_FULL_TRIP_TOOL, {
      ...base,
      travelers: 0,
      seasonalWindowStartMonth: 13,
      seasonalWindowEndMonth: "4",
      dates: { type: "exact", startDate: "Oct 13", endDate: "2026-10-20" },
      vibes: ["romantic", "party"],
    });
    expect(out).toMatchObject({ ...base, seasonalWindowEndMonth: 4, dates: { type: "exact", endDate: "2026-10-20" }, vibes: ["romantic"] });
    expect(out).not.toHaveProperty("travelers");
    expect(out).not.toHaveProperty("seasonalWindowStartMonth");
    expect((out?.dates as Record<string, unknown>).startDate).toBeUndefined();
  });

  it("drops a dates object that doesn't say what kind of dates it is", () => {
    const out = parseToolInput<Record<string, unknown>>(PARSE_FULL_TRIP_TOOL, { ...base, dates: { startDate: "2026-10-13" } });
    expect(out).not.toHaveProperty("dates");
  });

  it("filters wanderlog items to ones with a label and a known source", () => {
    const out = parseToolInput<{ items: unknown[] }>(ADD_TO_WANDERLOG_TOOL, {
      reply: "Saved!",
      items: [{ label: "Uffizi", source: "activity" }, { label: "Bar X", source: "nightclub" }, { source: "custom" }],
    });
    expect(out?.items).toEqual([{ label: "Uffizi", source: "activity" }]);
  });

  it("validates every generation tool schema without throwing", () => {
    for (const tool of TRAVEL_TOOLS) expect(() => parseToolInput(tool, {})).not.toThrow();
  });
});

describe("findToolInput", () => {
  it("finds and conforms the named tool's call, ignoring other blocks", () => {
    const content = [
      { type: "text", text: "Here you go", citations: null },
      { type: "tool_use", id: "t1", name: "make_selection", input: { picks: [{ id: "h1", reason: "r" }], summary: "s" } },
    ] as unknown as Anthropic.ContentBlock[];
    expect(findToolInput(content, SMART_PICK_TOOL)).toEqual({ picks: [{ id: "h1", reason: "r" }], summary: "s" });
    expect(findToolInput(content, UPDATE_LODGING_PREFERENCES_TOOL)).toBeNull();
  });
});
