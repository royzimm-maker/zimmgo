"use client";

import { useState } from "react";
import { DollarSign } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import { BUDGET_LABELS, type BudgetRange } from "@/types/trip";

const BUDGET_OPTIONS: {
  id: BudgetRange;
  sublabel: string;
  exampleHotel: string;
  exampleDining: string;
}[] = [
  { id: "under_500",  sublabel: "Smart traveller",       exampleHotel: "Boutique 3★ or Airbnb",      exampleDining: "Local spots & markets" },
  { id: "500_750",    sublabel: "Comfort-focused",        exampleHotel: "4★ hotel or premium Airbnb", exampleDining: "Good restaurants daily" },
  { id: "750_1000",   sublabel: "Premium experience",     exampleHotel: "4–5★ or design hotel",       exampleDining: "Fine dining a few nights" },
  { id: "1000_plus",  sublabel: "Luxury / no compromise", exampleHotel: "5★ or exclusive villa",      exampleDining: "Chef's table, omakase" },
];

export function BudgetStep() {
  const { trip, setBudget } = useTripStore();
  const [selected,    setSelected   ] = useState<BudgetRange | "other" | null>(trip.preferences.budgetRange ?? null);
  const [customValue, setCustomValue] = useState("");
  const [customError, setCustomError] = useState("");

  function handleSelect(id: BudgetRange | "other") {
    setSelected(id);
    setCustomError("");
  }

  function handleContinue() {
    if (selected === "other") {
      const num = parseInt(customValue.replace(/[^0-9]/g, ""), 10);
      if (!num || num < 50) { setCustomError("Please enter a valid daily amount (min $50)."); return; }
      // Map custom value to the closest budget tier
      const tier: BudgetRange =
        num < 500  ? "under_500"  :
        num < 750  ? "500_750"    :
        num < 1000 ? "750_1000"   : "1000_plus";
      setBudget(tier);
    } else if (selected) {
      setBudget(selected);
    }
  }

  const canContinue =
    (selected !== null && selected !== "other") ||
    (selected === "other" && !!customValue.trim());

  return (
    <StepShell
      stepId="budget"
      onContinue={handleContinue}
      continueDisabled={!canContinue}
      subtitle="Daily spend per person, covering lodging and meals. We'll keep recommendations within range."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BUDGET_OPTIONS.map((opt) => (
          <Card
            key={opt.id}
            hover
            selected={selected === opt.id}
            onClick={() => handleSelect(opt.id)}
            className="cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <span className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                selected === opt.id ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-500"
              )}>
                <DollarSign size={16} />
              </span>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{BUDGET_LABELS[opt.id]}</p>
                <p className="text-xs text-brand-600 font-medium">{opt.sublabel}</p>
                <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                  <p>🏨 {opt.exampleHotel}</p>
                  <p>🍽️ {opt.exampleDining}</p>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {/* Other / custom amount */}
        <Card
          hover
          selected={selected === "other"}
          onClick={() => handleSelect("other")}
          className="cursor-pointer sm:col-span-2"
        >
          <div className="flex items-center gap-3">
            <span className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              selected === "other" ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-500"
            )}>
              ✏️
            </span>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 text-sm">Other / Custom amount</p>
              <p className="text-xs text-slate-500">Enter your own daily budget</p>
            </div>
          </div>
          {selected === "other" && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-slate-500 text-sm">$</span>
              <input
                autoFocus
                type="number"
                min="50"
                value={customValue}
                onChange={(e) => { setCustomValue(e.target.value); setCustomError(""); }}
                placeholder="e.g. 850"
                className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              <span className="text-slate-400 text-xs">per day</span>
            </div>
          )}
          {customError && <p className="mt-1 text-xs text-red-500">{customError}</p>}
        </Card>
      </div>
    </StepShell>
  );
}
