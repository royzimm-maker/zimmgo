import { describe, it, expect } from "vitest";
import { buildItineraryClipboardHtml, buildItineraryClipboardText, itineraryClipboardTitle } from "@/lib/export/itineraryClipboard";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

const prefs = { destination: { cities: ["Lisbon"], displayName: "Lisbon" } } as TripPreferences;
const itinerary = {
  aiSummary: "A **great** week <in> Lisbon.",
  flights: [],
  hotels: [{ name: "Hotel A&B", location: "Alfama", pricePerNight: 120 }],
  restaurants: [],
  days: [{ dayNumber: 1, theme: "Arrival", date: "2026-10-01", location: "Lisbon", morning: ["Tram 28"], afternoon: [], evening: [], meals: [] }],
} as unknown as GeneratedItinerary;

describe("itinerary clipboard export", () => {
  it("builds a plain-text version with sections", () => {
    const title = itineraryClipboardTitle(prefs);
    const text = buildItineraryClipboardText(itinerary, prefs, title);
    expect(title).toBe("ZimmGo Trip — Lisbon");
    expect(text).toContain("HOTELS\n------\n• Hotel A&B — Alfama");
    expect(text).toContain("Day 1 — Arrival");
    expect(text).toContain("  Morning: Tram 28");
    expect(text).not.toContain("FLIGHTS");
  });

  it("escapes HTML and carries **bold** through to the rich version", () => {
    const html = buildItineraryClipboardHtml(itinerary, prefs, "T");
    expect(html).toContain("A <strong>great</strong> week &lt;in&gt; Lisbon.");
    expect(html).toContain("Hotel A&amp;B");
    expect(html).not.toContain("<in>");
  });
});
