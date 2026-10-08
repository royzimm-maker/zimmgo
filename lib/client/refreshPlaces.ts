import type { RestaurantOption } from "@/types/trip";

/** Google's current details for saved Google restaurants (app/api/places/refresh). Throws on failure. */
export async function fetchRefreshedRestaurants(restaurants: RestaurantOption[]): Promise<RestaurantOption[]> {
  const res = await fetch("/api/places/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurants }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't refresh places");
  return (await res.json()).restaurants as RestaurantOption[];
}
