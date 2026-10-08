import { describe, it, expect } from "vitest";
import { buildItineraryClipboardHtml, buildItineraryClipboardText, itineraryClipboardTitle } from "@/lib/export/itineraryClipboard";
import type { GeneratedItinerary, HotelOption, TripPreferences } from "@/types/trip";

const hotel = (id: string, name: string, city: string) => ({ id, name, city, location: city, pricePerNight: 120 }) as unknown as HotelOption;
const prefs = (over: Partial<TripPreferences> = {}) =>
  ({ destination: { cities: ["Lisbon", "Porto"], displayName: "Lisbon & Porto" }, ...over }) as TripPreferences;
const day = (n: number, location: string, morning: string[]) =>
  ({ dayNumber: n, theme: `Day ${n} theme`, date: `2026-10-0${n}`, location, morning, afternoon: [], evening: [], meals: [] });

function itinerary(over: Partial<GeneratedItinerary> = {}): GeneratedItinerary {
  return {
    aiSummary: "A **great** week <in> Portugal.",
    flights: [],
    // Generation lists ZimmGo's recommendation first for each city.
    hotels: [hotel("l1", "Hotel A&B", "Lisbon"), hotel("l2", "Lisbon Two", "Lisbon"), hotel("p1", "Porto Inn", "Porto")],
    activities: [{ id: "a1", name: "Tram 28 ride", location: "Lisbon" }],
    restaurants: [{ id: "r1", name: "Taberna", tier: "midrange", location: "Porto", cuisine: "Portuguese", priceRange: "$$" }],
    days: [day(1, "Lisbon", ["Walk Alfama"]), day(2, "Porto", ["Ribeira stroll"])],
    ...over,
  } as unknown as GeneratedItinerary;
}

describe("itinerary clipboard export", () => {
  it("lists each city's chosen stay, not every hotel option", () => {
    const text = buildItineraryClipboardText(itinerary({ selections: { hotelsByCity: { Lisbon: hotel("l2", "Lisbon Two", "Lisbon") } } }), prefs(), "T");
    expect(text).toContain("WHERE YOU'RE STAYING");
    expect(text).toContain("• Lisbon Two — Lisbon — $120/night\n");
    expect(text).toContain("• Porto Inn — Porto — $120/night (ZimmGo's recommendation)");
    expect(text).not.toContain("Hotel A&B");
  });

  it("shows ZimmGo's suggestions by time of day before the traveller arranges anything", () => {
    const text = buildItineraryClipboardText(itinerary(), prefs(), itineraryClipboardTitle(prefs()));
    expect(text.startsWith("ZimmGo Trip — Lisbon & Porto")).toBe(true);
    expect(text).toContain("Day 1 — Day 1 theme (");
    expect(text).toContain("  Morning: Walk Alfama");
  });

  it("shows the traveller's arrangement once they've made one — and says when a day was left free", () => {
    const planned = itinerary({ finalizedPlan: { dayCards: { 2: ["act-a1", "rest-r1"] }, bankCards: [] } });
    const text = buildItineraryClipboardText(planned, prefs(), "T");
    expect(text).toContain("  • Tram 28 ride\n  • Dinner: Taberna");
    expect(text).not.toContain("Ribeira stroll"); // the suggestion it replaced
    expect(text).toMatch(/Day 1 — .*\n  Free day — nothing scheduled/);
  });

  it("escapes HTML and carries **bold** through to the rich version", () => {
    const html = buildItineraryClipboardHtml(itinerary(), prefs(), "T");
    expect(html).toContain("A <strong>great</strong> week &lt;in&gt; Portugal.");
    expect(html).toContain("Hotel A&amp;B");
    expect(html).not.toContain("<in>");
  });
});
