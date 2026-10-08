import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import type Anthropic from "@anthropic-ai/sdk";
import { logServerError, serverError } from "@/lib/http/errors";
import { rateLimit } from "@/lib/rateLimit";
import { AIDeadlineError, getAnthropicClient, withinDeadline, DEFAULT_MODEL, TRAVEL_ADVISOR_SYSTEM_PROMPT } from "@/lib/ai/client";
import { buildRouteSuggestionPrompt } from "@/lib/ai/prompts";
import { SUGGEST_ROUTES_TOOL } from "@/lib/ai/tools";
import { logApiUsage } from "@/lib/ai/usageLog";
import { findToolInput } from "@/lib/ai/toolInput";
import { readJsonBody, tooLong } from "@/lib/http/readJsonBody";
import { tripSpan } from "@/lib/itinerary/dayPlan";
import { addDays, fitRoute, routeProblems, validFixedStays, withFixedStays, type RouteRules } from "@/lib/planning/route";
import type { RouteOption, TripPreferences } from "@/types/trip";

// Thinking plus two or three full routes takes 30-60s — longer than the
// client's 30s default — and a retry needs room too.
export const maxDuration = 120;
const BUDGET_MS = 110_000;
const ATTEMPT_MS = 80_000;

export type RouteRequest = Pick<TripPreferences, "destination" | "dates" | "vibes" | "activities" | "travelers"> & { feedback?: string };

export interface RouteSuggestions {
  routes: RouteOption[];
  note?: string;
}

interface ToolRoutes {
  routes: Omit<RouteOption, "id">[];
  note?: string;
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { bucket: "trip-routes", limit: 8, windowMs: 10 * 60_000 });
  if (limited) return limited;

  try {
    const parsed = await readJsonBody<RouteRequest>(request, 40_000);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    if (!body?.destination?.displayName || !body.dates) {
      return NextResponse.json({ error: "Set a destination and dates first." }, { status: 400 });
    }
    if (body.feedback && body.feedback.length > 1_000) return tooLong("Feedback", 1_000);

    const preferences = body as TripPreferences;
    const { startDate, numDays } = tripSpan(preferences);
    if (numDays < 2 || numDays > 60) {
      return NextResponse.json({ error: "A route needs a trip of 2 to 60 nights." }, { status: 400 });
    }
    const endDate = addDays(startDate, numDays);
    const rules: RouteRules = {
      startDate,
      numDays,
      fixedStays: validFixedStays(preferences.destination, startDate, numDays),
      minNights: preferences.destination?.minNightsPerStop,
      maxNights: preferences.destination?.maxNightsPerStop,
    };

    const client = getAnthropicClient();
    const deadline = Date.now() + BUDGET_MS;
    const ask = async (problems?: string[]): Promise<ToolRoutes | null> => {
      const response = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 16_000,
        system: TRAVEL_ADVISOR_SYSTEM_PROMPT,
        tools: [SUGGEST_ROUTES_TOOL as Anthropic.Tool],
        tool_choice: { type: "tool", name: "suggest_routes" },
        messages: [{
          role: "user",
          content: buildRouteSuggestionPrompt({ preferences, startDate, endDate, numDays, fixedStays: rules.fixedStays, feedback: body.feedback, problems }),
        }],
      }, withinDeadline(deadline, ATTEMPT_MS, 25_000));
      logApiUsage("trip-routes", DEFAULT_MODEL, response.usage, response.stop_reason);
      const found = findToolInput<ToolRoutes>(response.content, SUGGEST_ROUTES_TOOL);
      return found && { ...found, routes: found.routes.map((r) => ({ ...r, stops: fitRoute(r.stops, rules) })) };
    };

    // A route that misses the traveller's dates is never shown. With fewer
    // than two that keep every rule, Claude gets one retry with what was
    // wrong — time permitting — and the better of the two attempts is used.
    const problemsOf = (result: ToolRoutes) =>
      result.routes.flatMap((r) => routeProblems(r.stops, rules).map((p) => `${r.title}: ${p}`));
    const validOf = (result: ToolRoutes | null) => (result?.routes ?? []).filter((r) => routeProblems(r.stops, rules).length === 0);
    let result = await ask();
    if (result && validOf(result).length < 2) {
      const retry = await ask(problemsOf(result)).catch((e) => {
        if (!(e instanceof AIDeadlineError)) logServerError("trip/suggest-routes retry", e);
        return null;
      });
      if (validOf(retry).length > validOf(result).length) result = retry;
    }
    const valid = validOf(result);
    if (!valid.length) {
      logServerError("trip/suggest-routes", new Error(result ? `No route kept the rules: ${problemsOf(result).join(" | ")}` : "No suggest_routes tool call"));
      return NextResponse.json({ error: "ZimmGo couldn't fit a route to your dates — try again, or adjust your fixed dates." }, { status: 502 });
    }

    // Exactly one recommended route: the first marked, or the first.
    const recommendedIdx = Math.max(0, valid.findIndex((r) => r.recommended));
    const routes: RouteOption[] = valid.map((r, i) =>
      withFixedStays({ ...r, id: uuid(), recommended: i === recommendedIdx, leftOut: r.leftOut ?? [] }, rules.fixedStays)
    );
    routes.sort((a, b) => Number(b.recommended) - Number(a.recommended));
    return NextResponse.json({ routes, note: result?.note } satisfies RouteSuggestions);
  } catch (error: unknown) {
    return serverError("trip/suggest-routes", error);
  }
}
