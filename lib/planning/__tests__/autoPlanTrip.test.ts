import { describe, it, expect, vi } from "vitest";
import { autoPlanTrip, type PickFn } from "@/lib/planning/autoPlanTrip";
import type { ActivityOption, GeneratedItinerary, HotelOption, TripPreferences } from "@/types/trip";
import type { SmartPickRequestBody } from "@/types/smartPick";

const prefs = { activities: [], activityRankings: {}, vibes: [], transportation: [] } as unknown as TripPreferences;

const day = (dayNumber: number, location: string) =>
  ({ date: `2026-09-0${dayNumber}`, dayNumber, theme: "", location, morning: [], afternoon: [], evening: [], meals: [] });
const act = (id: string, location: string) => ({ id, name: id, location }) as unknown as ActivityOption;
const hotel = (id: string, city: string) => ({ id, name: id, city, location: city }) as unknown as HotelOption;

function itinerary(): GeneratedItinerary {
  return {
    id: "itin-1", tripId: "t1", version: 1, createdAt: "",
    days: [day(1, "Rome"), day(2, "Rome"), day(3, "Florence")],
    flights: [],
    hotels: [hotel("h-rome", "Rome"), hotel("h-flo", "Florence")],
    activities: [act("a-rome", "Rome"), act("a-flo", "Florence")],
    restaurants: [], currency: "USD", aiSummary: "", whyThisWorks: "",
  } as GeneratedItinerary;
}

// Picks everything offered and schedules each card on the city's first day.
const pickAll: PickFn = async (body: SmartPickRequestBody) => {
  if (body.kind === "hotel") return { picks: [{ id: body.hotels![0].id, reason: "" }], summary: "" };
  if (body.kind === "activities_for_city") return { picks: body.activities!.map((a) => ({ id: a.id, reason: "" })), summary: "" };
  if (body.kind === "schedule") {
    return { picks: body.activities!.map((a) => ({ id: `act-${a.id}`, dayNumber: body.days![0].dayNumber, reason: "" })), summary: "" };
  }
  return { picks: [], summary: "" };
};

describe("autoPlanTrip", () => {
  it("plans every city: hotel, picks and schedule", async () => {
    const result = await autoPlanTrip(itinerary(), prefs, pickAll);

    expect(result.selectedHotelsByCity).toEqual({ Rome: hotel("h-rome", "Rome"), Florence: hotel("h-flo", "Florence") });
    expect(result.selectedActivityIds.sort()).toEqual(["a-flo", "a-rome"]);
    expect(result.dayCards).toEqual({ 1: ["act-a-rome"], 2: [], 3: ["act-a-flo"] });
    expect(result.bankCards).toEqual([]);
    expect(result.failedCities).toEqual([]);
  });

  it("runs cities in parallel rather than one after another", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const slowPick: PickFn = async (body) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return pickAll(body);
    };
    await autoPlanTrip(itinerary(), prefs, slowPick);
    // Two cities × (hotel + activities) run at once in the first phase.
    expect(maxInFlight).toBeGreaterThanOrEqual(4);
  });

  it("keeps the cities that worked when one fails, leaving the failed city's items unscheduled", async () => {
    const pick = vi.fn<PickFn>(async (body) => {
      if (body.city === "Florence") throw new Error("overloaded");
      return pickAll(body);
    });
    const result = await autoPlanTrip(itinerary(), prefs, pick);

    expect(result.failedCities).toEqual(["Florence"]);
    expect(result.selectedHotelsByCity).toHaveProperty("Rome");
    expect(result.selectedHotelsByCity).not.toHaveProperty("Florence");
    expect(result.dayCards[1]).toEqual(["act-a-rome"]);
    expect(result.bankCards).toEqual(["act-a-flo"]);
    // Florence got one retry before being given up on.
    expect(pick.mock.calls.filter(([b]) => b.city === "Florence" && b.kind === "hotel")).toHaveLength(2);
  });

  it("retries a city once after a transient failure", async () => {
    let failed = false;
    const flaky: PickFn = async (body) => {
      if (body.city === "Rome" && body.kind === "schedule" && !failed) {
        failed = true;
        throw new Error("blip");
      }
      return pickAll(body);
    };
    const result = await autoPlanTrip(itinerary(), prefs, flaky);
    expect(result.failedCities).toEqual([]);
    expect(result.dayCards[1]).toEqual(["act-a-rome"]);
  });

  it("throws when every city fails", async () => {
    await expect(autoPlanTrip(itinerary(), prefs, async () => { throw new Error("API key is invalid"); }))
      .rejects.toThrow("API key is invalid");
  });

  it("offers each item to only one city, even when names overlap", async () => {
    const it = itinerary();
    it.days = [day(1, "Rome"), day(2, "Rome Outskirts")];
    it.activities = [act("a-rome", "Rome")];
    it.hotels = [];
    const pick = vi.fn<PickFn>(pickAll);

    const result = await autoPlanTrip(it, prefs, pick);

    const offered = pick.mock.calls.filter(([b]) => b.kind === "activities_for_city").flatMap(([b]) => b.activities!.map((a) => a.id));
    expect(offered).toEqual(["a-rome"]);
    expect(Object.values(result.dayCards).flat()).toEqual(["act-a-rome"]);
  });

  it("ignores schedule picks for unknown cards or days, and duplicates", async () => {
    const pick: PickFn = async (body) => body.kind === "schedule"
      ? { picks: [
          { id: "act-a-rome", dayNumber: 1, reason: "" },
          { id: "act-a-rome", dayNumber: 2, reason: "" },
          { id: "act-made-up", dayNumber: 1, reason: "" },
          { id: "act-a-rome", dayNumber: 3, reason: "" },
        ], summary: "" }
      : pickAll(body);
    const result = await autoPlanTrip(itinerary(), prefs, pick);
    expect(result.dayCards[1]).toEqual(["act-a-rome"]);
    expect(result.dayCards[2]).toEqual([]);
  });
});
