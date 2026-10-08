"use client";

import { useEffect, useRef } from "react";
import { useTripStore } from "@/lib/store/tripStore";
import { fetchRefreshedPlaces, type SavedGooglePlaces } from "@/lib/client/refreshPlaces";
import type { GeneratedItinerary, GooglePlaceRef } from "@/types/trip";

// Google's terms allow its place content to be kept for 30 days. Refresh a
// little before that, so an open trip never shows (or keeps syncing) an
// older copy.
export const REFRESH_AFTER_MS = 25 * 86_400_000;

function isStale(item: { google?: GooglePlaceRef }, now: number): boolean {
  return !!item.google && now - (Date.parse(item.google.fetchedAt) || 0) > REFRESH_AFTER_MS;
}

/** The itinerary's Google places that are due for a refresh. */
export function staleGooglePlaces(itinerary: GeneratedItinerary | null, now = Date.now()): SavedGooglePlaces {
  return {
    restaurants: (itinerary?.restaurants ?? []).filter((r) => isStale(r, now)),
    activities: (itinerary?.activities ?? []).filter((a) => isStale(a, now)),
  };
}

/**
 * Refreshes the open itinerary's Google places once they're due. Tried once
 * per itinerary per visit; if it fails (offline, Google's daily allowance
 * used up), the next visit tries again.
 */
export function useFreshGooglePlaces(itinerary: GeneratedItinerary | null) {
  const replaceRestaurants = useTripStore((s) => s.replaceRestaurants);
  const replaceActivities = useTripStore((s) => s.replaceActivities);
  const tried = useRef(new Set<string>());

  useEffect(() => {
    if (!itinerary || tried.current.has(itinerary.id)) return;
    const stale = staleGooglePlaces(itinerary);
    if (!stale.restaurants.length && !stale.activities.length) return;
    tried.current.add(itinerary.id);
    fetchRefreshedPlaces(stale)
      .then((fresh) => {
        if (fresh.restaurants.length) replaceRestaurants(itinerary.id, fresh.restaurants);
        if (fresh.activities.length) replaceActivities(itinerary.id, fresh.activities);
      })
      .catch(() => {});
  }, [itinerary, replaceRestaurants, replaceActivities]);
}
