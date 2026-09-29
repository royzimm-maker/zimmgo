import { describe, it, expect } from "vitest";
import { hotelForDay } from "@/components/planning/ItineraryView";
import type { GeneratedItinerary, HotelOption, ItineraryDay, TripPreferences } from "@/types/trip";

const hotel = (id: string, city: string) => ({ id, name: id, city, location: city }) as unknown as HotelOption;
const day = (location?: string) => ({ dayNumber: 1, location }) as unknown as ItineraryDay;
const itinerary = { hotels: [hotel("h-rome", "Rome"), hotel("h-flo", "Florence")] } as unknown as GeneratedItinerary;
const prefs = (p: Partial<TripPreferences> = {}) => p as TripPreferences;
const cities = ["Rome", "Florence"];

describe("hotelForDay", () => {
  it("uses the traveller's pick for that day's city", () => {
    const picked = hotel("h-flo-pick", "Florence");
    expect(hotelForDay(day("Florence"), itinerary, prefs({ selectedHotelsByCity: { Florence: picked } }), cities)).toBe(picked);
  });

  it("doesn't label a multi-city trip's days with another city's hotel", () => {
    // The old lookup put a Rome pick on every day of the trip.
    const romePick = hotel("h-rome-pick", "Rome");
    expect(hotelForDay(day("Florence"), itinerary, prefs({ selectedHotel: romePick }), cities)?.id).toBe("h-flo");
    expect(hotelForDay(day("Rome"), itinerary, prefs({ selectedHotel: romePick }), cities)).toBe(romePick);
  });

  it("uses the trip-wide pick on a single-city trip", () => {
    const pick = hotel("h-pick", "Rome center");
    expect(hotelForDay(day("Rome"), itinerary, prefs({ selectedHotel: pick }), ["Rome"])).toBe(pick);
  });

  it("falls back to the first hotel only for a day with no city", () => {
    expect(hotelForDay(day(undefined), itinerary, prefs(), cities)?.id).toBe("h-rome");
    expect(hotelForDay(day("Florence"), { hotels: [hotel("h-rome", "Rome")] } as unknown as GeneratedItinerary, prefs(), cities))
      .toBeUndefined();
  });
});
