"use client";

import { useState } from "react";
import { DollarSign, ChevronDown, ChevronUp, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { estimateTripBudget } from "@/lib/budget";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

interface Props {
  itinerary: GeneratedItinerary;
  preferences: TripPreferences;
}

export function BudgetBreakdown({ itinerary, preferences }: Props) {
  const [open, setOpen] = useState(false);
  // Same estimator used server-side to set totalEstimatedCost (Trip-at-a-
  // Glance's "Est. total") — passing the same itinerary data back through it
  // here keeps the two numbers shown to the user identical.
  const { lines, total, perPerson, travelers } = estimateTripBudget(
    { numDays: itinerary.days.length, flights: itinerary.flights, hotels: itinerary.hotels, activities: itinerary.activities },
    preferences
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <DollarSign size={15} className="text-sage-600" />
          <span className="text-sm font-semibold text-slate-800">Estimated Budget Breakdown</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-900">{formatCurrency(total)}</span>
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          <div className="px-4 py-3 flex flex-col gap-2">
            {lines.map((line) => (
              <div key={line.label} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700">{line.label}</p>
                  <p className="text-[10px] text-slate-400">{line.note}</p>
                </div>
                <p className="text-xs font-semibold text-slate-800 shrink-0">{formatCurrency(line.amount)}</p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-800">Total estimated</span>
              <span className="text-sm font-bold text-slate-900">{formatCurrency(total)}</span>
            </div>
            {travelers > 1 && (
              <div className="flex justify-between items-center mt-0.5">
                <span className="text-xs text-slate-500">Per person</span>
                <span className="text-xs font-semibold text-slate-600">{formatCurrency(perPerson)}</span>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="px-4 py-2.5 border-t border-slate-100 flex items-start gap-1.5">
            <Info size={11} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-relaxed">
              These are rough estimates based on your preferences. Actual costs may vary — verify flight and hotel prices directly before booking.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
