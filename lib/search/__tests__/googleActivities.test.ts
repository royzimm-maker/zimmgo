// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const quota = vi.hoisted(() => ({ claim: vi.fn<(name: string) => Promise<boolean>>(async () => true) }));
vi.mock("@/lib/rateLimit", () => ({ claimDailyQuota: quota.claim }));

import { activityQuery, categoryOf, googlePriceUsd, refreshActivity, searchGoogleActivities, toActivity } from "@/lib/search/googleActivities";
import { searchActivities } from "@/lib/search/activities";
import type { GooglePlace } from "@/lib/search/googlePlaces";

const KEY = "AIzaTESTKEY000000000000000000000000000";
const place = (over: Partial<GooglePlace> = {}): GooglePlace => ({
  id: "ChIJmuseum0000001",
  displayName: { text: "Calouste Gulbenkian Museum" },
  primaryTypeDisplayName: { text: "Art Museum" },
  types: ["art_museum", "museum", "tourist_attraction"],
  rating: 4.7,
  userRatingCount: 18450,
  googleMapsUri: "https://maps.google.com/?cid=2",
  websiteUri: "https://gulbenkian.pt",
  businessStatus: "OPERATIONAL",
  addressComponents: [{ longText: "Avenidas Novas", types: ["neighborhood"] }],
  ...over,
});

let fetchMock: ReturnType<typeof vi.fn>;
function googleReturns(places: GooglePlace[]) {
  fetchMock.mockImplementation(async (url: string) =>
    new Response(JSON.stringify(url.includes(":searchText") ? { places } : places[0]))
  );
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

describe("toActivity", () => {
  it("maps a Google place into the app's activity shape", () => {
    expect(toActivity(place(), "Lisbon", "2026-10-08T00:00:00.000Z")).toMatchObject({
      id: "ChIJmuseum0000001", name: "Calouste Gulbenkian Museum", category: "cultural",
      rating: 9.4, ratingSource: "Google Reviews", reviewCount: 18450,
      location: "Avenidas Novas, Lisbon", description: "Art Museum in Avenidas Novas.",
      isLocalFavorite: false,
      google: { placeId: "ChIJmuseum0000001", mapsUri: "https://maps.google.com/?cid=2", fetchedAt: "2026-10-08T00:00:00.000Z", websiteUri: "https://gulbenkian.pt" },
    });
  });

  it("links to tickets without repeating the city when the name already has it", () => {
    expect(toActivity(place(), "Lisbon", "").bookingUrl).toContain("q=Calouste%20Gulbenkian%20Museum%20Lisbon");
    expect(toActivity(place({ displayName: { text: "Museum of Illusions Lisbon" } }), "Lisbon", "").bookingUrl).toMatch(/q=Museum%20of%20Illusions%20Lisbon$/);
  });

  it("copes with address parts Google sends without a type list (seen live)", () => {
    const odd = place({ addressComponents: [{ longText: "Portugal" } as never, { longText: "Belém", types: ["neighborhood"] }] });
    expect(toActivity(odd, "Lisbon", "").location).toBe("Belém, Lisbon");
  });

  it("uses a typical fee and visit length for the kind of place, marked as an estimate", () => {
    expect(toActivity(place(), "Lisbon", "")).toMatchObject({ price: 20, priceIsEstimate: true, duration: "~2h", currency: "USD" });
    expect(toActivity(place({ types: ["park"] }), "Lisbon", "")).toMatchObject({ category: "hiking", price: 0, priceIsEstimate: true });
  });

  it("uses Google's own price when it gives one in dollars", () => {
    const priced = place({ priceRange: { startPrice: { currencyCode: "USD", units: "20" }, endPrice: { currencyCode: "USD", units: "30" } } });
    expect(toActivity(priced, "Lisbon", "")).toMatchObject({ price: 25, priceIsEstimate: false });
    expect(googlePriceUsd(place({ priceRange: { startPrice: { currencyCode: "EUR", units: "15" } } }))).toBeNull();
  });
});

describe("categoryOf and activityQuery", () => {
  it("maps the kind of place to the app's categories", () => {
    expect(categoryOf(place({ types: ["spa"] }))).toBe("wellness");
    expect(categoryOf(place({ types: ["market"] }))).toBe("food");
    expect(categoryOf(place({ types: ["observation_deck"] }))).toBe("photography");
    expect(categoryOf(place({ types: ["something_new"] }))).toBe("cultural");
  });

  it("searches for up to two of the traveller's interests", () => {
    expect(activityQuery("Lisbon")).toBe("top attractions in Lisbon");
    expect(activityQuery("Lisbon", ["cultural"])).toBe("museums and landmarks in Lisbon");
    expect(activityQuery("Lisbon", ["food", "hiking", "wellness"])).toBe("food markets and food tours and hikes and nature spots in Lisbon");
    expect(activityQuery("Lisbon", ["Surfing"])).toBe("top attractions in Lisbon"); // free-text interests aren't mapped
  });
});

describe("searchGoogleActivities", () => {
  it("returns real activities, dropping closed and little-reviewed places", async () => {
    googleReturns([place(), place({ id: "closed", businessStatus: "CLOSED_TEMPORARILY" }), place({ id: "tiny", userRatingCount: 12 })]);
    const list = (await searchGoogleActivities({ destination: "Lisbon", categories: ["cultural"] }))!;
    expect(list.map((a) => a.id)).toEqual(["ChIJmuseum0000001"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain(KEY);
    expect(JSON.parse(init.body as string).textQuery).toBe("museums and landmarks in Lisbon");
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).not.toContain("photos"); // activities don't use photos
  });

  it("gives up — so the caller uses sample data — without a key or past the daily allowance", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect(await searchGoogleActivities({ destination: "Lisbon" })).toBeNull();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", KEY);
    quota.claim.mockResolvedValueOnce(false);
    expect(await searchGoogleActivities({ destination: "Lisbon" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("feeds searchActivities, which falls back to the sample data when Google can't be used", async () => {
    googleReturns([place()]);
    expect((await searchActivities({ destination: "Lisbon" }))[0].google).toBeDefined();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    const sample = await searchActivities({ destination: "Paris" });
    expect(sample.length).toBeGreaterThan(0);
    expect(sample.every((a) => !a.google)).toBe(true);
  });
});

describe("refreshActivity", () => {
  it("refreshes from Google by place ID, keeping the id and city", async () => {
    googleReturns([place({ rating: 4.5 })]);
    const saved = toActivity(place(), "Lisbon", "2026-08-01T00:00:00.000Z");
    expect(await refreshActivity(saved)).toMatchObject({ id: saved.id, rating: 9, location: "Avenidas Novas, Lisbon" });
    expect(fetchMock.mock.calls[0][0]).toContain("/places/ChIJmuseum0000001");
  });
});
