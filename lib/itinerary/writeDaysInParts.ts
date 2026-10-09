// Long trips: the day-by-day schedule, written a few days at a time.
// Writing three weeks of days in the final planning round takes longer than
// a round may run, so it ended in template days. Here each stop's days
// (in parts of at most MAX_PART_DAYS) are written by their own short call,
// all in parallel, from that city's own search results. A part that fails
// or runs out of time keeps its template days (lib/itinerary/writtenDays.ts).
import type Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL, TRAVEL_ADVISOR_SYSTEM_PROMPT, withinDeadline } from "@/lib/ai/client";
import { buildDayPartPrompt } from "@/lib/ai/prompts";
import { WRITE_DAYS_TOOL } from "@/lib/ai/tools";
import { findToolInput } from "@/lib/ai/toolInput";
import { logApiUsage } from "@/lib/ai/usageLog";
import { logServerError } from "@/lib/http/errors";
import { resolveCity } from "@/lib/location";
import { mapWithConcurrency } from "@/lib/concurrency";
import { hasArrangedLodging } from "@/lib/planning/route";
import { planDays, type PlannedDay } from "@/lib/itinerary/dayPlan";
import type { WrittenDay } from "@/lib/itinerary/writtenDays";
import type { ActivityOption, RestaurantOption, TripPreferences } from "@/types/trip";

export const MAX_PART_DAYS = 6;
// Each part is a few days of writing — well under the planning rounds' cap.
const PART_TIMEOUT_MS = 75_000;
// Parts in flight at once — every stop of a typical long trip, without
// flooding the API on a very long one.
const PARALLEL_PARTS = 6;

/**
 * The trip's days in parts to write: each stay in a city (a run of
 * consecutive days there) on its own, a long stay split evenly into parts
 * of at most `maxDays`.
 */
export function dayParts(days: PlannedDay[], maxDays = MAX_PART_DAYS): PlannedDay[][] {
  const runs: PlannedDay[][] = [];
  for (const day of days) {
    const run = runs[runs.length - 1];
    if (run && run[0].city === day.city) run.push(day);
    else runs.push([day]);
  }
  return runs.flatMap((run) => {
    const count = Math.ceil(run.length / maxDays);
    const size = Math.ceil(run.length / count);
    return Array.from({ length: count }, (_, i) => run.slice(i * size, (i + 1) * size));
  });
}

/**
 * A city's places shared out among its parts, so two parts written at the
 * same time (Rome at both ends, or a long stay split in two) don't both plan
 * the same visit. Round-robin keeps the best-ranked places spread out.
 */
function shareOut<T>(items: T[], partIdx: number, partCount: number): T[] {
  return partCount <= 1 ? items : items.filter((_, i) => i % partCount === partIdx);
}

export async function writeDaysInParts(input: {
  client: Anthropic;
  preferences: TripPreferences;
  activities: ActivityOption[];
  restaurants: RestaurantOption[];
  travelNoteByCity: Record<string, string>;
  deadline?: number;
}): Promise<WrittenDay[]> {
  const { client, preferences, activities, restaurants, travelNoteByCity, deadline } = input;
  const days = planDays(preferences);
  const parts = dayParts(days);
  const cities = [...new Set(days.map((d) => d.city))];
  // A city's places, once each — the same place can come back from more than one search.
  const inCity = <T extends { name: string }>(items: T[], city: string, where: (item: T) => string | undefined) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.name.trim().toLowerCase();
      if (resolveCity(where(item), cities) !== city || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const written = await mapWithConcurrency(parts, PARALLEL_PARTS, async (part): Promise<WrittenDay[]> => {
    const city = part[0].city;
    const cityParts = parts.filter((p) => p[0].city === city);
    const idx = cityParts.indexOf(part);
    const previousCity = part[0].dayNumber > 1 ? days[part[0].dayNumber - 2].city : undefined;
    try {
      const response = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 8000,
        system: TRAVEL_ADVISOR_SYSTEM_PROMPT,
        tools: [WRITE_DAYS_TOOL],
        tool_choice: { type: "tool", name: WRITE_DAYS_TOOL.name },
        messages: [{
          role: "user",
          content: buildDayPartPrompt({
            preferences,
            days: part,
            totalDays: days.length,
            activities: shareOut(inCity(activities, city, (a) => a.location), idx, cityParts.length),
            restaurants: shareOut(inCity(restaurants, city, (r) => r.location), idx, cityParts.length),
            travelNoteByCity,
            previousCity,
            lodgingArranged: hasArrangedLodging(city, preferences),
          }),
        }],
      }, deadline === undefined ? undefined : withinDeadline(deadline, PART_TIMEOUT_MS));
      logApiUsage("itinerary-days", DEFAULT_MODEL, response.usage, response.stop_reason);
      const result = findToolInput<{ days: WrittenDay[] }>(response.content, WRITE_DAYS_TOOL);
      // Only this part's own days — a stray day number would overwrite another part's.
      const own = new Set(part.map((d) => d.dayNumber));
      return (result?.days ?? []).filter((d) => own.has(d.day_number));
    } catch (error) {
      logServerError("itinerary-days", error);
      return [];
    }
  });
  return written.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
