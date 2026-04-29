import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, DEFAULT_MODEL } from "@/lib/ai/client";
import { buildChatSystemPrompt } from "@/lib/ai/prompts";
import type { TripPreferences, ChatMessage } from "@/types/trip";

interface ChatRequest {
  message: string;
  history: ChatMessage[];
  preferences: TripPreferences;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history, preferences }: ChatRequest = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const client = getAnthropicClient();
    const system = buildChatSystemPrompt(preferences);

    // Convert stored chat history to Anthropic message format
    const messages = [
      ...history.slice(-12).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      system,
      messages,
    });

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
