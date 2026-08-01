// Weights restaurant picks toward a user's connected Beli account.
// PRODUCTION SWAP POINT: Beli has no public API today. When one exists (or a
// partnership is arranged), replace the mock logic below with a real OAuth
// connection plus a call to fetch the user's bookmarked/ranked restaurants,
// matched against `restaurants` by name + city. Everything downstream (types,
// UI, this function's signature) already expects an isBeliPick/beliNote pair.

import type { BeliPreference, RestaurantOption } from "@/types/trip";

const BELI_NOTES = [
  "Matches the top spot on your Beli list for this area",
  "Similar to places you've ranked highly on Beli",
  "Beli members in this city rank this among their favorites",
];

// Restaurant `location` fields are neighbourhood-level (e.g. "Trastevere, Rome"),
// so grouping by the raw string would treat every neighbourhood as its own city
// and tag nearly everything as a pick. Bucket by city instead: match against the
// trip's known destination cities where possible, else fall back to the text
// after the last comma.
function cityFor(location: string, cities?: string[]): string {
  const known = cities?.find((c) => location.toLowerCase().includes(c.toLowerCase()));
  if (known) return known;
  const parts = location.split(",");
  return parts[parts.length - 1].trim();
}

export function applyBeliPreference<T extends RestaurantOption>(
  restaurants: T[],
  pref?: BeliPreference,
  cities?: string[]
): T[] {
  if (!pref?.connected) return restaurants;

  // Mock: surface the highest-rated restaurant per city as a "Beli pick" —
  // stands in for cross-referencing the user's actual Beli rankings/bookmarks.
  const bestIdByCity = new Map<string, string>();
  const byId = new Map(restaurants.map((r) => [r.id, r]));
  for (const r of restaurants) {
    const city = cityFor(r.location ?? "", cities);
    const currentBestId = bestIdByCity.get(city);
    const currentBest = currentBestId ? byId.get(currentBestId) : undefined;
    if (!currentBest || r.rating > currentBest.rating) {
      bestIdByCity.set(city, r.id);
    }
  }

  let noteIdx = 0;
  return restaurants.map((r) => {
    if (bestIdByCity.get(cityFor(r.location ?? "", cities)) !== r.id) return r;
    return { ...r, isBeliPick: true, beliNote: BELI_NOTES[noteIdx++ % BELI_NOTES.length] };
  });
}
