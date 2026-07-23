"use client";

import { useState } from "react";
import { DollarSign, Minus, Plus } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import { BUDGET_LABELS, type BudgetRange } from "@/types/trip";

// ─── Lodging tier options ─────────────────────────────────────────────────────
const LODGING_TIERS: {
  id: BudgetRange;
  label: string;
  sublabel: string;
  exampleHotel: string;
}[] = [
  { id: "under_500",  label: "Under $200 / room / night", sublabel: "Smart traveller",       exampleHotel: "Boutique 3★, guesthouse, or Airbnb" },
  { id: "500_750",    label: "$200 – $400 / room / night", sublabel: "Comfort-focused",       exampleHotel: "4★ hotel or premium Airbnb" },
  { id: "750_1000",   label: "$400 – $700 / room / night", sublabel: "Premium experience",    exampleHotel: "4–5★ or design hotel" },
  { id: "1000_plus",  label: "$700+ / room / night",       sublabel: "Luxury / no compromise", exampleHotel: "5★ suite or exclusive villa" },
];

// ─── Food budget presets ──────────────────────────────────────────────────────
const FOOD_PRESETS: { value: number; label: string; sublabel: string; emoji: string }[] = [
  { value: 50,  label: "$30–70 / person / day",  sublabel: "Street food & casual spots",   emoji: "🥙" },
  { value: 100, label: "$70–150 / person / day", sublabel: "Good restaurants daily",        emoji: "🍷" },
  { value: 200, label: "$150–300 / person / day", sublabel: "Fine dining most nights",      emoji: "🥂" },
  { value: 400, label: "$300+ / person / day",   sublabel: "Chef's table & omakase",        emoji: "⭐" },
];

// ─── Stepper control ──────────────────────────────────────────────────────────
function Stepper({
  value,
  min = 1,
  max = 20,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Minus size={14} />
      </button>
      <span className="w-8 text-center font-semibold text-slate-800 text-sm tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function BudgetStep() {
  const { trip, setBudget, setBudgetDetails } = useTripStore();
  const prefs = trip.preferences;

  const [travelers,   setTravelers  ] = useState(prefs.travelers ?? 2);
  const [rooms,       setRooms      ] = useState(prefs.rooms ?? 1);
  const [lodgingTier, setLodgingTier] = useState<BudgetRange | "other" | null>(prefs.budgetRange ?? null);
  const [customNight,  setCustomNight ] = useState("");
  const [foodPreset,   setFoodPreset  ] = useState<number | "custom" | null>(prefs.dailyFoodBudgetPerPerson ?? null);
  const [customFood,   setCustomFood  ] = useState("");
  const [errors,       setErrors      ] = useState<{ night?: string; food?: string }>({});

  function handleContinue() {
    const errs: { night?: string; food?: string } = {};

    let resolvedTier: BudgetRange | null = null;
    if (lodgingTier === "other") {
      const num = parseInt(customNight.replace(/[^0-9]/g, ""), 10);
      if (!num || num < 30) { errs.night = "Please enter a valid nightly amount (min $30)."; }
      else {
        resolvedTier =
          num < 200  ? "under_500"  :
          num < 400  ? "500_750"    :
          num < 700  ? "750_1000"   : "1000_plus";
      }
    } else if (lodgingTier) {
      resolvedTier = lodgingTier;
    }

    let resolvedFood: number | undefined;
    if (foodPreset === "custom") {
      const num = parseInt(customFood.replace(/[^0-9]/g, ""), 10);
      if (!num || num < 10) { errs.food = "Please enter a valid food budget (min $10/person/day)."; }
      else { resolvedFood = num; }
    } else if (typeof foodPreset === "number") {
      resolvedFood = foodPreset;
    }

    if (Object.keys(errs).length) { setErrors(errs); return; }

    if (resolvedTier) setBudget(resolvedTier);
    setBudgetDetails({ travelers, rooms, dailyFoodBudgetPerPerson: resolvedFood });
  }

  const canContinue = lodgingTier !== null;

  return (
    <StepShell
      stepId="budget"
      onContinue={handleContinue}
      continueDisabled={!canContinue}
      subtitle="Tell us about your group and spending comfort — we'll tailor every recommendation."
    >
      <div className="flex flex-col gap-8">

        {/* ── Section 1: Travellers & Rooms ── */}
        <div>
          <p className="mb-3 text-sm font-semibold text-slate-700">Group size</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Travellers</p>
                <p className="text-xs text-slate-400">Total in your group</p>
              </div>
              <Stepper value={travelers} min={1} max={20} onChange={setTravelers} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Rooms</p>
                <p className="text-xs text-slate-400">Needed per night</p>
              </div>
              <Stepper value={rooms} min={1} max={10} onChange={setRooms} />
            </div>
          </div>
        </div>

        {/* ── Section 2: Lodging budget per room / night ── */}
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-700">Lodging budget</p>
          <p className="mb-3 text-xs text-slate-400">Per room per night — we&apos;ll match hotels and rentals to this range.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {LODGING_TIERS.map((opt) => (
              <Card
                key={opt.id}
                hover
                selected={lodgingTier === opt.id}
                onClick={() => { setLodgingTier(opt.id); setErrors((e) => ({ ...e, night: undefined })); }}
                className="cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    lodgingTier === opt.id ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-500"
                  )}>
                    <DollarSign size={16} />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{opt.label}</p>
                    <p className="text-xs text-brand-600 font-medium">{opt.sublabel}</p>
                    <p className="mt-1.5 text-xs text-slate-500">🏨 {opt.exampleHotel}</p>
                  </div>
                </div>
              </Card>
            ))}

            <Card
              hover
              selected={lodgingTier === "other"}
              onClick={() => { setLodgingTier("other"); setErrors((e) => ({ ...e, night: undefined })); }}
              className="cursor-pointer sm:col-span-2"
            >
              <div className="flex items-center gap-3">
                <span className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  lodgingTier === "other" ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-500"
                )}>
                  ✏️
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm">Custom nightly budget</p>
                  <p className="text-xs text-slate-500">Enter your own per-room amount</p>
                </div>
              </div>
              {lodgingTier === "other" && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-slate-500 text-sm">$</span>
                  <input
                    autoFocus
                    type="number"
                    min="30"
                    value={customNight}
                    onChange={(e) => { setCustomNight(e.target.value); setErrors((er) => ({ ...er, night: undefined })); }}
                    placeholder="e.g. 350"
                    className="w-36 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="text-slate-400 text-xs">per room / night</span>
                </div>
              )}
              {errors.night && <p className="mt-1 text-xs text-red-500">{errors.night}</p>}
            </Card>
          </div>
        </div>

        {/* ── Section 3: Daily food budget ── */}
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-700">
            Daily food budget <span className="font-normal text-slate-400">(optional)</span>
          </p>
          <p className="mb-3 text-xs text-slate-400">Per person per day — covers all meals.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FOOD_PRESETS.map((fp) => (
              <button
                key={fp.value}
                type="button"
                onClick={() => { setFoodPreset(fp.value); setErrors((e) => ({ ...e, food: undefined })); }}
                className={cn(
                  "flex flex-col items-start rounded-xl border px-3 py-3 text-left transition-all",
                  foodPreset === fp.value
                    ? "border-brand-500 bg-brand-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <span className="text-lg mb-1">{fp.emoji}</span>
                <p className={cn(
                  "text-xs font-semibold leading-tight",
                  foodPreset === fp.value ? "text-brand-700" : "text-slate-800"
                )}>
                  {fp.label}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{fp.sublabel}</p>
              </button>
            ))}
          </div>

          {/* Custom food budget */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => { setFoodPreset("custom"); setErrors((e) => ({ ...e, food: undefined })); }}
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                foodPreset === "custom"
                  ? "border-brand-500 bg-brand-50"
                  : "border-dashed border-slate-300 text-slate-400 hover:border-brand-400 hover:text-brand-600"
              )}
            >
              ✏️ {foodPreset === "custom" ? "Custom:" : "Enter a custom amount"}
            </button>
            {foodPreset === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-slate-500 text-sm">$</span>
                <input
                  autoFocus
                  type="number"
                  min="10"
                  value={customFood}
                  onChange={(e) => { setCustomFood(e.target.value); setErrors((er) => ({ ...er, food: undefined })); }}
                  placeholder="e.g. 120"
                  className="w-36 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <span className="text-slate-400 text-xs">per person / day</span>
              </div>
            )}
            {errors.food && <p className="mt-1 text-xs text-red-500">{errors.food}</p>}
          </div>
        </div>

        {/* ── Summary line ── */}
        {(travelers !== 2 || rooms !== 1 || lodgingTier !== null || (foodPreset && foodPreset !== "custom")) && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700 mb-1">Your group summary</p>
            <p>👥 {travelers} traveller{travelers !== 1 ? "s" : ""}, {rooms} room{rooms !== 1 ? "s" : ""} per night</p>
            {lodgingTier && lodgingTier !== "other" && (
              <p>🏨 Lodging: {BUDGET_LABELS[lodgingTier]}</p>
            )}
            {typeof foodPreset === "number" && (
              <p>🍽️ Food: ${foodPreset}/person/day</p>
            )}
          </div>
        )}
      </div>
    </StepShell>
  );
}
