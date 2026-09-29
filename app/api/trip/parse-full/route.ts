import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getAnthropicClient, DEFAULT_MODEL, TRAVEL_ADVISOR_SYSTEM_PROMPT } from "@/lib/ai/client";
import { buildFullTripParsePrompt } from "@/lib/ai/prompts";
import { PARSE_FULL_TRIP_TOOL } from "@/lib/ai/tools";
import { logApiUsage } from "@/lib/ai/usageLog";
import { readJsonBody, tooLong } from "@/lib/api/readJsonBody";

export interface ParseFullTripResult {
  cities: string[];
  displayName: string;
  likelyRoadTrip: boolean;
  flightsObviouslyRequired: boolean;
  seasonalNote?: string;
  seasonalWindowStartMonth?: number;
  seasonalWindowEndMonth?: number;
  departureAirport?: string;
  travelers?: number;
  dates?: {
    type: "exact" | "flexible";
    startDate?: string;
    endDate?: string;
    flexibleMonth?: string;
    flexibleDuration?: number;
  };
  budgetTier?: "under_500" | "500_750" | "750_1000" | "1000_plus";
  dietaryRestrictions?: string[];
  dietaryNotes?: string;
  avoidLongQueues?: boolean;
  dayTripRequested?: boolean;
  vibes?: string[];
  activities?: string[];
  summary: string;
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { bucket: "trip-parse-full", limit: 10, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const parsed = await readJsonBody<{ text: string }>(request, 40_000);
    if (!parsed.ok) return parsed.response;
    const { text } = parsed.body;

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }
    if (text.length > 5_000) return tooLong("Trip description", 5_000);

    const todayISO = new Date().toISOString().slice(0, 10);
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      system: TRAVEL_ADVISOR_SYSTEM_PROMPT,
      tools: [PARSE_FULL_TRIP_TOOL],
      tool_choice: { type: "tool", name: "parse_full_trip" },
      messages: [{ role: "user", content: buildFullTripParsePrompt(text, todayISO) }],
    });
    logApiUsage("trip-parse-full", DEFAULT_MODEL, response.usage);

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "AI did not return a parse result" }, { status: 502 });
    }

    const result = toolUse.input as ParseFullTripResult;
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[trip/parse-full]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
