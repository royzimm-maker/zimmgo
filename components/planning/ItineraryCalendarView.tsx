"use client";

import { parseLocalDate } from "@/lib/utils";
import type { ItineraryDay } from "@/types/trip";

interface Props {
  days: ItineraryDay[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Groups trip days by calendar month so a trip spanning a month boundary
// prints as two clean grids instead of one grid with a confusing gap.
function groupByMonth(days: ItineraryDay[]): Map<string, ItineraryDay[]> {
  const months = new Map<string, ItineraryDay[]>();
  for (const day of days) {
    const d = parseLocalDate(day.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = months.get(key) ?? [];
    bucket.push(day);
    months.set(key, bucket);
  }
  return months;
}

export function ItineraryCalendarView({ days }: Props) {
  const months = groupByMonth(days);

  return (
    <div className="flex flex-col gap-8">
      {Array.from(months.entries()).map(([key, monthDays]) => {
        const [year, month] = key.split("-").map(Number);
        return (
          <MonthGrid
            key={key}
            year={year}
            month={month}
            monthDays={monthDays}
          />
        );
      })}
    </div>
  );
}

function MonthGrid({ year, month, monthDays }: { year: number; month: number; monthDays: ItineraryDay[] }) {
  const byDate = new Map(monthDays.map((d) => [d.date, d]));
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const totalCells = leadingBlanks + daysInMonth;
  const trailingBlanks = (7 - (totalCells % 7)) % 7;

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array(trailingBlanks).fill(null),
  ];

  return (
    <div className="print:break-inside-avoid">
      <h3 className="mb-3 text-base font-bold text-slate-900">{MONTH_NAMES[month]} {year}</h3>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="bg-slate-50 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {wd}
          </div>
        ))}
        {cells.map((dateNum, idx) => {
          if (dateNum === null) return <div key={idx} className="min-h-[92px] bg-slate-50/50" />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(dateNum).padStart(2, "0")}`;
          const tripDay = byDate.get(iso);
          return (
            <div
              key={idx}
              className={
                tripDay
                  ? "flex min-h-[92px] flex-col gap-0.5 bg-brand-50/60 px-2 py-1.5"
                  : "min-h-[92px] bg-white px-2 py-1.5"
              }
            >
              <span className={tripDay ? "text-xs font-bold text-brand-700" : "text-xs text-slate-400"}>
                {dateNum}
              </span>
              {tripDay && (
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <span className="rounded bg-brand-100 px-1 py-0.5 text-[9px] font-semibold text-brand-700 leading-tight">
                    Day {tripDay.dayNumber}
                  </span>
                  {tripDay.location && (
                    <span className="truncate text-[10px] font-medium text-slate-600 leading-tight">
                      📍 {tripDay.location}
                    </span>
                  )}
                  <span className="line-clamp-2 text-[10px] text-slate-500 leading-tight">
                    {tripDay.theme}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
