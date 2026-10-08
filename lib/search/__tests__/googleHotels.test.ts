// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const quota = vi.hoisted(() => ({ claim: vi.fn<(name: string) => Promise<boolean>>(async () => true) }));
vi.mock("@/lib/rateLimit", () => ({ claimDailyQuota: quota.claim }));

import { checkPricesUrl, hotelQuery, refreshHotel, searchGoogleHotels, toHotel } from "@/lib/search/googleHotels";
import { searchHotels } from "@/lib/search/hotels";
import { formatNightlyRate } from "@/lib/utils";
import { toolResultForModel } from "@/lib/itinerary/runGeneration";
import { buildHotelPickPrompt } from "@/lib/ai/prompts";
import type { GooglePlace } from "@/lib/search/googlePlaces";
import type { TripPreferences } from "@/types/trip";

const KEY = "AIzaTESTKEY000000000000000000000000000";
const place = (over: Partial<GooglePlace> = {}): GooglePlace => ({
  id: "ChIJhotel00000001",
  displayName: { text: "Memmo Alfama" },
  primaryTypeDisplayName: { text: "Hotel" },
  types: ["hotel", "lodging"],
  rating: 4.7,
  userRatingCount: 2210,
  googleMapsUri: "https://maps.google.com/?cid=3",
  websiteUri: "https://memmohotels.com",
  editorialSummary: { text: "Chic hotel with a rooftop pool and river views." },
  businessStatus: "OPERATIONAL",
  addressComponents: [{ longText: "Alfama", types: ["neighborhood"] }],
  photos: [{ name: "places/ChIJhotel00000001/photos/p1", authorAttributions: [{ displayName: "Rui", uri: "https://maps.google.com/contrib/9" }] }],
  ...over,
});

let fetchMock: ReturnType<typeof vi.fn>;
function googleReturns(places: GooglePlace[]) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes(":searchText")) return new Response(JSON.stringify({ places }));
    if (url.includes("/media")) return new Response(JSON.stringify({ photoUri: "https://lh3.googleusercontent.com/hotel1" }));
    return new Response(JSON.stringify(places[0]));
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

describe("hotelQuery", () => {
  it("folds the class, kind and first amenity the traveller asked for into the search", () => {
    expect(hotelQuery({ destination: "Lisbon" })).toBe("hotels in Lisbon");
    expect(hotelQuery({ destination: "Lisbon", min_stars: 4, types: ["boutique"], amenities: ["Pool"] })).toBe("4-star boutique hotels with pool in Lisbon");
    expect(hotelQuery({ destination: "Lisbon", min_stars: 4, types: ["hostel"] })).toBe("hostels in Lisbon"); // no star class for hostels
    expect(hotelQuery({ destination: "Lisbon", types: ["airbnb"] })).toBe("hotels in Lisbon");
  });
});

describe("toHotel", () => {
  it("maps a Google place without inventing a star class, and with an estimated rate", () => {
    const h = toHotel(place(), { destination: "Lisbon", min_stars: 4, check_in: "2026-11-01", check_out: "2026-11-04" }, "2026-10-08T00:00:00.000Z");
    expect(h).toMatchObject({
      id: "ChIJhotel00000001", name: "Memmo Alfama", stars: 0, city: "Lisbon", location: "Alfama, Lisbon",
      pricePerNight: 220, priceIsEstimate: true, rating: 9.4, ratingSource: "Google Reviews", reviewCount: 2210,
      highlights: ["Hotel", "Alfama"], description: "Chic hotel with a rooftop pool and river views.",
      google: { placeId: "ChIJhotel00000001", mapsUri: "https://maps.google.com/?cid=3", websiteUri: "https://memmohotels.com" },
    });
    expect(h.bookingUrl).toBe("https://www.booking.com/searchresults.html?ss=Memmo+Alfama+Lisbon&checkin=2026-11-01&checkout=2026-11-04");
  });

  it("takes the rate from Google's price level when it has one, else the class searched", () => {
    expect(toHotel(place({ priceLevel: "PRICE_LEVEL_INEXPENSIVE" }), { destination: "Lisbon", min_stars: 5 }, "").pricePerNight).toBe(90);
    expect(toHotel(place(), { destination: "Lisbon", min_stars: 5 }, "").pricePerNight).toBe(450);
    expect(toHotel(place(), { destination: "Lisbon" }, "").pricePerNight).toBe(220);
  });

  it("links to prices without dates when the trip has none, and without repeating the city", () => {
    expect(checkPricesUrl("Lisbon Story Guesthouse", "Lisbon")).toBe("https://www.booking.com/searchresults.html?ss=Lisbon+Story+Guesthouse");
  });
});

describe("searchGoogleHotels", () => {
  it("returns real hotels with a key-free photo and its credit", async () => {
    googleReturns([place(), place({ id: "few", userRatingCount: 9 })]);
    const list = (await searchGoogleHotels({ destination: "Lisbon" }))!;
    expect(list.map((h) => h.id)).toEqual(["ChIJhotel00000001"]);
    expect(list[0].imageUrl).toBe("https://lh3.googleusercontent.com/hotel1");
    expect(list[0].google?.photoAttribution).toEqual({ name: "Rui", uri: "https://maps.google.com/contrib/9" });
    expect(JSON.stringify(list)).not.toContain(KEY);
  });

  it("feeds searchHotels, which falls back to the sample data when Google can't be used", async () => {
    googleReturns([place()]);
    expect((await searchHotels({ destination: "Lisbon" }))[0].google).toBeDefined();
    quota.claim.mockResolvedValue(false);
    const sample = await searchHotels({ destination: "Paris" });
    expect(sample.length).toBeGreaterThan(0);
    expect(sample.every((h) => !h.google && h.stars > 0)).toBe(true);
  });
});

describe("refreshHotel", () => {
  it("refreshes Google's details but keeps the id, city, estimated rate and dated price link", async () => {
    googleReturns([place({ rating: 4.4, displayName: { text: "Memmo Alfama Hotel" } })]);
    const saved = toHotel(place(), { destination: "Lisbon", min_stars: 5, check_in: "2026-11-01", check_out: "2026-11-04" }, "2026-08-01T00:00:00.000Z");
    const fresh = (await refreshHotel(saved))!;
    expect(fresh).toMatchObject({ id: saved.id, name: "Memmo Alfama Hotel", rating: 8.8, city: "Lisbon", pricePerNight: 450, bookingUrl: saved.bookingUrl });
  });
});

describe("how an estimated rate is shown", () => {
  it("is called an estimate wherever a nightly rate is printed", () => {
    expect(formatNightlyRate({ pricePerNight: 220, priceIsEstimate: true })).toBe("~$220/night (est.)");
    expect(formatNightlyRate({ pricePerNight: 180 })).toBe("$180/night");
  });

  it("tells Claude the rate is an estimate, gives Google's rating, and never a 0-star class", () => {
    const hotel = toHotel(place(), { destination: "Lisbon" }, "");
    const prompt = buildHotelPickPrompt("Lisbon", { vibes: [] } as unknown as TripPreferences, [hotel]);
    expect(prompt).toContain("4.7★ on Google (2210 reviews)");
    expect(prompt).toContain("about $220/night (estimate)");
    expect(prompt).not.toContain("0★");
    const forModel = toolResultForModel([hotel]);
    expect(forModel).not.toContain('"stars"');
    expect(forModel).not.toMatch(/Uri"|Url"/);
  });
});
