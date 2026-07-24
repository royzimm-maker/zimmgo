"use client";

import { useState } from "react";
import { DollarSign, ChevronDown, ChevronUp, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

interface Props {
  itinerary: GeneratedItinerary;
  preferences: TripPreferences;
}

interface BudgetLine {
  label: string;
  amount: number;
  note: string;
}

function calcBudget(itinerary: GeneratedItinerary, preferences: TripPreferences) {
  const travelers = preferences.travelers ?? 1;
  const days = itinerary.days.length;
  const dailyFood = preferences.dailyFoodBudgetPerPerson ?? 80;

  // Flights list contains alternative options — only the first two represent
  // the outbound + return legs actually being budgeted (matches TripGlance).
  const flightCost = itinerary.flights.slice(0, 2).reduce((s, f) => s + f.price, 0) * travelers;
  const hotelNights = Math.max(days - 1, 1);
  const avgNightly = itinerary.hotels.length
    ? itinerary.hotels.reduce((s, h) => s + h.pricePerNight, 0) / itinerary.hotels.length
    : 0;
  const hotelCost = avgNightly * hotelNights;
  const activityCost = itinerary.activities.reduce((s, a) => s + a.price, 0) * travelers;
  const foodCost = dailyFood * travelers * days;
  const transportCost = Math.round(days * 25 * travelers);
  const subtotal = flightCost + hotelCost + activityCost + foodCost + transportCost;
  const misc = Math.round(subtotal * 0.1);
  const total = subtotal + misc;

  const lines: BudgetLine[] = [
    { label: "Flights",                   amount: flightCost,    note: `${travelers} traveler${travelers > 1 ? "s" : ""}, outbound + return` },
    { label: "Hotels",                    amount: hotelCost,     note: `${hotelNights} night${hotelNights > 1 ? "s" : ""}, avg ${formatCurrency(avgNightly)}/night` },
    { label: "Activities & Tours",        amount: activityCost,  note: `${itinerary.activities.length} experience${itinerary.activities.length !== 1 ? "s" : ""}` },
    { label: "Food & Dining",             amount: foodCost,      note: `~$${dailyFood}/person/day × ${days} days` },
    { label: "Local Transportation",      amount: transportCost, note: "rideshare, transit, taxis" },
    { label: "Miscellaneous (10% buffer)",amount: misc,          note: "tips, souvenirs, incidentals" },
  ];

  return { lines, total, perPerson: Math.round(total / travelers), travelers };
}

export function BudgetBreakdown({ itinerary, preferences }: Props) {
  const [open, setOpen] = useState(false);
  const { lines, total, perPerson, travelers } = calcBudget(itinerary, preferences);

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
