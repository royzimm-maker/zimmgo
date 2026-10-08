// @vitest-environment node
import { describe, it, expect } from "vitest";
import { distanceMiles, searchFlights, typicalFlightTime, typicalOneWayFareUsd } from "@/lib/search/flights";
import { googleFlightsUrl, googleFlightsUrlForPair, pairFlights } from "@/lib/utils";
import { buildItineraryClipboardText } from "@/lib/export/itineraryClipboard";
import { toolResultForModel } from "@/lib/itinerary/runGeneration";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

const BOS = { lat: 42.3656, lng: -71.0096 };
const LIS = { lat: 38.7742, lng: -9.1342 };

describe("fare and time estimates", () => {
  it("measures the great-circle distance", () => {
    expect(Math.round(distanceMiles(BOS, LIS))).toBe(3184);
  });

  it("gives a typical fare and flying time for a distance", () => {
    expect(typicalOneWayFareUsd(3184)).toBe(350);
    expect(typicalOneWayFareUsd(1260)).toBe(180);
    expect(typicalFlightTime(3184)).toBe("~7h");
    expect(typicalFlightTime(200)).toBe("~1h");
  });
});

describe("searchFlights", () => {
  it("returns one estimated leg — no airline, flight number, times or stops", async () => {
    const [leg, ...rest] = await searchFlights({ origin: "Boston (BOS)", destination: "LIS", departure_date: "2026-11-01", return_date: "2026-11-04" });
    expect(rest).toEqual([]);
    expect(leg).toMatchObject({
      airline: "Any airline", flightNumber: "", origin: "BOS", destination: "LIS", departureTime: "2026-11-01", arrivalTime: "",
      duration: "~7h", price: 350, priceIsEstimate: true, cabinClass: "economy",
    });
    expect(leg.stops).toBeUndefined();
    expect(leg.bookingUrl).toBe(googleFlightsUrl("BOS", "LIS", "2026-11-01", "2026-11-04"));
  });

  it("scales the fare by cabin, and lowest-fare mode searches economy", async () => {
    const [business] = await searchFlights({ origin: "BOS", destination: "LIS", departure_date: "2026-11-01", cabin_class: "business" });
    expect(business.price).toBe(1580);
    const [cheapest] = await searchFlights({ origin: "BOS", destination: "LIS", departure_date: "2026-11-01", cabin_class: "business", lowest_fare_mode: true });
    expect(cheapest).toMatchObject({ price: 350, cabinClass: "economy" });
  });

  it("falls back to a typical long-haul fare when an airport's location isn't known", async () => {
    const [leg] = await searchFlights({ origin: "BOS", destination: "XYZ", departure_date: "2026-11-01" });
    expect(leg).toMatchObject({ price: 450, duration: "" });
  });

  it("gives Claude nothing to invent an airline or nonstop from", async () => {
    const forModel = toolResultForModel(await searchFlights({ origin: "BOS", destination: "LIS", departure_date: "2026-11-01" }));
    expect(forModel).toContain('"priceIsEstimate":true');
    expect(forModel).not.toContain('"stops"');
    expect(forModel).not.toContain("bookingUrl");
  });
});

describe("Google Flights links", () => {
  it("searches the route, dates and cabin", () => {
    expect(decodeURIComponent(googleFlightsUrl("BOS", "LIS", "2026-11-01", "2026-11-04", "business", true)))
      .toBe("https://www.google.com/travel/flights?q=Flights to LIS from BOS on 2026-11-01 through 2026-11-04 business class nonstop");
    expect(decodeURIComponent(googleFlightsUrl("BOS", "LIS", "2026-11-01"))).toContain("on 2026-11-01 one way");
  });

  it("covers both legs of a pair as one round trip", async () => {
    const out = (await searchFlights({ origin: "BOS", destination: "LIS", departure_date: "2026-11-01" }))[0];
    const back = (await searchFlights({ origin: "LIS", destination: "BOS", departure_date: "2026-11-04" }))[0];
    const [pair] = pairFlights([out, back], "LIS");
    expect(decodeURIComponent(googleFlightsUrlForPair(pair.outbound, pair.ret))).toContain("Flights to LIS from BOS on 2026-11-01 through 2026-11-04");
  });
});

describe("estimates are called estimates in exports", () => {
  it("copies an estimated flight without an airline, as a typical fare", async () => {
    const flights = await searchFlights({ origin: "BOS", destination: "LIS", departure_date: "2026-11-01" });
    const itinerary = { days: [], hotels: [], activities: [], restaurants: [], aiSummary: "", flights } as unknown as GeneratedItinerary;
    const text = buildItineraryClipboardText(itinerary, { destination: { cities: ["Lisbon"], displayName: "Lisbon" } } as TripPreferences, "T");
    expect(text).toContain("• BOS → LIS — about $350/pp (typical fare; search Google Flights for real fares)");
    expect(text).not.toContain("Any airline");
  });
});

describe("airport locations for the estimate", () => {
  it("prices a short hop to an airport without its own coordinates from its city's location", async () => {
    const [hop] = await searchFlights({ origin: "LIS", destination: "OPO", departure_date: "2026-11-05" });
    expect(hop.price).toBeLessThan(200); // ~170 miles, not the $450 long-haul fallback
    const [named] = await searchFlights({ origin: "Lisbon (LIS)", destination: "Porto (OPO)", departure_date: "2026-11-05" });
    expect(named.price).toBe(hop.price);
  });
});
