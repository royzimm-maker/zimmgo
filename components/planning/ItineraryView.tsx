"use client";

import { useState, useMemo } from "react";
import { Plane, Hotel, Star, Clock, MapPin, ChevronDown, ChevronUp, ExternalLink, Printer, Copy, Check as CheckIcon, UtensilsCrossed, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import { TripGlance } from "@/components/planning/TripGlance";
import { BudgetBreakdown } from "@/components/planning/BudgetBreakdown";
import { PackingList } from "@/components/planning/PackingList";
import { PreTripTasks } from "@/components/planning/PreTripTasks";
import { LocalDiscovery } from "@/components/planning/LocalDiscovery";
import type { GeneratedItinerary, FlightOption, HotelOption, ActivityOption, RestaurantOption, ItineraryDay } from "@/types/trip";

interface Props {
  itinerary: GeneratedItinerary;
}

export function ItineraryView({ itinerary }: Props) {
  const { trip, setSelectedHotel, setSelectedFlight } = useTripStore();
  const [expandedDay, setExpandedDay] = useState<number>(-1);
  const [copied, setCopied] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(
    trip.preferences.selectedHotel?.id ?? null
  );

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

  async function handleCopy() {
    const lines: string[] = [
      `ZimmGo Trip — ${preferences.destination?.displayName ?? "Your Trip"}`,
      "",
      itinerary.aiSummary,
      "",
      "── FLIGHTS ──",
      ...itinerary.flights.map((f) => `${f.airline} · ${f.origin} → ${f.destination} · ${formatCurrency(f.price)}/pp`),
      "",
      "── HOTELS ──",
      ...itinerary.hotels.map((h) => `${h.name} · ${h.location} · ${formatCurrency(h.pricePerNight)}/night`),
      ...(itinerary.restaurants?.length
        ? ["", "── WHERE TO EAT ──", ...itinerary.restaurants.map((r) => `${r.name} · ${r.cuisine} · ${r.priceRange} · ${r.location}`)]
        : []),
      "",
      "── ITINERARY ──",
      ...itinerary.days.map((d) => [
        `Day ${d.dayNumber}: ${d.theme} (${d.date})`,
        d.morning.length ? `  Morning: ${d.morning.join(", ")}` : "",
        d.afternoon.length ? `  Afternoon: ${d.afternoon.join(", ")}` : "",
        d.evening.length ? `  Evening: ${d.evening.join(", ")}` : "",
      ].filter(Boolean).join("\n")),
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Trip at a Glance */}
      <TripGlance itinerary={itinerary} preferences={preferences} />

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
        <StatCard label="Est. total" value={formatCurrency(itinerary.totalEstimatedCost)} icon={<Star size={14} />} />
        <StatCard label="Activities" value={`${itinerary.activities.length}`} icon={<MapPin size={14} />} />
      </div>

      {/* Flights */}
      {itinerary.flights.length > 0 && (
        <Section
          title="Recommended Flights"
          icon={<Plane size={16} />}
          subtitle="Select your preferred option — prices are roundtrip per person, estimated. Book directly with the airline."
        >
          <FlightPairList
            flights={itinerary.flights}
            depAirport={preferences.destination?.departureAirport ?? ""}
            selectedFlightId={trip.preferences.selectedFlight?.id}
            onSelect={(f) => setSelectedFlight(trip.preferences.selectedFlight?.id === f.id ? null : f)}
          />
        </Section>
      )}

      {/* Hotels */}
      {preferences.selectedHotel ? (
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
          <div className="flex flex-col gap-3">
            {itinerary.hotels.map((h) => (
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
            ))}
          </div>
        </Section>
      )}

      {/* Restaurants — grouped by location */}
      {itinerary.restaurants && itinerary.restaurants.length > 0 && (
        <Section title="Where to Eat" icon={<UtensilsCrossed size={16} />}>
          <GroupedCards
            items={itinerary.restaurants}
            getLocation={(r) => r.location}
            renderCard={(r) => <RestaurantCard key={r.id} restaurant={r} />}
          />
        </Section>
      )}

      {/* Day-by-day */}
      <Section title="Day-by-Day Itinerary" icon={<MapPin size={16} />}>
        <div className="flex flex-col gap-2">
          {itinerary.days.map((day, idx) => {
            const pickedCardIds = itinerary.finalizedPlan?.dayCards[day.dayNumber] ?? [];
            const picks = pickedCardIds
              .map((id) => cardNameMap[id])
              .filter((p): p is { name: string; kind: "activity" | "restaurant" } => Boolean(p));
            const dayHotel = preferences.selectedHotel
              ?? itinerary.hotels.find((h) =>
                  day.location && h.location.toLowerCase().includes(day.location.toLowerCase())
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
      </Section>

      {/* Activities — grouped by location */}
      {itinerary.activities.length > 0 && (
        <Section title="Top Experiences" icon={<Star size={16} />}>
          <GroupedCards
            items={itinerary.activities}
            getLocation={(a) => a.location}
            renderCard={(a) => <ActivityCard key={a.id} activity={a} />}
            gridCols
          />
        </Section>
      )}

      {/* Local discovery */}
      <LocalDiscovery preferences={preferences} />

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
      </div>
    </div>
  );
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
  // Group days by location
  const locationGroups: { location: string; dates: string[]; dayCount: number }[] = [];
  for (const day of itinerary.days) {
    const loc = day.location ?? preferences.destination?.displayName ?? "Unknown";
    const last = locationGroups[locationGroups.length - 1];
    if (last && last.location === loc) {
      last.dates.push(day.date);
      last.dayCount++;
    } else {
      locationGroups.push({ location: loc, dates: [day.date], dayCount: 1 });
    }
  }

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

function Section({ title, icon, subtitle, children }: { title: string; icon: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
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

// Groups items by location and renders them under a location header
function GroupedCards<T>({
  items,
  getLocation,
  renderCard,
  gridCols = false,
}: {
  items: T[];
  getLocation: (item: T) => string | undefined;
  renderCard: (item: T) => React.ReactNode;
  gridCols?: boolean;
}) {
  // Build ordered groups preserving first-seen order
  const groups: { location: string; items: T[] }[] = [];
  const groupIndex: Record<string, number> = {};
  for (const item of items) {
    const loc = getLocation(item) ?? "Other";
    if (groupIndex[loc] === undefined) {
      groupIndex[loc] = groups.length;
      groups.push({ location: loc, items: [] });
    }
    groups[groupIndex[loc]].items.push(item);
  }

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

function FlightPairList({
  flights,
  depAirport,
  selectedFlightId,
  onSelect,
}: {
  flights: FlightOption[];
  depAirport: string;
  selectedFlightId?: string;
  onSelect: (f: FlightOption) => void;
}) {
  // Extract IATA code from strings like "Seattle-Tacoma International (SEA)" or bare "SEA"
  const depCode = (depAirport.match(/\(([A-Z]{3})\)/)?.[1] ?? depAirport.trim().toUpperCase().slice(-3));
  const isOutbound = (f: FlightOption) =>
    depAirport ? f.origin.toUpperCase().includes(depCode) : true;
  const outbound = flights.filter(isOutbound);
  const returns  = flights.filter((f) => !isOutbound(f));

  const pairs = outbound.length
    ? outbound.map((o) => ({
        outbound: o,
        ret: returns.find((r) => r.airline === o.airline) ?? returns[0] ?? null,
      }))
    : flights.map((f) => ({ outbound: f, ret: null }));

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
                    Out {formatCurrency(o.price)}/pp + Return {formatCurrency(ret.price)}/pp
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-slate-900 text-sm">{formatCurrency(roundtripPp)}</p>
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

const HOTEL_TIER: Record<number, { label: string }> = {
  5: { label: "The full five-star treatment" },
  4: { label: "Seriously comfortable, no drama" },
  3: { label: "Sleep well, spend the savings" },
};

function HotelCard({ hotel, selected = false, onSelect }: { hotel: HotelOption; selected?: boolean; onSelect?: () => void }) {
  const sourceIcon: Record<string, string> = {
    "Google Reviews": "🔵",
    "TripAdvisor": "🟢",
    "Booking.com": "🔷",
  };
  const icon = hotel.ratingSource ? (sourceIcon[hotel.ratingSource] ?? "⭐") : "⭐";
  const tierLabel = (HOTEL_TIER[hotel.stars] ?? HOTEL_TIER[4]).label;

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
            {formatCurrency(hotel.pricePerNight)}<span className="font-normal text-xs text-slate-400">/night</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="font-medium text-sage-600">{hotel.rating}/10</span>
            {" · "}{hotel.reviewCount.toLocaleString()} reviews
          </p>
          {hotel.ratingSource && (
            <p className="text-[10px] text-slate-400 mt-0.5">{icon} {hotel.ratingSource}</p>
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

function RestaurantCard({ restaurant: r }: { restaurant: RestaurantOption }) {
  const emoji = RESTAURANT_TIER_EMOJI[r.tier] ?? "🍽️";
  const priceColor = PRICE_LABEL_COLOR[r.priceRange] ?? "text-slate-600";

  return (
    <Card padding="none" className="overflow-hidden">
      {r.imageUrl && (
        <div className="relative w-full h-32 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.imageUrl} alt={r.name} className="w-full h-full object-cover" />
          <span className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide shadow-sm" style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}>
            {emoji} {r.playfulCategory}
          </span>
          <span className="absolute bottom-1.5 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] text-white/80 font-medium tracking-wide">
            Illustrative
          </span>
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-800 text-sm">{r.name}</p>
              <span className={`text-xs font-bold ${priceColor}`}>{r.priceRange}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{r.cuisine} · {r.location}</p>
            <p className="text-xs text-slate-600 leading-relaxed mt-1.5">{r.description}</p>
            {r.mustOrder && (
              <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 leading-snug">
                🍴 Must order: {r.mustOrder}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 ml-2">
            <p className="text-xs font-medium text-sage-700">{r.rating}/10</p>
            <p className="text-[10px] text-slate-400">{r.reviewCount.toLocaleString()} reviews</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-100">
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

function ActivityCard({ activity }: { activity: ActivityOption }) {
  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-800 text-sm">{activity.name}</p>
            {activity.isLocalFavorite && <Badge variant="success">Local pick</Badge>}
          </div>
          <p className="text-xs text-slate-500 mt-1">{activity.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            <span>⏱ {activity.duration}</span>
            <span>⭐ {activity.rating}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-slate-900 text-sm">{formatCurrency(activity.price)}</p>
          {activity.bookingUrl && (
            <a href={activity.bookingUrl} target="_blank" rel="noreferrer"
              className="text-xs text-brand-500 hover:underline flex items-center gap-0.5 justify-end mt-0.5">
              Book <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
