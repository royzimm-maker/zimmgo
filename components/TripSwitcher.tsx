"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin, Plus, Trash2 } from "lucide-react";
import { useTripStore } from "@/lib/store/tripStore";
import { parseLocalDate } from "@/lib/utils";
import type { Trip } from "@/types/trip";

function destinationLabel(trip: Trip): string {
  return trip.preferences.destination?.displayName ?? "Not started yet";
}

const COMPACT_DATE = { month: "short", day: "numeric" } as const;
const FLEX_MONTH: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };

function dateLabel(trip: Trip): string | null {
  const dates = trip.preferences.dates;
  if (!dates) return null;
  if (dates.type === "exact" && dates.startDate && dates.endDate) {
    const start = parseLocalDate(dates.startDate);
    const end = parseLocalDate(dates.endDate);
    const sameYear = start.getFullYear() === end.getFullYear();
    const startLabel = start.toLocaleDateString("en-US", COMPACT_DATE);
    const endLabel = end.toLocaleDateString("en-US", sameYear ? COMPACT_DATE : { ...COMPACT_DATE, year: "numeric" });
    return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
  }
  if (dates.type === "flexible" && dates.flexibleMonth) {
    const [y, m] = dates.flexibleMonth.split("-").map(Number);
    const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("en-US", FLEX_MONTH);
    return dates.flexibleDuration ? `${monthLabel} · ${dates.flexibleDuration} days` : monthLabel;
  }
  return null;
}

export function TripSwitcher() {
  const { trip, savedTrips, switchToTrip, startNewTrip, deleteTrip } = useTripStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // All trips, active one first, most-recently-updated saved trips next.
  const allTrips = [trip, ...[...savedTrips].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))];

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleSwitch(id: string) {
    switchToTrip(id);
    setOpen(false);
    router.push("/plan");
  }

  function handleNewTrip() {
    startNewTrip();
    setOpen(false);
    router.push("/plan");
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const isActive = id === trip.id;
    const label = isActive
      ? "Delete this trip? This can't be undone — you'll start with a blank trip."
      : "Delete this trip? This can't be undone.";
    if (!confirm(label)) return;
    deleteTrip(id);
    if (isActive) setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors max-w-[180px]"
      >
        <span className="truncate">{trip.name}</span>
        <ChevronDown size={13} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-72 rounded-lg border border-slate-200 bg-white shadow-lg py-1.5">
          <p className="px-3 pb-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Your trips
          </p>
          <div className="max-h-72 overflow-y-auto">
            {allTrips.map((t) => (
              <div
                key={t.id}
                onClick={() => (t.id === trip.id ? setOpen(false) : handleSwitch(t.id))}
                className={`group flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${
                  t.id === trip.id ? "bg-brand-50" : ""
                }`}
              >
                <MapPin size={13} className={`mt-0.5 ${t.id === trip.id ? "text-brand-500 shrink-0" : "text-slate-300 shrink-0"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium ${t.id === trip.id ? "text-brand-700" : "text-slate-700"}`}>
                    {t.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">{destinationLabel(t)}</p>
                  {dateLabel(t) && (
                    <p className="truncate text-[10px] text-slate-400">{dateLabel(t)}</p>
                  )}
                </div>
                {t.id === trip.id && (
                  <span className="shrink-0 mt-0.5 text-[10px] font-semibold text-brand-500">Active</span>
                )}
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, t.id)}
                  title="Delete trip"
                  className="shrink-0 mt-0.5 text-slate-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-1 border-t border-slate-100 pt-1">
            <button
              type="button"
              onClick={handleNewTrip}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              <Plus size={14} />
              New trip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
