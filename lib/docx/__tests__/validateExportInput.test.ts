// @vitest-environment node
import { describe, it, expect } from "vitest";
import { invalidExport } from "@/lib/docx/validateExportInput";
import { assembleItineraryDocxModel } from "@/lib/docx/assembleItineraryDocxModel";
import { searchHotels } from "@/lib/search/hotels";
import { searchActivities } from "@/lib/search/activities";
import { searchRestaurants } from "@/lib/search/restaurants";
import { searchFlights } from "@/lib/search/flights";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

const preferences = {
  activities: [], activityRankings: {}, vibes: [], transportation: [], travelers: 2,
  destination: { cities: ["Lisbon", "Porto"], displayName: "Lisbon & Porto" },
} as unknown as TripPreferences;

// Built from the same search providers generation uses, so the check is
// tested against the shapes the app really produces.
async function realItinerary(): Promise<GeneratedItinerary> {
  const [hotels, activities, restaurants, flights] = await Promise.all([
    searchHotels({ destination: "Lisbon" }),
    searchActivities({ destination: "Lisbon" }),
    searchRestaurants({ destination: "Lisbon" }),
    searchFlights({ origin: "BOS", destination: "LIS", departure_date: "2026-10-01", return_date: "2026-10-04" }),
  ]);
  const day = (n: number, location: string) => ({
    dayNumber: n, date: `2026-10-0${n}`, theme: "Explore", location, morning: ["Walk"], afternoon: [], evening: ["Dinner"], meals: [],
  });
  return {
    id: "i1", days: [day(1, "Lisbon"), day(2, "Lisbon"), day(3, "Porto")], flights, hotels, activities, restaurants,
    aiSummary: "", whyThisWorks: "",
    selections: { hotelsByCity: { Lisbon: hotels[0] }, activityIds: [activities[0].id], restaurantIds: [] },
    finalizedPlan: { dayCards: { 1: [`act-${activities[0].id}`] }, bankCards: [] },
  } as unknown as GeneratedItinerary;
}

describe("invalidExport", () => {
  it("accepts an itinerary shaped like the app's own — and the layout can build it", async () => {
    const itinerary = await realItinerary();
    expect(invalidExport(itinerary, preferences)).toBeNull();
    expect(() => assembleItineraryDocxModel(itinerary, preferences)).not.toThrow();
  });

  it("names the field when a day's contents are the wrong type", async () => {
    const itinerary = await realItinerary();
    expect(invalidExport({ ...itinerary, days: [{ dayNumber: "x", location: 5 }] }, preferences)).toBe("itinerary.days[0].dayNumber is missing or the wrong type");
    expect(invalidExport({ ...itinerary, days: [{ dayNumber: 1, location: 5 }] }, preferences)).toBe("itinerary.days[0].location is missing or the wrong type");
    expect(invalidExport({ ...itinerary, days: [{ dayNumber: 1, morning: "Walk" }] }, preferences)).toBe("itinerary.days[0].morning is missing or the wrong type");
  });

  it("rejects wrongly-shaped hotels, choices, arrangements and destinations", async () => {
    const itinerary = await realItinerary();
    expect(invalidExport({ ...itinerary, hotels: [{ ...itinerary.hotels[0], highlights: "pool" }] }, preferences)).toMatch(/hotels\[0\]\.highlights/);
    expect(invalidExport({ ...itinerary, selections: { hotelsByCity: { Lisbon: { name: 3 } } } }, preferences)).toMatch(/hotelsByCity/);
    expect(invalidExport({ ...itinerary, finalizedPlan: { dayCards: { 1: "act-1" } } }, preferences)).toMatch(/finalizedPlan/);
    expect(invalidExport(itinerary, { ...preferences, destination: 7 })).toMatch(/destination/);
    expect(invalidExport(itinerary, { ...preferences, travelers: "two" })).toMatch(/travelers/);
  });

  it("allows optional fields to be absent or null", async () => {
    const itinerary = await realItinerary();
    const bare: Record<string, unknown> = { ...itinerary };
    for (const key of ["selections", "finalizedPlan", "restaurants"]) delete bare[key];
    expect(invalidExport({ ...bare, days: [{ dayNumber: 1, notes: null }] }, { destination: undefined })).toBeNull();
  });
});
