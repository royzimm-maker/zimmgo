import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/http/errors";
import { rateLimit } from "@/lib/rateLimit";
import { readJsonBody, tooMany } from "@/lib/http/readJsonBody";
import { refreshRestaurant } from "@/lib/search/googleRestaurants";
import { refreshActivity } from "@/lib/search/googleActivities";
import { refreshHotel } from "@/lib/search/googleHotels";
import type { ActivityOption, HotelOption, RestaurantOption } from "@/types/trip";

// Google's terms allow its place content to be kept for 30 days; a saved
// trip's Google places are refreshed through here when it's opened after
// that (lib/hooks/useFreshGooglePlaces.ts). Each place is one Google call,
// inside the daily allowance in lib/search/googlePlaces.ts.
const MAX_PLACES = 30;

function isSavedGooglePlace(r: unknown): boolean {
  const x = r as { id?: unknown; location?: unknown; google?: { placeId?: unknown } } | null;
  return !!x && typeof x.id === "string" && typeof x.location === "string" && typeof x.google?.placeId === "string";
}

// An absent list is empty; anything else must be a list of saved Google places.
function listOf<T>(v: unknown): T[] | null {
  if (v === undefined) return [];
  return Array.isArray(v) && v.every(isSavedGooglePlace) ? (v as T[]) : null;
}

function found<T>(items: (T | null)[]): T[] {
  return items.filter((x): x is T => x !== null);
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { bucket: "places-refresh", limit: 10, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const parsed = await readJsonBody<{ restaurants?: unknown; activities?: unknown; hotels?: unknown }>(request, 200_000);
    if (!parsed.ok) return parsed.response;
    const restaurants = listOf<RestaurantOption>(parsed.body?.restaurants);
    const activities = listOf<ActivityOption>(parsed.body?.activities);
    const hotels = listOf<HotelOption>(parsed.body?.hotels);
    if (!restaurants || !activities || !hotels) {
      return NextResponse.json({ error: "restaurants, activities and hotels must be lists of saved Google places" }, { status: 400 });
    }
    if (restaurants.length + activities.length + hotels.length > MAX_PLACES) return tooMany("places", MAX_PLACES);

    const [freshRestaurants, freshActivities, freshHotels] = await Promise.all([
      Promise.all(restaurants.map(refreshRestaurant)),
      Promise.all(activities.map(refreshActivity)),
      Promise.all(hotels.map(refreshHotel)),
    ]);
    return NextResponse.json({ restaurants: found(freshRestaurants), activities: found(freshActivities), hotels: found(freshHotels) });
  } catch (error: unknown) {
    return serverError("places/refresh", error);
  }
}
