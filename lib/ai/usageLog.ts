import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

// $/million tokens — https://platform.claude.com/docs/en/about-claude/pricing
// Keyed by model so a future route on a different model (Opus/Haiku/Fable)
// still gets a correct estimate instead of silently reusing Sonnet's rate.
const PRICE_PER_MILLION: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
};
const DEFAULT_PRICE = PRICE_PER_MILLION["claude-sonnet-5"];

export function priceForModel(model: string): { input: number; output: number } {
  return PRICE_PER_MILLION[model] ?? DEFAULT_PRICE;
}

// Cache reads are ~90% cheaper than a fresh input token and cache writes cost
// slightly more than one — Anthropic doesn't publish a universal cache-write
// multiplier, so this uses the commonly-documented 1.25x/0.1x figures. Good
// enough for a cost *estimate*; the raw token counts logged alongside this
// are what to trust if the exact figure ever matters.
export function estimateCostUsd(
  model: string,
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }
): number {
  const price = priceForModel(model);
  return (
    (usage.inputTokens / 1_000_000) * price.input +
    (usage.outputTokens / 1_000_000) * price.output +
    (usage.cacheReadTokens / 1_000_000) * price.input * 0.1 +
    (usage.cacheWriteTokens / 1_000_000) * price.input * 1.25
  );
}

// Call right after every client.messages.create(...) across the app (see the
// six app/api/**/route.ts files that call the Anthropic API) so real token
// counts accumulate instead of the cost estimates staying guesses forever.
// `route` should match that route's own rateLimit `bucket` name, so the two
// line up when reading either one.
export async function logApiUsage(route: string, model: string, usage: Anthropic.Usage): Promise<void> {
  try {
    await prisma.apiUsageEvent.create({
      data: {
        route,
        model,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (error) {
    // Never let usage logging break the actual API response — a missing
    // DATABASE_URL (or any DB hiccup) shouldn't take down itinerary
    // generation, chat, etc. this is attached to.
    console.error("[usageLog]", error);
  }
}
