"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Hotel, Star, Clock, MapPin, ChevronDown, ChevronUp, ExternalLink, Printer, Copy, Check as CheckIcon, Check, Calendar, List, Lightbulb, FileDown, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatDate, groupItineraryDaysByLocation } from "@/lib/utils";
import { buildTripPlan, dayLines, itemLabel, type DayPlan } from "@/lib/itinerary/tripPlan";
import { buildItineraryClipboardHtml, buildItineraryClipboardText, itineraryClipboardTitle } from "@/lib/export/itineraryClipboard";
import { RichText } from "@/components/planning/RichText";
import { Section, StatCard } from "@/components/planning/ItineraryCards";
import { useTripStore } from "@/lib/store/tripStore";
import { TripGlance } from "@/components/planning/TripGlance";
import { BudgetBreakdown } from "@/components/planning/BudgetBreakdown";
import { PackingList } from "@/components/planning/PackingList";
import { PreTripTasks } from "@/components/planning/PreTripTasks";
import { Wanderlog } from "@/components/planning/Wanderlog";
import { LocalDiscovery } from "@/components/planning/LocalDiscovery";
import { ItineraryCalendarView } from "@/components/planning/ItineraryCalendarView";
import { exportItineraryDocx } from "@/lib/api/exportItineraryDocx";
import type { GeneratedItinerary } from "@/types/trip";

// The finished itinerary, shown once the traveller has reviewed it. Choosing
// flights, hotels, restaurants and activities happens in
// ItinerarySelectionWizard, before this.
interface Props {
  itinerary: GeneratedItinerary;
}

export function ItineraryView({ itinerary }: Props) {
  const { trip } = useTripStore();
  const [expandedDay, setExpandedDay] = useState<number>(-1);
  const [copied, setCopied] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const preferences = trip.preferences;
  // Each day's stay and contents — the same plan "Copy itinerary" and the
  // Word export render (lib/itinerary/tripPlan.ts).
  const plan = useMemo(() => buildTripPlan(itinerary, preferences), [itinerary, preferences]);

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
    const title = itineraryClipboardTitle(preferences);
    const plainText = buildItineraryClipboardText(itinerary, preferences, title);
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
            {plan.days.map((dayPlan, idx) => (
              <DayCard
                key={dayPlan.day.dayNumber}
                dayPlan={dayPlan}
                expanded={expandedDay === idx}
                onToggle={() => setExpandedDay(expandedDay === idx ? -1 : idx)}
              />
            ))}
          </div>
        )}
      </Section>

      <div className={showCalendar ? "flex flex-col gap-6 print:hidden" : "contents"}>
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
        <span><span className="font-semibold">Saved automatically.</span> Your trip is stored in this browser and backed up to ZimmGo, linked to this device — just return to this page to pick up where you left off. <Link href="/privacy" className="underline hover:text-sage-900">Privacy &amp; deleting your data</Link></span>
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

// One day of the finished itinerary. What it holds follows the shared plan
// (lib/itinerary/tripPlan.ts): the traveller's arrangement once they've made
// one — a day they left empty is a free day — else ZiGy's suggestions.
function DayCard({
  dayPlan,
  expanded,
  onToggle,
}: {
  dayPlan: DayPlan;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { day, city, stay, source, items } = dayPlan;
  const hotel = stay?.hotel;
  const slotEmoji: Record<string, string> = { Morning: "🌅", Afternoon: "☀️", Evening: "🌙" };
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
              {city && <span className="ml-1.5 text-brand-500">· {city}</span>}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
      </button>

      {/* The traveller's plan for the day, at a glance */}
      {items.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item.cardId}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                item.kind === "activity"
                  ? "bg-brand-50 text-brand-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {item.kind === "activity" ? "🎯" : "🍽️"} {item.name}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3">
          {source === "traveller" ? (
            items.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Your plan for the day</p>
                <ul className="space-y-0.5">
                  {items.map((item) => (
                    <li key={item.cardId} className="text-xs text-slate-700 flex gap-1.5">
                      <span className="text-slate-300">·</span>{itemLabel(item)}
                      {item.kind === "activity" && item.activity.duration && (
                        <span className="text-slate-400">· {item.activity.duration}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Free day — nothing scheduled. Add something with &quot;Fine-tune my schedule&quot;.
              </p>
            )
          ) : (
            <>
              {dayLines(dayPlan).map(({ label, text }) => (
                <div key={label ?? text}>
                  <p className="text-xs font-semibold text-slate-500 mb-1">{slotEmoji[label ?? ""] ?? ""} {label}</p>
                  <ul className="space-y-0.5">
                    {text.split(", ").map((part, i) => (
                      <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                        <span className="text-slate-300">·</span>{part}
                      </li>
                    ))}
                  </ul>
                </div>
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
            </>
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
