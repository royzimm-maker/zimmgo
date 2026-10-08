// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const quota = vi.hoisted(() => ({ claim: vi.fn<(name: string) => Promise<boolean>>(async () => true) }));
vi.mock("@/lib/rateLimit", () => ({ claimDailyQuota: quota.claim }));

import { refreshRestaurant, restaurantQuery, searchGoogleRestaurants, toRestaurant, usablePlaces } from "@/lib/search/googleRestaurants";
import { searchRestaurants } from "@/lib/search/restaurants";
import type { GooglePlace } from "@/lib/search/googlePlaces";

const KEY = "AIzaTESTKEY000000000000000000000000000";
const place = (over: Partial<GooglePlace> = {}): GooglePlace => ({
  id: "ChIJabc123def456",
  displayName: { text: "Taberna da Rua" },
  primaryTypeDisplayName: { text: "Portuguese Restaurant" },
  types: ["portuguese_restaurant", "restaurant"],
  priceLevel: "PRICE_LEVEL_MODERATE",
  rating: 4.6,
  userRatingCount: 2315,
  googleMapsUri: "https://maps.google.com/?cid=1",
  websiteUri: "https://taberna.example",
  editorialSummary: { text: "Cosy tavern serving petiscos." },
  businessStatus: "OPERATIONAL",
  addressComponents: [{ longText: "Chiado", types: ["neighborhood"] }, { longText: "Lisboa", types: ["locality"] }],
  photos: [{ name: "places/ChIJabc123def456/photos/p1", authorAttributions: [{ displayName: "Ana", uri: "https://maps.google.com/contrib/1" }] }],
  ...over,
});

let fetchMock: ReturnType<typeof vi.fn>;
function googleReturns(places: GooglePlace[]) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes(":searchText")) return new Response(JSON.stringify({ places }));
    if (url.includes("/media")) return new Response(JSON.stringify({ photoUri: "https://lh3.googleusercontent.com/photo1" }));
    if (url.includes("/places/")) return new Response(JSON.stringify(places[0]));
    return new Response("{}", { status: 404 });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  quota.claim.mockResolvedValue(true);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_PLACES_API_KEY", KEY);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("toRestaurant", () => {
  it("maps a Google place into the app's restaurant shape", () => {
    const r = toRestaurant(place(), "Lisbon", "2026-10-08T00:00:00.000Z");
    expect(r).toMatchObject({
      id: "ChIJabc123def456", name: "Taberna da Rua", cuisine: "Portuguese", tier: "midrange", priceRange: "$$",
      rating: 9.2, ratingSource: "Google Reviews", reviewCount: 2315,
      location: "Chiado, Lisbon", // the searched city, not Google's "Lisboa", so the city matching works
      description: "Cosy tavern serving petiscos.", menuUrl: "https://taberna.example",
      google: { placeId: "ChIJabc123def456", mapsUri: "https://maps.google.com/?cid=1", fetchedAt: "2026-10-08T00:00:00.000Z" },
    });
  });

  it("sets the tier from the kind of place, then its price", () => {
    expect(toRestaurant(place({ types: ["cafe"] }), "Lisbon", "").tier).toBe("brunch");
    expect(toRestaurant(place({ types: ["fast_food_restaurant"] }), "Lisbon", "").tier).toBe("street_food");
    expect(toRestaurant(place({ priceLevel: "PRICE_LEVEL_VERY_EXPENSIVE" }), "Lisbon", "")).toMatchObject({ tier: "fine_dining", priceRange: "$$$$" });
    expect(toRestaurant(place({ priceLevel: undefined }), "Lisbon", "").priceRange).toBe("$$");
  });

  it("writes a plain description when Google has no summary", () => {
    expect(toRestaurant(place({ editorialSummary: undefined }), "Lisbon", "").description).toBe("Mid-range Portuguese restaurant in Chiado.");
    expect(toRestaurant(place({ editorialSummary: undefined, primaryTypeDisplayName: undefined, priceLevel: "PRICE_LEVEL_VERY_EXPENSIVE", addressComponents: [] }), "Lisbon", "").description)
      .toBe("Fine-dining restaurant.");
    expect(toRestaurant(place({ editorialSummary: undefined, types: ["cafe"] }), "Lisbon", "").description).toBe("Café and brunch spot in Chiado.");
  });

  it("labels real places plainly, never with the sample data's playful claims", () => {
    expect(toRestaurant(place({ priceLevel: "PRICE_LEVEL_VERY_EXPENSIVE" }), "Lisbon", "").playfulCategory).toBe("Fine dining");
  });
});

describe("usablePlaces and restaurantQuery", () => {
  it("drops closed places and ratings from too few reviews", () => {
    const kept = usablePlaces([place(), place({ id: "closed", businessStatus: "CLOSED_PERMANENTLY" }), place({ id: "new", userRatingCount: 4 })]);
    expect(kept.map((p) => p.id)).toEqual(["ChIJabc123def456"]);
  });

  it("folds cuisines and brunch into the query", () => {
    expect(restaurantQuery("Lisbon")).toBe("restaurants in Lisbon");
    expect(restaurantQuery("Lisbon", ["seafood"])).toBe("seafood restaurants in Lisbon");
    expect(restaurantQuery("Lisbon", [], ["brunch"])).toBe("brunch spots in Lisbon");
  });
});

describe("searchGoogleRestaurants", () => {
  it("returns real restaurants with a key-free photo and its author credit", async () => {
    googleReturns([place()]);
    const [r] = (await searchGoogleRestaurants({ destination: "Lisbon" }))!;
    expect(r.imageUrl).toBe("https://lh3.googleusercontent.com/photo1");
    expect(r.google?.photoAttribution).toEqual({ name: "Ana", uri: "https://maps.google.com/contrib/1" });
    expect(JSON.stringify(r)).not.toContain(KEY);
    // The key travels only in the request header, never in a URL.
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).not.toContain(KEY);
      expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe(KEY);
    }
  });

  it("asks Google only for the fields it uses", async () => {
    googleReturns([place()]);
    await searchGoogleRestaurants({ destination: "Lisbon", budget_level: "low" });
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url).includes(":searchText"))!;
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).toMatch(/^places\.id,places\.displayName,/);
    expect(JSON.parse(init.body as string)).toMatchObject({ textQuery: "restaurants in Lisbon", priceLevels: ["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE"] });
  });

  it("gives up — so the caller uses sample data — without a key, past the daily allowance, or on a Google error", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect(await searchGoogleRestaurants({ destination: "Lisbon" })).toBeNull();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", KEY);

    quota.claim.mockResolvedValueOnce(false);
    expect(await searchGoogleRestaurants({ destination: "Lisbon" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(new Response("{}", { status: 403 }));
    expect(await searchGoogleRestaurants({ destination: "Lisbon" })).toBeNull();
  });

  it("still returns restaurants, without photos, once the photo allowance is used up", async () => {
    googleReturns([place()]);
    quota.claim.mockImplementation(async (name: string) => name !== "google-places-photos");
    const [r] = (await searchGoogleRestaurants({ destination: "Lisbon" }))!;
    expect(r.imageUrl).toBeUndefined();
    expect(r.google?.photoAttribution).toBeUndefined();
  });
});

describe("searchRestaurants", () => {
  it("uses Google when it can", async () => {
    googleReturns([place()]);
    expect((await searchRestaurants({ destination: "Lisbon" }))[0].google?.placeId).toBe("ChIJabc123def456");
  });

  it("falls back to the sample data when Google can't be used", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    const sample = await searchRestaurants({ destination: "Paris" });
    expect(sample.length).toBeGreaterThan(0);
    expect(sample.every((r) => !r.google)).toBe(true);
  });
});

describe("refreshRestaurant", () => {
  it("refreshes from Google by place ID, keeping the id and the city", async () => {
    googleReturns([place({ rating: 4.2, displayName: { text: "Taberna da Rua (renamed)" } })]);
    const saved = toRestaurant(place(), "Lisbon", "2026-08-01T00:00:00.000Z");
    const fresh = await refreshRestaurant(saved);
    expect(fresh).toMatchObject({ id: saved.id, name: "Taberna da Rua (renamed)", rating: 8.4, location: "Chiado, Lisbon" });
    expect(Date.parse(fresh!.google!.fetchedAt)).toBeGreaterThan(Date.parse("2026-08-01"));
    expect(fetchMock.mock.calls[0][0]).toContain("/places/ChIJabc123def456");
  });

  it("can't refresh sample data, or when Google is unavailable", async () => {
    expect(await refreshRestaurant({ ...toRestaurant(place(), "Lisbon", ""), google: undefined })).toBeNull();
    quota.claim.mockResolvedValue(false);
    expect(await refreshRestaurant(toRestaurant(place(), "Lisbon", ""))).toBeNull();
  });
});
