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
    // ZiGy's recommendation is listed first for each city.
    hotels: [hotel("lis-zigy", "Lisbon", 200), hotel("lis-lux", "Lisbon", 800), hotel("opo-zigy", "Porto", 100)],
    activities: [{ id: "a1", name: "Tram", location: "Lisbon", price: 30 }, { id: "a2", name: "Cruise", location: "Porto", price: 70 }],
    ...over,
  } as unknown as GeneratedItinerary;
}
const prefs = { destination: { cities: ["Lisbon", "Porto"], displayName: "Portugal", arrivalAirport: "LIS" }, travelers: 1 } as unknown as TripPreferences;
const line = (it: GeneratedItinerary, id: string) => estimateTripBudget(it, prefs).lines.find((l) => l.id === id)!;

describe("estimateTripBudget — prices the traveller's picks", () => {
  it("before any choices: ZiGy's first flight pair and hotels, and every suggested activity", () => {
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
