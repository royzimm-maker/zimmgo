import { describe, it, expect } from "vitest";
import { REFRESH_AFTER_MS, staleGoogleRestaurants } from "@/lib/hooks/useFreshGooglePlaces";
import type { GeneratedItinerary, RestaurantOption } from "@/types/trip";

const now = Date.parse("2026-11-10T00:00:00.000Z");
const restaurant = (id: string, fetchedAt?: string) =>
  ({ id, name: id, location: "Lisbon", ...(fetchedAt ? { google: { placeId: id, mapsUri: "", fetchedAt } } : {}) }) as RestaurantOption;

describe("staleGoogleRestaurants", () => {
  it("picks only Google restaurants fetched longer ago than the refresh window", () => {
    const itinerary = {
      restaurants: [
        restaurant("old", new Date(now - REFRESH_AFTER_MS - 1).toISOString()),
        restaurant("recent", new Date(now - 86_400_000).toISOString()),
        restaurant("sample"),
      ],
    } as unknown as GeneratedItinerary;
    expect(staleGoogleRestaurants(itinerary, now).map((r) => r.id)).toEqual(["old"]);
  });

  it("refreshes well inside Google's 30-day limit", () => {
    expect(REFRESH_AFTER_MS).toBeLessThan(30 * 86_400_000);
  });

  it("handles no itinerary or no restaurants", () => {
    expect(staleGoogleRestaurants(null, now)).toEqual([]);
    expect(staleGoogleRestaurants({} as GeneratedItinerary, now)).toEqual([]);
  });
});
