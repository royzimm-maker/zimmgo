"use client";

import { useMemo } from "react";
import { useTripStore } from "@/lib/store/tripStore";
import type { GeneratedItinerary } from "@/types/trip";

// Shared between ItineraryView and ItinerarySelectionWizard — both render
// RestaurantCard/ActivityCard and need the same "already saved?" check plus
// save action.
export function useWanderlogSave(itinerary: GeneratedItinerary) {
  const { addWanderlogItem } = useTripStore();

  const wanderlogLabels = useMemo(
    () => new Set((itinerary.wanderlog ?? []).map((w) => w.label)),
    [itinerary.wanderlog]
  );

  function handleSaveToWanderlog(label: string, source: "activity" | "restaurant", location?: string, description?: string) {
    if (wanderlogLabels.has(label)) return;
    addWanderlogItem(itinerary.id, { label, source, location, description });
  }

  return { wanderlogLabels, handleSaveToWanderlog };
}
