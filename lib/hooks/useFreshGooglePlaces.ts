"use client";

import { useEffect, useRef } from "react";
import { useTripStore } from "@/lib/store/tripStore";
import { fetchRefreshedPlaces, type SavedGooglePlaces } from "@/lib/client/refreshPlaces";
import type { GeneratedItinerary, GooglePlaceRef, HotelOption } from "@/types/trip";

// Google's terms allow its place content to be kept for 30 days. Refresh a
// little before that, so an open trip never shows (or keeps syncing) an
// older copy.
export const REFRESH_AFTER_MS = 25 * 86_400_000;

function isStale(item: { google?: GooglePlaceRef }, now: number): boolean {
  return !!item.google && now - (Date.parse(item.google.fetchedAt) || 0) > REFRESH_AFTER_MS;
}

/**
 * The trip's Google places that are due for a refresh: the open itinerary's
 * lists, plus hotels kept outside them — each city's chosen hotel and the
 * Lodging step's pick — once each.
 */
export function staleGooglePlaces(itinerary: GeneratedItinerary | null, lodgingPick?: HotelOption, now = Date.now()): SavedGooglePlaces {
  const hotels = new Map<string, HotelOption>();
  for (const h of [...(itinerary?.hotels ?? []), ...Object.values(itinerary?.selections?.hotelsByCity ?? {}), ...(lodgingPick ? [lodgingPick] : [])]) {
    if (isStale(h, now) && !hotels.has(h.id)) hotels.set(h.id, h);
  }
  return {
    restaurants: (itinerary?.restaurants ?? []).filter((r) => isStale(r, now)),
    activities: (itinerary?.activities ?? []).filter((a) => isStale(a, now)),
    hotels: [...hotels.values()],
  };
}

/**
 * Refreshes the open trip's Google places once they're due. Tried once per
 * itinerary (or Lodging pick) per visit; if it fails (offline, Google's daily
 * allowance used up), the next visit tries again.
 */
export function useFreshGooglePlaces(itinerary: GeneratedItinerary | null, lodgingPick?: HotelOption) {
  const replaceRestaurants = useTripStore((s) => s.replaceRestaurants);
  const replaceActivities = useTripStore((s) => s.replaceActivities);
  const replaceHotels = useTripStore((s) => s.replaceHotels);
  const tried = useRef(new Set<string>());

  useEffect(() => {
    const key = itinerary?.id ?? `pick:${lodgingPick?.id ?? ""}`;
    if (tried.current.has(key)) return;
    const stale = staleGooglePlaces(itinerary, lodgingPick);
    if (!stale.restaurants.length && !stale.activities.length && !stale.hotels.length) return;
    tried.current.add(key);
    fetchRefreshedPlaces(stale)
      .then((fresh) => {
        if (itinerary && fresh.restaurants.length) replaceRestaurants(itinerary.id, fresh.restaurants);
        if (itinerary && fresh.activities.length) replaceActivities(itinerary.id, fresh.activities);
        if (fresh.hotels.length) replaceHotels(itinerary?.id ?? null, fresh.hotels);
      })
      .catch(() => {});
  }, [itinerary, lodgingPick, replaceRestaurants, replaceActivities, replaceHotels]);
}
