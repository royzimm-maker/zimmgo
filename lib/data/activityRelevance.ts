import type { ActivityCategory, Destination, DatePreference } from "@/types/trip";

// Heuristic, keyword-based relevance check for the handful of activity
// categories that only make sense for a subset of destinations/seasons
// (skiing needs snow; diving/snorkel/sailing need a coastline). This is a
// mock-data app with no real geo/climate API, so these are curated keyword
// lists rather than anything authoritative — the goal is just to stop
// obviously-wrong combinations (skiing in Tokyo, snorkeling in Madrid) from
// being offered as selectable interests, not to model geography precisely.
// Unrecognized destinations are left unfiltered — showing an activity that
// doesn't quite fit beats hiding one for a place we don't recognize.

const SKI_KEYWORDS = [
  "alps", "swiss", "switzerland", "austria", "aspen", "vail", "whistler",
  "niseko", "hakuba", "andorra", "chamonix", "zermatt", "st. moritz", "st moritz",
  "colorado", "tahoe", "banff", "queenstown", "dolomites", "dolomiti",
  "courchevel", "val d'isere", "innsbruck", "megeve", "gstaad", "aspen",
  "park city", "jackson hole", "bariloche", "chile", "patagonia",
];

// Southern-hemisphere ski keywords flip the seasonal window (winter there is
// roughly May–Sep instead of Nov–Apr).
const SOUTHERN_HEMISPHERE_SKI_KEYWORDS = ["queenstown", "bariloche", "chile", "patagonia", "australia", "new zealand"];

// Well-known landlocked or non-tropical major cities/regions where diving,
// snorkeling, or sailing aren't realistically on offer. Deliberately a short,
// high-confidence list rather than trying to whitelist every coastline in
// the world (which would risk excluding legitimate coastal destinations we
// simply don't recognize).
const NO_WATERSPORTS_KEYWORDS = [
  "tokyo", "kyoto", "osaka", "madrid", "paris", "milan", "prague", "vienna",
  "zurich", "geneva", "munich", "berlin", "london", "edinburgh", "glasgow",
  "florence", "bologna", "innsbruck", "denver", "aspen", "vail", "banff",
  "reykjavik", "amsterdam", "brussels",
];

function matchesAny(haystack: string, keywords: string[]): boolean {
  return keywords.some((kw) => haystack.includes(kw));
}

function destinationText(destination?: Destination): string {
  if (!destination) return "";
  return [
    destination.displayName,
    destination.freeText,
    destination.country,
    destination.region,
    ...(destination.cities ?? []),
  ]
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();
}

// Returns the travel month (1-12), or null if it can't be determined
// (e.g. no dates chosen yet).
function travelMonth(dates?: DatePreference): number | null {
  if (!dates) return null;
  if (dates.type === "exact" && dates.startDate) {
    const m = Number(dates.startDate.split("-")[1]);
    return Number.isFinite(m) ? m : null;
  }
  if (dates.type === "flexible" && dates.flexibleMonth) {
    const m = Number(dates.flexibleMonth.split("-")[1]);
    return Number.isFinite(m) ? m : null;
  }
  return null;
}

/**
 * Categories to hide from the interest picker for this destination/season —
 * e.g. skiing for an April Tokyo trip, or diving for a Madrid city break.
 */
export function getIrrelevantCategories(
  destination: Destination | undefined,
  dates: DatePreference | undefined
): Set<ActivityCategory> {
  const hidden = new Set<ActivityCategory>();
  const text = destinationText(destination);
  if (!text) return hidden;

  // Skiing: needs both a recognized ski destination and a plausible winter month.
  const isSkiDestination = matchesAny(text, SKI_KEYWORDS);
  if (isSkiDestination) {
    const month = travelMonth(dates);
    if (month !== null) {
      const isSouthern = matchesAny(text, SOUTHERN_HEMISPHERE_SKI_KEYWORDS);
      const winterMonths = isSouthern ? [5, 6, 7, 8, 9] : [11, 12, 1, 2, 3, 4];
      if (!winterMonths.includes(month)) hidden.add("skiing");
    }
    // If we don't know the month yet, don't hide it — better to let the user
    // pick and adjust later than to hide it before dates are even set.
  } else {
    hidden.add("skiing");
  }

  // Diving/snorkel/sailing: only hide for destinations we're confident have
  // no realistic water access.
  if (matchesAny(text, NO_WATERSPORTS_KEYWORDS)) {
    hidden.add("diving");
    hidden.add("sailing");
  }

  return hidden;
}
