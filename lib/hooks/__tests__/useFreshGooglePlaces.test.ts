import { describe, it, expect } from "vitest";
import { REFRESH_AFTER_MS, staleGooglePlaces } from "@/lib/hooks/useFreshGooglePlaces";
import type { GeneratedItinerary } from "@/types/trip";

const now = Date.parse("2026-11-10T00:00:00.000Z");
const old = new Date(now - REFRESH_AFTER_MS - 1).toISOString();
const recent = new Date(now - 86_400_000).toISOString();
const place = (id: string, fetchedAt?: string) =>
  ({ id, name: id, location: "Lisbon", ...(fetchedAt ? { google: { placeId: id, mapsUri: "", fetchedAt } } : {}) });

describe("staleGooglePlaces", () => {
  it("picks only Google restaurants and activities fetched longer ago than the refresh window", () => {
    const itinerary = {
      restaurants: [place("r-old", old), place("r-recent", recent), place("r-sample")],
      activities: [place("a-old", old), place("a-sample")],
    } as unknown as GeneratedItinerary;
    const stale = staleGooglePlaces(itinerary, now);
    expect(stale.restaurants.map((r) => r.id)).toEqual(["r-old"]);
    expect(stale.activities.map((a) => a.id)).toEqual(["a-old"]);
  });

  it("refreshes well inside Google's 30-day limit", () => {
    expect(REFRESH_AFTER_MS).toBeLessThan(30 * 86_400_000);
  });

  it("handles no itinerary or empty lists", () => {
    expect(staleGooglePlaces(null, now)).toEqual({ restaurants: [], activities: [] });
    expect(staleGooglePlaces({ activities: [] } as unknown as GeneratedItinerary, now)).toEqual({ restaurants: [], activities: [] });
  });
});
