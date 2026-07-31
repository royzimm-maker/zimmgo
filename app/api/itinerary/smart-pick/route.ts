import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, DEFAULT_MODEL, TRAVEL_ADVISOR_SYSTEM_PROMPT } from "@/lib/ai/client";
import { SMART_PICK_TOOL } from "@/lib/ai/tools";
import { buildHotelPickPrompt, buildSchedulePickPrompt } from "@/lib/ai/prompts";
import type { TripPreferences, HotelOption, ActivityOption, RestaurantOption, ItineraryDay } from "@/types/trip";

interface SmartPickRequest {
  kind: "hotel" | "schedule";
  city: string;
  preferences: TripPreferences;
  hotels?: HotelOption[];
  days?: ItineraryDay[];
  activities?: ActivityOption[];
  restaurants?: RestaurantOption[];
}

interface SmartPickResult {
  picks: { id: string; dayNumber?: number; reason: string }[];
  summary: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SmartPickRequest = await request.json();
    const { kind, city, preferences } = body;

    const prompt = kind === "hotel"
      ? buildHotelPickPrompt(city, preferences, body.hotels ?? [])
      : buildSchedulePickPrompt(city, preferences, body.days ?? [], body.activities ?? [], body.restaurants ?? []);

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      system: TRAVEL_ADVISOR_SYSTEM_PROMPT,
      tools: [SMART_PICK_TOOL],
      tool_choice: { type: "tool", name: "make_selection" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "AI did not return a selection" }, { status: 502 });
    }

    const result = toolUse.input as SmartPickResult;
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[itinerary/smart-pick]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
