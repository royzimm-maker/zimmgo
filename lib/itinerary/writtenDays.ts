// Claude's own day-by-day schedule (the `days` of its generate_itinerary
// call), fitted onto the day skeleton the app built (lib/itinerary/dayPlan.ts).
// A day Claude didn't write — or wrote nothing usable for — keeps the
// template day, so a partial answer still yields a complete itinerary.
import type { ItineraryDay } from "@/types/trip";

export interface WrittenDay {
  day_number: number;
  theme?: string;
  morning?: string[];
  afternoon?: string[];
  evening?: string[];
  breakfast?: string;
  lunch?: string;
  dinner?: string;
  note?: string;
}

const MAX_ITEMS_PER_PERIOD = 4;
const MAX_TEXT = 220;

const clean = (text: unknown): string | undefined => {
  if (typeof text !== "string") return undefined;
  const t = text.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, MAX_TEXT) : undefined;
};
const cleanList = (items: unknown): string[] =>
  (Array.isArray(items) ? items : []).map(clean).filter((t): t is string => !!t).slice(0, MAX_ITEMS_PER_PERIOD);

/**
 * The template days with Claude's writing in place of the template's, day by
 * day. Kept from the template: the date, city and day number (the skeleton),
 * the arrival and inter-city travel notes (Claude's own travel note already
 * flows into those), and a splurge-night marker on dinner.
 */
export function applyWrittenDays(days: ItineraryDay[], written: WrittenDay[] | undefined): ItineraryDay[] {
  const byNumber = new Map((written ?? []).map((w) => [w.day_number, w]));
  return days.map((day) => {
    const w = byNumber.get(day.dayNumber);
    if (!w) return day;
    const morning = cleanList(w.morning);
    const afternoon = cleanList(w.afternoon);
    const evening = cleanList(w.evening);
    if (!morning.length && !afternoon.length && !evening.length) return day;

    const templateMeal = (type: ItineraryDay["meals"][number]["type"]) => day.meals.find((m) => m.type === type)?.suggestion;
    const splurge = templateMeal("dinner")?.match(/^(🥂 Splurge night[^—]*— )/)?.[1] ?? "";
    const meal = (type: ItineraryDay["meals"][number]["type"], text: unknown) => {
      const mine = clean(text);
      const suggestion = mine ? (type === "dinner" ? `${splurge}${mine}` : mine) : templateMeal(type);
      return suggestion ? [{ type, suggestion }] : [];
    };

    return {
      ...day,
      theme: clean(w.theme) ?? day.theme,
      morning,
      afternoon,
      evening,
      meals: [...meal("breakfast", w.breakfast), ...meal("lunch", w.lunch), ...meal("dinner", w.dinner)],
      notes: day.notes ?? clean(w.note),
    };
  });
}
