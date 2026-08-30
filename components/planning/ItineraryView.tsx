"use client";

import { useState, useMemo } from "react";
import { Plane, Hotel, Star, Clock, MapPin, ChevronDown, ChevronUp, ExternalLink, Printer, Copy, Check as CheckIcon, UtensilsCrossed, Check, Heart, Calendar, List, Lightbulb, Ship, TrainFront, FileDown, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, pairFlights, groupByLocation, groupItineraryDaysByLocation } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import { useWanderlogSave } from "@/lib/hooks/useWanderlogSave";
import { TripGlance } from "@/components/planning/TripGlance";
import { BudgetBreakdown } from "@/components/planning/BudgetBreakdown";
import { PackingList } from "@/components/planning/PackingList";
import { PreTripTasks } from "@/components/planning/PreTripTasks";
import { Wanderlog } from "@/components/planning/Wanderlog";
import { LocalDiscovery } from "@/components/planning/LocalDiscovery";
import { ItineraryCalendarView } from "@/components/planning/ItineraryCalendarView";
import { exportItineraryDocx } from "@/lib/api/exportItineraryDocx";
import type { GeneratedItinerary, FlightOption, HotelOption, ActivityOption, RestaurantOption, ItineraryDay, TripPreferences, TransportOption } from "@/types/trip";

interface Props {
  itinerary: GeneratedItinerary;
  // When true, skip the Flights/Hotels/Restaurants/Top Experiences sections —
  // used once the user has already stepped through ItinerarySelectionWizard for these.
  hideSelectionSections?: boolean;
}

export function ItineraryView({ itinerary, hideSelectionSections = false }: Props) {
  const { trip, setSelectedHotel, setSelectedFlight } = useTripStore();
  const [expandedDay, setExpandedDay] = useState<number>(-1);
  const [copied, setCopied] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(
    trip.preferences.selectedHotel?.id ?? null
  );

  const { wanderlogLabels, handleSaveToWanderlog } = useWanderlogSave(itinerary);

  // Build card-id → display info lookup for the finalized plan
  const cardNameMap = useMemo<Record<string, { name: string; kind: "activity" | "restaurant" }>>(() => {
    const m: Record<string, { name: string; kind: "activity" | "restaurant" }> = {};
    itinerary.activities.forEach((a) => { m[`act-${a.id}`] = { name: a.name, kind: "activity" }; });
    (itinerary.restaurants ?? []).forEach((r) => { m[`rest-${r.id}`] = { name: r.name, kind: "restaurant" }; });
    return m;
  }, [itinerary.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const preferences = trip.preferences;

  function handlePrint() {
    window.print();
  }

  function handlePrintCalendar() {
    setShowCalendar(true);
    // Print has to wait a paint cycle so the calendar grid is in the DOM
    // (and the rest of the page has picked up print:hidden) before printing.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  async function handleCopy() {
    const title = `ZimmGo Trip — ${preferences.destination?.displayName ?? "Your Trip"}`;

    // Plain-text version — for terminals, Notepad, chat apps that don't
    // render HTML. Headings get a heavier separator so they still read as
    // sections even without bold/font-size to lean on.
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
    const plainText = lines.join("\n");

    // Rich-text version — renders as actual headings/bold/lists when pasted
    // into Gmail, Docs, Notion, Word, etc. instead of a wall of plain text.
    const html = buildItineraryClipboardHtml(itinerary, preferences, title);

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
    } catch {
      // Safari/older browsers, or a permissions failure on the rich write —
      // plain text still gets the content across.
      await navigator.clipboard.writeText(plainText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleExportDocx() {
    setExportingDocx(true);
    setExportError(null);
    try {
      await exportItineraryDocx(itinerary, preferences);
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : "Export failed — please try again.");
    } finally {
      setExportingDocx(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Everything above Day-by-Day is hidden when printing the calendar —
          it's a lot of page for a "print the calendar" request. Uses
          `contents` outside calendar-print mode so it doesn't affect the
          normal on-screen flex layout/spacing at all. */}
      <div className={showCalendar ? "flex flex-col gap-6 print:hidden" : "contents"}>
      {/* Trip at a Glance */}
      <TripGlance itinerary={itinerary} preferences={preferences} />

      {/* Gateway city advisory — flagged when the arrival/departure airport
          isn't in any of the destination cities and a same-day connection
          isn't realistic, so it's easy to miss until you're booking. */}
      {itinerary.gatewayAdvisory && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Lightbulb size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800 mb-0.5">Plan a gateway-city stopover</p>
            <p className="text-xs text-amber-800 leading-relaxed">{itinerary.gatewayAdvisory}</p>
          </div>
        </div>
      )}

      {/* ZiGy's Take */}
      <div className="rounded-xl border border-sage-200 bg-white overflow-hidden">
        <div className="bg-gradient-to-r from-sage-600 to-brand-500 px-4 py-3 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-0.5">AI Travel Advisor</p>
          <h3 className="text-base font-bold">ZiGy&apos;s Take</h3>
        </div>
        <div className="px-4 py-4">
          <RichText text={itinerary.aiSummary} className="text-sm text-slate-700 leading-relaxed" />
          {itinerary.whyThisWorks && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <RichText text={itinerary.whyThisWorks} className="text-xs text-slate-500 italic leading-relaxed" />
            </div>
          )}
        </div>
      </div>

      {/* Destination summary */}
      <DestinationSummary itinerary={itinerary} preferences={preferences} />

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Days" value={`${itinerary.days.length}`} icon={<Clock size={14} />} />
        <StatCard label="Est. total" value={formatCurrency(itinerary.totalEstimatedCost, preferences.preferredCurrency)} icon={<Star size={14} />} />
        <StatCard label="Activities" value={`${itinerary.activities.length}`} icon={<MapPin size={14} />} />
      </div>

      {/* Flights */}
      {!hideSelectionSections && itinerary.flights.length > 0 && (
        <Section
          title="Recommended Flights"
          icon={<Plane size={16} />}
          subtitle="Select your preferred option — prices are roundtrip per person, estimated. Book directly with the airline."
        >
          <FlightPairList
            flights={itinerary.flights}
            arrivalAirport={preferences.destination?.arrivalAirport ?? ""}
            selectedFlightId={trip.preferences.selectedFlight?.id}
            onSelect={(f) => setSelectedFlight(trip.preferences.selectedFlight?.id === f.id ? null : f)}
          />
        </Section>
      )}

      {/* Hotels */}
      {!hideSelectionSections && (preferences.selectedHotel ? (
        <Section
          title="Your Planned Stay"
          icon={<Hotel size={16} />}
          subtitle="Selected during planning — not yet booked. Use the link below to reserve."
        >
          <HotelCard hotel={preferences.selectedHotel} />
        </Section>
      ) : itinerary.hotels.length > 0 && (
        <Section
          title={itinerary.hotels.length > 1 ? "Choose Your Stay" : "Recommended Lodging"}
          icon={<Hotel size={16} />}
          subtitle={itinerary.hotels.length > 1 ? "Tap a hotel to select it — your choice is saved to your plan." : undefined}
        >
          <GroupedCards
            items={itinerary.hotels}
            renderCard={(h) => (
              <HotelCard
                key={h.id}
                hotel={h}
                selected={selectedHotelId === h.id}
                onSelect={() => {
                  const next = selectedHotelId === h.id ? null : h.id;
                  setSelectedHotelId(next);
                  setSelectedHotel(next ? h : null);
                }}
              />
            )}
          />
        </Section>
      ))}

      {/* Restaurants — grouped by location */}
      {!hideSelectionSections && itinerary.restaurants && itinerary.restaurants.length > 0 && (
        <Section
          title="Where to Eat"
          icon={<UtensilsCrossed size={16} />}
          subtitle="Tap the bookmark to save a pick to your Wanderlog for later."
        >
          <GroupedCards
            items={itinerary.restaurants}
            renderCard={(r) => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                saved={wanderlogLabels.has(r.name)}
                onSave={() => handleSaveToWanderlog(r.name, "restaurant", r.location, r.description)}
              />
            )}
          />
        </Section>
      )}

      </div>

      {/* Day-by-day — always visible, in either list or printable-calendar form */}
      <Section title="Day-by-Day Itinerary" icon={<MapPin size={16} />}>
        <div className="mb-3 flex items-center gap-2 print:hidden">
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={() => setShowCalendar(false)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                !showCalendar ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <List size={12} /> List
            </button>
            <button
              type="button"
              onClick={() => setShowCalendar(true)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                showCalendar ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Calendar size={12} /> Calendar
            </button>
          </div>
          {showCalendar && (
            <button
              type="button"
              onClick={handlePrintCalendar}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Printer size={12} />
              Print calendar
            </button>
          )}
        </div>

        {showCalendar ? (
          <ItineraryCalendarView days={itinerary.days} />
        ) : (
          <div className="flex flex-col gap-2">
            {itinerary.days.map((day, idx) => {
              const pickedCardIds = itinerary.finalizedPlan?.dayCards[day.dayNumber] ?? [];
              const picks = pickedCardIds
                .map((id) => cardNameMap[id])
                .filter((p): p is { name: string; kind: "activity" | "restaurant" } => Boolean(p));
              const dayHotel = preferences.selectedHotel
                ?? itinerary.hotels.find((h) =>
                    day.location && h.location && day.location.toLowerCase().includes(h.location.toLowerCase().split(",")[0].trim())
                  )
                ?? itinerary.hotels[0];
              return (
                <DayCard
                  key={day.dayNumber}
                  day={day}
                  expanded={expandedDay === idx}
                  onToggle={() => setExpandedDay(expandedDay === idx ? -1 : idx)}
                  picks={picks}
                  hotel={dayHotel}
                />
              );
            })}
          </div>
        )}
      </Section>

      <div className={showCalendar ? "flex flex-col gap-6 print:hidden" : "contents"}>
      {/* Activities — grouped by location */}
      {!hideSelectionSections && itinerary.activities.length > 0 && (
        <Section
          title="Top Experiences"
          icon={<Star size={16} />}
          subtitle="Tap the bookmark to save a pick to your Wanderlog for later."
        >
          <GroupedCards
            items={itinerary.activities}
            renderCard={(a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                saved={wanderlogLabels.has(a.name)}
                onSave={() => handleSaveToWanderlog(a.name, "activity", a.location, a.description)}
              />
            )}
            gridCols
          />
        </Section>
      )}

      {/* Local discovery */}
      <LocalDiscovery preferences={preferences} itineraryId={itinerary.id} />

      {/* ZiGy's Wanderlog */}
      <Wanderlog itinerary={itinerary} />

      {/* Budget breakdown */}
      <BudgetBreakdown itinerary={itinerary} preferences={preferences} />

      {/* Packing list */}
      <PackingList itinerary={itinerary} preferences={preferences} />

      {/* Pre-trip task timeline */}
      <PreTripTasks itinerary={itinerary} preferences={preferences} />

      {/* Saved indicator + download bar */}
      <div className="flex items-center gap-2 rounded-lg bg-sage-50 border border-sage-100 px-3 py-2 text-xs text-sage-700">
        <Check size={12} className="text-sage-500 shrink-0" />
        <span><span className="font-semibold">Saved to this device.</span> Your trip is stored in your browser — just return to this page to pick up where you left off.</span>
      </div>

      {/* Download / share bar */}
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={handlePrint}
          title="A raw printout of this screen, exactly as it looks now"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Printer size={13} />
          Print / Save as PDF
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          {copied ? <CheckIcon size={13} className="text-sage-600" /> : <Copy size={13} />}
          {copied ? "Copied!" : "Copy itinerary"}
        </button>
        <button
          type="button"
          onClick={handleExportDocx}
          disabled={exportingDocx}
          title="A polished, print-ready document — nicely formatted and organized for reading or sharing"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60"
        >
          <FileDown size={13} />
          {exportingDocx ? "Exporting…" : "Export as Word doc"}
        </button>
      </div>
      <p className="text-[10px] text-slate-400 -mt-1">
        Print / Save as PDF is a quick raw copy of this screen — Export as Word doc gives you a polished, formatted itinerary to keep or share.
      </p>
      {exportError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {exportError}
        </div>
      )}
      </div>
    </div>
  );
}

// ─── Clipboard HTML: a self-contained, inline-styled export so the itinerary
// still looks intentional when pasted into Gmail/Docs/Notion/Word rather than
// showing up as a dump of plain text with no visual hierarchy ────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The AI summary uses **bold** markdown-style emphasis (see RichText below) —
// carry that through to the HTML clipboard version instead of pasting the
// literal asterisks.
function markdownBoldToHtml(text: string): string {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function buildItineraryClipboardHtml(
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

// ─── RichText: renders paragraphs, bullet lists, and **bold** without a library ─

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s,)]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>;
    }
    if (/^https?:\/\//.test(part)) {
      const display = part.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-brand-500 hover:underline">
          {display}<ExternalLink size={10} className="shrink-0" />
        </a>
      );
    }
    return part;
  });
}

function RichText({ text, className = "" }: { text: string; className?: string }) {
  if (!text?.trim()) return null;

  // Split into blocks on blank lines
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

        // Bullet list block: every line starts with - / • / *
        const isList = lines.every((l) => /^[-•*]\s/.test(l));
        if (isList) {
          return (
            <ul key={bi} className="space-y-1 pl-1">
              {lines.map((line, li) => (
                <li key={li} className="flex gap-2 leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  <span>{renderInline(line.replace(/^[-•*]\s/, ""))}</span>
                </li>
              ))}
            </ul>
          );
        }

        // Plain paragraph (preserve intentional single line-breaks)
        return (
          <p key={bi} className="leading-relaxed">
            {lines.map((line, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {renderInline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

// ─── Destination summary (replaces inaccurate map) ────────────────────────────

function DestinationSummary({ itinerary, preferences }: { itinerary: GeneratedItinerary; preferences: import("@/types/trip").TripPreferences }) {
  const locationGroups = groupItineraryDaysByLocation(itinerary.days, preferences.destination?.displayName ?? "Unknown");

  const dep = preferences.destination?.departureAirport;
  const arr = preferences.destination?.arrivalAirport;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <MapPin size={13} className="text-brand-500" />
        <p className="text-xs font-semibold text-slate-700">Your Route</p>
        {dep && arr && (
          <span className="ml-auto text-[10px] text-slate-400 font-mono">
            {dep.split(" ").pop()?.replace(/[()]/g, "")} ↔ {arr}
          </span>
        )}
      </div>
      <div className="px-4 py-3 flex flex-col gap-2">
        {locationGroups.map((g, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{g.location}</p>
              <p className="text-[11px] text-slate-400">
                {formatDate(g.dates[0])}
                {g.dayCount > 1 && ` — ${formatDate(g.dates[g.dates.length - 1])}`}
                {" · "}{g.dayCount} day{g.dayCount !== 1 ? "s" : ""}
              </p>
            </div>
            {i < locationGroups.length - 1 && (
              <span className="text-slate-300 text-xs">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

export function Section({ title, icon, subtitle, children }: { title: string; icon: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-brand-500">{icon}</span>
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-slate-400 mb-3 pl-6">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

// Groups items by their `location` field and renders them under a location header
export function GroupedCards<T extends { location?: string }>({
  items,
  renderCard,
  gridCols = false,
}: {
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  gridCols?: boolean;
}) {
  const groups = groupByLocation(items, (i) => i.location);
  const singleGroup = groups.length === 1;

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.location}>
          {!singleGroup && (
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={11} className="text-brand-400 shrink-0" />
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">{g.location}</p>
              <div className="flex-1 border-t border-brand-100" />
            </div>
          )}
          <div className={gridCols ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "flex flex-col gap-2"}>
            {g.items.map((item) => renderCard(item))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">{icon}<span className="text-xs">{label}</span></div>
      <p className="font-bold text-slate-800 text-sm">{value}</p>
    </div>
  );
}

export function FlightPairList({
  flights,
  arrivalAirport,
  selectedFlightId,
  onSelect,
}: {
  flights: FlightOption[];
  arrivalAirport: string;
  selectedFlightId?: string;
  onSelect: (f: FlightOption) => void;
}) {
  const pairs = pairFlights(flights, arrivalAirport);
  const { trip } = useTripStore();
  const currency = trip.preferences.preferredCurrency;

  return (
    <div className="flex flex-col gap-3">
      {pairs.map(({ outbound: o, ret }) => {
        const roundtripPp = o.price + (ret?.price ?? 0);
        const isSelected = selectedFlightId === o.id;
        return (
          <Card
            key={o.id}
            padding="sm"
            className={`transition-all ${isSelected ? "border-brand-400 ring-2 ring-brand-100" : ""}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 text-sm">{o.airline}</span>
                  <Badge variant="info">{o.cabinClass}</Badge>
                  {o.stops === 0 && <Badge variant="success">Nonstop</Badge>}
                </div>
                <div className="mt-1 text-xs text-slate-500 flex flex-col gap-0.5">
                  <span>Outbound: {o.origin} → {o.destination} · {o.duration}</span>
                  {ret && <span>Return: {ret.origin} → {ret.destination} · {ret.duration}</span>}
                </div>
                {ret && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Out {formatCurrency(o.price, currency)}/pp + Return {formatCurrency(ret.price, currency)}/pp
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-slate-900 text-sm">{formatCurrency(roundtripPp, currency)}</p>
                <p className="text-[10px] text-slate-400">roundtrip/pp</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onSelect(o)}
                className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  isSelected
                    ? "bg-brand-600 text-white"
                    : "border border-brand-300 text-brand-700 hover:bg-brand-50"
                }`}
              >
                {isSelected && <Check size={11} />}
                {isSelected ? "Selected" : "Select this flight"}
              </button>
              <a
                href={o.bookingUrl ?? "https://www.google.com/travel/flights"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-0.5 text-xs text-brand-500 hover:underline ml-auto font-medium"
              >
                Book with airline <ExternalLink size={10} />
              </a>
            </div>
          </Card>
        );
      })}
      <p className="text-[10px] text-slate-400 text-center">
        Estimates only — prices change. Booking opens the airline&apos;s site in a new tab.
      </p>
    </div>
  );
}

export function TransportCard({
  option,
  selected = false,
  onSelect,
}: {
  option: TransportOption;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { trip } = useTripStore();
  const currency = trip.preferences.preferredCurrency;
  const ModeIcon = option.mode === "ferry" ? Ship : TrainFront;

  return (
    <Card padding="sm" className={`transition-all ${selected ? "border-brand-400 ring-2 ring-brand-100" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <ModeIcon size={15} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm">{option.provider}</span>
            <Badge variant="info">{option.mode === "ferry" ? "Ferry" : "Train"}</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {option.fromCity} → {option.toCity} · {option.duration}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-slate-900 text-sm">{formatCurrency(option.price, currency)}</p>
          <p className="text-[10px] text-slate-400">per person</p>
        </div>
      </div>
      {onSelect && (
        <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onSelect}
            className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              selected ? "bg-brand-600 text-white" : "border border-brand-300 text-brand-700 hover:bg-brand-50"
            }`}
          >
            {selected && <Check size={11} />}
            {selected ? "Selected" : "Select this option"}
          </button>
          {option.bookingUrl && (
            <a
              href={option.bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-0.5 text-xs text-brand-500 hover:underline ml-auto font-medium"
            >
              Book with {option.provider} <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

const HOTEL_TIER: Record<number, { label: string }> = {
  5: { label: "The full five-star treatment" },
  4: { label: "Seriously comfortable, no drama" },
  3: { label: "Sleep well, spend the savings" },
};

export function HotelCard({ hotel, selected = false, onSelect }: { hotel: HotelOption; selected?: boolean; onSelect?: () => void }) {
  const sourceIcon: Record<string, string> = {
    "Google Reviews": "🔵",
    "TripAdvisor": "🟢",
    "Booking.com": "🔷",
  };
  const icon = hotel.ratingSource ? (sourceIcon[hotel.ratingSource] ?? "⭐") : "⭐";
  const tierLabel = (HOTEL_TIER[hotel.stars] ?? HOTEL_TIER[4]).label;
  const { trip } = useTripStore();

  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect?.()}
      className={`rounded-xl border overflow-hidden transition-all duration-150 ${
        selected
          ? "border-brand-500 ring-2 ring-brand-200"
          : onSelect
            ? "border-slate-200 hover:border-slate-300 cursor-pointer"
            : "border-slate-200"
      }`}
    >
      {/* Hotel image */}
      {hotel.imageUrl && (
        <div className="relative w-full h-36 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hotel.imageUrl}
            alt={hotel.name}
            className="w-full h-full object-cover"
          />
          <span className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide shadow-sm" style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}>
            {tierLabel}
          </span>
          {selected && (
            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-bold text-white shadow">
              ✓ Your pick
            </span>
          )}
          <span className="absolute bottom-1.5 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] text-white/80 font-medium tracking-wide">
            Illustrative
          </span>
        </div>
      )}
      <div className="flex items-start gap-3 p-3">
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${selected ? "text-brand-700" : "text-slate-800"}`}>{hotel.name}</span>
            <div className="flex">
              {Array.from({ length: hotel.stars }).map((_, i) => (
                <Star key={i} size={10} className="fill-amber-400 text-amber-400" />
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{hotel.location}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {hotel.highlights.slice(0, 3).map((h) => (
              <Badge key={h} variant="muted">{h}</Badge>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-slate-900 text-sm">
            {formatCurrency(hotel.pricePerNight, trip.preferences.preferredCurrency)}<span className="font-normal text-xs text-slate-400">/night</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="font-medium text-sage-600">{hotel.rating}/10</span>
            {" · "}{hotel.reviewCount.toLocaleString()} reviews
          </p>
          {hotel.ratingSource && (
            <p className="text-[10px] text-slate-400 mt-0.5">{icon} {hotel.ratingSource}</p>
          )}
          {hotel.sourceRatings && (
            <p className="text-[9px] text-slate-400 mt-0.5">
              {hotel.sourceRatings.map((s) => `${s.source} ${s.rating}`).join(" · ")}
            </p>
          )}
          <div className="flex items-center gap-2 justify-end mt-1.5">
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(hotel.name + " " + hotel.location)}`}
              target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-slate-400 hover:text-slate-600 hover:underline flex items-center gap-0.5"
              title="View on Google Maps"
            >
              Map <ExternalLink size={9} />
            </a>
            {hotel.bookingUrl && (
              <a href={hotel.bookingUrl} target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-brand-500 hover:underline flex items-center gap-0.5 font-medium">
                Book <ExternalLink size={9} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const RESTAURANT_TIER_EMOJI: Record<string, string> = {
  fine_dining: "🌟",
  upscale:     "✨",
  midrange:    "💫",
  casual:      "🪑",
  street_food: "🛺",
  brunch:      "☕",
};

const PRICE_LABEL_COLOR: Record<string, string> = {
  "$$$$": "text-amber-700",
  "$$$":  "text-brand-700",
  "$$":   "text-sage-700",
  "$":    "text-slate-600",
};

export function RestaurantCard({
  restaurant: r,
  saved = false,
  onSave,
  selected = false,
  onSelect,
}: {
  restaurant: RestaurantOption;
  saved?: boolean;
  onSave?: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const emoji = RESTAURANT_TIER_EMOJI[r.tier] ?? "🍽️";
  const priceColor = PRICE_LABEL_COLOR[r.priceRange] ?? "text-slate-600";

  return (
    <Card padding="none" selected={selected} className="overflow-hidden">
      <div className="p-3 flex gap-3">
        {r.imageUrl && (
          <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.imageUrl} alt={r.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-semibold text-slate-800 text-sm truncate">{r.name}</p>
                <span className={`text-xs font-bold shrink-0 ${priceColor}`}>{r.priceRange}</span>
                {r.michelinDistinction && <Badge variant="warning">🎖️ {r.michelinDistinction}</Badge>}
                {r.isBeliPick && <Badge variant="success">Beli pick</Badge>}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{emoji} {r.cuisine} · {r.location}</p>
              <p className="text-xs text-slate-600 mt-1 line-clamp-1">{r.description}</p>
            </div>
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <div className="flex flex-col items-end gap-1">
                {onSelect && (
                  <button
                    type="button"
                    onClick={onSelect}
                    title={selected ? "Remove from your day-by-day plan" : "Add to your day-by-day plan"}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold whitespace-nowrap transition-colors ${
                      selected ? "bg-brand-600 text-white" : "border border-brand-400 bg-brand-50 text-brand-700 hover:bg-brand-100 hover:border-brand-500"
                    }`}
                  >
                    {selected ? <Check size={10} /> : null}
                    {selected ? "In Itinerary" : "Add to Itinerary"}
                  </button>
                )}
                {onSave && (
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={saved}
                    title={saved ? "Saved to Wanderlog — your save-for-later list" : "Save to Wanderlog — keep it without scheduling it"}
                    className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap transition-colors ${
                      saved ? "text-brand-600" : "border border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-600"
                    }`}
                  >
                    <Heart size={10} className={saved ? "fill-brand-600" : undefined} />
                    {saved ? "Saved" : "Add to Wanderlog"}
                  </button>
                )}
              </div>
              <p className="text-xs font-medium text-sage-700">{r.rating}/10</p>
            </div>
          </div>

          {r.mustOrder && (
            <p className="mt-1.5 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 leading-snug truncate">
              🍴 {r.mustOrder}
            </p>
          )}
          {r.beliNote && (
            <p className="mt-1 text-[11px] text-brand-600 bg-brand-50 rounded px-2 py-1 leading-snug">
              📍 {r.beliNote}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2">
            {r.menuUrl && (
              <a href={r.menuUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-slate-700 hover:underline">
                Menu <ExternalLink size={9} />
              </a>
            )}
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(r.name + " " + r.location)}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-slate-700 hover:underline">
              Map <ExternalLink size={9} />
            </a>
            {r.bookingUrl && (
              <a href={r.bookingUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-0.5 text-[11px] text-brand-500 font-medium hover:underline ml-auto">
                {r.tier === "fine_dining" || r.tier === "upscale" ? "Reserve" : "Find it"} <ExternalLink size={9} />
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function DayCard({
  day,
  expanded,
  onToggle,
  picks = [],
  hotel,
}: {
  day: ItineraryDay;
  expanded: boolean;
  onToggle: () => void;
  picks?: { name: string; kind: "activity" | "restaurant" }[];
  hotel?: HotelOption;
}) {
  return (
    <Card padding="sm" className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
            {day.dayNumber}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-slate-800 text-sm">{day.theme}</p>
            <p className="text-xs text-slate-400">
              {formatDate(day.date)}
              {day.location && <span className="ml-1.5 text-brand-500">· {day.location}</span>}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
      </button>

      {/* Your picks — shown when the user has personalized this day */}
      {picks.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {picks.map((p, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                p.kind === "activity"
                  ? "bg-brand-50 text-brand-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {p.kind === "activity" ? "🎯" : "🍽️"} {p.name}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3">
          {[
            { label: "Morning", items: day.morning, emoji: "🌅" },
            { label: "Afternoon", items: day.afternoon, emoji: "☀️" },
            { label: "Evening", items: day.evening, emoji: "🌙" },
          ].map(({ label, items, emoji }) => (
            items.length > 0 && (
              <div key={label}>
                <p className="text-xs font-semibold text-slate-500 mb-1">{emoji} {label}</p>
                <ul className="space-y-0.5">
                  {items.map((item, i) => (
                    <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                      <span className="text-slate-300">·</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )
          ))}
          {day.meals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">🍽️ Meal suggestions</p>
              {day.meals.map((m) => (
                <div key={m.type} className="flex items-start justify-between gap-2 py-0.5">
                  <p className="text-xs text-slate-700 flex-1">
                    <span className="capitalize text-slate-400">{m.type}: </span>{m.suggestion}
                  </p>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(m.suggestion)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-brand-500 transition-colors"
                    title="Search on Google"
                  >
                    <ExternalLink size={9} />
                  </a>
                </div>
              ))}
            </div>
          )}
          {day.notes && <p className="text-xs text-slate-500 italic">{day.notes}</p>}
          {hotel && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-1">
              <Hotel size={11} className="text-slate-400 shrink-0" />
              <p className="text-xs text-slate-500">
                <span className="text-slate-400">Staying at: </span>
                <span className="font-medium text-slate-700">{hotel.name}</span>
                <span className="text-slate-400"> · {hotel.location}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function ActivityCard({
  activity,
  saved = false,
  onSave,
  selected = false,
  onSelect,
}: {
  activity: ActivityOption;
  saved?: boolean;
  onSave?: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { trip } = useTripStore();
  return (
    <Card padding="sm" selected={selected}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-800 text-sm">{activity.name}</p>
            {activity.isLocalFavorite && <Badge variant="success">Local pick</Badge>}
          </div>
          <p className="text-xs text-slate-500 mt-1">{activity.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            <span>⏱ {activity.duration}</span>
            <span>⭐ {activity.rating}{activity.ratingSource ? ` (${activity.ratingSource})` : ""}</span>
          </div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
          <div className="flex flex-col items-end gap-1">
            {onSelect && (
              <button
                type="button"
                onClick={onSelect}
                title={selected ? "Remove from your day-by-day plan" : "Add to your day-by-day plan"}
                className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap transition-colors ${
                  selected ? "bg-brand-600 text-white" : "border border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-600"
                }`}
              >
                {selected ? <Check size={10} /> : null}
                {selected ? "In Itinerary" : "Add to Itinerary"}
              </button>
            )}
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={saved}
                title={saved ? "Saved to Wanderlog — your save-for-later list" : "Save to Wanderlog — keep it without scheduling it"}
                className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap transition-colors ${
                  saved ? "text-brand-600" : "border border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-600"
                }`}
              >
                <Heart size={10} className={saved ? "fill-brand-600" : undefined} />
                {saved ? "Saved" : "Add to Wanderlog"}
              </button>
            )}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">{formatCurrency(activity.price, trip.preferences.preferredCurrency)}</p>
            {activity.bookingUrl && (
              <a href={activity.bookingUrl} target="_blank" rel="noreferrer"
                className="text-xs text-brand-500 hover:underline flex items-center gap-0.5 justify-end mt-0.5">
                Book <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
