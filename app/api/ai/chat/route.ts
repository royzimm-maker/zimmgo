import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getAnthropicClient, DEFAULT_MODEL } from "@/lib/ai/client";
import { buildChatSystemPrompt } from "@/lib/ai/prompts";
import {
  ADD_TO_WANDERLOG_TOOL,
  UPDATE_LODGING_PREFERENCES_TOOL,
  UPDATE_ACTIVITY_PREFERENCES_TOOL,
  UPDATE_VIBE_PREFERENCES_TOOL,
  UPDATE_AIRLINE_PREFERENCES_TOOL,
} from "@/lib/ai/tools";
import type { TripPreferences, ChatMessage, StepId, LodgingType, AirlineAlliance } from "@/types/trip";

interface ChatRequest {
  message: string;
  history: ChatMessage[];
  preferences: TripPreferences;
  itineraryContext?: { activities: string[]; restaurants: string[] };
  stepContext?: StepId;
}

interface WanderlogToolItem {
  label: string;
  source: "activity" | "restaurant" | "discovery" | "custom";
  location?: string;
}

interface LodgingUpdateToolInput {
  types?: LodgingType[];
  min_stars?: 3 | 4 | 5;
  amenities?: string[];
  other_amenity?: string;
  reply: string;
}

interface ActivityUpdateToolInput {
  activities: string[];
  reply: string;
}

interface VibeUpdateToolInput {
  vibes: string[];
  reply: string;
}

interface AirlineUpdateToolInput {
  airlines?: string[];
  alliances?: AirlineAlliance[];
  prefer_nonstop?: boolean;
  cabin_classes?: string[];
  prioritize_lowest_fare?: boolean;
  reply: string;
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { bucket: "chat", limit: 20, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const { message, history, preferences, itineraryContext, stepContext }: ChatRequest = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const client = getAnthropicClient();
    const system = buildChatSystemPrompt(preferences, itineraryContext, stepContext);

    // Convert stored chat history to Anthropic message format
    const messages = [
      ...history.slice(-12).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    // Each preference-edit tool is only exposed on its own step — offering it
    // elsewhere wouldn't make sense (and could confuse the model into calling
    // it out of context).
    const tools = [
      ADD_TO_WANDERLOG_TOOL,
      ...(stepContext === "lodging" ? [UPDATE_LODGING_PREFERENCES_TOOL] : []),
      ...(stepContext === "activities" ? [UPDATE_ACTIVITY_PREFERENCES_TOOL] : []),
      ...(stepContext === "vibe" ? [UPDATE_VIBE_PREFERENCES_TOOL] : []),
      ...(stepContext === "airlines" ? [UPDATE_AIRLINE_PREFERENCES_TOOL] : []),
    ];

    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      system,
      tools,
      messages,
    });

    const wanderlogUse = response.content.find((b) => b.type === "tool_use" && b.name === "add_to_wanderlog");
    if (wanderlogUse && wanderlogUse.type === "tool_use") {
      const input = wanderlogUse.input as { items: WanderlogToolItem[]; reply: string };
      return NextResponse.json({ reply: input.reply, wanderlogItems: input.items });
    }

    const lodgingUse = response.content.find((b) => b.type === "tool_use" && b.name === "update_lodging_preferences");
    if (lodgingUse && lodgingUse.type === "tool_use") {
      const input = lodgingUse.input as LodgingUpdateToolInput;
      return NextResponse.json({
        reply: input.reply,
        lodgingUpdate: {
          types: input.types,
          minStars: input.min_stars,
          amenities: input.amenities,
          otherAmenity: input.other_amenity,
        },
      });
    }

    const activityUse = response.content.find((b) => b.type === "tool_use" && b.name === "update_activity_preferences");
    if (activityUse && activityUse.type === "tool_use") {
      const input = activityUse.input as ActivityUpdateToolInput;
      return NextResponse.json({ reply: input.reply, activityUpdate: input.activities });
    }

    const vibeUse = response.content.find((b) => b.type === "tool_use" && b.name === "update_vibe_preferences");
    if (vibeUse && vibeUse.type === "tool_use") {
      const input = vibeUse.input as VibeUpdateToolInput;
      return NextResponse.json({ reply: input.reply, vibeUpdate: input.vibes });
    }

    const airlineUse = response.content.find((b) => b.type === "tool_use" && b.name === "update_airline_preferences");
    if (airlineUse && airlineUse.type === "tool_use") {
      const input = airlineUse.input as AirlineUpdateToolInput;
      return NextResponse.json({
        reply: input.reply,
        airlineUpdate: {
          airlines: input.airlines,
          alliances: input.alliances,
          preferNonstop: input.prefer_nonstop,
          cabinClasses: input.cabin_classes,
          prioritizeLowestFare: input.prioritize_lowest_fare,
        },
      });
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    return NextResponse.json({ reply: text });
  } catch (error: unknown) {
    console.error("[ai/chat]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
