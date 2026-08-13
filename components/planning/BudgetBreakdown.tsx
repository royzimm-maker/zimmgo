"use client";

import { useState } from "react";
import { DollarSign, ChevronDown, ChevronUp, Info, RotateCcw } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  estimateTripBudget,
  normalizeCabinClass,
  CABIN_CLASS_LABELS,
  CABIN_CLASS_MULTIPLIERS,
  LODGING_TIER_NIGHTLY,
  FOOD_TIER_PRESETS,
  ACTIVITY_INTENSITY_PRESETS,
  type BudgetOverrides,
  type CabinClass,
  type BudgetLine,
} from "@/lib/budget";
import { BUDGET_LABELS, type BudgetRange } from "@/types/trip";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

interface Props {
  itinerary: GeneratedItinerary;
  preferences: TripPreferences;
}

// Small pill-button used for every "what if" control below.
function OptionPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      )}
    >
      {children}
    </button>
  );
}

const ADJUSTABLE_LINE_IDS: BudgetLine["id"][] = ["flights", "hotels", "activities", "food"];

export function BudgetBreakdown({ itinerary, preferences }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedLine, setExpandedLine] = useState<BudgetLine["id"] | null>(null);
  const [overrides, setOverrides] = useState<BudgetOverrides>({});

  const budgetInput = { numDays: itinerary.days.length, flights: itinerary.flights, hotels: itinerary.hotels, activities: itinerary.activities };

  // Same estimator used server-side to set totalEstimatedCost (Trip-at-a-
  // Glance's "Est. total") — passing the same itinerary data back through it
  // here keeps the two numbers shown to the user identical when no "what if"
  // adjustments are active.
  const baseline = estimateTripBudget(budgetInput, preferences);
  const { lines, total, perPerson, travelers } = estimateTripBudget(budgetInput, preferences, overrides);

  const hasOverrides = Object.keys(overrides).length > 0;
  const delta = total - baseline.total;
  const baseCabin = normalizeCabinClass(itinerary.flights[0]?.cabinClass);

  function toggleLine(id: BudgetLine["id"]) {
    if (!ADJUSTABLE_LINE_IDS.includes(id)) return;
    setExpandedLine((cur) => (cur === id ? null : id));
  }

  function resetAll() {
    setOverrides({});
  }

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
          <p className="px-4 pt-3 text-[10px] text-slate-400">
            Tap a line item to see what changing it would do to your total — nothing here affects your actual picks.
          </p>

          <div className="px-4 py-3 flex flex-col gap-1">
            {lines.map((line) => {
              const adjustable = ADJUSTABLE_LINE_IDS.includes(line.id);
              const isExpanded = expandedLine === line.id;
              return (
                <div key={line.id} className="rounded-lg">
                  <button
                    type="button"
                    onClick={() => toggleLine(line.id)}
                    disabled={!adjustable}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors",
                      adjustable && "hover:bg-slate-50 cursor-pointer",
                      !adjustable && "cursor-default"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 flex items-center gap-1">
                        {line.label}
                        {adjustable && (isExpanded ? <ChevronUp size={11} className="text-slate-400" /> : <ChevronDown size={11} className="text-slate-400" />)}
                      </p>
                      <p className="text-[10px] text-slate-400">{line.note}</p>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 shrink-0">{formatCurrency(line.amount)}</p>
                  </button>

                  {isExpanded && line.id === "flights" && (
                    <div className="px-1.5 pb-2.5 pt-1 flex flex-wrap gap-1.5">
                      {(Object.keys(CABIN_CLASS_MULTIPLIERS) as CabinClass[]).map((cabin) => (
                        <OptionPill
                          key={cabin}
                          active={(overrides.cabinClass ?? baseCabin) === cabin}
                          onClick={() =>
                            setOverrides((o) => ({ ...o, cabinClass: cabin === baseCabin ? undefined : cabin }))
                          }
                        >
                          {CABIN_CLASS_LABELS[cabin]}
                          {cabin === baseCabin ? " (booked)" : ""}
                        </OptionPill>
                      ))}
                    </div>
                  )}

                  {isExpanded && line.id === "hotels" && (
                    <div className="px-1.5 pb-2.5 pt-1 flex flex-wrap gap-1.5">
                      <OptionPill active={!overrides.lodgingTier} onClick={() => setOverrides((o) => ({ ...o, lodgingTier: undefined }))}>
                        As searched
                      </OptionPill>
                      {(Object.keys(LODGING_TIER_NIGHTLY) as BudgetRange[]).map((tier) => (
                        <OptionPill
                          key={tier}
                          active={overrides.lodgingTier === tier}
                          onClick={() => setOverrides((o) => ({ ...o, lodgingTier: tier }))}
                        >
                          {BUDGET_LABELS[tier]}
                        </OptionPill>
                      ))}
                    </div>
                  )}

                  {isExpanded && line.id === "food" && (
                    <div className="px-1.5 pb-2.5 pt-1 flex flex-wrap gap-1.5">
                      {FOOD_TIER_PRESETS.map((preset) => (
                        <OptionPill
                          key={preset.value}
                          active={(overrides.dailyFoodBudgetPerPerson ?? preferences.dailyFoodBudgetPerPerson ?? 80) === preset.value}
                          onClick={() => setOverrides((o) => ({ ...o, dailyFoodBudgetPerPerson: preset.value }))}
                        >
                          {preset.label}
                        </OptionPill>
                      ))}
                    </div>
                  )}

                  {isExpanded && line.id === "activities" && (
                    <div className="px-1.5 pb-2.5 pt-1 flex flex-wrap gap-1.5">
                      <OptionPill active={!overrides.activityIntensity} onClick={() => setOverrides((o) => ({ ...o, activityIntensity: undefined }))}>
                        As planned
                      </OptionPill>
                      {ACTIVITY_INTENSITY_PRESETS.map((preset) => (
                        <OptionPill
                          key={preset.value}
                          active={overrides.activityIntensity === preset.value}
                          onClick={() => setOverrides((o) => ({ ...o, activityIntensity: preset.value }))}
                        >
                          {preset.label}
                        </OptionPill>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-800">
                {hasOverrides ? "Adjusted estimate" : "Total estimated"}
              </span>
              <span className="text-sm font-bold text-slate-900">{formatCurrency(total)}</span>
            </div>
            {travelers > 1 && (
              <div className="flex justify-between items-center mt-0.5">
                <span className="text-xs text-slate-500">Per person</span>
                <span className="text-xs font-semibold text-slate-600">{formatCurrency(perPerson)}</span>
              </div>
            )}
            {hasOverrides && (
              <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={resetAll}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-brand-600 transition-colors"
                >
                  <RotateCcw size={11} />
                  Reset to your picks
                </button>
                <span className={cn("text-[11px] font-semibold", delta > 0 ? "text-amber-600" : delta < 0 ? "text-sage-600" : "text-slate-400")}>
                  {delta > 0 ? "+" : ""}
                  {formatCurrency(delta)} vs your picks
                </span>
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
