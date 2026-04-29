"use client";

import { useState } from "react";
import { Plane, Hotel, Star, Clock, Users, MapPin, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Card, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { GeneratedItinerary, FlightOption, HotelOption, ActivityOption, ItineraryDay } from "@/types/trip";

interface Props {
  itinerary: GeneratedItinerary;
}

export function ItineraryView({ itinerary }: Props) {
  const [expandedDay, setExpandedDay] = useState<number>(0);

  return (
    <div className="flex flex-col gap-6">
      {/* AI Summary */}
      <div className="rounded-xl bg-gradient-to-br from-brand-50 to-sage-50 border border-brand-100 p-4">
        <p className="text-sm font-semibold text-brand-700 mb-3">Your trip at a glance</p>
        <RichText text={itinerary.aiSummary} className="text-sm text-slate-700" />
        {itinerary.whyThisWorks && (
          <div className="mt-3 pt-3 border-t border-brand-100">
            <RichText text={itinerary.whyThisWorks} className="text-xs text-slate-500 italic" />
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Days" value={`${itinerary.days.length}`} icon={<Clock size={14} />} />
        <StatCard label="Est. total" value={formatCurrency(itinerary.totalEstimatedCost)} icon={<Star size={14} />} />
        <StatCard label="Activities" value={`${itinerary.activities.length}`} icon={<MapPin size={14} />} />
      </div>

      {/* Flights */}
      {itinerary.flights.length > 0 && (
        <Section title="Recommended Flights" icon={<Plane size={16} />}>
          <div className="flex flex-col gap-2">
            {itinerary.flights.map((f) => <FlightCard key={f.id} flight={f} />)}
          </div>
        </Section>
      )}

      {/* Hotels */}
      {itinerary.hotels.length > 0 && (
        <Section title="Recommended Lodging" icon={<Hotel size={16} />}>
          <div className="flex flex-col gap-2">
            {itinerary.hotels.map((h) => <HotelCard key={h.id} hotel={h} />)}
          </div>
        </Section>
      )}

      {/* Day-by-day */}
      <Section title="Day-by-Day Itinerary" icon={<MapPin size={16} />}>
        <div className="flex flex-col gap-2">
          {itinerary.days.map((day, idx) => (
            <DayCard
              key={day.dayNumber}
              day={day}
              expanded={expandedDay === idx}
              onToggle={() => setExpandedDay(expandedDay === idx ? -1 : idx)}
            />
          ))}
        </div>
      </Section>

      {/* Activities */}
      {itinerary.activities.length > 0 && (
        <Section title="Top Experiences" icon={<Star size={16} />}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {itinerary.activities.map((a) => <ActivityCard key={a.id} activity={a} />)}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── RichText: renders paragraphs, bullet lists, and **bold** without a library ─

function renderInline(text: string): React.ReactNode[] {
  // Split on **bold** markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>;
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

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-brand-500">{icon}</span>
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      </div>
      {children}
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

function FlightCard({ flight }: { flight: FlightOption }) {
  return (
    <Card padding="sm" className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800 text-sm">{flight.airline}</span>
          <Badge variant="info">{flight.cabinClass}</Badge>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
          <span>{flight.origin}</span>
          <Plane size={10} />
          <span>{flight.destination}</span>
          <span>·</span>
          <span>{flight.duration}</span>
          {flight.stops === 0 && <Badge variant="success">Nonstop</Badge>}
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-slate-900">{formatCurrency(flight.price)}</p>
        {flight.bookingUrl && (
          <a href={flight.bookingUrl} target="_blank" rel="noreferrer"
            className="text-xs text-brand-500 hover:underline flex items-center gap-0.5 justify-end mt-0.5">
            Book <ExternalLink size={10} />
          </a>
        )}
      </div>
    </Card>
  );
}

function HotelCard({ hotel }: { hotel: HotelOption }) {
  return (
    <Card padding="sm" className="flex items-start gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800 text-sm">{hotel.name}</span>
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
        <p className="font-bold text-slate-900 text-sm">{formatCurrency(hotel.pricePerNight)}<span className="font-normal text-xs text-slate-400">/night</span></p>
        <p className="text-xs text-sage-600 mt-0.5">{hotel.rating}/10 · {hotel.reviewCount.toLocaleString()} reviews</p>
        {hotel.bookingUrl && (
          <a href={hotel.bookingUrl} target="_blank" rel="noreferrer"
            className="text-xs text-brand-500 hover:underline flex items-center gap-0.5 justify-end mt-0.5">
            Book <ExternalLink size={10} />
          </a>
        )}
      </div>
    </Card>
  );
}

function DayCard({ day, expanded, onToggle }: { day: ItineraryDay; expanded: boolean; onToggle: () => void }) {
  return (
    <Card padding="sm" className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
            {day.dayNumber}
          </span>
          <div>
            <p className="font-medium text-slate-800 text-sm">{day.theme}</p>
            <p className="text-xs text-slate-400">{formatDate(day.date)}</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

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
                <p key={m.type} className="text-xs text-slate-700">
                  <span className="capitalize text-slate-400">{m.type}: </span>{m.suggestion}
                </p>
              ))}
            </div>
          )}
          {day.notes && <p className="text-xs text-slate-500 italic">{day.notes}</p>}
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
