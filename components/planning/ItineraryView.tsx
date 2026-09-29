"use client";

import { useState, useMemo } from "react";
import { Plane, Hotel, Star, Clock, MapPin, ChevronDown, ChevronUp, ExternalLink, Printer, Copy, Check as CheckIcon, UtensilsCrossed, Check, Calendar, List, Lightbulb, FileDown, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatDate, groupItineraryDaysByLocation } from "@/lib/utils";
import { resolveCity, sameLocation } from "@/lib/location";
import { buildItineraryClipboardHtml, buildItineraryClipboardText, itineraryClipboardTitle } from "@/lib/export/itineraryClipboard";
import { RichText } from "@/components/planning/RichText";
import {
  Section, GroupedCards, StatCard, FlightPairList, HotelCard, RestaurantCard, ActivityCard,
} from "@/components/planning/ItineraryCards";
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
import type { GeneratedItinerary, HotelOption, ItineraryDay, TripPreferences } from "@/types/trip";
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
  const tripCities = useMemo(
    () => Array.from(new Set(itinerary.days.map((d) => d.location).filter((l): l is string => Boolean(l)))),
    [itinerary.days]
  );

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
              const dayHotel = hotelForDay(day, itinerary, preferences, tripCities);
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

// The hotel shown as "Staying at" on a day: the traveller's pick for that
// day's city first, then any hotel in that city. Only a day with no city at
// all falls back to the trip-wide pick or first hotel — on a multi-city trip
// that fallback used to label every day with the first city's hotel.
export function hotelForDay(
  day: ItineraryDay,
  itinerary: GeneratedItinerary,
  preferences: TripPreferences,
  cities: string[]
): HotelOption | undefined {
  const city = resolveCity(day.location, cities);
  if (!city) return preferences.selectedHotel ?? itinerary.hotels[0];
  const trip = preferences.selectedHotel;
  return (
    preferences.selectedHotelsByCity?.[city] ??
    (trip && (cities.length === 1 || sameLocation(trip.city ?? trip.location, city)) ? trip : undefined) ??
    itinerary.hotels.find((h) => resolveCity(h.city ?? h.location, cities) === city)
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
