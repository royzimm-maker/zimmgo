// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ rateLimit: vi.fn(), getAnthropicClient: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/lib/ai/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/client")>()),
  getAnthropicClient: m.getAnthropicClient,
}));

import { POST as smartPick } from "@/app/api/itinerary/smart-pick/route";
import { POST as chat } from "@/app/api/ai/chat/route";
import { POST as parseFull } from "@/app/api/trip/parse-full/route";
import { readJsonBody } from "@/lib/http/readJsonBody";

function post(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json" },
  });
}
const prefs = { activities: [], activityRankings: {}, vibes: [], transportation: [] };

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockResolvedValue(null);
});

describe("AI route input bounds — rejected before any AI call", () => {
  it("smart-pick rejects oversized option lists", async () => {
    const res = await smartPick(post("/api/itinerary/smart-pick", {
      kind: "hotel", city: "Rome", preferences: prefs, hotels: Array.from({ length: 61 }, (_, i) => ({ id: String(i) })),
    }));
    expect(res.status).toBe(400);
    expect(m.getAnthropicClient).not.toHaveBeenCalled();
  });

  it("smart-pick rejects a non-array list", async () => {
    const res = await smartPick(post("/api/itinerary/smart-pick", { kind: "hotel", preferences: prefs, hotels: "lots" }));
    expect(res.status).toBe(400);
  });

  it("chat rejects an overly long message", async () => {
    const res = await chat(post("/api/ai/chat", { message: "x".repeat(4_001), history: [], preferences: prefs }));
    expect(res.status).toBe(400);
    expect(m.getAnthropicClient).not.toHaveBeenCalled();
  });

  it("chat rejects an oversized body", async () => {
    const res = await chat(post("/api/ai/chat", { message: "hi", history: [{ role: "user", content: "x".repeat(250_000) }], preferences: prefs }));
    expect(res.status).toBe(413);
  });

  it("parse-full rejects an overly long description", async () => {
    const res = await parseFull(post("/api/trip/parse-full", { text: "x".repeat(5_001) }));
    expect(res.status).toBe(400);
    expect(m.getAnthropicClient).not.toHaveBeenCalled();
  });
});

describe("readJsonBody", () => {
  it("rejects invalid JSON with 400", async () => {
    const r = await readJsonBody(post("/x", "{nope"), 1_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });

  it("parses a body within the limit", async () => {
    const r = await readJsonBody<{ a: number }>(post("/x", { a: 1 }), 1_000);
    expect(r.ok && r.body.a).toBe(1);
  });
});
