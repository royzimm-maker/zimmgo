import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, DEFAULT_MODEL } from "@/lib/ai/client";
import { buildChatSystemPrompt } from "@/lib/ai/prompts";
import { ADD_TO_WANDERLOG_TOOL, UPDATE_LODGING_PREFERENCES_TOOL } from "@/lib/ai/tools";
import type { TripPreferences, ChatMessage, StepId, LodgingType } from "@/types/trip";

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

export async function POST(request: NextRequest) {
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

    // Only exposed on the Lodging step — a lodging preference edit tool call
    // wouldn't make sense (and could confuse the model) anywhere else.
    const tools = stepContext === "lodging"
      ? [ADD_TO_WANDERLOG_TOOL, UPDATE_LODGING_PREFERENCES_TOOL]
      : [ADD_TO_WANDERLOG_TOOL];

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
