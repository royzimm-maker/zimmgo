// Applies the user's review-source preference to mock rating data.
// PRODUCTION SWAP POINT: replace the mock jitter below with real per-source
// API calls (Booking.com, Google Places, TripAdvisor, Expedia, Hotels.com)
// keyed off the same ReviewSourcePreference shape — everything downstream
// (types, UI, this function's signature) already expects a sourceRatings breakdown.

import { randomInt } from "@/lib/utils";
import type { ReviewSourcePreference } from "@/types/trip";

// One preference covers hotels, restaurants, and activities at once (asked for
// during the Lodging step, applied everywhere) — so sources are picked to be
// reasonable across all three rather than dining- or lodging-specific only.
export const REVIEW_SOURCES = ["Google Reviews", "TripAdvisor", "Booking.com", "Expedia", "Hotels.com"] as const;

const CROSS_REFERENCE_SOURCES = ["Google Reviews", "TripAdvisor", "Booking.com"] as const;

interface Rateable {
  rating: number;
  ratingSource?: string;
  sourceRatings?: { source: string; rating: number }[];
}

export function applyReviewSourcePref<T extends Rateable>(items: T[], pref?: ReviewSourcePreference): T[] {
  if (!pref) return items;

  if (pref.mode === "single" && pref.source) {
    return items.map((item) => ({ ...item, ratingSource: pref.source, sourceRatings: undefined }));
  }

  if (pref.mode === "cross_reference") {
    return items.map((item) => {
      // Jitter each source ±0.4 around the base mock rating, then average —
      // stands in for genuinely different scores per site until wired to real APIs.
      const breakdown = CROSS_REFERENCE_SOURCES.map((source) => ({
        source,
        rating: Math.round(Math.min(10, Math.max(0, item.rating + (randomInt(-4, 4) / 10))) * 10) / 10,
      }));
      const avg = Math.round((breakdown.reduce((s, b) => s + b.rating, 0) / breakdown.length) * 10) / 10;
      return { ...item, rating: avg, ratingSource: "Cross-referenced average", sourceRatings: breakdown };
    });
  }

  return items;
}
