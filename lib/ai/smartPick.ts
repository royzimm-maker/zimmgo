import { getAnthropicClient, withinDeadline, AI_TIMEOUT_MS, DEFAULT_MODEL, TRAVEL_ADVISOR_SYSTEM_PROMPT } from "@/lib/ai/client";
import { SMART_PICK_TOOL } from "@/lib/ai/tools";
import { buildHotelPickPrompt, buildSchedulePickPrompt, buildPreferencePickPrompt, buildActivitiesForCityPickPrompt, buildRestaurantsForCityPickPrompt } from "@/lib/ai/prompts";
import { logApiUsage } from "@/lib/ai/usageLog";
import { findToolInput } from "@/lib/ai/toolInput";
import type { SmartPickKind, SmartPickRequestBody, SmartPickResponse } from "@/types/smartPick";

const PREFERENCE_KINDS = new Set<SmartPickKind>(["activities", "vibes", "lodging"]);

// Carries the HTTP status the smart-pick route should answer with.
export class SmartPickError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// One smart-pick AI call — shared by the /api/itinerary/smart-pick route and
// the server-side auto-plan job, so both run exactly the same prompt. A job
// passes its deadline so the call can't outlive the function; interactive
// use gets the client's standard timeout.
export async function runSmartPick(body: SmartPickRequestBody, deadline?: number): Promise<SmartPickResponse> {
  const { kind, preferences } = body;
  const prompt = kind === "hotel"
    ? buildHotelPickPrompt(body.city ?? "", preferences, body.hotels ?? [])
    : kind === "schedule"
    ? buildSchedulePickPrompt(body.city ?? "", preferences, body.days ?? [], body.activities ?? [], body.restaurants ?? [])
    : kind === "activities_for_city"
    ? buildActivitiesForCityPickPrompt(body.city ?? "", preferences, body.activities ?? [])
    : kind === "restaurants_for_city"
    ? buildRestaurantsForCityPickPrompt(body.city ?? "", preferences, body.restaurants ?? [])
    : PREFERENCE_KINDS.has(kind)
    ? buildPreferencePickPrompt(kind as "activities" | "vibes" | "lodging", preferences, body.candidates ?? [])
    : null;

  if (!prompt) throw new SmartPickError(`Unknown smart-pick kind: ${kind}`, 400);

  const client = getAnthropicClient();
  const options = deadline === undefined ? undefined : withinDeadline(deadline, AI_TIMEOUT_MS);
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    system: TRAVEL_ADVISOR_SYSTEM_PROMPT,
    tools: [SMART_PICK_TOOL],
    tool_choice: { type: "tool", name: "make_selection" },
    messages: [{ role: "user", content: prompt }],
  }, options);
  logApiUsage("smart-pick", DEFAULT_MODEL, response.usage, response.stop_reason);

  const selection = findToolInput<SmartPickResponse>(response.content, SMART_PICK_TOOL);
  if (!selection) throw new SmartPickError("AI did not return a usable selection", 502);
  return selection;
}
