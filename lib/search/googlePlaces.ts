// Google Places API (New) — real places for the search providers in this
// folder. Server-only: the key (GOOGLE_PLACES_API_KEY) must never reach a
// browser, which is also why photos are resolved here to Google's key-free
// image URLs.
//
// Cost control: requests that return ratings and summaries are billed at
// Google's "Enterprise + Atmosphere" tier, free for the first 1,000 a month;
// photos have their own 1,000. Every call first takes one unit of a daily
// allowance (claimDailyQuota) sized to stay inside those, so the bill stays
// at $0. Past the allowance, when the key isn't set, or on any error, these
// return null and callers fall back to sample data.
//
// Google's terms: content may be kept 30 days (place IDs forever), must be
// attributed to Google Maps (and photos to their authors), and AI output
// built from it must link to Google Maps. See GooglePlaceRef in types/trip.ts.
import { claimDailyQuota } from "@/lib/rateLimit";

const API = "https://places.googleapis.com/v1";
const TIMEOUT_MS = 8_000;

// ~30 a day keeps a month under 1,000. Env-overridable for a paid account.
const DAILY_SEARCH_ALLOWANCE = Number(process.env.GOOGLE_PLACES_DAILY_SEARCHES ?? 30);
const DAILY_PHOTO_ALLOWANCE = Number(process.env.GOOGLE_PLACES_DAILY_PHOTOS ?? 30);
const DAILY_DETAILS_ALLOWANCE = Number(process.env.GOOGLE_PLACES_DAILY_DETAILS ?? 30);

export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  websiteUri?: string;
  editorialSummary?: { text: string };
  businessStatus?: string;
  servesBrunch?: boolean;
  servesBreakfast?: boolean;
  addressComponents?: { longText: string; types?: string[] }[];
  priceRange?: { startPrice?: { currencyCode: string; units?: string }; endPrice?: { currencyCode: string; units?: string } };
  photos?: { name: string; authorAttributions?: { displayName: string; uri?: string }[] }[];
}

// Each provider asks only for the fields it reads (Text Search prefixes them
// with "places."). Google bills a call at the tier of its priciest field;
// editorialSummary puts these at "Enterprise + Atmosphere".

const apiKey = () => process.env.GOOGLE_PLACES_API_KEY;

async function call<T>(url: string, init: RequestInit, fieldMask?: string): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, ...(fieldMask ? { "X-Goog-FieldMask": fieldMask } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[googlePlaces] ${res.status} from ${url.split("?")[0]}`, (await res.text()).slice(0, 300));
      return null;
    }
    return (await res.json()) as T;
  } catch (error: unknown) {
    console.error("[googlePlaces] request failed", error);
    return null;
  }
}

/** Places matching a text query, or null if Google can't be used right now. */
export async function searchPlaces(
  textQuery: string,
  fields: string[],
  opts: { pageSize?: number; minRating?: number; priceLevels?: string[] } = {}
): Promise<GooglePlace[] | null> {
  if (!apiKey() || !(await claimDailyQuota("google-places-search", DAILY_SEARCH_ALLOWANCE))) return null;
  const body = { textQuery, languageCode: "en", pageSize: opts.pageSize ?? 10, minRating: opts.minRating, priceLevels: opts.priceLevels };
  const data = await call<{ places?: GooglePlace[] }>(
    `${API}/places:searchText`,
    { method: "POST", body: JSON.stringify(body) },
    fields.map((f) => `places.${f}`).join(",")
  );
  return data ? data.places ?? [] : null;
}

/** One place's current details by ID — how saved places are refreshed. */
export async function placeDetails(placeId: string, fields: string[]): Promise<GooglePlace | null> {
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return null;
  if (!apiKey() || !(await claimDailyQuota("google-places-details", DAILY_DETAILS_ALLOWANCE))) return null;
  return call<GooglePlace>(`${API}/places/${placeId}`, { method: "GET" }, fields.join(","));
}

/**
 * A key-free image URL for a place's first photo, with the author credit
 * Google requires alongside it. Null when there's no photo or the daily
 * photo allowance is used up — the card then shows no image.
 */
export async function placePhoto(place: GooglePlace, maxWidthPx = 400): Promise<{ url: string; attribution?: { name: string; uri?: string } } | null> {
  const photo = place.photos?.[0];
  if (!photo || !apiKey() || !(await claimDailyQuota("google-places-photos", DAILY_PHOTO_ALLOWANCE))) return null;
  const data = await call<{ photoUri?: string }>(`${API}/${photo.name}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`, { method: "GET" });
  if (!data?.photoUri) return null;
  const author = photo.authorAttributions?.[0];
  return { url: data.photoUri, attribution: author ? { name: author.displayName, uri: author.uri } : undefined };
}

/** A place's neighbourhood ("Chiado"), if Google gives one. */
export function neighbourhoodOf(place: GooglePlace): string | undefined {
  const pick = (type: string) => place.addressComponents?.find((c) => c.types?.includes(type))?.longText;
  return pick("neighborhood") ?? pick("sublocality_level_1") ?? pick("sublocality");
}

/** A search term for a place on another site: its name, plus the city unless the name already has it. */
export function withCity(name: string, city: string): string {
  return name.toLowerCase().includes(city.toLowerCase()) ? name : `${name} ${city}`;
}
