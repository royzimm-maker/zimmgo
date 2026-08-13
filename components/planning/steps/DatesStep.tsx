"use client";

import { useState } from "react";
import { Calendar, Shuffle, Info } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { SimpleDatePicker } from "@/components/ui/SimpleDatePicker";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import type { DatePreference } from "@/types/trip";

type DateMode = "exact" | "flexible";

const DURATIONS = [7, 10, 14, 21];
const DURATION_MAX = 90;

// 11 months forward from today — airlines rarely open bookings beyond this
function generateMonths() {
  const now = new Date();
  return Array.from({ length: 11 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: d.toLocaleString("default", { month: "long", year: "numeric" }) };
  });
}

const MONTHS = generateMonths();

export function DatesStep() {
  const { trip, setDates } = useTripStore();
  const existing = trip.preferences.dates;

  const [mode, setMode] = useState<DateMode>(existing?.type ?? "exact");
  // Local date, not toISOString() — UTC would give the wrong "today" for
  // users west of UTC in the evening (blocking same-day departures).
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  // Airlines typically don't open bookings beyond ~11 months out, so flight
  // search past this point would just be querying a date no real airline
  // has fares for yet. Dates beyond it are still selectable — the trip can
  // still be planned end-to-end — flight search just gets skipped for it.
  const flightWindowMonths = 11;
  const flightMaxObj = new Date(now.getFullYear(), now.getMonth() + flightWindowMonths, now.getDate());
  const maxDate = `${flightMaxObj.getFullYear()}-${String(flightMaxObj.getMonth() + 1).padStart(2, "0")}-${String(flightMaxObj.getDate()).padStart(2, "0")}`;
  // Hard limit on how far out a trip can be planned at all — generous, just
  // guards against fat-fingering a year far in the future.
  const hardMaxObj = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
  const hardMaxDate = `${hardMaxObj.getFullYear()}-${String(hardMaxObj.getMonth() + 1).padStart(2, "0")}-${String(hardMaxObj.getDate()).padStart(2, "0")}`;
  const [startDate, setStartDate] = useState(existing?.startDate?.slice(0, 10) ?? "");
  const [endDate,   setEndDate  ] = useState(existing?.endDate?.slice(0, 10) ?? "");
  const [flexMonth, setFlexMonth] = useState(existing?.flexibleMonth ?? MONTHS[0].value);
  const [duration,     setDuration    ] = useState(existing?.flexibleDuration ?? 10);
  const [customDur,    setCustomDur   ] = useState(false);
  const [customDurVal, setCustomDurVal] = useState("");

  function isValid() {
    if (mode === "exact") return !!startDate && !!endDate && startDate <= endDate;
    return true;
  }

  function handleStartDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setStartDate(val);
    if (val) {
      // Auto-set return to departure + 1 day if not yet set or before departure
      const dep = new Date(val + "T00:00:00");
      dep.setDate(dep.getDate() + 1);
      const nextDay = `${dep.getFullYear()}-${String(dep.getMonth() + 1).padStart(2, "0")}-${String(dep.getDate()).padStart(2, "0")}`;
      if (!endDate || endDate <= val) setEndDate(nextDay);
    }
  }

  // Flexible-month picks are already capped to the flight-booking window
  // (see MONTHS), so only exact dates can land beyond it.
  const isBeyondFlightWindow = mode === "exact" && !!startDate && startDate > maxDate;

  function handleContinue() {
    const pref: DatePreference =
      mode === "exact"
        ? { type: "exact", startDate, endDate, skipFlightSearch: isBeyondFlightWindow }
        : { type: "flexible", flexibleMonth: flexMonth, flexibleDuration: duration };
    setDates(pref);
  }

  return (
    <StepShell
      stepId="dates"
      onContinue={handleContinue}
      continueDisabled={!isValid()}
      subtitle="Exact dates lock in your flights; flexible lets us find the sweet spot."
    >
      {/* Mode toggle */}
      <div className="mb-5 flex gap-2">
        {(["exact", "flexible"] as DateMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border transition-all",
              mode === m
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            )}
          >
            {m === "exact" ? <Calendar size={14} /> : <Shuffle size={14} />}
            {m === "exact" ? "Exact dates" : "Flexible window"}
          </button>
        ))}
      </div>

      {mode === "exact" ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-4">
            <SimpleDatePicker
              label="Departure"
              value={startDate}
              onChange={(val) => handleStartDateChange({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>)}
              min={today}
              max={hardMaxDate}
              softMax={maxDate}
            />
            <SimpleDatePicker
              label="Return"
              value={endDate}
              onChange={(val) => setEndDate(val)}
              min={startDate || today}
              max={hardMaxDate}
              softMax={maxDate}
            />
          </div>
          {isBeyondFlightWindow && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Airlines typically don&apos;t open bookings this far ahead — usually about {flightWindowMonths} months out.
                We&apos;ll skip flight search for now so it isn&apos;t querying dates no airline has fares for yet, but
                you can still plan everything else (hotels, restaurants, activities) and add flights once they&apos;re
                bookable closer to your trip.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Preferred month</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {MONTHS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setFlexMonth(m.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                    flexMonth === m.value
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Trip duration</p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => { setDuration(d); setCustomDur(false); }}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                    !customDur && duration === d
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {d} days
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomDur(true)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                  customDur
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                Other…
              </button>
            </div>
            {customDur && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={DURATION_MAX}
                  value={customDurVal}
                  onChange={(e) => {
                    setCustomDurVal(e.target.value);
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n >= 1 && n <= DURATION_MAX) setDuration(n);
                  }}
                  placeholder="e.g. 21"
                  className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <span className="text-sm text-slate-500">days</span>
              </div>
            )}
          </div>
        </div>
      )}
    </StepShell>
  );
}
