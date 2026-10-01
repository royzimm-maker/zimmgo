// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.rateLimit }));

import { POST as hotels } from "@/app/api/hotels/search/route";
import { POST as groundTransport } from "@/app/api/ground-transport/search/route";
import { POST as flights } from "@/app/api/itinerary/search-flights/route";
import { POST as exportDocx } from "@/app/api/itinerary/export-docx/route";

function post(body: unknown) {
  return new NextRequest("http://localhost/api/x", {
    method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json" },
  });
}
const prefs = {
  activities: [], activityRankings: {}, vibes: [], transportation: [],
  destination: { cities: ["Lisbon"], displayName: "Lisbon", departureAirport: "BOS", arrivalAirport: "LIS" },
  dates: { type: "exact", startDate: "2026-10-01", endDate: "2026-10-05" },
};

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockResolvedValue(null);
});

describe("hotel search", () => {
  it("searches with valid input, clamping what it doesn't recognize", async () => {
    const res = await hotels(post({ destination: "Rome", min_stars: "4", types: ["boutique"], limit: 500 }));
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(12); // out-of-range limit dropped → default
  });

  it("rejects a missing or blank destination, and an oversized body", async () => {
    expect((await hotels(post({ min_stars: 4 }))).status).toBe(400);
    expect((await hotels(post({ destination: "   " }))).status).toBe(400);
    expect((await hotels(post({ destination: "Rome", amenities: ["x".repeat(20_000)] }))).status).toBe(413);
  });

  it("truncates an over-long destination rather than passing it through", async () => {
    const list = await (await hotels(post({ destination: "x".repeat(500) }))).json();
    expect(list.every((h: { city: string }) => h.city.length <= 200)).toBe(true);
  });

  it("is rate limited", async () => {
    m.rateLimit.mockResolvedValue(new Response("{}", { status: 429 }));
    expect((await hotels(post({ destination: "Rome" }))).status).toBe(429);
  });
});

describe("ground transport search", () => {
  it("searches a valid leg", async () => {
    const res = await groundTransport(post({ fromCity: "Mykonos", toCity: "Santorini", date: "2026-09-10" }));
    expect(res.status).toBe(200);
    expect((await res.json()).transport.length).toBe(3);
  });

  it("rejects a malformed date or missing city with 400 instead of crashing", async () => {
    expect((await groundTransport(post({ fromCity: "Mykonos", toCity: "Santorini", date: "next week" }))).status).toBe(400);
    expect((await groundTransport(post({ toCity: "Santorini", date: "2026-09-10" }))).status).toBe(400);
    expect((await groundTransport(post("not json"))).status).toBe(400);
  });
});

describe("flight search", () => {
  it("searches with valid preferences, dropping an unknown cabin class instead of pricing it as NaN", async () => {
    const res = await flights(post({ preferences: { ...prefs, airlinePrefs: { cabinClass: "ultra_luxe" } } }));
    expect(res.status).toBe(200);
    const { flights: list } = await res.json();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((f: { price: number }) => Number.isFinite(f.price))).toBe(true);
  });

  it("rejects missing preferences or bad dates with 400", async () => {
    expect((await flights(post({}))).status).toBe(400);
    const badDates = { ...prefs, dates: { type: "exact", startDate: "Oct 1", endDate: "2026-10-05" } };
    expect((await flights(post({ preferences: badDates }))).status).toBe(400);
  });
});

describe("Word export", () => {
  const itinerary = { id: "i1", days: [], flights: [], hotels: [], activities: [], restaurants: [], aiSummary: "", whyThisWorks: "" };

  it("rejects malformed or oversized itineraries before doing any layout work", async () => {
    expect((await exportDocx(post({ preferences: prefs }))).status).toBe(400);
    expect((await exportDocx(post({ itinerary: { ...itinerary, days: "many" }, preferences: prefs }))).status).toBe(400);
    expect((await exportDocx(post({ itinerary: { ...itinerary, days: Array.from({ length: 61 }, () => ({})) }, preferences: prefs }))).status).toBe(400);
    expect((await exportDocx(post({ itinerary: { ...itinerary, aiSummary: "x".repeat(700_000) }, preferences: prefs }))).status).toBe(413);
    // Wrong types inside an entry are a 400 too, not a crash (was "name.normalize is not a function").
    const bad = await exportDocx(post({ itinerary: { ...itinerary, days: [{ dayNumber: "x", location: 5 }] }, preferences: prefs }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toContain("days[0]");
  });

  it("has its own, tighter rate limit", async () => {
    m.rateLimit.mockResolvedValue(new Response("{}", { status: 429 }));
    expect((await exportDocx(post({ itinerary, preferences: prefs }))).status).toBe(429);
    expect(m.rateLimit.mock.calls[0][1]).toMatchObject({ bucket: "export-docx", limit: 10 });
  });
});
