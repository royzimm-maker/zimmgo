"use client";

import { useState } from "react";
import { Calendar, Shuffle } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import type { DatePreference } from "@/types/trip";

type DateMode = "exact" | "flexible";

const DURATIONS = [7, 10, 14, 21];

const MONTHS = [
  "2026-05", "2026-06", "2026-07", "2026-08",
  "2026-09", "2026-10", "2026-11", "2026-12",
  "2027-01", "2027-02", "2027-03", "2027-04",
].map((m) => ({
  value: m,
  label: new Date(m + "-01").toLocaleString("default", { month: "long", year: "numeric" }),
}));

export function DatesStep() {
  const { trip, setDates } = useTripStore();
  const existing = trip.preferences.dates;

  const [mode, setMode] = useState<DateMode>(existing?.type ?? "exact");
  const today = new Date().toISOString().slice(0, 10); // always current year
  const [startDate, setStartDate] = useState(existing?.startDate?.slice(0, 10) ?? "");
  const [endDate,   setEndDate  ] = useState(existing?.endDate?.slice(0, 10) ?? "");
  const [flexMonth, setFlexMonth] = useState(existing?.flexibleMonth ?? MONTHS[0].value);
  const [duration,  setDuration ] = useState(existing?.flexibleDuration ?? 10);

  function isValid() {
    if (mode === "exact") return !!startDate && !!endDate && startDate <= endDate;
    return true;
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
            onChange={(e) => setStartDate(e.target.value)}
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
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                    duration === d
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </StepShell>
  );
}
