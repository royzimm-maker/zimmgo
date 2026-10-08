import { describe, it, expect } from "vitest";
import { describeVibes, vibeLabel } from "@/lib/data/vibes";
import { buildChatSystemPrompt, buildItineraryPrompt } from "@/lib/ai/prompts";
import type { TripPreferences } from "@/types/trip";

const prefs = {
  activities: [], activityRankings: {}, vibes: ["great_food", "architecture", "Glamping"], transportation: [],
  destination: { cities: ["Lisbon"], displayName: "Lisbon" },
  dates: { type: "exact", startDate: "2026-10-01", endDate: "2026-10-03" },
} as unknown as TripPreferences;

describe("vibe names", () => {
  it("names known vibes and leaves free-text ones as typed", () => {
    expect(vibeLabel("great_food")).toBe("Food-Forward Travel");
    expect(vibeLabel("Glamping")).toBe("Glamping");
    expect(describeVibes(["great_food", "Glamping"])).toBe("Food-Forward Travel, Glamping");
    expect(describeVibes(["great_food", "Glamping"], true)).toBe("Food-Forward Travel (great_food), Glamping");
  });

  it("gives Claude vibe names — not ids it would echo to the traveller — when planning", () => {
    const prompt = buildItineraryPrompt(prefs);
    expect(prompt).toContain("Trip vibe: Food-Forward Travel, Architecture, Glamping.");
    expect(prompt).not.toContain("great_food");
  });

  it("keeps the ids in chat, where ZimmGo's vibe tool takes them back", () => {
    expect(buildChatSystemPrompt(prefs)).toContain("Vibe: Food-Forward Travel (great_food), Architecture (architecture), Glamping");
  });
});
