// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ rateLimit: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/lib/ai/usageLog", () => ({ logApiUsage: vi.fn() }));
vi.mock("@/lib/ai/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/client")>()),
  getAnthropicClient: () => ({ messages: { create: m.create } }),
}));

import { POST } from "@/app/api/ai/chat/route";

const prefs = { activities: [], activityRankings: {}, vibes: [], transportation: [] };
function chat(stepContext = "lodging") {
  return POST(new NextRequest("http://localhost/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ message: "make it boutique hotels, 4 stars", history: [], preferences: prefs, stepContext }),
    headers: { "content-type": "application/json" },
  }));
}
function modelReturns(...content: unknown[]) {
  m.create.mockResolvedValue({ content, usage: { input_tokens: 1, output_tokens: 1 } });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockResolvedValue(null);
});

describe("POST /api/ai/chat — model tool output", () => {
  it("passes on a conformed preference update", async () => {
    modelReturns({ type: "tool_use", id: "t", name: "update_lodging_preferences", input: { types: "boutique", min_stars: "4", reply: "Done!" } });

    const body = await (await chat()).json();

    expect(body).toEqual({ reply: "Done!", lodgingUpdate: { types: ["boutique"], minStars: 4 } });
  });

  it("never forwards values outside the schema into the trip — nor wipes a selection with them", async () => {
    modelReturns({ type: "tool_use", id: "t", name: "update_lodging_preferences", input: { types: ["castle"], min_stars: 9, reply: "Done!" } });

    const body = await (await chat()).json();

    // No `types` at all, so the traveller's existing lodging types stay as they are.
    expect(body.lodgingUpdate).toEqual({});
  });

  it("applies nothing and says so when the tool call is unusable", async () => {
    modelReturns({ type: "tool_use", id: "t", name: "update_lodging_preferences", input: { types: ["hotel"] } }); // no reply

    const body = await (await chat()).json();

    expect(body.lodgingUpdate).toBeUndefined();
    expect(body.reply).toMatch(/couldn't apply that change/);
  });

  it("returns plain text replies unchanged", async () => {
    modelReturns({ type: "text", text: "Boutique hotels are lovely in Lisbon.", citations: null });
    expect(await (await chat()).json()).toEqual({ reply: "Boutique hotels are lovely in Lisbon." });
  });
});
