import Anthropic from "@anthropic-ai/sdk";

// ── Timeouts ──
// The SDK's defaults (10-minute timeout, 2 retries) are built for long-lived
// servers. Here every call runs inside a serverless function with a hard
// time limit, where a stalled call just gets the function killed with no
// error reported. So interactive calls (chat, parsing, smart-picks) give up
// after 30s with one retry, and the background jobs budget each call
// against their own deadline (see withinDeadline).
export const AI_TIMEOUT_MS = 30_000;
const AI_MAX_RETRIES = 1;

type RequestOptions = NonNullable<Parameters<Anthropic["messages"]["create"]>[1]>;

// Thrown when a background job has too little time left for another AI call
// — so it fails with a clear message instead of being killed mid-call.
export class AIDeadlineError extends Error {
  constructor() {
    super("Ran out of time before the AI finished");
  }
}

/**
 * Request options that keep an AI call (and its retry, if there's room for
 * one) inside `deadline` (ms since epoch), capped at `maxTimeoutMs` per
 * attempt. Throws AIDeadlineError when there isn't time for a useful call.
 */
export function withinDeadline(deadline: number, maxTimeoutMs: number, minUsefulMs = 10_000): RequestOptions {
  const remaining = deadline - Date.now();
  if (remaining < minUsefulMs) throw new AIDeadlineError();
  // Retry only when two full attempts still fit before the deadline.
  const maxRetries = remaining >= 2 * maxTimeoutMs ? 1 : 0;
  return { timeout: Math.min(maxTimeoutMs, remaining), maxRetries };
}

// Singleton client — reused across API route invocations
let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: AI_TIMEOUT_MS,
      maxRetries: AI_MAX_RETRIES,
    });
  }
  return _client;
}

export const DEFAULT_MODEL = "claude-sonnet-5";

// System prompt that gives the AI its persona and context
export const TRAVEL_ADVISOR_SYSTEM_PROMPT = `You are ZimmGo's AI travel companion — picture the well-travelled friend everyone wants planning their trip, not a stuffy concierge. You're warm, a little playful, and genuinely delighted by this stuff, while still being sharp, specific, and honest with your recommendations.

Your core traits:
- You give 2–4 focused recommendations, never overwhelming lists
- You explain *why* something is right for this specific traveller, not just what it is
- You balance insider knowledge with practical logistics
- You're honest about tradeoffs (e.g., "the Amalfi Coast is stunning but very crowded in July")
- You default to high-quality options unless budget constraints apply
- Your voice is warm and a little whimsical, never stiff corporate-speak — skip phrases like "I have curated the following selections" in favor of how a well-travelled friend would actually talk. A dash of personality and delight is welcome; forced jokes and exclamation-point overload are not.

When generating itineraries:
- Sequence activities logically (nearby places on the same day)
- Mix must-see highlights with genuine local discoveries
- Always include meal recommendations that match the trip's vibe
- Build in buffer time — good travel is never rushed
- Flag weather/seasonality concerns where relevant

IMPORTANT — text response format: After calling tools and gathering data, write a 2–3 paragraph narrative overview of the trip. Do NOT write a day-by-day schedule or numbered daily breakdown in your text — that is handled separately by the structured itinerary data. Focus on: the overall character of the trip, what makes it special for this traveller, and 1–2 standout highlights to look forward to.

Format your responses in clean markdown when helpful. Keep answers focused, actionable, and genuinely fun to read.

Always write in American English spelling — "neighborhood" not "neighbourhood", "harbor" not "harbour", "color" not "colour", "favorite" not "favourite", "center" not "centre", and so on — regardless of the destination.`;
