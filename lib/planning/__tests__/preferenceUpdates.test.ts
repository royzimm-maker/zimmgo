import { describe, it, expect } from "vitest";
import { applyPreferenceUpdate } from "@/lib/planning/preferenceUpdates";
import type { TripPreferences } from "@/types/trip";

const prefs = (over: Partial<TripPreferences> = {}) =>
  ({ activities: ["hiking"], activityRankings: {}, vibes: ["romantic"], transportation: [], ...over }) as TripPreferences;

describe("applyPreferenceUpdate", () => {
  it("replaces activity and vibe lists — free-text entries included", () => {
    expect(applyPreferenceUpdate(prefs(), { kind: "activities", activities: ["food", "Surfing"] })).toEqual({ activities: ["food", "Surfing"] });
    expect(applyPreferenceUpdate(prefs(), { kind: "vibes", vibes: ["beaches", "Pet-friendly"] })).toEqual({ vibes: ["beaches", "Pet-friendly"] });
  });

  it("changes only the lodging fields the update names, and adds an extra amenity once", () => {
    const before = prefs({ lodging: { types: ["hotel"], minStars: 5, amenities: ["pool"] } });
    expect(applyPreferenceUpdate(before, { kind: "lodging", types: ["boutique"], otherAmenity: "rooftop bar" }))
      .toEqual({ lodging: { types: ["boutique"], minStars: 5, amenities: ["pool", "rooftop bar"] } });
    expect(applyPreferenceUpdate(before, { kind: "lodging", otherAmenity: "pool" }).lodging?.amenities).toEqual(["pool"]);
  });

  it("starts lodging from sensible defaults when there's none yet", () => {
    expect(applyPreferenceUpdate(prefs(), { kind: "lodging", minStars: 3 })).toEqual({ lodging: { types: [], minStars: 3, amenities: [] } });
  });

  it("keeps unnamed airline fields and uses the first cabin class as the main one", () => {
    const before = prefs({ airlinePrefs: { airlines: ["Lufthansa"], alliances: [], preferNonstop: false, cabinClass: "economy" } });
    expect(applyPreferenceUpdate(before, { kind: "airlines", cabinClasses: ["business", "first"] })).toEqual({
      airlinePrefs: { airlines: ["Lufthansa"], alliances: [], preferNonstop: false, cabinClass: "business", cabinClasses: ["business", "first"], prioritizeLowestFare: false },
    });
  });

  it("clears airline, alliance and cabin choices when the traveller wants the lowest fares", () => {
    const before = prefs({ airlinePrefs: { airlines: ["Lufthansa"], alliances: ["star_alliance"], preferNonstop: true, cabinClass: "business" } });
    expect(applyPreferenceUpdate(before, { kind: "airlines", prioritizeLowestFare: true, airlines: ["Delta Air Lines"] })).toEqual({
      airlinePrefs: { airlines: [], alliances: [], preferNonstop: false, cabinClass: "economy", cabinClasses: [], prioritizeLowestFare: true },
    });
  });
});
