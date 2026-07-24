"use client";

import { useState } from "react";
import { ClipboardList, ChevronDown, ChevronUp, Check, AlertCircle } from "lucide-react";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

interface Task {
  text: string;
  urgent?: boolean;
}

interface TaskGroup {
  timeframe: string;
  daysLabel: string;
  tasks: Task[];
  isPast: boolean;
}

function buildTaskGroups(preferences: TripPreferences, itinerary: GeneratedItinerary): TaskGroup[] {
  const dateStr = preferences.dates?.startDate ?? itinerary.days[0]?.date ?? "";
  const departure = dateStr ? new Date(dateStr) : null;
  const today = new Date();
  const daysUntil = departure ? Math.ceil((departure.getTime() - today.getTime()) / 86_400_000) : 999;

  return [
    {
      timeframe: "6+ months before",
      daysLabel: "180+ days out",
      isPast: daysUntil < 180,
      tasks: [
        { text: "Book flights — prices are usually best 3–6 months out" },
        { text: "Check visa requirements for your passport (allow 4–8 weeks if needed)", urgent: true },
        { text: "Reserve hotels — especially in peak season" },
        { text: "Book any signature experiences that sell out (cooking classes, hot-air balloons, etc.)" },
      ],
    },
    {
      timeframe: "3–6 months before",
      daysLabel: "90–180 days out",
      isPast: daysUntil < 90,
      tasks: [
        { text: "Purchase travel insurance" },
        { text: "Notify your bank and credit card companies of travel dates" },
        { text: "Arrange airport transfers or car hire" },
        { text: "Book tours and guided experiences" },
      ],
    },
    {
      timeframe: "1–2 months before",
      daysLabel: "30–60 days out",
      isPast: daysUntil < 30,
      tasks: [
        { text: "Make restaurant reservations — most accept bookings 4 weeks in advance", urgent: true },
        { text: "Confirm passport has 6+ months validity beyond your return date", urgent: true },
        { text: "Download offline maps, translation apps, and local apps" },
        { text: "Confirm all hotel and tour bookings" },
        { text: "Check if any vaccinations are recommended" },
      ],
    },
    {
      timeframe: "1–2 weeks before",
      daysLabel: "7–14 days out",
      isPast: daysUntil < 7,
      tasks: [
        { text: "Pack and weigh luggage (check airline baggage allowance)" },
        { text: "Exchange currency or order travel cash" },
        { text: "Download airline app and save boarding passes" },
        { text: "Confirm flight times haven't changed" },
        { text: "Download entertainment for the flight" },
      ],
    },
    {
      timeframe: "Day before",
      daysLabel: "24 hours out",
      isPast: daysUntil < 1,
      tasks: [
        { text: "Check in online (usually opens 24 hours before departure)" },
        { text: "Charge all devices and your power bank" },
        { text: "Double-check all travel documents are together" },
        { text: "Confirm airport transfer or parking" },
        { text: "Set multiple alarms — getting to the airport stress-free is half the battle" },
      ],
    },
  ];
}

interface Props {
  itinerary: GeneratedItinerary;
  preferences: TripPreferences;
}

export function PreTripTasks({ itinerary, preferences }: Props) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const groups = buildTaskGroups(preferences, itinerary);
  const total = groups.reduce((s, g) => s + g.tasks.length, 0);
  const done = checked.size;

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClipboardList size={15} className="text-amber-500" />
          <span className="text-sm font-semibold text-slate-800">Pre-Trip Task Timeline</span>
        </div>
        <div className="flex items-center gap-3">
          {open && done > 0 && (
            <span className="text-xs text-sage-600 font-medium">{done}/{total} done</span>
          )}
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {groups.map((group) => (
            <div key={group.timeframe} className={`px-4 py-3 ${group.isPast ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {group.timeframe}
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-500">
                  {group.daysLabel}
                </span>
                {group.isPast && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-medium text-amber-700">
                    Already past
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {group.tasks.map((task) => {
                  const key = `${group.timeframe}:${task.text}`;
                  const isDone = checked.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggle(key)}
                      className="flex items-start gap-2 text-left"
                    >
                      <span className={`shrink-0 mt-0.5 flex h-4 w-4 items-center justify-center rounded border transition-all ${
                        isDone ? "border-sage-500 bg-sage-500" : "border-slate-300"
                      }`}>
                        {isDone && <Check size={10} className="text-white" />}
                      </span>
                      <span className={`text-xs leading-relaxed flex-1 ${isDone ? "line-through text-slate-400" : "text-slate-700"}`}>
                        {task.text}
                        {task.urgent && !isDone && (
                          <AlertCircle size={10} className="inline ml-1 text-amber-500" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
