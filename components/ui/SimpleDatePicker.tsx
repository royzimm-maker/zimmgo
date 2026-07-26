"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string; // YYYY-MM-DD or ""
  onChange: (val: string) => void;
  min: string; // YYYY-MM-DD
  max: string; // YYYY-MM-DD
}

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseYMD(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SimpleDatePicker({ label, value, onChange, min, max }: Props) {
  const minDate = parseYMD(min)!;
  const maxDate = parseYMD(max)!;
  const selectedDate = parseYMD(value);

  const [viewYear, setViewYear] = useState(() => (selectedDate ?? minDate).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (selectedDate ?? minDate).getMonth());

  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDow = firstOfMonth.getDay();

  const canGoPrev = new Date(viewYear, viewMonth - 1, 1) >= new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  const todayStr = toYMD(new Date());

  function navigate(dir: -1 | 1) {
    const d = new Date(viewYear, viewMonth + dir, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {/* Month navigation — no year picker */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={!canGoPrev}
            className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} className="text-slate-600" />
          </button>
          <span className="text-xs font-semibold text-slate-700">
            {firstOfMonth.toLocaleString("default", { month: "long", year: "numeric" })}
          </span>
          <button
            type="button"
            onClick={() => navigate(1)}
            disabled={!canGoNext}
            className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} className="text-slate-600" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DOW.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-slate-400 py-0.5">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const date = new Date(viewYear, viewMonth, day);
            const dateStr = toYMD(date);
            const isSelected = dateStr === value;
            const isDisabled = date < minDate || date > maxDate;
            const isToday = dateStr === todayStr;

            return (
              <button
                key={day}
                type="button"
                disabled={isDisabled}
                onClick={() => onChange(dateStr)}
                className={cn(
                  "aspect-square flex items-center justify-center text-xs rounded-lg transition-all",
                  isSelected
                    ? "bg-brand-500 text-white font-semibold"
                    : isDisabled
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-slate-700 hover:bg-brand-50 hover:text-brand-700",
                  isToday && !isSelected && "font-semibold text-brand-500"
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
