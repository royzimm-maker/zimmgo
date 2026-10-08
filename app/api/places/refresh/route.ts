import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/http/errors";
import { rateLimit } from "@/lib/rateLimit";
import { readJsonBody, tooMany } from "@/lib/http/readJsonBody";
import { refreshRestaurant } from "@/lib/search/googleRestaurants";
import type { RestaurantOption } from "@/types/trip";

// Google's terms allow its place content to be kept for 30 days; a saved
// trip's Google restaurants are refreshed through here when it's opened
// after that (lib/hooks/useFreshGooglePlaces.ts). Each place is one Google
// call, inside the daily allowance in lib/search/googlePlaces.ts.
const MAX_PLACES = 30;

const isSavedGooglePlace = (r: unknown): r is RestaurantOption => {
  const x = r as Partial<RestaurantOption> | null;
  return !!x && typeof x.id === "string" && typeof x.location === "string" && typeof x.google?.placeId === "string";
};

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { bucket: "places-refresh", limit: 10, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const parsed = await readJsonBody<{ restaurants?: unknown }>(request, 200_000);
    if (!parsed.ok) return parsed.response;
    const list = parsed.body?.restaurants;
    if (!Array.isArray(list) || !list.every(isSavedGooglePlace)) {
      return NextResponse.json({ error: "restaurants must be a list of saved Google places" }, { status: 400 });
    }
    if (list.length > MAX_PLACES) return tooMany("restaurants", MAX_PLACES);

    const refreshed = await Promise.all(list.map(refreshRestaurant));
    return NextResponse.json({ restaurants: refreshed.filter((r): r is RestaurantOption => r !== null) });
  } catch (error: unknown) {
    return serverError("places/refresh", error);
  }
}
