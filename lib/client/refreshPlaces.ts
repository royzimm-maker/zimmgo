import type { ActivityOption, RestaurantOption } from "@/types/trip";

export interface SavedGooglePlaces {
  restaurants: RestaurantOption[];
  activities: ActivityOption[];
}

/** Google's current details for saved Google places (app/api/places/refresh). Throws on failure. */
export async function fetchRefreshedPlaces(places: SavedGooglePlaces): Promise<SavedGooglePlaces> {
  const res = await fetch("/api/places/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(places),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't refresh places");
  const data = await res.json();
  return { restaurants: data.restaurants ?? [], activities: data.activities ?? [] };
}
