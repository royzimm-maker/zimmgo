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
import { logApiUsage } from "@/lib/ai/usageLog";
import { findToolInput } from "@/lib/ai/toolInput";
import { readJsonBody, tooLong, tooMany } from "@/lib/api/readJsonBody";
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

const MAX_MESSAGE_CHARS = 4_000;
const MAX_CONTEXT_ITEMS = 200;

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { bucket: "chat", limit: 20, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const parsed = await readJsonBody<ChatRequest>(request, 200_000);
    if (!parsed.ok) return parsed.response;
    const { message, history, preferences, itineraryContext, stepContext } = parsed.body;

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_CHARS) return tooLong("Message", MAX_MESSAGE_CHARS);
    if (
      (itineraryContext?.activities?.length ?? 0) > MAX_CONTEXT_ITEMS ||
      (itineraryContext?.restaurants?.length ?? 0) > MAX_CONTEXT_ITEMS
    ) {
      return tooMany("itinerary context items", MAX_CONTEXT_ITEMS);
    }

    const client = getAnthropicClient();
    const system = buildChatSystemPrompt(preferences, itineraryContext, stepContext);

    // Convert stored chat history to Anthropic message format. History is
    // client-supplied, so each entry is length-capped like the new message.
    const messages = [
      ...(Array.isArray(history) ? history : []).slice(-12).map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: String(m.content ?? "").slice(0, MAX_MESSAGE_CHARS),
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
    logApiUsage("chat", DEFAULT_MODEL, response.usage);

    // Tool inputs are conformed to their schemas (lib/ai/toolInput.ts) before
    // they reach the client, which writes them straight into the saved trip.
    const wanderlog = findToolInput<{ items: WanderlogToolItem[]; reply: string }>(response.content, ADD_TO_WANDERLOG_TOOL);
    if (wanderlog) {
      return NextResponse.json({ reply: wanderlog.reply, wanderlogItems: wanderlog.items });
    }

    const lodging = findToolInput<LodgingUpdateToolInput>(response.content, UPDATE_LODGING_PREFERENCES_TOOL);
    if (lodging) {
      return NextResponse.json({
        reply: lodging.reply,
        lodgingUpdate: {
          types: lodging.types,
          minStars: lodging.min_stars,
          amenities: lodging.amenities,
          otherAmenity: lodging.other_amenity,
        },
      });
    }

    const activity = findToolInput<ActivityUpdateToolInput>(response.content, UPDATE_ACTIVITY_PREFERENCES_TOOL);
    if (activity) {
      return NextResponse.json({ reply: activity.reply, activityUpdate: activity.activities });
    }

    const vibe = findToolInput<VibeUpdateToolInput>(response.content, UPDATE_VIBE_PREFERENCES_TOOL);
    if (vibe) {
      return NextResponse.json({ reply: vibe.reply, vibeUpdate: vibe.vibes });
    }

    const airline = findToolInput<AirlineUpdateToolInput>(response.content, UPDATE_AIRLINE_PREFERENCES_TOOL);
    if (airline) {
      return NextResponse.json({
        reply: airline.reply,
        airlineUpdate: {
          airlines: airline.airlines,
          alliances: airline.alliances,
          preferNonstop: airline.prefer_nonstop,
          cabinClasses: airline.cabin_classes,
          prioritizeLowestFare: airline.prioritize_lowest_fare,
        },
      });
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    // A tool call whose input didn't survive validation applies nothing —
    // say so rather than returning an empty reply.
    const unusableToolCall = !text.trim() && response.content.some((b) => b.type === "tool_use");
    return NextResponse.json({
      reply: unusableToolCall ? "Sorry — I couldn't apply that change. Could you say it a different way?" : text,
    });
  } catch (error: unknown) {
    console.error("[ai/chat]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
