import { describe, it, expect } from "vitest";
import { chosenHotelForCity, hotelForDay } from "@/lib/planning/hotelChoice";
import type { GeneratedItinerary, HotelOption, TripPreferences } from "@/types/trip";

const hotel = (id: string, city: string) => ({ id, name: id, city, location: city }) as unknown as HotelOption;
// Generation puts ZiGy's recommended hotel first for each city.
const itinerary = {
  hotels: [hotel("rome-zigy", "Rome"), hotel("rome-2", "Rome"), hotel("flo-zigy", "Florence")],
} as unknown as GeneratedItinerary;
const prefs = (selectedHotelsByCity?: Record<string, HotelOption>) => ({ selectedHotelsByCity }) as TripPreferences;
const cities = ["Rome", "Florence"];

describe("chosenHotelForCity", () => {
  it("is the traveller's choice for that city when there is one", () => {
    const picked = hotel("rome-2", "Rome");
    expect(chosenHotelForCity("Rome", itinerary, prefs({ Rome: picked }), cities)).toEqual({ hotel: picked, byTraveller: true });
  });

  it("falls back to ZiGy's recommendation, marked as not the traveller's", () => {
    expect(chosenHotelForCity("Florence", itinerary, prefs({ Rome: hotel("rome-2", "Rome") }), cities))
      .toEqual({ hotel: hotel("flo-zigy", "Florence"), byTraveller: false });
  });

  it("never offers another city's hotel", () => {
    const noFlorence = { hotels: [hotel("rome-zigy", "Rome")] } as unknown as GeneratedItinerary;
    expect(chosenHotelForCity("Florence", noFlorence, prefs(), cities)).toBeNull();
  });
});

describe("hotelForDay", () => {
  it("shows each day its own city's stay on a multi-city trip", () => {
    const romePick = hotel("rome-2", "Rome");
    expect(hotelForDay({ location: "Rome" }, itinerary, prefs({ Rome: romePick }), cities)).toBe(romePick);
    expect(hotelForDay({ location: "Florence" }, itinerary, prefs({ Rome: romePick }), cities)?.id).toBe("flo-zigy");
  });

  it("puts a day without a location in the first city", () => {
    expect(hotelForDay({}, itinerary, prefs(), cities)?.id).toBe("rome-zigy");
  });
});
