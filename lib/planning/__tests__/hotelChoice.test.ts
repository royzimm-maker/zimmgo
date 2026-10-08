import { describe, it, expect } from "vitest";
import { chosenHotelForCity } from "@/lib/planning/hotelChoice";
import type { GeneratedItinerary, HotelOption } from "@/types/trip";

const hotel = (id: string, city: string) => ({ id, name: id, city, location: city }) as unknown as HotelOption;
// Generation puts ZimmGo's recommended hotel first for each city; the
// traveller's choices live on the itinerary.
const itinerary = (hotelsByCity?: Record<string, HotelOption>, hotels = [hotel("rome-zigy", "Rome"), hotel("rome-2", "Rome"), hotel("flo-zigy", "Florence")]) =>
  ({ hotels, selections: { hotelsByCity } }) as unknown as GeneratedItinerary;
const cities = ["Rome", "Florence"];

describe("chosenHotelForCity", () => {
  it("is the traveller's choice for that city when there is one", () => {
    const picked = hotel("rome-2", "Rome");
    expect(chosenHotelForCity("Rome", itinerary({ Rome: picked }), cities)).toEqual({ hotel: picked, byTraveller: true });
  });

  it("falls back to ZimmGo's recommendation, marked as not the traveller's", () => {
    expect(chosenHotelForCity("Florence", itinerary({ Rome: hotel("rome-2", "Rome") }), cities))
      .toEqual({ hotel: hotel("flo-zigy", "Florence"), byTraveller: false });
  });

  it("never offers another city's hotel", () => {
    expect(chosenHotelForCity("Florence", itinerary(undefined, [hotel("rome-zigy", "Rome")]), cities)).toBeNull();
  });
});
