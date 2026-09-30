import { describe, it, expect } from "vitest";
import { assembleLodging, lodgingFromPicks, lodgingPickCandidates, type LodgingDraft } from "@/lib/planning/lodgingPicks";

const draft = (over: Partial<LodgingDraft> = {}): LodgingDraft => ({
  types: ["hotel"], minStars: 4, amenities: ["Pool"], otherTypeOpen: false, otherTypeValue: "", amenityOpen: false, otherAmenity: "", ...over,
});
const known = { types: ["hotel", "boutique"] as const, amenities: ["Pool", "Spa"] };
const pick = (id: string) => ({ id, reason: "" });

describe("assembleLodging", () => {
  it("adds a typed-in type and amenity only while their Other… field is open", () => {
    expect(assembleLodging(draft({ otherTypeOpen: true, otherTypeValue: " yurt ", amenityOpen: true, otherAmenity: "Sauna" })))
      .toEqual({ types: ["hotel", "yurt"], minStars: 4, amenities: ["Pool", "Sauna"] });
    expect(assembleLodging(draft({ otherTypeValue: "yurt", otherAmenity: "Sauna" }))).toEqual({ types: ["hotel"], minStars: 4, amenities: ["Pool"] });
  });
});

describe("lodgingFromPicks", () => {
  it("reads types, stars and amenities from ZiGy's picks, ignoring anything unknown", () => {
    const picks = [pick("type:boutique"), pick("type:castle"), pick("stars:5"), pick("amenity:Spa"), pick("amenity:Moat")];
    expect(lodgingFromPicks(picks, { ...known, types: [...known.types] }, { types: ["hotel"], minStars: 3 }))
      .toEqual({ types: ["boutique"], minStars: 5, amenities: ["Spa"] });
  });

  it("keeps the current type and stars when ZiGy picks none", () => {
    expect(lodgingFromPicks([pick("stars:9")], { ...known, types: [...known.types] }, { types: ["hotel"], minStars: 4 }))
      .toEqual({ types: ["hotel"], minStars: 4, amenities: [] });
  });

  it("offers every type, star level and amenity as a candidate", () => {
    const ids = lodgingPickCandidates([{ id: "hotel", label: "Hotel" }], ["Pool"]).map((c) => c.id);
    expect(ids).toEqual(["type:hotel", "stars:3", "stars:4", "stars:5", "amenity:Pool"]);
  });
});
