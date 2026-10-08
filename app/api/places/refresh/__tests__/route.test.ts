// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ rateLimit: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/lib/search/googleRestaurants", () => ({ refreshRestaurant: m.refresh }));

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
  it("returns the restaurants Google could refresh, leaving out the rest", async () => {
    m.refresh.mockImplementation(async (r: { id: string }) => (r.id === "a" ? { ...r, rating: 9.4 } : null));
    const res = await post({ restaurants: [saved("a"), saved("b")] });
    expect(res.status).toBe(200);
    expect((await res.json()).restaurants).toEqual([{ ...saved("a"), rating: 9.4 }]);
  });

  it("rejects anything that isn't a list of saved Google places, or too many", async () => {
    expect((await post({ restaurants: "x" })).status).toBe(400);
    expect((await post({ restaurants: [{ id: "s", location: "Lisbon" }] })).status).toBe(400);
    expect((await post({ restaurants: Array.from({ length: 31 }, (_, i) => saved(`p${i}`)) })).status).toBe(400);
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    m.rateLimit.mockResolvedValue(new Response("{}", { status: 429 }));
    expect((await post({ restaurants: [saved("a")] })).status).toBe(429);
  });
});
