import { describe, it, expect } from "vitest";
import { REFRESH_AFTER_MS, staleGooglePlaces } from "@/lib/hooks/useFreshGooglePlaces";
import type { GeneratedItinerary, HotelOption } from "@/types/trip";

const now = Date.parse("2026-11-10T00:00:00.000Z");
const old = new Date(now - REFRESH_AFTER_MS - 1).toISOString();
const recent = new Date(now - 86_400_000).toISOString();
const place = (id: string, fetchedAt?: string) =>
  ({ id, name: id, location: "Lisbon", ...(fetchedAt ? { google: { placeId: id, mapsUri: "", fetchedAt } } : {}) });
const empty = { restaurants: [], activities: [], hotels: [] };

describe("staleGooglePlaces", () => {
  it("picks only Google places fetched longer ago than the refresh window", () => {
    const itinerary = {
      restaurants: [place("r-old", old), place("r-recent", recent), place("r-sample")],
      activities: [place("a-old", old), place("a-sample")],
      hotels: [place("h-old", old), place("h-recent", recent)],
    } as unknown as GeneratedItinerary;
    const stale = staleGooglePlaces(itinerary, undefined, now);
    expect(stale.restaurants.map((r) => r.id)).toEqual(["r-old"]);
    expect(stale.activities.map((a) => a.id)).toEqual(["a-old"]);
    expect(stale.hotels.map((h) => h.id)).toEqual(["h-old"]);
  });

  it("includes hotels kept outside the list — chosen per city and the Lodging pick — once each", () => {
    const itinerary = {
      hotels: [place("h-old", old)],
      selections: { hotelsByCity: { Lisbon: place("h-old", old), Porto: place("chosen-old", old) } },
    } as unknown as GeneratedItinerary;
    const pick = place("pick-old", old) as unknown as HotelOption;
    expect(staleGooglePlaces(itinerary, pick, now).hotels.map((h) => h.id)).toEqual(["h-old", "chosen-old", "pick-old"]);
  });

  it("refreshes a stale Lodging pick even before there's an itinerary", () => {
    const pick = place("pick-old", old) as unknown as HotelOption;
    expect(staleGooglePlaces(null, pick, now)).toEqual({ ...empty, hotels: [pick] });
  });

  it("refreshes well inside Google's 30-day limit", () => {
    expect(REFRESH_AFTER_MS).toBeLessThan(30 * 86_400_000);
  });

  it("handles no itinerary or empty lists", () => {
    expect(staleGooglePlaces(null, undefined, now)).toEqual(empty);
    expect(staleGooglePlaces({ activities: [], hotels: [] } as unknown as GeneratedItinerary, undefined, now)).toEqual(empty);
  });
});
