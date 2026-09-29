// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/local-discovery/route";

function get(destination: string, cities: string[] = []) {
  const params = new URLSearchParams({ destination });
  for (const c of cities) params.append("city", c);
  return GET(new NextRequest(`http://localhost/api/local-discovery?${params}`));
}

describe("GET /api/local-discovery", () => {
  it("returns just the matched destination's guide", async () => {
    const res = await get("Iceland — Reykjavik");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.destination).toBe("Iceland");
    // Only one destination's data — not the whole curated set.
    expect(JSON.stringify(body)).not.toContain("Amalfi");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
  });

  it("merges region picks into the country guide for a multi-city trip", async () => {
    const body = await (await get("Italy — Rome & Amalfi Coast", ["Rome", "Positano"])).json();
    expect(body.destination).toBe("Italy — Rome & Amalfi Coast");
    expect(JSON.stringify(body.hiddenGems)).not.toBe("[]");
  });

  it("falls back to the generic guide for an unknown destination", async () => {
    const body = await (await get("Ulaanbaatar")).json();
    expect(body.destination).toBe("Ulaanbaatar");
    expect(body.apps.length).toBeGreaterThan(0);
  });

  it("rejects oversized input", async () => {
    expect((await get("x".repeat(201))).status).toBe(400);
    expect((await get("Italy", Array.from({ length: 31 }, () => "Rome"))).status).toBe(400);
  });
});
