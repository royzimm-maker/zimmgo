// A preference change ZimmGo applies from chat (the update_*_preferences
// tools), and the rules for folding it into the saved preferences. Shared by
// the chat route, which produces updates, and the store, which applies them —
// so the chat panel only has to show what changed.
import type { AirlineAlliance, AirlinePreference, LodgingType, TripPreferences } from "@/types/trip";

export interface LodgingUpdate {
  kind: "lodging";
  types?: LodgingType[];
  minStars?: 3 | 4 | 5;
  amenities?: string[];
  otherAmenity?: string;
}
export interface ActivitiesUpdate {
  kind: "activities";
  activities: string[];
}
export interface VibesUpdate {
  kind: "vibes";
  vibes: string[];
}
export interface AirlinesUpdate {
  kind: "airlines";
  airlines?: string[];
  alliances?: AirlineAlliance[];
  preferNonstop?: boolean;
  cabinClasses?: string[];
  prioritizeLowestFare?: boolean;
}
export type PreferenceUpdate = LodgingUpdate | ActivitiesUpdate | VibesUpdate | AirlinesUpdate;

/**
 * The preference fields an update changes. Lists (activities, vibes, and the
 * lodging/airline lists) replace what was there — the model has the current
 * values in context and is told to carry forward anything it isn't changing.
 * Fields the update leaves out keep their current value.
 */
export function applyPreferenceUpdate(preferences: TripPreferences, update: PreferenceUpdate): Partial<TripPreferences> {
  switch (update.kind) {
    case "activities":
      return { activities: update.activities };
    case "vibes":
      return { vibes: update.vibes };
    case "lodging": {
      const existing = preferences.lodging;
      const amenities = update.amenities ?? existing?.amenities ?? [];
      return {
        lodging: {
          types: update.types ?? existing?.types ?? [],
          minStars: update.minStars ?? existing?.minStars ?? 4,
          amenities: update.otherAmenity && !amenities.includes(update.otherAmenity) ? [...amenities, update.otherAmenity] : amenities,
        },
      };
    }
    case "airlines": {
      const existing = preferences.airlinePrefs;
      // Lowest fare overrides every airline/alliance/cabin choice.
      if (update.prioritizeLowestFare ?? existing?.prioritizeLowestFare ?? false) {
        return { airlinePrefs: { airlines: [], alliances: [], preferNonstop: false, cabinClass: "economy", cabinClasses: [], prioritizeLowestFare: true } };
      }
      const cabinClasses = update.cabinClasses ?? existing?.cabinClasses ?? [];
      return {
        airlinePrefs: {
          airlines: update.airlines ?? existing?.airlines ?? [],
          alliances: update.alliances ?? existing?.alliances ?? [],
          preferNonstop: update.preferNonstop ?? existing?.preferNonstop ?? true,
          cabinClass: (cabinClasses[0] ?? "economy") as AirlinePreference["cabinClass"],
          cabinClasses,
          prioritizeLowestFare: false,
        },
      };
    }
  }
}
