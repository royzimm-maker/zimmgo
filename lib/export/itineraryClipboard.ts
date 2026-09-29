// "Copy itinerary" content, in the two forms the clipboard carries: plain
// text for terminals, Notepad and chat apps, and a self-contained,
// inline-styled HTML version so the itinerary still looks intentional when
// pasted into Gmail/Docs/Notion/Word rather than showing up as a dump of
// plain text with no visual hierarchy.
import { formatCurrency, formatDate } from "@/lib/utils";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

export function itineraryClipboardTitle(preferences: TripPreferences): string {
  return `ZimmGo Trip — ${preferences.destination?.displayName ?? "Your Trip"}`;
}

// Headings get a heavier separator so they still read as sections even
// without bold/font-size to lean on.
export function buildItineraryClipboardText(
  itinerary: GeneratedItinerary,
  preferences: TripPreferences,
  title: string
): string {
  const lines: string[] = [
    title,
    "=".repeat(title.length),
    "",
    itinerary.aiSummary,
    ...(itinerary.flights.length
      ? ["", "FLIGHTS", "-------", ...itinerary.flights.map((f) => `• ${f.airline} — ${f.origin} → ${f.destination} — ${formatCurrency(f.price, preferences.preferredCurrency)}/pp`)]
      : []),
    "",
    "HOTELS",
    "------",
    ...itinerary.hotels.map((h) => `• ${h.name} — ${h.location} — ${formatCurrency(h.pricePerNight, preferences.preferredCurrency)}/night`),
    ...(itinerary.restaurants?.length
      ? ["", "WHERE TO EAT", "------------", ...itinerary.restaurants.map((r) => `• ${r.name} — ${r.cuisine}, ${r.priceRange} — ${r.location}`)]
      : []),
    "",
    "DAY-BY-DAY ITINERARY",
    "---------------------",
    ...itinerary.days.map((d) => [
      `Day ${d.dayNumber} — ${d.theme} (${formatDate(d.date)}${d.location ? `, ${d.location}` : ""})`,
      d.morning.length ? `  Morning: ${d.morning.join(", ")}` : "",
      d.afternoon.length ? `  Afternoon: ${d.afternoon.join(", ")}` : "",
      d.evening.length ? `  Evening: ${d.evening.join(", ")}` : "",
    ].filter(Boolean).join("\n")),
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

  const hotelsHtml = list(
    itinerary.hotels.map(
      (h) => `<strong>${escapeHtml(h.name)}</strong> — ${escapeHtml(h.location)} — ${escapeHtml(formatCurrency(h.pricePerNight, preferences.preferredCurrency))}/night`
    )
  );

  const restaurantsHtml = itinerary.restaurants?.length
    ? heading("Where to Eat") +
      list(
        itinerary.restaurants.map(
          (r) => `<strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.cuisine)}, ${escapeHtml(r.priceRange)} — ${escapeHtml(r.location)}`
        )
      )
    : "";

  const daysHtml = itinerary.days
    .map((d) => {
      const blocks = [
        d.morning.length ? `<strong>Morning:</strong> ${escapeHtml(d.morning.join(", "))}` : "",
        d.afternoon.length ? `<strong>Afternoon:</strong> ${escapeHtml(d.afternoon.join(", "))}` : "",
        d.evening.length ? `<strong>Evening:</strong> ${escapeHtml(d.evening.join(", "))}` : "",
      ].filter(Boolean);
      return `
        <div style="margin-bottom:14px;">
          <p style="margin:0 0 4px;font-weight:700;color:#0f172a;">
            Day ${d.dayNumber} — ${escapeHtml(d.theme)}
            <span style="font-weight:400;color:#64748b;"> (${escapeHtml(formatDate(d.date))}${d.location ? `, ${escapeHtml(d.location)}` : ""})</span>
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
      ${heading("Hotels")}${hotelsHtml}
      ${restaurantsHtml}
      ${heading("Day-by-Day Itinerary")}${daysHtml}
    </div>`;
}
