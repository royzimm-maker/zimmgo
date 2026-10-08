// Real attractions and experiences from Google Places, in the app's
// ActivityOption shape. searchActivities (activities.ts) uses these when
// Google is available and falls back to its sample data otherwise.
//
// Google describes places, not bookable experiences: it rarely has an entry
// price and never a visit length. Those come from the kind of place — a
// typical fee (flagged priceIsEstimate, shown as an estimate) and a typical
// visit ("~2h"). Nothing here claims more than Google's data supports.
import { neighbourhoodOf, placeDetails, searchPlaces, withCity, type GooglePlace } from "@/lib/search/googlePlaces";
import type { ActivityCategory, ActivityOption } from "@/types/trip";

const RESULTS_PER_SEARCH = 5;
const MIN_REVIEWS = 50; // sights draw lots of reviews; fewer suggests a minor spot
const ACTIVITY_FIELDS = [
  "id", "displayName", "primaryTypeDisplayName", "types", "rating", "userRatingCount", "googleMapsUri",
  "websiteUri", "editorialSummary", "businessStatus", "addressComponents", "priceRange",
];

// The kind of place → the app's activity category. First match wins.
const CATEGORY_BY_TYPE: [string[], ActivityCategory][] = [
  [["ski_resort"], "skiing"],
  [["marina", "boat_tour_agency"], "sailing"],
  [["spa", "sauna", "wellness_center", "public_bath"], "wellness"],
  [["hiking_area", "national_park", "state_park", "nature_preserve", "park", "garden", "botanical_garden", "beach"], "hiking"],
  [["market", "farmers_market", "food_court", "winery"], "food"],
  [["amusement_park", "zoo", "aquarium", "water_park", "adventure_sports_center"], "adventure"],
  [["observation_deck", "scenic_spot", "vista_point"], "photography"],
  [["tour_agency"], "guided_walking_tour"],
];

/** What each category is searched as, and its typical visit length and entry fee (USD) when Google has none. */
const CATEGORY_INFO: Record<ActivityCategory, { query: string; duration: string; fee: number }> = {
  cultural:            { query: "museums and landmarks",  duration: "~2h",      fee: 20 },
  hiking:              { query: "hikes and nature spots", duration: "~3h",      fee: 0 },
  food:                { query: "food markets and food tours", duration: "~2h", fee: 30 },
  wellness:            { query: "spas and thermal baths", duration: "~2h",      fee: 60 },
  adventure:           { query: "adventure activities",   duration: "~3h",      fee: 40 },
  photography:         { query: "viewpoints",             duration: "~1h",      fee: 0 },
  guided_walking_tour: { query: "walking tours",          duration: "~3h",      fee: 35 },
  sailing:             { query: "boat trips",             duration: "~3h",      fee: 80 },
  diving:              { query: "diving trips",           duration: "Half day", fee: 120 },
  skiing:              { query: "ski areas",              duration: "Full day", fee: 90 },
  cycling:             { query: "bike tours",             duration: "~3h",      fee: 30 },
};

const isCategory = (c: string): c is ActivityCategory => c in CATEGORY_INFO;

/** The text query for a search, from up to two of the traveller's categories, e.g. "museums and landmarks in Lisbon". */
export function activityQuery(destination: string, categories: string[] = []): string {
  const phrases = categories.filter(isCategory).slice(0, 2).map((c) => CATEGORY_INFO[c].query);
  return `${phrases.length ? phrases.join(" and ") : "top attractions"} in ${destination}`;
}

export function categoryOf(place: GooglePlace): ActivityCategory {
  const types = place.types ?? [];
  return CATEGORY_BY_TYPE.find(([match]) => match.some((t) => types.includes(t)))?.[1] ?? "cultural";
}

/** Google's entry price when it gives one in US dollars (the middle of its range), else null. */
export function googlePriceUsd(place: GooglePlace): number | null {
  const { startPrice, endPrice } = place.priceRange ?? {};
  const prices = [startPrice, endPrice].filter((p) => p?.currencyCode === "USD" && p.units !== undefined).map((p) => Number(p!.units));
  return prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
}

/** A Google place as an activity in `destination`. */
export function toActivity(place: GooglePlace, destination: string, fetchedAt: string): ActivityOption {
  const name = place.displayName?.text ?? "Attraction";
  const category = categoryOf(place);
  const info = CATEGORY_INFO[category];
  const kind = place.primaryTypeDisplayName?.text ?? "Attraction";
  const area = neighbourhoodOf(place);
  const price = googlePriceUsd(place);
  const mapsUri = place.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${place.id}`;
  return {
    id: place.id,
    name,
    category,
    duration: info.duration,
    price: price ?? info.fee,
    priceIsEstimate: price === null,
    currency: "USD",
    rating: Math.round((place.rating ?? 0) * 20) / 10, // Google's 1–5 stars on the app's 10-point scale
    ratingSource: "Google Reviews",
    reviewCount: place.userRatingCount ?? 0,
    isLocalFavorite: false, // nothing in Google's data says so
    description: place.editorialSummary?.text ?? `${kind}${area ? ` in ${area}` : ""}.`,
    // Ends with the searched city so the app's city matching places it (Google may use the local name).
    location: area ? `${area}, ${destination}` : destination,
    bookingUrl: `https://www.getyourguide.com/s/?q=${encodeURIComponent(withCity(name, destination))}`,
    google: { placeId: place.id, mapsUri, fetchedAt, websiteUri: place.websiteUri },
  };
}

function usablePlaces(places: GooglePlace[]): GooglePlace[] {
  return places.filter((p) => (p.businessStatus ?? "OPERATIONAL") === "OPERATIONAL" && (p.userRatingCount ?? 0) >= MIN_REVIEWS);
}

/** Real activities for a search, or null to fall back to sample data. */
export async function searchGoogleActivities(params: { destination: string; categories?: string[] }): Promise<ActivityOption[] | null> {
  const found = await searchPlaces(activityQuery(params.destination, params.categories), ACTIVITY_FIELDS, { pageSize: 10, minRating: 4 });
  if (!found) return null;
  // Places keep the date Google returned them, even when served from the cache.
  const { places, fetchedAt } = found;
  const chosen = usablePlaces(places).slice(0, RESULTS_PER_SEARCH);
  if (!chosen.length) return null;
  return chosen.map((p) => toActivity(p, params.destination, fetchedAt));
}

/** A saved Google activity with Google's current details, keeping its id and city; null if it can't be refreshed now. */
export async function refreshActivity(saved: ActivityOption): Promise<ActivityOption | null> {
  if (!saved.google) return null;
  const place = await placeDetails(saved.google.placeId, ACTIVITY_FIELDS);
  if (!place) return null;
  const city = (saved.location ?? "").split(",").pop()!.trim();
  return { ...toActivity(place, city, new Date().toISOString()), id: saved.id };
}
