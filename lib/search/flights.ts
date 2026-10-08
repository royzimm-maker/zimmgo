// Flights. No free, usable source of live fares exists for an app like this
// (Amadeus closed its self-service API in July 2026; Kiwi is invite-only), and
// made-up airlines, times and fares would be invented claims. So a flight
// search returns one honest estimate per leg instead: the route and date, a
// typical fare from the great-circle distance and cabin (priceIsEstimate),
// a typical flying time, and a link that opens Google Flights for the real
// options. No airline, flight number, departure time or stops are given.

import type { FlightOption } from "@/types/trip";
import { stableId } from "@/lib/search/mockRandom";
import { lookupAirport, lookupCity, type LatLng } from "@/lib/data/coordinates";
import { DEPARTURE_AIRPORTS, ROUTING_DB } from "@/lib/data/airportRouting";
import { extractIataCode, googleFlightsUrl } from "@/lib/utils";

interface FlightSearchParams {
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  cabin_class?: string;
  preferred_airlines?: string[];
  nonstop_only?: boolean;
  lowest_fare_mode?: boolean;
}

// Typical fare relative to economy.
const CABIN_MULTIPLIER: Record<string, number> = { economy: 1, premium_economy: 2.2, business: 4.5, first: 8 };
// When an airport's location isn't known: a typical long-haul economy fare, one way.
const UNKNOWN_ROUTE_ONE_WAY_USD = 450;

/**
 * Where an airport is: its own coordinates, else its city's — named in the
 * request ("Porto (OPO)") or in the app's airport lists — so a short hop
 * isn't priced as long-haul just because the airport isn't in the table.
 */
export function airportLocation(code: string, label = ""): LatLng | null {
  const own = lookupAirport(code);
  if (own) return own;
  const named = label.replace(/\s*\(.*\)\s*$/, "").trim();
  const listed = DEPARTURE_AIRPORTS.find((a) => a.code === code)?.city
    ?? ROUTING_DB.flatMap((r) => r.arrivalAirports).find((a) => a.code === code)?.city;
  for (const city of [named, listed]) {
    if (city && city.toUpperCase() !== code) {
      const at = lookupCity(city);
      if (at) return at;
    }
  }
  return null;
}

/** Great-circle distance in miles. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/** A typical one-way economy fare for a distance: a base plus a per-mile rate, rounded to $10. */
export function typicalOneWayFareUsd(miles: number): number {
  return Math.round((75 + 0.085 * miles) / 10) * 10;
}

/** Typical flying time for a distance, e.g. "~7h" (cruise plus taxi and climb; connections not included). */
export function typicalFlightTime(miles: number): string {
  return `~${Math.max(1, Math.round(miles / 500 + 0.5))}h`;
}

export async function searchFlights(params: FlightSearchParams): Promise<FlightOption[]> {
  // Guard against malformed tool calls from the AI (missing required params)
  if (!params.origin || !params.destination || !params.departure_date) return [];

  const origin = extractIataCode(params.origin);
  const destination = extractIataCode(params.destination);
  const cabin = params.lowest_fare_mode ? "economy" : (params.cabin_class && params.cabin_class in CABIN_MULTIPLIER ? params.cabin_class : "economy");
  const from = airportLocation(origin, params.origin);
  const to = airportLocation(destination, params.destination);
  const miles = from && to ? distanceMiles(from, to) : null;
  const oneWayEconomy = miles !== null ? typicalOneWayFareUsd(miles) : UNKNOWN_ROUTE_ONE_WAY_USD;

  return [{
    id: stableId("flight-estimate", origin, destination, params.departure_date, cabin),
    airline: "Any airline",
    flightNumber: "",
    origin,
    destination,
    departureTime: params.departure_date,
    arrivalTime: "",
    duration: miles !== null ? typicalFlightTime(miles) : "",
    price: Math.round((oneWayEconomy * CABIN_MULTIPLIER[cabin]) / 10) * 10,
    currency: "USD",
    cabinClass: cabin,
    priceIsEstimate: true,
    // One search is one leg; the link covers the whole trip when the return date is known.
    bookingUrl: googleFlightsUrl(origin, destination, params.departure_date, params.return_date, cabin, params.nonstop_only),
  }];
}
