// The Lodging step's rules, apart from its UI: how the form's draft becomes a
// saved LodgingPreference, and how "Let ZiGy choose" turns ZiGy's picks
// into lodging types, a star minimum and amenities.
import type { SmartPick } from "@/types/smartPick";
import type { LodgingPreference, LodgingStarRating, LodgingType } from "@/types/trip";

/** The form as the traveller has it, including the free-text "Other…" fields. */
export interface LodgingDraft {
  types: LodgingType[];
  minStars: LodgingStarRating;
  amenities: string[];
  otherTypeOpen: boolean;
  otherTypeValue: string;
  amenityOpen: boolean;
  otherAmenity: string;
}

/** The preference the draft saves as: a typed-in "Other…" type or amenity joins its list. */
export function assembleLodging(d: LodgingDraft): LodgingPreference {
  return {
    types: d.otherTypeOpen && d.otherTypeValue.trim() ? [...d.types, d.otherTypeValue.trim() as LodgingType] : d.types,
    minStars: d.minStars,
    amenities: d.amenityOpen && d.otherAmenity.trim() ? [...d.amenities, d.otherAmenity.trim()] : d.amenities,
  };
}

const STAR_OPTIONS: LodgingStarRating[] = [3, 4, 5];

/** Everything ZiGy may choose from, as smart-pick candidates. */
export function lodgingPickCandidates(types: { id: LodgingType; label: string }[], amenities: string[]) {
  return [
    ...types.map((t) => ({ id: `type:${t.id}`, label: `Lodging type: ${t.label}` })),
    ...STAR_OPTIONS.map((s) => ({ id: `stars:${s}`, label: `${s}-star minimum` })),
    ...amenities.map((a) => ({ id: `amenity:${a}`, label: `Amenity: ${a}` })),
  ];
}

/**
 * The lodging ZiGy's picks describe. Only known types and amenities count;
 * with no type or star pick, the current ones stay. Amenities are replaced
 * by ZiGy's (possibly empty) list.
 */
export function lodgingFromPicks(
  picks: SmartPick[],
  known: { types: LodgingType[]; amenities: string[] },
  current: { types: LodgingType[]; minStars: LodgingStarRating }
): Pick<LodgingPreference, "types" | "minStars" | "amenities"> {
  const valuesFor = (prefix: string) => picks.filter((p) => p.id.startsWith(prefix)).map((p) => p.id.slice(prefix.length));
  const types = valuesFor("type:").filter((t): t is LodgingType => known.types.includes(t as LodgingType));
  const stars = valuesFor("stars:").map(Number).find((s): s is LodgingStarRating => STAR_OPTIONS.includes(s as LodgingStarRating));
  return {
    types: types.length ? types : current.types,
    minStars: stars ?? current.minStars,
    amenities: valuesFor("amenity:").filter((a) => known.amenities.includes(a)),
  };
}
