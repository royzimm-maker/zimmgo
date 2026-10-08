// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const m = vi.hoisted(() => ({
  claim: vi.fn<(name: string) => Promise<boolean>>(async () => true),
  searchFind: vi.fn(), searchUpsert: vi.fn(), photoFind: vi.fn(), photoUpsert: vi.fn(),
}));
vi.mock("@/lib/rateLimit", () => ({ claimDailyQuota: m.claim }));
vi.mock("@/lib/db", () => ({
  prisma: {
    placeSearchCache: { findUnique: m.searchFind, upsert: m.searchUpsert, deleteMany: vi.fn(async () => ({})) },
    placePhotoCache: { findUnique: m.photoFind, upsert: m.photoUpsert, deleteMany: vi.fn(async () => ({})) },
  },
}));

import { CACHE_DAYS, placePhoto, searchPlaces, type GooglePlace } from "@/lib/search/googlePlaces";
import { searchGoogleRestaurants } from "@/lib/search/googleRestaurants";

const KEY = "AIzaTESTKEY000000000000000000000000000";
const place = (id: string): GooglePlace => ({
  id, displayName: { text: id }, rating: 4.6, userRatingCount: 500, businessStatus: "OPERATIONAL",
  photos: [{ name: `places/${id}/photos/p1`, authorAttributions: [{ displayName: "Ana", uri: "https://maps.google.com/contrib/1" }] }],
});
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  m.claim.mockResolvedValue(true);
  m.searchFind.mockResolvedValue(null);
  m.photoFind.mockResolvedValue(null);
  m.searchUpsert.mockResolvedValue({});
  m.photoUpsert.mockResolvedValue({});
  fetchMock = vi.fn(async (url: string) =>
    new Response(JSON.stringify(url.includes("/media") ? { photoUri: "https://lh3.googleusercontent.com/fresh" } : { places: [place("fresh")] }))
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_PLACES_API_KEY", KEY);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("searchPlaces cache", () => {
  it("serves a recent search from the cache — no Google call, no allowance used, Google's original date kept", async () => {
    const fetchedAt = daysAgo(3);
    m.searchFind.mockResolvedValue({ places: [place("cached")], fetchedAt });

    const result = await searchPlaces("Restaurants in Lisbon", ["id"]);

    expect(result).toEqual({ places: [place("cached")], fetchedAt: fetchedAt.toISOString() });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(m.claim).not.toHaveBeenCalled();
  });

  it("goes to Google once the cached copy is older than the cache window, and stores the new one", async () => {
    m.searchFind.mockResolvedValue({ places: [place("old")], fetchedAt: daysAgo(CACHE_DAYS + 1) });

    const result = await searchPlaces("restaurants in Lisbon", ["id"]);

    expect(result?.places.map((p) => p.id)).toEqual(["fresh"]);
    expect(m.claim).toHaveBeenCalledWith("google-places-search", expect.any(Number));
    expect(m.searchUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ places: [place("fresh")] }) }));
  });

  it("goes to Google when the cache can't be read", async () => {
    m.searchFind.mockRejectedValue(new Error("table missing"));
    expect((await searchPlaces("restaurants in Lisbon", ["id"]))?.places[0].id).toBe("fresh");
  });

  it("treats the same search in different case as one entry, but different filters or fields as separate ones", async () => {
    await searchPlaces("Restaurants in Lisbon", ["id"]);
    await searchPlaces("restaurants in lisbon ", ["id"]);
    await searchPlaces("restaurants in Lisbon", ["id"], { priceLevels: ["PRICE_LEVEL_MODERATE"] });
    await searchPlaces("restaurants in Lisbon", ["id", "rating"]);
    const keys = m.searchFind.mock.calls.map((c) => c[0].where.key);
    expect(keys[0]).toBe(keys[1]);
    expect(new Set(keys).size).toBe(3);
  });

  it("doesn't use the cache without a key — Google isn't configured", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect(await searchPlaces("restaurants in Lisbon", ["id"])).toBeNull();
    expect(m.searchFind).not.toHaveBeenCalled();
  });
});

describe("placePhoto cache", () => {
  it("reuses a recent photo and its credit without a Google call", async () => {
    m.photoFind.mockResolvedValue({ url: "https://lh3.googleusercontent.com/cached", authorName: "Ana", authorUri: "https://maps.google.com/contrib/1", fetchedAt: daysAgo(1) });
    expect(await placePhoto(place("x"))).toEqual({ url: "https://lh3.googleusercontent.com/cached", attribution: { name: "Ana", uri: "https://maps.google.com/contrib/1" } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(m.claim).not.toHaveBeenCalled();
  });

  it("fetches and stores a photo it hasn't got", async () => {
    expect((await placePhoto(place("x")))?.url).toBe("https://lh3.googleusercontent.com/fresh");
    expect(m.photoUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ url: "https://lh3.googleusercontent.com/fresh", authorName: "Ana" }) }));
  });
});

describe("cached places keep their original date", () => {
  it("a restaurant served from the cache is dated when Google returned it, so its refresh comes on time", async () => {
    const fetchedAt = daysAgo(5);
    m.searchFind.mockResolvedValue({ places: [place("ChIJcached000001")], fetchedAt });
    const [r] = (await searchGoogleRestaurants({ destination: "Lisbon" }))!;
    expect(r.google?.fetchedAt).toBe(fetchedAt.toISOString());
  });
});
