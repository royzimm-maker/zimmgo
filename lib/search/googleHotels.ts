// Real hotels from Google Places, in the app's HotelOption shape.
// searchHotels (hotels.ts) uses these when Google is available and falls back
// to its sample data otherwise.
//
// Google has no hotel star class and no nightly rates. So a real hotel's
// `stars` is 0 (unknown — the UI shows none; the traveller's star preference
// shapes the search instead), and its `pricePerNight` is a typical rate for
// the class searched, flagged priceIsEstimate and shown as an estimate with
// a link to check real prices for the trip's dates.
import { neighbourhoodOf, placeDetails, placePhoto, searchPlaces, withCity, type GooglePlace } from "@/lib/search/googlePlaces";
import type { HotelOption } from "@/types/trip";

const RESULTS_PER_SEARCH = 6;
const MIN_REVIEWS = 50;
const HOTEL_FIELDS = [
  "id", "displayName", "primaryTypeDisplayName", "types", "priceLevel", "rating", "userRatingCount",
  "googleMapsUri", "websiteUri", "editorialSummary", "businessStatus", "addressComponents", "photos",
];

// Typical nightly rate (USD) by the class searched for, or by Google's price level when it has one.
const RATE_BY_STARS: Record<number, number> = { 1: 70, 2: 90, 3: 120, 4: 220, 5: 450 };
const RATE_BY_PRICE_LEVEL: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 90,
  PRICE_LEVEL_MODERATE: 160,
  PRICE_LEVEL_EXPENSIVE: 280,
  PRICE_LEVEL_VERY_EXPENSIVE: 450,
};

const TYPE_WORDS: Record<string, string> = { hotel: "hotels", boutique: "boutique hotels", resort: "resorts", hostel: "hostels" };

export interface HotelSearch {
  destination: string;
  check_in?: string;
  check_out?: string;
  min_stars?: number;
  types?: string[];
  amenities?: string[];
}

/** The text query for a search, e.g. "4-star boutique hotels with pool in Lisbon". */
export function hotelQuery(params: HotelSearch): string {
  const kinds = (params.types ?? []).map((t) => TYPE_WORDS[t]).filter(Boolean);
  const what = kinds.length ? kinds.slice(0, 2).join(" and ") : "hotels";
  const stars = params.min_stars && params.min_stars >= 3 && !kinds.includes("hostels") ? `${params.min_stars}-star ` : "";
  const amenity = params.amenities?.[0] ? ` with ${params.amenities[0].toLowerCase()}` : "";
  return `${stars}${what}${amenity} in ${params.destination}`;
}

/** Where to check real prices: Booking.com's search for this hotel, for the trip's dates when known. */
export function checkPricesUrl(name: string, city: string, checkIn?: string, checkOut?: string): string {
  const q = new URLSearchParams({ ss: withCity(name, city) });
  if (checkIn && checkOut) {
    q.set("checkin", checkIn);
    q.set("checkout", checkOut);
  }
  return `https://www.booking.com/searchresults.html?${q.toString()}`;
}

/** A Google place as a hotel in `destination` (no photo yet). */
export function toHotel(place: GooglePlace, params: HotelSearch, fetchedAt: string): HotelOption {
  const name = place.displayName?.text ?? "Hotel";
  const area = neighbourhoodOf(place);
  const kind = place.primaryTypeDisplayName?.text;
  const rate = (place.priceLevel && RATE_BY_PRICE_LEVEL[place.priceLevel]) || RATE_BY_STARS[params.min_stars ?? 4] || RATE_BY_STARS[4];
  const mapsUri = place.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${place.id}`;
  return {
    id: place.id,
    name,
    stars: 0, // unknown: Google has no hotel class
    // Ends with the searched city so the app's city matching places it (Google may use the local name).
    location: area ? `${area}, ${params.destination}` : params.destination,
    city: params.destination,
    pricePerNight: rate,
    priceIsEstimate: true,
    currency: "USD",
    rating: Math.round((place.rating ?? 0) * 20) / 10, // Google's 1–5 stars on the app's 10-point scale
    ratingSource: "Google Reviews",
    reviewCount: place.userRatingCount ?? 0,
    highlights: [kind, area].filter((h): h is string => !!h),
    description: place.editorialSummary?.text,
    bookingUrl: checkPricesUrl(name, params.destination, params.check_in, params.check_out),
    google: { placeId: place.id, mapsUri, fetchedAt, websiteUri: place.websiteUri },
  };
}

function usablePlaces(places: GooglePlace[]): GooglePlace[] {
  return places.filter((p) => (p.businessStatus ?? "OPERATIONAL") === "OPERATIONAL" && (p.userRatingCount ?? 0) >= MIN_REVIEWS);
}

async function withPhoto(hotel: HotelOption, place: GooglePlace): Promise<HotelOption> {
  const photo = await placePhoto(place, 800);
  if (!photo || !hotel.google) return hotel;
  return { ...hotel, imageUrl: photo.url, google: { ...hotel.google, photoAttribution: photo.attribution } };
}

/** Real hotels for a search, or null to fall back to sample data. */
export async function searchGoogleHotels(params: HotelSearch): Promise<HotelOption[] | null> {
  const found = await searchPlaces(hotelQuery(params), HOTEL_FIELDS, { pageSize: 12, minRating: 3.5 });
  if (!found) return null;
  // Places keep the date Google returned them, even when served from the cache.
  const { places, fetchedAt } = found;
  const chosen = usablePlaces(places).slice(0, RESULTS_PER_SEARCH);
  if (!chosen.length) return null;
  return Promise.all(chosen.map((p) => withPhoto(toHotel(p, params, fetchedAt), p)));
}

/** A saved Google hotel with Google's current details, keeping its id, city, rate and price link; null if it can't be refreshed now. */
export async function refreshHotel(saved: HotelOption): Promise<HotelOption | null> {
  if (!saved.google) return null;
  const place = await placeDetails(saved.google.placeId, HOTEL_FIELDS);
  if (!place) return null;
  const city = saved.city ?? saved.location.split(",").pop()!.trim();
  const fresh = await withPhoto(toHotel(place, { destination: city }, new Date().toISOString()), place);
  // The estimated rate and dated price link came from the original search's class and dates — keep them.
  return { ...fresh, id: saved.id, pricePerNight: saved.pricePerNight, bookingUrl: saved.bookingUrl ?? fresh.bookingUrl };
}
