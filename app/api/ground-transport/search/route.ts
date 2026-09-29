import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api/errors";
import { searchGroundTransport } from "@/lib/api/groundTransport";
import { rateLimit } from "@/lib/rateLimit";
import { readJsonBody } from "@/lib/api/readJsonBody";
import { parseWithSchema, type JsonSchema } from "@/lib/ai/toolInput";
import type { TripPreferences } from "@/types/trip";

// Deterministic, non-AI ground-transport search — used by the review
// wizard's manual "Search" fallback for a leg where generation didn't
// produce any options. Mirrors app/api/itinerary/search-flights/route.ts.
const BODY_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    fromCity: { type: "string", maxLength: 100 },
    toCity: { type: "string", maxLength: 100 },
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
  required: ["fromCity", "toCity", "date"],
};

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { bucket: "search", limit: 60, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const parsed = await readJsonBody<{ preferences?: unknown }>(request, 100_000);
    if (!parsed.ok) return parsed.response;
    const leg = parseWithSchema<{ fromCity: string; toCity: string; date: string }>(BODY_SCHEMA, parsed.body);
    if (!leg || !leg.fromCity || !leg.toCity) {
      return NextResponse.json({ error: "fromCity, toCity and a YYYY-MM-DD date are required" }, { status: 400 });
    }
    // The search doesn't read preferences yet (kept for parity with the other searches).
    const preferences = (parsed.body.preferences ?? {}) as TripPreferences;
    const transport = await searchGroundTransport(leg.fromCity, leg.toCity, leg.date, preferences);
    return NextResponse.json({ transport });
  } catch (error: unknown) {
    return serverError("ground-transport/search", error);
  }
}
