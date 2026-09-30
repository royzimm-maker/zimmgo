import { describe, it, expect } from "vitest";
import { carryOverSelections } from "@/lib/planning/selections";
import type { Destination, GeneratedItinerary, HotelOption, ItinerarySelections } from "@/types/trip";

const hotel = (id: string, city: string) => ({ id, name: id, city, location: city }) as unknown as HotelOption;
const destination = { cities: ["Rome", "Florence"], displayName: "Italy" } as Destination;
const next = (cities: string[] = ["Rome", "Florence"]) =>
  ({
    days: cities.map((location, i) => ({ dayNumber: i + 1, location })),
    activities: [{ id: "a1" }, { id: "a2" }],
    restaurants: [{ id: "r1" }],
    flights: [{ id: "f1" }],
    groundTransport: [{ id: "t1" }],
  }) as unknown as GeneratedItinerary;

describe("carryOverSelections", () => {
  it("keeps choices that still apply to the new itinerary and drops the rest", () => {
    const previous: ItinerarySelections = {
      hotelsByCity: { Rome: hotel("h1", "Rome"), Venice: hotel("h2", "Venice") },
      activityIds: ["a1", "gone"],
      restaurantIds: ["r1", "gone"],
      flight: { id: "f-gone" } as unknown as ItinerarySelections["flight"],
      transportByLeg: { Rome: { id: "t1" }, Florence: { id: "t-gone" } } as unknown as ItinerarySelections["transportByLeg"],
    };
    expect(carryOverSelections(previous, undefined, next(), destination)).toEqual({
      hotelsByCity: { Rome: hotel("h1", "Rome") },
      activityIds: ["a1"],
      restaurantIds: ["r1"],
      transportByLeg: { Rome: { id: "t1" } },
    });
  });

  it("keeps a flight that's still among the options", () => {
    const flight = { id: "f1" } as unknown as ItinerarySelections["flight"];
    expect(carryOverSelections({ flight }, undefined, next(), destination).flight).toBe(flight);
  });

  it("uses the Lodging step's pick for its city when nothing's chosen there", () => {
    const pick = hotel("lodging", "Florence");
    expect(carryOverSelections(undefined, pick, next(), destination).hotelsByCity).toEqual({ Florence: pick });
  });

  it("never lets the Lodging pick override a choice made on the itinerary", () => {
    const chosen = hotel("chosen", "Rome");
    const s = carryOverSelections({ hotelsByCity: { Rome: chosen } }, hotel("lodging", "Rome"), next(), destination);
    expect(s.hotelsByCity).toEqual({ Rome: chosen });
  });

  it("starts empty when there's nothing to carry over", () => {
    expect(carryOverSelections(undefined, undefined, next(), destination)).toEqual({});
  });
});
