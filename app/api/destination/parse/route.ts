import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/http/errors";
import { rateLimit } from "@/lib/rateLimit";
import { getAnthropicClient, DEFAULT_MODEL, TRAVEL_ADVISOR_SYSTEM_PROMPT } from "@/lib/ai/client";
import { buildDestinationParsePrompt } from "@/lib/ai/prompts";
import { PARSE_DESTINATION_TOOL } from "@/lib/ai/tools";
import { logApiUsage } from "@/lib/ai/usageLog";
import { findToolInput } from "@/lib/ai/toolInput";
import { readJsonBody, tooLong } from "@/lib/http/readJsonBody";

interface ParseDestinationResult {
  cities: string[];
  displayName: string;
  likelyRoadTrip: boolean;
  flightsObviouslyRequired: boolean;
  seasonalNote?: string;
  seasonalWindowStartMonth?: number;
  seasonalWindowEndMonth?: number;
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { bucket: "destination-parse", limit: 20, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const parsed = await readJsonBody<{ text: string }>(request, 20_000);
    if (!parsed.ok) return parsed.response;
    const { text } = parsed.body;

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }
    if (text.length > 2_000) return tooLong("Destination text", 2_000);

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 512,
      system: TRAVEL_ADVISOR_SYSTEM_PROMPT,
      tools: [PARSE_DESTINATION_TOOL],
      tool_choice: { type: "tool", name: "parse_destination" },
      messages: [{ role: "user", content: buildDestinationParsePrompt(text) }],
    });
    logApiUsage("destination-parse", DEFAULT_MODEL, response.usage);

    // Conformed to the tool's schema — the client saves this into the trip.
    const result = findToolInput<ParseDestinationResult>(response.content, PARSE_DESTINATION_TOOL);
    if (!result) {
      return NextResponse.json({ error: "Couldn't make sense of that — try describing it a little differently." }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    return serverError("destination/parse", error);
  }
}
