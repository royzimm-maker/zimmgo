import { describe, it, expect } from "vitest";
import { planDays, tripSpan } from "@/lib/itinerary/dayPlan";
import { applyWrittenDays } from "@/lib/itinerary/writtenDays";
import type { ItineraryDay, TripPreferences } from "@/types/trip";

const prefs = (over: Partial<TripPreferences> = {}) =>
  ({
    activities: [], activityRankings: {}, vibes: [], transportation: [],
    destination: { cities: ["Lisbon", "Porto"], displayName: "Lisbon & Porto" },
    dates: { type: "exact", startDate: "2026-10-01", endDate: "2026-10-05" },
    ...over,
  }) as TripPreferences;

describe("planDays", () => {
  it("shares the days between cities evenly, in visiting order", () => {
    expect(planDays(prefs()).map((d) => `${d.dayNumber} ${d.date} ${d.city}`)).toEqual([
      "1 2026-10-01 Lisbon", "2 2026-10-02 Lisbon", "3 2026-10-03 Porto", "4 2026-10-04 Porto",
    ]);
  });

  it("follows the traveller's own per-city split when it accounts for every day", () => {
    expect(planDays(prefs({ cityNights: { Lisbon: 3, Porto: 1 } })).map((d) => d.city)).toEqual(["Lisbon", "Lisbon", "Lisbon", "Porto"]);
    // A split that doesn't add up is ignored rather than half-applied.
    expect(planDays(prefs({ cityNights: { Lisbon: 3, Porto: 3 } })).map((d) => d.city)).toEqual(["Lisbon", "Lisbon", "Porto", "Porto"]);
  });

  it("doesn't gain a day when the trip crosses a daylight-saving change", () => {
    // US clocks fall back on 1 Nov 2026: 1–5 Nov is still four days, as the Dates step counts it.
    expect(tripSpan(prefs({ dates: { type: "exact", startDate: "2026-11-01", endDate: "2026-11-05" } })).numDays).toBe(4);
  });

  it("starts a flexible trip mid-month, for its chosen length", () => {
    const days = planDays(prefs({ dates: { type: "flexible", flexibleMonth: "2027-03", flexibleDuration: 3 } }));
    expect(days.map((d) => d.date)).toEqual(["2027-03-15", "2027-03-16", "2027-03-17"]);
  });
});

const templateDay = (n: number, over: Partial<ItineraryDay> = {}): ItineraryDay => ({
  date: `2026-10-0${n}`, dayNumber: n, theme: "Template theme", location: n <= 2 ? "Lisbon" : "Porto",
  morning: ["Template morning"], afternoon: ["Template afternoon"], evening: ["Template evening"],
  meals: [
    { type: "breakfast", suggestion: "Template breakfast" },
    { type: "lunch", suggestion: "Template lunch" },
    { type: "dinner", suggestion: "Template dinner" },
  ],
  ...over,
});

describe("applyWrittenDays", () => {
  it("uses Claude's writing for a day, keeping the date and city", () => {
    const [day] = applyWrittenDays([templateDay(1)], [{
      day_number: 1, theme: "Alfama, Fado & the Castle",
      morning: ["Castelo de São Jorge at opening"], afternoon: ["Wander Alfama's lanes"], evening: ["Fado at a small tasca"],
      breakfast: "Breakfast Lovers Misericórdia — pastries and coffee", lunch: "Time Out Market", dinner: "Solar dos Presuntos — classic Portuguese",
      note: "Book the castle online to skip the queue.",
    }]);
    expect(day).toEqual({
      ...templateDay(1),
      theme: "Alfama, Fado & the Castle",
      morning: ["Castelo de São Jorge at opening"], afternoon: ["Wander Alfama's lanes"], evening: ["Fado at a small tasca"],
      meals: [
        { type: "breakfast", suggestion: "Breakfast Lovers Misericórdia — pastries and coffee" },
        { type: "lunch", suggestion: "Time Out Market" },
        { type: "dinner", suggestion: "Solar dos Presuntos — classic Portuguese" },
      ],
      notes: "Book the castle online to skip the queue.",
    });
  });

  it("keeps the template for a day Claude didn't write, or wrote nothing usable for", () => {
    const days = [templateDay(1), templateDay(2)];
    const out = applyWrittenDays(days, [{ day_number: 2, theme: "Empty", morning: [" "], afternoon: [], evening: [] }]);
    expect(out).toEqual(days);
    expect(applyWrittenDays(days, undefined)).toEqual(days);
  });

  it("fills a meal Claude left out from the template", () => {
    const [day] = applyWrittenDays([templateDay(1)], [{ day_number: 1, morning: ["Walk"], afternoon: [], evening: [], dinner: "Cervejaria Ramiro" }]);
    expect(day.meals).toEqual([
      { type: "breakfast", suggestion: "Template breakfast" },
      { type: "lunch", suggestion: "Template lunch" },
      { type: "dinner", suggestion: "Cervejaria Ramiro" },
    ]);
    expect(day.theme).toBe("Template theme");
  });

  it("keeps the arrival and travel notes, and a splurge night's marker", () => {
    const day = templateDay(3, {
      notes: "Take the ~2h45m train from Lisbon to Porto.",
      meals: [{ type: "dinner", suggestion: "🥂 Splurge night (anniversary) — Template dinner" }],
    });
    const [out] = applyWrittenDays([day], [{ day_number: 3, morning: ["Train north"], afternoon: [], evening: [], dinner: "The Yeatman", note: "Pack light." }]);
    expect(out.notes).toBe("Take the ~2h45m train from Lisbon to Porto.");
    expect(out.meals.find((m) => m.type === "dinner")?.suggestion).toBe("🥂 Splurge night (anniversary) — The Yeatman");
  });

  it("tidies Claude's text: trims, drops blanks, and caps each part of the day", () => {
    const [day] = applyWrittenDays([templateDay(1)], [{
      day_number: 1, morning: ["  a  ", "", "b", "c", "d", "e"], afternoon: ["x".repeat(500)], evening: [],
    }]);
    expect(day.morning).toEqual(["a", "b", "c", "d"]);
    expect(day.afternoon[0]).toHaveLength(220);
  });
});
