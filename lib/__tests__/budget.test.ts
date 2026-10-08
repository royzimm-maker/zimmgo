import { describe, it, expect } from "vitest";
import { estimateTripBudget } from "@/lib/budget";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

const flight = (id: string, origin: string, destination: string, price: number, cabinClass = "economy") =>
  ({ id, airline: "TAP", origin, destination, price, cabinClass });
const hotel = (id: string, city: string, pricePerNight: number) => ({ id, name: id, city, location: city, pricePerNight });
const day = (n: number, location: string) => ({ dayNumber: n, location, morning: [], afternoon: [], evening: [], meals: [] });

// 3 days: Lisbon, Lisbon, Porto → 2 nights, both in Lisbon.
function itinerary(over: Partial<GeneratedItinerary> = {}): GeneratedItinerary {
  return {
    days: [day(1, "Lisbon"), day(2, "Lisbon"), day(3, "Porto")],
    flights: [
      flight("out-cheap", "JFK", "LIS", 400), flight("out-pricey", "JFK", "LIS", 900),
      flight("ret-cheap", "OPO", "JFK", 300),
    ],
    // ZimmGo's recommendation is listed first for each city.
    hotels: [hotel("lis-zigy", "Lisbon", 200), hotel("lis-lux", "Lisbon", 800), hotel("opo-zigy", "Porto", 100)],
    activities: [{ id: "a1", name: "Tram", location: "Lisbon", price: 30 }, { id: "a2", name: "Cruise", location: "Porto", price: 70 }],
    ...over,
  } as unknown as GeneratedItinerary;
}
const prefs = { destination: { cities: ["Lisbon", "Porto"], displayName: "Portugal", arrivalAirport: "LIS" }, travelers: 1 } as unknown as TripPreferences;
const line = (it: GeneratedItinerary, id: string) => estimateTripBudget(it, prefs).lines.find((l) => l.id === id)!;

describe("estimateTripBudget — prices the traveller's picks", () => {
  it("before any choices: ZimmGo's first flight pair and hotels, and every suggested activity", () => {
    const it0 = itinerary();
    expect(line(it0, "flights").amount).toBe(400 + 300);
    expect(line(it0, "hotels").amount).toBe(2 * 200);
    expect(line(it0, "activities").amount).toBe(100);
    expect(line(it0, "activities").note).toBe("2 suggested experiences");
  });

  it("follows the chosen flight, the chosen hotel, and only the picked activities", () => {
    const chosen = itinerary({
      selections: { flight: flight("out-pricey", "JFK", "LIS", 900), hotelsByCity: { Lisbon: hotel("lis-lux", "Lisbon", 800) }, activityIds: ["a2"] },
    } as never);
    expect(line(chosen, "flights").amount).toBe(900 + 300);
    expect(line(chosen, "hotels").amount).toBe(2 * 800);
    expect(line(chosen, "activities").amount).toBe(70);
    expect(line(chosen, "activities").note).toBe("1 experience");
  });

  it("once days are arranged, prices only the activities placed on them", () => {
    const arranged = itinerary({ finalizedPlan: { dayCards: { 1: ["act-a1"] }, bankCards: [] } } as never);
    expect(line(arranged, "activities").amount).toBe(30);
  });

  it("prices each night at its own city's stay", () => {
    const twoCities = itinerary({ days: [day(1, "Lisbon"), day(2, "Porto"), day(3, "Porto")] } as never);
    expect(line(twoCities, "hotels").amount).toBe(200 + 100);
  });
});

describe("estimateTripBudget — estimated entry fees", () => {
  it("says so in the activities line when any price is an estimate", () => {
    const withEstimate = itinerary({ activities: [{ id: "a1", name: "Museum", location: "Lisbon", price: 20, priceIsEstimate: true }] } as never);
    expect(line(withEstimate, "activities").note).toContain("some entry fees estimated");
    expect(line(itinerary(), "activities").note).not.toContain("estimated");
  });
});

describe("estimateTripBudget — estimated hotel rates", () => {
  it("says so in the hotels line when a stay's rate is an estimate", () => {
    const estimated = itinerary({ hotels: [{ ...hotel("lis-zigy", "Lisbon", 220), priceIsEstimate: true }, hotel("opo-zigy", "Porto", 100)] } as never);
    expect(line(estimated, "hotels").note).toContain("estimated rates");
    expect(line(itinerary(), "hotels").note).not.toContain("estimated");
  });
});

describe("estimateTripBudget — estimated fares", () => {
  it("calls an estimated fare a typical fare in the flights line", () => {
    const estimated = itinerary({ flights: [{ ...flight("out-cheap", "JFK", "LIS", 400), priceIsEstimate: true }, flight("ret-cheap", "OPO", "JFK", 300)] } as never);
    expect(line(estimated, "flights").note).toContain("typical fare");
    expect(line(itinerary(), "flights").note).not.toContain("typical");
  });
});

describe("estimateTripBudget — lodging already arranged", () => {
  it("doesn't price nights where the traveller has their own place", () => {
    const twoCities = itinerary({ days: [day(1, "Lisbon"), day(2, "Porto"), day(3, "Porto")] } as never);
    const withVilla = {
      ...prefs,
      stops: [{ city: "Lisbon", nights: 1 }, { city: "Porto", nights: 2, lodgingArranged: true }],
    } as unknown as TripPreferences;
    const hotels = estimateTripBudget(twoCities, withVilla).lines.find((l) => l.id === "hotels")!;
    expect(hotels.amount).toBe(200);
    expect(hotels.note).toContain("not counting your own lodging");
  });
});
