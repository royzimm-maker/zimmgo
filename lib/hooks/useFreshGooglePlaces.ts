"use client";

import { useEffect, useRef } from "react";
import { useTripStore } from "@/lib/store/tripStore";
import { fetchRefreshedRestaurants } from "@/lib/client/refreshPlaces";
import type { GeneratedItinerary, RestaurantOption } from "@/types/trip";

// Google's terms allow its place content to be kept for 30 days. Refresh a
// little before that, so an open trip never shows (or keeps syncing) an
// older copy.
export const REFRESH_AFTER_MS = 25 * 86_400_000;

/** The itinerary's Google restaurants that are due for a refresh. */
export function staleGoogleRestaurants(itinerary: GeneratedItinerary | null, now = Date.now()): RestaurantOption[] {
  return (itinerary?.restaurants ?? []).filter(
    (r) => r.google && now - (Date.parse(r.google.fetchedAt) || 0) > REFRESH_AFTER_MS
  );
}

/**
 * Refreshes the open itinerary's Google restaurants once they're due. Tried
 * once per itinerary per visit; if it fails (offline, Google's daily
 * allowance used up), the next visit tries again.
 */
export function useFreshGooglePlaces(itinerary: GeneratedItinerary | null) {
  const replaceRestaurants = useTripStore((s) => s.replaceRestaurants);
  const tried = useRef(new Set<string>());

  useEffect(() => {
    if (!itinerary || tried.current.has(itinerary.id)) return;
    const stale = staleGoogleRestaurants(itinerary);
    if (!stale.length) return;
    tried.current.add(itinerary.id);
    fetchRefreshedRestaurants(stale)
      .then((fresh) => { if (fresh.length) replaceRestaurants(itinerary.id, fresh); })
      .catch(() => {});
  }, [itinerary, replaceRestaurants]);
}
