"use client";

import { useState } from "react";

// Shared by ItinerarySelectionWizard's restaurant and activity stages — both
// cap a per-city list to a preview count with a "show more" reveal, keyed by
// city so expanding one city doesn't expand the others.
export function useExpandablePreview<T>(itemsForCity: T[], previewCount: number, cityKey: string) {
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const expanded = expandedCities.has(cityKey);
  const visible = expanded ? itemsForCity : itemsForCity.slice(0, previewCount);
  const hasMore = itemsForCity.length > previewCount;

  function expand() {
    setExpandedCities((prev) => new Set(prev).add(cityKey));
  }

  return { visible, hasMore, expanded, expand };
}
