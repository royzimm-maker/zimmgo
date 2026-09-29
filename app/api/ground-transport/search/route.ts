import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api/errors";
import { searchGroundTransport } from "@/lib/api/groundTransport";
import type { TripPreferences } from "@/types/trip";

// Deterministic, non-AI ground-transport search — used by the review
// wizard's manual "Search" fallback for a leg where generation didn't
// produce any options. Mirrors app/api/itinerary/search-flights/route.ts.
export async function POST(request: NextRequest) {
  try {
    const { fromCity, toCity, date, preferences } = (await request.json()) as {
      fromCity: string;
      toCity: string;
      date: string;
      preferences: TripPreferences;
    };
    const transport = await searchGroundTransport(fromCity, toCity, date, preferences);
    return NextResponse.json({ transport });
  } catch (error: unknown) {
    return serverError("ground-transport/search", error);
  }
}
