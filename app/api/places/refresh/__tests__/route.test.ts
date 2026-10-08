// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ rateLimit: vi.fn(), refreshRestaurant: vi.fn(), refreshActivity: vi.fn(), refreshHotel: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/lib/search/googleRestaurants", () => ({ refreshRestaurant: m.refreshRestaurant }));
vi.mock("@/lib/search/googleActivities", () => ({ refreshActivity: m.refreshActivity }));
vi.mock("@/lib/search/googleHotels", () => ({ refreshHotel: m.refreshHotel }));

import { POST } from "@/app/api/places/refresh/route";

const post = (body: unknown) => POST(new NextRequest("http://localhost/api/places/refresh", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
}));
const saved = (id: string) => ({ id, name: id, location: "Lisbon", google: { placeId: id, mapsUri: "", fetchedAt: "" } });

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockResolvedValue(null);
});

describe("POST /api/places/refresh", () => {
  it("returns the restaurants, activities and hotels Google could refresh, leaving out the rest", async () => {
    m.refreshRestaurant.mockImplementation(async (r: { id: string }) => (r.id === "a" ? { ...r, rating: 9.4 } : null));
    m.refreshActivity.mockImplementation(async (a: { id: string }) => ({ ...a, rating: 8.8 }));
    m.refreshHotel.mockImplementation(async (h: { id: string }) => ({ ...h, rating: 9 }));
    const res = await post({ restaurants: [saved("a"), saved("b")], activities: [saved("m")], hotels: [saved("h")] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      restaurants: [{ ...saved("a"), rating: 9.4 }],
      activities: [{ ...saved("m"), rating: 8.8 }],
      hotels: [{ ...saved("h"), rating: 9 }],
    });
  });

  it("treats a missing list as empty", async () => {
    const res = await post({ activities: [saved("m")] });
    expect(res.status).toBe(200);
    expect(m.refreshRestaurant).not.toHaveBeenCalled();
  });

  it("rejects anything that isn't a list of saved Google places, or too many in total", async () => {
    expect((await post({ restaurants: "x" })).status).toBe(400);
    expect((await post({ activities: [{ id: "s", location: "Lisbon" }] })).status).toBe(400);
    const many = Array.from({ length: 16 }, (_, i) => saved(`p${i}`));
    expect((await post({ restaurants: many, activities: many })).status).toBe(400);
    expect(m.refreshRestaurant).not.toHaveBeenCalled();
    expect(m.refreshActivity).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    m.rateLimit.mockResolvedValue(new Response("{}", { status: 429 }));
    expect((await post({ restaurants: [saved("a")] })).status).toBe(429);
  });
});
