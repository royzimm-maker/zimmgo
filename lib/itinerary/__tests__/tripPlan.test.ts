import { describe, it, expect } from "vitest";
import { buildTripPlan, dayLines, itemLabel } from "@/lib/itinerary/tripPlan";
import type { GeneratedItinerary, HotelOption, TripPreferences } from "@/types/trip";

const hotel = (id: string, city: string) => ({ id, name: id, city, location: city }) as unknown as HotelOption;
const day = (n: number, location: string, morning: string[] = [`${location} walk`]) =>
  ({ dayNumber: n, date: `2026-10-0${n}`, theme: "", location, morning, afternoon: [], evening: ["Sunset"], meals: [] });

function itinerary(over: Partial<GeneratedItinerary> = {}): GeneratedItinerary {
  return {
    days: [day(1, "Rome"), day(2, "Rome"), day(3, "Florence")],
    // Generation lists ZimmGo's recommendation first for each city.
    hotels: [hotel("rome-zigy", "Rome"), hotel("rome-2", "Rome"), hotel("flo-zigy", "Florence")],
    activities: [{ id: "a1", name: "Colosseum", location: "Rome", isLocalFavorite: true }],
    restaurants: [
      { id: "r1", name: "Da Enzo", tier: "midrange", location: "Rome" },
      { id: "r2", name: "Café Brunch", tier: "brunch", location: "Florence" },
    ],
    ...over,
  } as unknown as GeneratedItinerary;
}
const prefs = (over: Partial<TripPreferences> = {}) =>
  ({ destination: { cities: ["Rome", "Florence"], displayName: "Italy" }, ...over }) as TripPreferences;

describe("buildTripPlan — stays", () => {
  it("gives each day its own city's stay: the traveller's choice, else ZimmGo's recommendation", () => {
    const plan = buildTripPlan(itinerary({ selections: { hotelsByCity: { Rome: hotel("rome-2", "Rome") } } }), prefs());
    expect(plan.days.map((d) => [d.day.dayNumber, d.stay?.hotel.id, d.stay?.byTraveller])).toEqual([
      [1, "rome-2", true], [2, "rome-2", true], [3, "flo-zigy", false],
    ]);
    expect(plan.stays.map((s) => [s.city, s.choice.hotel.id])).toEqual([["Rome", "rome-2"], ["Florence", "flo-zigy"]]);
  });
});

describe("buildTripPlan — what each day holds", () => {
  it("shows ZimmGo's suggestions, by time of day, before the traveller arranges anything", () => {
    const [day1] = buildTripPlan(itinerary(), prefs()).days;
    expect(day1.source).toBe("suggested");
    expect(dayLines(day1)).toEqual([{ label: "Morning", text: "Rome walk" }, { label: "Evening", text: "Sunset" }]);
  });

  it("shows only the traveller's items once they've arranged their days — an empty day is free, not backfilled", () => {
    const planned = itinerary({ finalizedPlan: { dayCards: { 1: ["act-a1", "rest-r1"], 3: ["rest-r2", "act-gone"] }, bankCards: [] } });
    const [day1, day2, day3] = buildTripPlan(planned, prefs()).days;

    expect(day1.source).toBe("traveller");
    expect(dayLines(day1)).toEqual([{ text: "Colosseum" }, { text: "Dinner: Da Enzo" }]);
    expect(dayLines(day2)).toEqual([]); // free day — no "Rome walk" suggestion
    expect(day3.items.map((i) => i.cardId)).toEqual(["rest-r2"]); // unknown card ids are dropped
  });

  it("labels a brunch spot as brunch", () => {
    const planned = itinerary({ finalizedPlan: { dayCards: { 3: ["rest-r2"] }, bankCards: [] } });
    expect(itemLabel(buildTripPlan(planned, prefs()).days[2].items[0])).toBe("Brunch: Café Brunch");
  });
});
