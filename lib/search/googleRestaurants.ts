// Real restaurants from Google Places, in the app's RestaurantOption shape.
// searchRestaurants (restaurants.ts) uses these when Google is available and
// falls back to its sample data otherwise.
import { neighbourhoodOf, placeDetails, placePhoto, searchPlaces, withCity, type GooglePlace } from "@/lib/search/googlePlaces";
import type { RestaurantOption, RestaurantTier } from "@/types/trip";

const RESULTS_PER_SEARCH = 6;
const RESTAURANT_FIELDS = [
  "id", "displayName", "primaryTypeDisplayName", "types", "priceLevel", "rating", "userRatingCount",
  "googleMapsUri", "websiteUri", "editorialSummary", "businessStatus", "servesBrunch", "servesBreakfast",
  "addressComponents", "photos",
];
const MIN_REVIEWS = 20; // a rating from a handful of reviews says little

const PRICE: Record<string, RestaurantOption["priceRange"]> = {
  PRICE_LEVEL_FREE: "$",
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};
const TIER_BY_PRICE: Record<RestaurantOption["priceRange"], RestaurantTier> = {
  "$": "casual", "$$": "midrange", "$$$": "upscale", "$$$$": "fine_dining",
};
const BRUNCH_TYPES = ["breakfast_restaurant", "brunch_restaurant", "cafe", "coffee_shop", "bakery"];
const STREET_FOOD_TYPES = ["fast_food_restaurant", "food_court", "sandwich_shop", "hot_dog_stand"];
const BUDGET_PRICE_LEVELS: Record<string, string[]> = {
  low: ["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE"],
  mid: ["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"],
};

/** The text query for a search: cuisines and meal type folded in, e.g. "seafood restaurants in Lisbon". */
export function restaurantQuery(destination: string, cuisines: string[] = [], mealTypes: string[] = []): string {
  const brunch = mealTypes.some((m) => /brunch|breakfast/i.test(m));
  const what = brunch ? "brunch spots" : [...cuisines.slice(0, 2), "restaurants"].join(" ");
  return `${what} in ${destination}`;
}

export function tierOf(place: GooglePlace, priceRange: RestaurantOption["priceRange"]): RestaurantTier {
  const types = place.types ?? [];
  if (types.some((t) => BRUNCH_TYPES.includes(t))) return "brunch";
  if (types.some((t) => STREET_FOOD_TYPES.includes(t))) return "street_food";
  return TIER_BY_PRICE[priceRange];
}

// Plain descriptions from Google's price level and place type. The sample
// data's playful labels ("Michelin or bust") would be claims about a real
// restaurant that Google's data doesn't support — and Claude reads them.
const TIER_LABELS: Record<RestaurantTier, string> = {
  fine_dining: "Fine dining", upscale: "Upscale", midrange: "Mid-range",
  casual: "Casual", street_food: "Street food", brunch: "Café and brunch",
};

/** e.g. "Fine-dining Mediterranean restaurant in Chiado." */
export function plainDescription(tier: RestaurantTier, cuisine: string, area?: string): string {
  const where = area ? ` in ${area}` : "";
  if (tier === "brunch") return `Café and brunch spot${where}.`;
  const kind = cuisine === "Restaurant" ? "restaurant" : `${cuisine} restaurant`;
  const label = { fine_dining: "Fine-dining", upscale: "Upscale", midrange: "Mid-range", casual: "Casual", street_food: "Street-food" }[tier];
  return `${label} ${kind}${where}.`;
}

function michelinIn(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("bib gourmand")) return "Bib Gourmand";
  if (/michelin[- ]star/.test(lower)) return "Michelin Star";
  return undefined;
}

/** A Google place as a restaurant in `destination` (no photo yet). */
export function toRestaurant(place: GooglePlace, destination: string, fetchedAt: string): RestaurantOption {
  const name = place.displayName?.text ?? "Restaurant";
  const priceRange = (place.priceLevel && PRICE[place.priceLevel]) || "$$";
  const tier = tierOf(place, priceRange);
  const cuisine = (place.primaryTypeDisplayName?.text ?? "Restaurant").replace(/\s+Restaurant$/i, "") || "Restaurant";
  const area = neighbourhoodOf(place);
  const summary = place.editorialSummary?.text;
  const mapsUri = place.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${place.id}`;
  return {
    id: place.id,
    name,
    cuisine,
    tier,
    playfulCategory: TIER_LABELS[tier],
    priceRange,
    rating: Math.round((place.rating ?? 0) * 20) / 10, // Google's 1–5 stars on the app's 10-point scale
    ratingSource: "Google Reviews",
    reviewCount: place.userRatingCount ?? 0,
    // Always ends with the searched city, so the app's city matching places it correctly
    // (Google's own address may use the local name, e.g. "Lisboa").
    location: area ? `${area}, ${destination}` : destination,
    description: summary ?? plainDescription(tier, cuisine, area),
    menuUrl: place.websiteUri,
    bookingUrl: tier === "fine_dining" || tier === "upscale"
      ? `https://www.opentable.com/s/?term=${encodeURIComponent(withCity(name, destination))}`
      : undefined,
    michelinDistinction: summary ? michelinIn(summary) : undefined,
    google: { placeId: place.id, mapsUri, fetchedAt },
  };
}

/** Open places with enough reviews to trust the rating, best first as Google ranks them. */
export function usablePlaces(places: GooglePlace[]): GooglePlace[] {
  return places.filter((p) => (p.businessStatus ?? "OPERATIONAL") === "OPERATIONAL" && (p.userRatingCount ?? 0) >= MIN_REVIEWS);
}

/** Adds each restaurant's photo and its author credit (photos have their own daily allowance). */
export async function withPhotos(restaurants: RestaurantOption[], places: GooglePlace[]): Promise<RestaurantOption[]> {
  const byId = new Map(places.map((p) => [p.id, p]));
  return Promise.all(
    restaurants.map(async (r) => {
      const place = r.google && byId.get(r.google.placeId);
      const photo = place ? await placePhoto(place) : null;
      if (!photo || !r.google) return r;
      return { ...r, imageUrl: photo.url, google: { ...r.google, photoAttribution: photo.attribution } };
    })
  );
}

/** Real restaurants for a search, or null to fall back to sample data. */
export async function searchGoogleRestaurants(params: {
  destination: string;
  cuisine_preferences?: string[];
  budget_level?: "low" | "mid" | "high";
  meal_types?: string[];
}): Promise<RestaurantOption[] | null> {
  const found = await searchPlaces(restaurantQuery(params.destination, params.cuisine_preferences, params.meal_types), RESTAURANT_FIELDS, {
    pageSize: 12,
    minRating: 4,
    priceLevels: params.budget_level ? BUDGET_PRICE_LEVELS[params.budget_level] : undefined,
  });
  if (!found) return null;
  // Places keep the date Google returned them, even when served from the cache.
  const { places, fetchedAt } = found;
  const chosen = usablePlaces(places).slice(0, RESULTS_PER_SEARCH);
  if (!chosen.length) return null;
  return withPhotos(chosen.map((p) => toRestaurant(p, params.destination, fetchedAt)), chosen);
}

/**
 * A saved Google restaurant with Google's current details, keeping its id
 * (so the traveller's picks still point at it) and its city. Null if it
 * can't be refreshed right now.
 */
export async function refreshRestaurant(saved: RestaurantOption): Promise<RestaurantOption | null> {
  if (!saved.google) return null;
  const place = await placeDetails(saved.google.placeId, RESTAURANT_FIELDS);
  if (!place) return null;
  const city = saved.location.split(",").pop()!.trim();
  const [fresh] = await withPhotos([toRestaurant(place, city, new Date().toISOString())], [place]);
  return { ...fresh, id: saved.id };
}
