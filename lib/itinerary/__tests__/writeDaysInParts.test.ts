// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

vi.mock("@/lib/ai/usageLog", () => ({ logApiUsage: vi.fn() }));
vi.mock("@/lib/http/errors", async (orig) => ({ ...(await orig<typeof import("@/lib/http/errors")>()), logServerError: vi.fn() }));

import { dayParts, writeDaysInParts } from "@/lib/itinerary/writeDaysInParts";
import { planDays, writesDaysInParts } from "@/lib/itinerary/dayPlan";
import { buildItineraryPrompt } from "@/lib/ai/prompts";
import type { ActivityOption, RestaurantOption, TripPreferences, TripStop } from "@/types/trip";

// The Italy route: Rome 3, Ostuni 6, Lecce 5, the Tuscany villa 5, Rome 2 — 21 days.
const stops: TripStop[] = [
  { city: "Rome", nights: 3 }, { city: "Ostuni", nights: 6 }, { city: "Lecce", nights: 5 },
  { city: "Tuscany", nights: 5, lodgingArranged: true }, { city: "Rome", nights: 2 },
];
const prefs = {
  activities: ["beaches"], activityRankings: {}, vibes: [], transportation: [],
  destination: { displayName: "Italy", cities: ["Rome", "Ostuni", "Lecce", "Tuscany"] },
  dates: { type: "exact", startDate: "2027-05-25", endDate: "2027-06-15" },
  stops,
} as unknown as TripPreferences;

const act = (name: string, location: string) => ({ id: name, name, location, duration: "2h" }) as ActivityOption;
const rest = (name: string, location: string) => ({ id: name, name, location, cuisine: "Italian", priceRange: "$$" }) as RestaurantOption;

// A fake client that writes every day it's asked for, recording each prompt.
function fakeClient(fail?: (prompt: string) => boolean) {
  const prompts: string[] = [];
  const create = vi.fn(async (req: Anthropic.MessageCreateParams) => {
    const prompt = req.messages[0].content as string;
    prompts.push(prompt);
    if (fail?.(prompt)) throw new Error("boom");
    const dayNumbers = [...prompt.matchAll(/- Day (\d+) \(/g)].map((m) => Number(m[1]));
    return {
      stop_reason: "tool_use",
      usage: { input_tokens: 1, output_tokens: 1 },
      content: [{
        type: "tool_use", id: "w", name: "write_days",
        input: { days: [...dayNumbers, 99].map((n) => ({ day_number: n, theme: `Day ${n}`, morning: ["x"], afternoon: ["y"], evening: ["z"] })) },
      }],
    };
  });
  return { client: { messages: { create } } as unknown as Anthropic, create, prompts };
}

beforeEach(() => vi.clearAllMocks());

describe("dayParts", () => {
  it("gives each stay its own part and splits a long stay evenly", () => {
    const parts = dayParts(planDays(prefs)).map((p) => `${p[0].city}:${p.map((d) => d.dayNumber).join(",")}`);
    expect(parts).toEqual([
      "Rome:1,2,3", "Ostuni:4,5,6,7,8,9", "Lecce:10,11,12,13,14", "Tuscany:15,16,17,18,19", "Rome:20,21",
    ]);
    const tenInOne = dayParts(planDays({ ...prefs, stops: undefined, destination: { displayName: "Rome", cities: ["Rome"] }, dates: { type: "exact", startDate: "2027-05-01", endDate: "2027-05-11" } } as never));
    expect(tenInOne.map((p) => p.length)).toEqual([5, 5]);
  });
});

describe("writeDaysInParts", () => {
  const activities = [act("Colosseum", "Rome"), act("Vatican", "Rome"), act("Trulli walk", "Ostuni"), act("Siena day", "Tuscany")];
  const restaurants = [rest("Roscioli", "Rome"), rest("Osteria Ostuni", "Ostuni")];

  it("writes every day, one call per part, keeping only each part's own days", async () => {
    const { client, create } = fakeClient();
    const days = await writeDaysInParts({ client, preferences: prefs, activities, restaurants, travelNoteByCity: { Ostuni: "Train to Bari, then drive." } });
    expect(create).toHaveBeenCalledTimes(5);
    expect(days.map((d) => d.day_number).sort((a, b) => a - b)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
  });

  it("gives each part its own city's places, shared out between Rome's two stays", async () => {
    const { client, prompts } = fakeClient();
    await writeDaysInParts({ client, preferences: prefs, activities, restaurants, travelNoteByCity: { Ostuni: "Train to Bari, then drive." } });
    const [romeFirst, ostuni, , tuscany, romeLast] = prompts;
    expect(romeFirst).toContain("Colosseum");
    expect(romeFirst).not.toContain("Vatican");
    expect(romeLast).toContain("Vatican");
    expect(romeLast).not.toContain("Colosseum");
    expect(ostuni).toContain("Trulli walk");
    expect(ostuni).not.toContain("Colosseum");
    expect(ostuni).toContain("arrival day from Rome (Train to Bari, then drive.)");
    expect(tuscany).toContain("their own place in Tuscany");
    expect(romeFirst).toContain("first day of the trip");
    expect(romeLast).toContain("last day");
  });

  it("leaves a failed part to the template days", async () => {
    const { client } = fakeClient((prompt) => prompt.includes("all in Lecce"));
    const days = await writeDaysInParts({ client, preferences: prefs, activities, restaurants, travelNoteByCity: {} });
    expect(days.map((d) => d.day_number)).not.toContain(10);
    expect(days).toHaveLength(16);
  });
});

describe("the planning round on a long trip", () => {
  it("leaves the days out, so the final round stays short", () => {
    expect(writesDaysInParts(prefs)).toBe(true);
    expect(buildItineraryPrompt(prefs)).toContain("Leave `days` out of generate_itinerary");
    const short = { ...prefs, stops: undefined, destination: { displayName: "Rome", cities: ["Rome"] }, dates: { type: "exact", startDate: "2027-05-01", endDate: "2027-05-05" } } as never;
    expect(writesDaysInParts(short)).toBe(false);
    expect(buildItineraryPrompt(short)).toContain("Also include `days`");
  });
});
