"use client";

import { Plane, Hotel, Users, Calendar, MapPin } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

interface Props {
  itinerary: GeneratedItinerary;
  preferences: TripPreferences;
}

export function TripGlance({ itinerary, preferences }: Props) {
  const { days, flights, hotels } = itinerary;
  const travelers = preferences.travelers ?? 1;
  const destination = preferences.destination?.displayName ?? "Your destination";

  const firstDay = days[0];
  const lastDay  = days[days.length - 1];

  return (
    <div className="rounded-xl border border-brand-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-200 mb-0.5">Trip at a Glance</p>
        <h3 className="text-base font-bold">{destination}</h3>
      </div>

      {/* Key facts grid */}
      <div className="grid grid-cols-2 gap-0 border-b border-slate-100">
        <Fact icon={<Calendar size={13} />} label="Departure" value={firstDay ? formatDate(firstDay.date) : "—"} />
        <Fact icon={<Calendar size={13} />} label="Return" value={lastDay ? formatDate(lastDay.date) : "—"} border />
        <Fact icon={<Users size={13} />} label="Travelers" value={`${travelers} ${travelers === 1 ? "person" : "people"}`} top />
        <Fact icon={<MapPin size={13} />} label="Duration" value={`${days.length} day${days.length !== 1 ? "s" : ""}`} top border />
      </div>

      {/* Flights summary */}
      {flights.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
            <Plane size={10} /> Flights
          </p>
          <div className="flex flex-col gap-1.5">
            {flights.slice(0, 2).map((f, i) => (
              <div key={f.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  <span className="font-medium">{i === 0 ? "Outbound" : "Return"}:</span>{" "}
                  {f.origin} → {f.destination} · {f.airline}
                </span>
                <span className="text-slate-500 font-medium">{formatCurrency(f.price)}<span className="text-slate-400">/pp</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hotels summary */}
      {hotels.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
            <Hotel size={10} /> Recommended Lodging
          </p>
          <div className="flex flex-col gap-1">
            {hotels.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium">{h.name}</span>
                <span className="text-slate-500">{h.location} · {formatCurrency(h.pricePerNight)}/night</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function Fact({
  icon, label, value, border = false, top = false,
}: {
  icon: React.ReactNode; label: string; value: string; border?: boolean; top?: boolean;
}) {
  return (
    <div className={`px-4 py-2.5 ${border ? "border-l border-slate-100" : ""} ${top ? "border-t border-slate-100" : ""}`}>
      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">{icon}{label}</div>
      <p className="text-xs font-semibold text-slate-800">{value}</p>
    </div>
  );
}
