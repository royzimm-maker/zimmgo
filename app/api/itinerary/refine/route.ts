import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getAnthropicClient, DEFAULT_MODEL } from "@/lib/ai/client";
import { logApiUsage } from "@/lib/ai/usageLog";
import type { TripPreferences } from "@/types/trip";

interface RefineBody {
  question: string;
  contextItem: string;      // name of activity or neighborhood being asked about
  contextType: "activity" | "neighborhood";
  preferences: TripPreferences;
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { bucket: "itinerary-refine", limit: 20, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const body = await request.json() as RefineBody;
    const { question, contextItem, contextType, preferences } = body;

    if (!question?.trim() || !contextItem) {
      return NextResponse.json({ error: "question and contextItem are required" }, { status: 400 });
    }

    const dest = preferences.destination?.displayName ?? "the destination";
    const itemLabel = contextType === "neighborhood" ? "neighborhood" : "activity";

    const systemPrompt =
      `You are ZimmGo, an expert travel advisor. The traveller is planning a trip to ${dest}. ` +
      `Answer their question about the ${itemLabel} "${contextItem}" concisely and helpfully. ` +
      `Be specific, practical, and enthusiastic. Keep your answer under 120 words. ` +
      `If asked for alternatives, suggest 2–3 comparable options with a one-line description each. ` +
      `Always write in American English spelling (e.g. "neighborhood", "harbor", "color"), regardless of the destination.`;

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    });
    await logApiUsage("itinerary-refine", DEFAULT_MODEL, response.usage);

    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    console.error("[itinerary/refine]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
