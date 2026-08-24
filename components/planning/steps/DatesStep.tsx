"use client";

import { useEffect, useState } from "react";
import { Calendar, Shuffle, Info, AlertCircle, Sparkles } from "lucide-react";
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

// True if `month` (1-12) falls within [start, end] — wrapping the new year
// when start > end (e.g. 9 through 4 means Sept, Oct, Nov, Dec, Jan..Apr).
function isMonthInWindow(month: number, start: number, end: number): boolean {
  return start <= end ? month >= start && month <= end : month >= start || month <= end;
}

export function DatesStep() {
  const { trip, setDates, completeStep, goToStep } = useTripStore();
  const existing = trip.preferences.dates;
  const seasonalStart = trip.preferences.destination?.seasonalWindowStartMonth;
  const seasonalEnd = trip.preferences.destination?.seasonalWindowEndMonth;
  const hasSeasonalWindow = seasonalStart !== undefined && seasonalEnd !== undefined;

  const [mode, setMode] = useState<DateMode>(existing?.type ?? "exact");
  const [showSeasonalWarning, setShowSeasonalWarning] = useState(false);
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
  const [arrivalTime, setArrivalTime] = useState(existing?.preferredArrivalTime ?? "");
  const [departureTimeOfDay, setDepartureTimeOfDay] = useState<DatePreference["preferredDepartureTimeOfDay"] | undefined>(
    existing?.preferredDepartureTimeOfDay
  );
  // Default into the seasonal window (the next upcoming month that falls in
  // it) rather than always "this month" — only when nothing's been picked
  // yet, so it never overrides a traveller's own earlier choice.
  const [flexMonth, setFlexMonth] = useState(() => {
    if (existing?.flexibleMonth) return existing.flexibleMonth;
    if (hasSeasonalWindow) {
      const inWindow = MONTHS.find((m) => isMonthInWindow(Number(m.value.split("-")[1]), seasonalStart!, seasonalEnd!));
      if (inWindow) return inWindow.value;
    }
    return MONTHS[0].value;
  });
  const [duration,     setDuration    ] = useState(existing?.flexibleDuration ?? 10);
  const [customDur,    setCustomDur   ] = useState(false);
  const [customDurVal, setCustomDurVal] = useState("");

  // At least one night per city, so a multi-city trip can't be planned with
  // fewer nights than destinations — a same-day date range for e.g. 3 cities
  // forces the itinerary generator to silently squash or invent days.
  const cityCount = trip.preferences.destination?.cities?.filter(Boolean).length ?? 1;
  const minNights = Math.max(1, cityCount);
  const tripNights =
    startDate && endDate
      ? Math.round((new Date(endDate + "T00:00:00").getTime() - new Date(startDate + "T00:00:00").getTime()) / 86400000)
      : 0;
  const tooFewNights = mode === "exact" && !!startDate && !!endDate && startDate <= endDate && tripNights < minNights;

  function isValid() {
    if (mode === "exact") return !!startDate && !!endDate && startDate <= endDate && tripNights >= minNights;
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

  function buildDatePref(): DatePreference {
    return mode === "exact"
      ? {
          type: "exact",
          startDate,
          endDate,
          skipFlightSearch: isBeyondFlightWindow,
          preferredArrivalTime: arrivalTime || undefined,
          preferredDepartureTimeOfDay: departureTimeOfDay,
        }
      : { type: "flexible", flexibleMonth: flexMonth, flexibleDuration: duration };
  }

  // Every calendar month the trip actually spans — for flexible mode that's
  // just the one chosen month; for exact mode a trip can cross several.
  function monthsSpanned(): number[] {
    if (mode === "flexible") return [Number(flexMonth.split("-")[1])];
    if (!startDate || !endDate) return [];
    const months = new Set<number>();
    const cur = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    while (cur <= end) {
      months.add(cur.getMonth() + 1);
      cur.setDate(cur.getDate() + 1);
    }
    return Array.from(months);
  }

  const spannedMonths = monthsSpanned();
  const outOfSeasonalWindow =
    hasSeasonalWindow &&
    isValid() &&
    spannedMonths.length > 0 &&
    !spannedMonths.some((m) => isMonthInWindow(m, seasonalStart!, seasonalEnd!));

  function handleContinue() {
    if (outOfSeasonalWindow && !showSeasonalWarning) {
      setShowSeasonalWarning(true);
      return false;
    }
    setDates(buildDatePref());
  }

  // Mirrors DestinationStep's confirmRoadTrip — a custom action outside
  // StepShell's own Continue button, so it has to complete+advance the step
  // itself rather than relying on StepShell's wrapper to do it.
  function continueAnyway() {
    setDates(buildDatePref());
    setShowSeasonalWarning(false);
    completeStep("dates");
    goToStep("airlines");
  }

  // If the traveller edits their way back into the window after seeing the
  // warning, drop it instead of leaving a stale "outside the window" banner
  // up once it's no longer true.
  useEffect(() => {
    if (showSeasonalWarning && !outOfSeasonalWindow) setShowSeasonalWarning(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outOfSeasonalWindow]);

  return (
    <StepShell
      stepId="dates"
      onContinue={handleContinue}
      continueDisabled={!isValid()}
      subtitle="Exact dates lock in your flights; flexible lets us find the sweet spot."
    >
      {/* Seasonal heads-up — shown up front so it informs the pick in the
          first place; picking dates outside the window still only prompts a
          confirmation (below), never blocks outright, since the traveller's
          real constraints (school breaks, work) always take priority over
          an astronomical event. */}
      {trip.preferences.destination?.seasonalNote && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
          <Sparkles size={15} className="text-brand-500 shrink-0 mt-0.5" />
          <p className="text-xs text-brand-800 leading-relaxed">{trip.preferences.destination.seasonalNote}</p>
        </div>
      )}

      {/* Confirmation prompt — only appears after Continue is clicked with
          dates outside the window, so it doesn't nag while the traveller is
          still picking. */}
      {showSeasonalWarning && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-amber-800 leading-relaxed">
              These dates don&apos;t fall within the window ZiGy mentioned — {trip.preferences.destination?.seasonalNote}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={continueAnyway}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                Continue anyway
              </button>
              <button
                type="button"
                onClick={() => setShowSeasonalWarning(false)}
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
              >
                Let me adjust the dates
              </button>
            </div>
          </div>
        </div>
      )}

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
          {tooFewNights && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-800 leading-relaxed">
                {tripNights} night{tripNights !== 1 ? "s" : ""} isn&apos;t enough to cover all {cityCount} destinations on this trip
                — pick a return date at least {minNights} night{minNights !== 1 ? "s" : ""} after departure.
              </p>
            </div>
          )}
          {/* Optional flight time preferences — flight search biases generated
              options toward these, and the day-by-day plan treats day 1/the
              last day as partial around them, instead of ignoring time of day
              entirely. */}
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
            <p className="mb-2 text-sm font-medium text-slate-700">
              Flight timing <span className="font-normal text-slate-400">(optional)</span>
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Preferred arrival time</label>
                <input
                  type="time"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Preferred return-flight departure</label>
                <div className="flex gap-1.5">
                  {(["morning", "afternoon", "evening"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDepartureTimeOfDay((prev) => (prev === t ? undefined : t))}
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition-all",
                        departureTimeOfDay === t
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
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
