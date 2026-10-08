import { describe, it, expect } from "vitest";
import { applyReviewSourcePref } from "@/lib/data/reviewSources";
import { applyBeliPreference } from "@/lib/data/beli";
import type { RestaurantOption } from "@/types/trip";

const sample = { id: "s", name: "Sample", location: "Lisbon", rating: 9, ratingSource: "Google Reviews" } as RestaurantOption;
const real = { ...sample, id: "g", name: "Real", rating: 9.6, google: { placeId: "g", mapsUri: "", fetchedAt: "" } } as RestaurantOption;

// Both features stand in for integrations ZimmGo doesn't have. On sample data
// that's fine; on a real place it would be a false claim about a real business.
describe("real places are never given invented ratings or Beli claims", () => {
  it("keeps a real place's actual rating and source, whatever the review-source preference", () => {
    const [s1, r1] = applyReviewSourcePref([sample, real], { mode: "single", source: "TripAdvisor" });
    expect(s1.ratingSource).toBe("TripAdvisor");
    expect(r1).toBe(real);
    const [, r2] = applyReviewSourcePref([sample, real], { mode: "cross_reference" });
    expect(r2).toBe(real);
  });

  it("never marks a real place as a Beli pick, and keeps the list's order", () => {
    const result = applyBeliPreference([real, sample], { connected: true } as never, ["Lisbon"]);
    expect(result.map((r) => r.id)).toEqual(["g", "s"]);
    expect(result[0].isBeliPick).toBeUndefined();
    expect(result[1].isBeliPick).toBe(true);
  });
});
