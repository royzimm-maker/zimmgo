import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/http/errors";
import { searchFlights } from "@/lib/search/flights";
import { rateLimit } from "@/lib/rateLimit";
import { readJsonBody } from "@/lib/http/readJsonBody";
import { parseWithSchema, type JsonSchema } from "@/lib/ai/toolInput";
import type { TripPreferences } from "@/types/trip";

// Deterministic, non-AI flight search — used by the review wizard's manual
// "Search for flights" fallback when an itinerary was generated with no
// flight options (e.g. the AI's search_flights call came back empty). Mirrors
// the same outbound/return construction buildItineraryPrompt asks the AI to
// follow, just invoked directly instead of through a tool-use loop.

const ISO_DATE = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } as const;
const AIRPORT = { type: "string", maxLength: 120 } as const;

// Only the preference fields this search reads — anything else is ignored.
const BODY_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    preferences: {
      type: "object",
      properties: {
        destination: {
          type: "object",
          properties: { departureAirport: AIRPORT, arrivalAirport: AIRPORT, returnAirport: AIRPORT },
        },
        dates: {
          type: "object",
          properties: { type: { type: "string", enum: ["exact", "flexible"] }, startDate: ISO_DATE, endDate: ISO_DATE },
        },
        airlinePrefs: {
          type: "object",
          properties: {
            cabinClass: { type: "string", enum: ["economy", "premium_economy", "business", "first"] },
            airlines: { type: "array", items: { type: "string", maxLength: 60 }, maxItems: 20 },
            preferNonstop: { type: "boolean" },
            prioritizeLowestFare: { type: "boolean" },
          },
        },
      },
    },
  },
  required: ["preferences"],
};

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { bucket: "search", limit: 60, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const parsed = await readJsonBody<unknown>(request, 100_000);
    if (!parsed.ok) return parsed.response;
    const body = parseWithSchema<{ preferences: TripPreferences }>(BODY_SCHEMA, parsed.body);
    if (!body) return NextResponse.json({ error: "Trip preferences are required" }, { status: 400 });
    const { preferences } = body;
    const dest = preferences.destination;
    const dates = preferences.dates;

    if (!dest?.departureAirport || !dest?.arrivalAirport) {
      return NextResponse.json({ error: "Missing departure or arrival airport" }, { status: 400 });
    }
    if (dates?.type !== "exact" || !dates.startDate || !dates.endDate) {
      return NextResponse.json({ error: "Exact travel dates are required to search flights" }, { status: 400 });
    }

    const airlinePrefs = preferences.airlinePrefs;
    const common = {
      cabin_class: airlinePrefs?.cabinClass,
      preferred_airlines: airlinePrefs?.airlines,
      nonstop_only: airlinePrefs?.preferNonstop,
      lowest_fare_mode: airlinePrefs?.prioritizeLowestFare,
    };

    const outbound = await searchFlights({
      origin: dest.departureAirport,
      destination: dest.arrivalAirport,
      departure_date: dates.startDate,
      ...common,
    });
    const returnLeg = await searchFlights(
      dest.returnAirport
        ? { origin: dest.arrivalAirport, destination: dest.returnAirport, departure_date: dates.endDate, ...common }
        : { origin: dest.arrivalAirport, destination: dest.departureAirport, departure_date: dates.endDate, ...common }
    );

    return NextResponse.json({ flights: [...outbound, ...returnLeg] });
  } catch (error: unknown) {
    return serverError("itinerary/search-flights", error);
  }
}
