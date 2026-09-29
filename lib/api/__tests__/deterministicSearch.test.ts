import { describe, it, expect } from "vitest";
import { searchFlights } from "@/lib/api/flights";
import { searchHotels } from "@/lib/api/hotels";
import { searchActivities } from "@/lib/api/activities";
import { searchRestaurants } from "@/lib/api/restaurants";
import { searchGroundTransport } from "@/lib/api/groundTransport";
import { seededRandom, stableId } from "@/lib/api/mockRandom";
import type { TripPreferences } from "@/types/trip";

const prefs = { activities: [], activityRankings: {}, vibes: [], transportation: [] } as unknown as TripPreferences;

// A repeated search (retry, regenerate, re-open a step) must not mint new IDs,
// or anything the trip already selected by ID is silently orphaned.
describe("mock searches are deterministic", () => {
  it("flights: same query → same results and IDs; different date → different", async () => {
    const q = { origin: "JFK", destination: "LIS", departure_date: "2026-10-01", cabin_class: "business" };
    const a = await searchFlights(q);
    expect(await searchFlights(q)).toEqual(a);
    expect(new Set(a.map((f) => f.id)).size).toBe(a.length);
    const other = await searchFlights({ ...q, departure_date: "2026-10-02" });
    expect(other.map((f) => f.id)).not.toEqual(a.map((f) => f.id));
  });

  it("flights: lowest-fare mode is stable too", async () => {
    const q = { origin: "JFK", destination: "LIS", departure_date: "2026-10-01", lowest_fare_mode: true };
    expect(await searchFlights(q)).toEqual(await searchFlights(q));
  });

  it("hotels: same hotel keeps its ID and price across searches", async () => {
    const a = await searchHotels({ destination: "Rome" } as Parameters<typeof searchHotels>[0]);
    const b = await searchHotels({ destination: "Rome" } as Parameters<typeof searchHotels>[0]);
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
    expect(new Set(a.map((h) => h.id)).size).toBe(a.length);
  });

  it("activities and restaurants: same query → same IDs, distinct per city", async () => {
    expect(await searchActivities({ destination: "Paris" })).toEqual(await searchActivities({ destination: "Paris" }));
    const rome = await searchRestaurants({ destination: "Rome" });
    const florence = await searchRestaurants({ destination: "Florence" });
    expect(await searchRestaurants({ destination: "Rome" })).toEqual(rome);
    // Florence can share Rome's pool, but its items must not share Rome's IDs.
    const romeIds = new Set(rome.map((r) => r.id));
    expect(florence.some((r) => romeIds.has(r.id))).toBe(false);
  });

  it("ground transport: same leg and date → same options", async () => {
    const a = await searchGroundTransport("Mykonos", "Santorini", "2026-09-10", prefs);
    expect(a.length).toBe(3);
    expect(await searchGroundTransport("Mykonos", "Santorini", "2026-09-10", prefs)).toEqual(a);
  });
});

describe("mockRandom", () => {
  it("seededRandom repeats for the same seed and stays in [0, 1)", () => {
    const a = seededRandom("x", 1);
    const b = seededRandom("x", 1);
    const xs = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it("stableId ignores case and surrounding whitespace, but not content", () => {
    expect(stableId("hotel", "Hotel Artemide", "Rome")).toBe(stableId("hotel", " hotel artemide ", "ROME"));
    expect(stableId("hotel", "Hotel Artemide", "Rome")).not.toBe(stableId("hotel", "Hotel Artemide", "Florence"));
  });
});
