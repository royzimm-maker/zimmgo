// The trip's day skeleton — which date each day is and which city it's in.
// Decided here, by code, so the generation prompt (lib/ai/prompts.ts) can
// tell Claude exactly which days to write and the assembly step
// (lib/itinerary/runGeneration.ts) builds the same days.
import { parseLocalDate } from "@/lib/utils";
import { routeStops } from "@/lib/planning/route";
import type { TripPreferences } from "@/types/trip";

export interface PlannedDay {
  dayNumber: number;
  date: string; // ISO date
  city: string;
}

// Writing every day in the final planning round takes longer than a round
// may run for long trips, so past this many days the days are written
// separately, a few at a time and in parallel (lib/itinerary/writeDaysInParts.ts).
export const DAYS_IN_ONE_PASS = 8;

export function writesDaysInParts(preferences: TripPreferences): boolean {
  return tripSpan(preferences).numDays > DAYS_IN_ONE_PASS;
}

/** The trip's start date and number of days, from exact dates or a flexible month and length. */
export function tripSpan(preferences: TripPreferences): { startDate: string; numDays: number } {
  if (preferences.dates?.type === "flexible") {
    // Land on the 15th of the chosen month as a placeholder start.
    const [yr, mo] = (preferences.dates.flexibleMonth ?? new Date().toISOString().slice(0, 7)).split("-").map(Number);
    const d = new Date(yr, mo - 1, 15);
    return {
      startDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-15`,
      numDays: Math.max(1, preferences.dates.flexibleDuration ?? 10),
    };
  }
  const departs = preferences.dates?.startDate ?? new Date().toISOString().slice(0, 10);
  const endDate = preferences.dates?.endDate ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  // An overnight flight: the trip on the ground starts the day they land.
  const arrival = preferences.dates?.arrivalDate;
  const startDate = arrival && arrival > departs && arrival < endDate ? arrival : departs;
  // Rounded, not ceil()-ed: a daylight-saving change adds or removes an hour, which
  // must not become an extra day (the Dates step counts the same way).
  const days = Math.round((parseLocalDate(endDate).getTime() - parseLocalDate(startDate).getTime()) / 86400000);
  return { startDate, numDays: Math.max(1, days) };
}

/**
 * Every day of the trip with its date and city. The chosen route's stops
 * (the Route step) come first; then the traveller's own per-city split (the
 * itinerary step's leg editor), when it accounts for every city and every
 * day; otherwise cities share the days evenly, in visiting order. A
 * single-city trip uses its city, or the destination name.
 */
export function planDays(preferences: TripPreferences): PlannedDay[] {
  const { startDate, numDays } = tripSpan(preferences);
  const dest = preferences.destination?.displayName ?? "the destination";
  const cities = preferences.destination?.cities?.filter(Boolean) ?? [];

  const nights = preferences.cityNights;
  const nightsValid = !!nights
    && cities.length > 0
    && cities.every((c) => Number.isInteger(nights[c]) && nights[c] > 0)
    && cities.reduce((sum, c) => sum + nights[c], 0) === numDays;
  const stops = routeStops(preferences, numDays);
  const dayCities: string[] | null = stops
    ? stops.flatMap((s) => Array(s.nights).fill(s.city))
    : nightsValid ? cities.flatMap((c) => Array(nights![c]).fill(c)) : null;

  const start = parseLocalDate(startDate);
  return Array.from({ length: numDays }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    // Local components, not toISOString(), which would shift the date in positive-offset zones.
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const city = dayCities
      ? dayCities[i]
      : cities.length > 1
      ? cities[Math.floor((i / numDays) * cities.length)]
      : (cities[0] ?? dest);
    return { dayNumber: i + 1, date: iso, city };
  });
}
