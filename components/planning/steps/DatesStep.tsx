"use client";

import { useState } from "react";
import { Calendar, Shuffle } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { Input } from "@/components/ui/Input";
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
    if (endDate && endDate < val) setEndDate("");
  }

  function handleContinue() {
    const pref: DatePreference =
      mode === "exact"
        ? { type: "exact", startDate, endDate }
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
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="date"
            label="Departure"
            value={startDate}
            onChange={handleStartDateChange}
            min={today}
          />
          <Input
            type="date"
            label="Return"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || today}
          />
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
