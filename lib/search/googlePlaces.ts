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
//
// Caching: a search or photo is reused from the database for CACHE_DAYS, so
// a second trip to the same city costs no Google call and no allowance.
// Cached places keep the date Google returned them (fetchedAt), so the
// app's refresh still runs inside the 30 days. The cache fails soft: if it
// can't be read or written, the call simply goes to Google.
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { claimDailyQuota } from "@/lib/rateLimit";
import { inBackground } from "@/lib/background";

const API = "https://places.googleapis.com/v1";
const TIMEOUT_MS = 8_000;

// ~30 a day keeps a month under 1,000. Env-overridable for a paid account.
const DAILY_SEARCH_ALLOWANCE = Number(process.env.GOOGLE_PLACES_DAILY_SEARCHES ?? 30);
const DAILY_PHOTO_ALLOWANCE = Number(process.env.GOOGLE_PLACES_DAILY_PHOTOS ?? 30);
const DAILY_DETAILS_ALLOWANCE = Number(process.env.GOOGLE_PLACES_DAILY_DETAILS ?? 30);

export const CACHE_DAYS = 7;
const CACHE_MS = CACHE_DAYS * 86_400_000;
const cacheKey = (...parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const freshSince = () => new Date(Date.now() - CACHE_MS);

// Occasionally delete expired entries, like the other cleanup sweeps.
function sweepExpired() {
  if (Math.random() >= 0.02) return;
  const cutoff = freshSince();
  inBackground("placesCache", () => prisma.placeSearchCache.deleteMany({ where: { fetchedAt: { lt: cutoff } } }));
  inBackground("placesCache", () => prisma.placePhotoCache.deleteMany({ where: { fetchedAt: { lt: cutoff } } }));
}

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

/**
 * Places matching a text query, with when Google returned them (ISO date) —
 * from the cache when the same search ran recently, else from Google. Null
 * if Google can't be used right now.
 */
export async function searchPlaces(
  textQuery: string,
  fields: string[],
  opts: { pageSize?: number; minRating?: number; priceLevels?: string[] } = {}
): Promise<{ places: GooglePlace[]; fetchedAt: string } | null> {
  if (!apiKey()) return null;
  const body = { textQuery: textQuery.trim(), languageCode: "en", pageSize: opts.pageSize ?? 10, minRating: opts.minRating, priceLevels: opts.priceLevels };
  const key = cacheKey("search", { ...body, textQuery: body.textQuery.toLowerCase() }, fields);

  const cached = await prisma.placeSearchCache.findUnique({ where: { key } }).catch(() => null);
  if (cached && cached.fetchedAt > freshSince()) {
    return { places: cached.places as unknown as GooglePlace[], fetchedAt: cached.fetchedAt.toISOString() };
  }

  if (!(await claimDailyQuota("google-places-search", DAILY_SEARCH_ALLOWANCE))) return null;
  const data = await call<{ places?: GooglePlace[] }>(
    `${API}/places:searchText`,
    { method: "POST", body: JSON.stringify(body) },
    fields.map((f) => `places.${f}`).join(",")
  );
  if (!data) return null;
  const places = data.places ?? [];
  const fetchedAt = new Date();
  const json = places as unknown as object;
  inBackground("placesCache", () => prisma.placeSearchCache.upsert({
    where: { key },
    create: { key, places: json, fetchedAt },
    update: { places: json, fetchedAt },
  }));
  sweepExpired();
  return { places, fetchedAt: fetchedAt.toISOString() };
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
  if (!photo || !apiKey()) return null;
  const key = cacheKey("photo", photo.name, maxWidthPx);

  const cached = await prisma.placePhotoCache.findUnique({ where: { key } }).catch(() => null);
  if (cached && cached.fetchedAt > freshSince()) {
    return { url: cached.url, attribution: cached.authorName ? { name: cached.authorName, uri: cached.authorUri ?? undefined } : undefined };
  }

  if (!(await claimDailyQuota("google-places-photos", DAILY_PHOTO_ALLOWANCE))) return null;
  const data = await call<{ photoUri?: string }>(`${API}/${photo.name}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`, { method: "GET" });
  if (!data?.photoUri) return null;
  const author = photo.authorAttributions?.[0];
  const row = { url: data.photoUri, authorName: author?.displayName ?? null, authorUri: author?.uri ?? null, fetchedAt: new Date() };
  inBackground("placesCache", () => prisma.placePhotoCache.upsert({ where: { key }, create: { key, ...row }, update: row }));
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
