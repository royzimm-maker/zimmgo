import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getAnthropicClient, DEFAULT_MODEL, TRAVEL_ADVISOR_SYSTEM_PROMPT } from "@/lib/ai/client";
import { buildDestinationParsePrompt } from "@/lib/ai/prompts";
import { PARSE_DESTINATION_TOOL } from "@/lib/ai/tools";

interface ParseDestinationResult {
  cities: string[];
  displayName: string;
  likelyRoadTrip: boolean;
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { bucket: "destination-parse", limit: 20, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const { text } = await request.json() as { text: string };

    if (!text?.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 512,
      system: TRAVEL_ADVISOR_SYSTEM_PROMPT,
      tools: [PARSE_DESTINATION_TOOL],
      tool_choice: { type: "tool", name: "parse_destination" },
      messages: [{ role: "user", content: buildDestinationParsePrompt(text) }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "AI did not return a parse result" }, { status: 502 });
    }

    const result = toolUse.input as ParseDestinationResult;
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[destination/parse]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
