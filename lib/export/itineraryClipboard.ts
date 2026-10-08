// "Copy itinerary" content, in the two forms the clipboard carries: plain
// text for terminals, Notepad and chat apps, and a self-contained,
// inline-styled HTML version so the itinerary still looks intentional when
// pasted into Gmail/Docs/Notion/Word rather than showing up as a dump of
// plain text with no visual hierarchy.
//
// Both render from the same plan as the on-screen itinerary and the Word
// export (lib/itinerary/tripPlan.ts): each city's chosen stay, and each
// day's contents — the traveller's arrangement once they've made one.
import { formatCurrency, formatDate, formatNightlyRate } from "@/lib/utils";
import { buildTripPlan, dayLines, type DayPlan, type TripPlan } from "@/lib/itinerary/tripPlan";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

export function itineraryClipboardTitle(preferences: TripPreferences): string {
  return `ZimmGo Trip — ${preferences.destination?.displayName ?? "Your Trip"}`;
}

const FREE_DAY = "Free day — nothing scheduled";

function stayLine(stay: TripPlan["stays"][number], preferences: TripPreferences): string {
  const { hotel, byTraveller } = stay.choice;
  const price = formatNightlyRate(hotel, preferences.preferredCurrency);
  return `${hotel.name} — ${stay.city} — ${price}${byTraveller ? "" : " (ZiGy's recommendation)"}`;
}

function dayHeading(dayPlan: DayPlan): string {
  const { day, city } = dayPlan;
  return `Day ${day.dayNumber} — ${day.theme} (${formatDate(day.date)}${city ? `, ${city}` : ""})`;
}

// Headings get a heavier separator so they still read as sections even
// without bold/font-size to lean on.
export function buildItineraryClipboardText(
  itinerary: GeneratedItinerary,
  preferences: TripPreferences,
  title: string
): string {
  const plan = buildTripPlan(itinerary, preferences);
  const lines: string[] = [
    title,
    "=".repeat(title.length),
    "",
    itinerary.aiSummary,
    ...(itinerary.flights.length
      ? ["", "FLIGHTS", "-------", ...itinerary.flights.map((f) => `• ${f.airline} — ${f.origin} → ${f.destination} — ${formatCurrency(f.price, preferences.preferredCurrency)}/pp`)]
      : []),
    ...(plan.stays.length
      ? ["", "WHERE YOU'RE STAYING", "--------------------", ...plan.stays.map((s) => `• ${stayLine(s, preferences)}`)]
      : []),
    ...(itinerary.restaurants?.length
      ? ["", "WHERE TO EAT", "------------", ...itinerary.restaurants.map((r) => `• ${r.name} — ${r.cuisine}, ${r.priceRange} — ${r.location}`)]
      : []),
    "",
    "DAY-BY-DAY ITINERARY",
    "---------------------",
    ...plan.days.map((dayPlan) => {
      const content = dayLines(dayPlan);
      const body = content.length
        ? content.map((l) => (l.label ? `  ${l.label}: ${l.text}` : `  • ${l.text}`))
        : [`  ${FREE_DAY}`];
      return [dayHeading(dayPlan), ...body].join("\n");
    }),
  ];
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The AI summary uses **bold** markdown-style emphasis (see RichText) —
// carry that through to the HTML clipboard version instead of pasting the
// literal asterisks.
function markdownBoldToHtml(text: string): string {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

export function buildItineraryClipboardHtml(
  itinerary: GeneratedItinerary,
  preferences: TripPreferences,
  title: string
): string {
  const plan = buildTripPlan(itinerary, preferences);
  const heading = (text: string) =>
    `<h2 style="font-size:16px;font-weight:700;margin:20px 0 8px;color:#0f172a;">${escapeHtml(text)}</h2>`;
  const list = (items: string[]) =>
    `<ul style="margin:0 0 4px;padding-left:20px;">${items.map((i) => `<li style="margin-bottom:4px;">${i}</li>`).join("")}</ul>`;

  const summaryHtml = itinerary.aiSummary
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 10px;line-height:1.5;">${markdownBoldToHtml(p)}</p>`)
    .join("");

  const flightsHtml = itinerary.flights.length
    ? heading("Flights") +
      list(
        itinerary.flights.map(
          (f) => `<strong>${escapeHtml(f.airline)}</strong> — ${escapeHtml(f.origin)} → ${escapeHtml(f.destination)} — ${escapeHtml(formatCurrency(f.price, preferences.preferredCurrency))}/pp`
        )
      )
    : "";

  const staysHtml = plan.stays.length
    ? heading("Where You're Staying") +
      list(
        plan.stays.map(({ city, choice }) =>
          `<strong>${escapeHtml(choice.hotel.name)}</strong> — ${escapeHtml(city)} — ${escapeHtml(formatNightlyRate(choice.hotel, preferences.preferredCurrency))}` +
          (choice.byTraveller ? "" : ` <em style="color:#64748b;">(ZiGy's recommendation)</em>`)
        )
      )
    : "";

  const restaurantsHtml = itinerary.restaurants?.length
    ? heading("Where to Eat") +
      list(
        itinerary.restaurants.map(
          (r) => `<strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.cuisine)}, ${escapeHtml(r.priceRange)} — ${escapeHtml(r.location)}`
        )
      )
    : "";

  const daysHtml = plan.days
    .map((dayPlan) => {
      const { day, city } = dayPlan;
      const content = dayLines(dayPlan);
      const blocks = content.length
        ? content.map((l) => (l.label ? `<strong>${l.label}:</strong> ${escapeHtml(l.text)}` : escapeHtml(l.text)))
        : [`<em style="color:#64748b;">${FREE_DAY}</em>`];
      return `
        <div style="margin-bottom:14px;">
          <p style="margin:0 0 4px;font-weight:700;color:#0f172a;">
            Day ${day.dayNumber} — ${escapeHtml(day.theme)}
            <span style="font-weight:400;color:#64748b;"> (${escapeHtml(formatDate(day.date))}${city ? `, ${escapeHtml(city)}` : ""})</span>
          </p>
          ${list(blocks)}
        </div>`;
    })
    .join("");

  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;max-width:640px;">
      <h1 style="font-size:22px;font-weight:800;margin:0 0 4px;color:#0f172a;">${escapeHtml(title)}</h1>
      <hr style="border:none;border-top:2px solid #e2e8f0;margin:8px 0 16px;" />
      ${summaryHtml}
      ${flightsHtml}
      ${staysHtml}
      ${restaurantsHtml}
      ${heading("Day-by-Day Itinerary")}${daysHtml}
    </div>`;
}
