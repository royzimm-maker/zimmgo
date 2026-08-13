import { NextRequest, NextResponse } from "next/server";
import { searchFlights } from "@/lib/api/flights";
import type { TripPreferences } from "@/types/trip";

// Deterministic, non-AI flight search — used by the review wizard's manual
// "Search for flights" fallback when an itinerary was generated with no
// flight options (e.g. the AI's search_flights call came back empty). Mirrors
// the same outbound/return construction buildItineraryPrompt asks the AI to
// follow, just invoked directly instead of through a tool-use loop.
export async function POST(request: NextRequest) {
  try {
    const { preferences } = (await request.json()) as { preferences: TripPreferences };
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
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
