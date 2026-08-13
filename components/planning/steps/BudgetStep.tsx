"use client";

import { useState } from "react";
import { DollarSign, Minus, Plus } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import { BUDGET_LABELS, type BudgetRange } from "@/types/trip";

// ─── Lodging tier options ─────────────────────────────────────────────────────
// Deliberately price-only — no star rating or accommodation style claims here.
// A boutique hotel and a big chain can land at the same nightly rate, and
// "$200-400 = 4-star" isn't reliably true, so pinning a style/star claim to a
// price band both overpromises and duplicates the Lodging step's own type
// and star-rating pickers, which are the actual place to choose that.
const LODGING_TIERS: {
  id: BudgetRange;
  label: string;
  sublabel: string;
  note: string;
}[] = [
  { id: "under_500",  label: "Under $200 / room / night",  sublabel: "Value-focused",          note: "Keeps lodging costs low so the budget goes further elsewhere" },
  { id: "500_750",    label: "$200 – $400 / room / night", sublabel: "Comfort-focused",        note: "A solid range for well-reviewed stays, whatever style you're after" },
  { id: "750_1000",   label: "$400 – $700 / room / night", sublabel: "Premium experience",     note: "More space, service, and amenities, at any style of property" },
  { id: "1000_plus",  label: "$700+ / room / night",       sublabel: "Luxury / no compromise", note: "Top-tier service and space, wherever you choose to stay" },
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

const SPLURGE_RANGES: { min: number; max?: number; label: string }[] = [
  { min: 100, max: 150, label: "$100–150/person" },
  { min: 200, max: 300, label: "$200–300/person" },
  { min: 400,           label: "$400+/person" },
];

// ─── Main component ───────────────────────────────────────────────────────────
export function BudgetStep() {
  const { trip, setBudget, setBudgetDetails } = useTripStore();
  const prefs = trip.preferences;

  const [travelers,    setTravelers   ] = useState(prefs.travelers ?? 2);
  const [rooms,        setRooms       ] = useState(prefs.rooms ?? 1);
  const [lodgingTiers, setLodgingTiers] = useState<BudgetRange[]>(prefs.budgetRanges ?? []);
  const [useCustomRange, setUseCustomRange] = useState(Boolean(prefs.customBudgetRange));
  const [customMin,    setCustomMin    ] = useState(prefs.customBudgetRange ? String(prefs.customBudgetRange.min) : "");
  const [customMax,    setCustomMax    ] = useState(prefs.customBudgetRange ? String(prefs.customBudgetRange.max) : "");
  const [foodPreset,   setFoodPreset  ] = useState<number | "custom" | null>(prefs.dailyFoodBudgetPerPerson ?? null);
  const [customFood,   setCustomFood  ] = useState("");
  const [wantsSplurge,  setWantsSplurge ] = useState(Boolean(prefs.splurge));
  const [splurgeCount,  setSplurgeCount ] = useState(prefs.splurge?.count ?? 2);
  const existingSplurgeMatchesPreset = SPLURGE_RANGES.some(
    (r) => r.min === prefs.splurge?.budgetPerPerson && r.max === prefs.splurge?.budgetPerPersonMax
  );
  const [splurgeRange,  setSplurgeRange ] = useState<{ min: number; max?: number } | null>(
    prefs.splurge && existingSplurgeMatchesPreset
      ? { min: prefs.splurge.budgetPerPerson, max: prefs.splurge.budgetPerPersonMax }
      : SPLURGE_RANGES[1]
  );
  const [useCustomSplurge, setUseCustomSplurge] = useState(Boolean(prefs.splurge) && !existingSplurgeMatchesPreset);
  const [customSplurgeMin, setCustomSplurgeMin] = useState(
    prefs.splurge && !existingSplurgeMatchesPreset ? String(prefs.splurge.budgetPerPerson) : ""
  );
  const [customSplurgeMax, setCustomSplurgeMax] = useState(
    prefs.splurge?.budgetPerPersonMax && !existingSplurgeMatchesPreset ? String(prefs.splurge.budgetPerPersonMax) : ""
  );
  const [splurgeNotes,  setSplurgeNotes ] = useState(prefs.splurge?.notes ?? "");
  const [errors, setErrors] = useState<{ night?: string; food?: string; splurge?: string }>({});

  function toggleTier(id: BudgetRange) {
    setLodgingTiers((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
    setErrors((e) => ({ ...e, night: undefined }));
  }

  function handleContinue() {
    const errs: { night?: string; food?: string; splurge?: string } = {};

    let customRange: { min: number; max: number } | undefined;
    if (useCustomRange) {
      const min = parseInt(customMin.replace(/[^0-9]/g, ""), 10);
      const max = parseInt(customMax.replace(/[^0-9]/g, ""), 10);
      if (!min || !max || min < 30 || max <= min) {
        errs.night = "Please enter a valid range (min $30, and a max greater than the min).";
      } else {
        customRange = { min, max };
      }
    }

    let resolvedFood: number | undefined;
    if (foodPreset === "custom") {
      const num = parseInt(customFood.replace(/[^0-9]/g, ""), 10);
      if (!num || num < 10) { errs.food = "Please enter a valid food budget (min $10/person/day)."; }
      else { resolvedFood = num; }
    } else if (typeof foodPreset === "number") {
      resolvedFood = foodPreset;
    }

    let resolvedSplurgeRange: { min: number; max?: number } | undefined;
    if (wantsSplurge) {
      if (useCustomSplurge) {
        const min = parseInt(customSplurgeMin.replace(/[^0-9]/g, ""), 10);
        const maxRaw = customSplurgeMax.trim();
        const max = maxRaw ? parseInt(maxRaw.replace(/[^0-9]/g, ""), 10) : undefined;
        if (!min || min < 10 || (max !== undefined && (!max || max <= min))) {
          errs.splurge = "Please enter a valid amount (min $10, and a max greater than the min if you set one).";
        } else {
          resolvedSplurgeRange = { min, max };
        }
      } else {
        resolvedSplurgeRange = splurgeRange ?? SPLURGE_RANGES[1];
      }
    }

    if (Object.keys(errs).length) { setErrors(errs); return false; }

    setBudget(lodgingTiers);
    setBudgetDetails({
      travelers,
      rooms,
      dailyFoodBudgetPerPerson: resolvedFood,
      customBudgetRange: customRange,
      splurge: wantsSplurge && resolvedSplurgeRange
        ? {
            count: splurgeCount,
            budgetPerPerson: resolvedSplurgeRange.min,
            budgetPerPersonMax: resolvedSplurgeRange.max,
            notes: splurgeNotes.trim() || undefined,
          }
        : undefined,
    });
  }

  const canContinue = lodgingTiers.length > 0 || useCustomRange;

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
          <p className="mb-3 text-xs text-slate-400">
            Per room per night — pick as many tiers as you&apos;d consider, we&apos;ll match hotels and rentals across them.
            You&apos;ll choose hotel type and star rating separately in the Lodging step.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {LODGING_TIERS.map((opt) => (
              <Card
                key={opt.id}
                hover
                selected={lodgingTiers.includes(opt.id)}
                onClick={() => toggleTier(opt.id)}
                className="cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    lodgingTiers.includes(opt.id) ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-500"
                  )}>
                    <DollarSign size={16} />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{opt.label}</p>
                    <p className="text-xs text-brand-600 font-medium">{opt.sublabel}</p>
                    <p className="mt-1.5 text-xs text-slate-500">{opt.note}</p>
                  </div>
                </div>
              </Card>
            ))}

            <Card
              hover
              selected={useCustomRange}
              onClick={() => { setUseCustomRange((v) => !v); setErrors((e) => ({ ...e, night: undefined })); }}
              className="cursor-pointer sm:col-span-2"
            >
              <div className="flex items-center gap-3">
                <span className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  useCustomRange ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-500"
                )}>
                  ✏️
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm">Custom nightly range</p>
                  <p className="text-xs text-slate-500">Set your own min–max per-room range</p>
                </div>
              </div>
              {useCustomRange && (
                <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-slate-500 text-sm">$</span>
                  <input
                    autoFocus
                    type="number"
                    min="30"
                    value={customMin}
                    onChange={(e) => { setCustomMin(e.target.value); setErrors((er) => ({ ...er, night: undefined })); }}
                    placeholder="e.g. 250"
                    className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="text-slate-400 text-xs">to</span>
                  <span className="text-slate-500 text-sm">$</span>
                  <input
                    type="number"
                    min="30"
                    value={customMax}
                    onChange={(e) => { setCustomMax(e.target.value); setErrors((er) => ({ ...er, night: undefined })); }}
                    placeholder="e.g. 450"
                    className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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

        {/* ── Section 4: Splurge meals ── */}
        <div>
          <button
            type="button"
            onClick={() => setWantsSplurge((v) => !v)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all",
              wantsSplurge ? "border-sage-500 bg-sage-50" : "border-slate-200 bg-white hover:border-slate-300"
            )}
          >
            <span className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg",
              wantsSplurge ? "bg-sage-500 text-white" : "bg-slate-100"
            )}>
              🥂
            </span>
            <div className="flex-1">
              <p className={cn("font-semibold text-sm", wantsSplurge ? "text-sage-800" : "text-slate-800")}>
                Room for a few splurge meals? <span className="font-normal text-slate-400">(optional)</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                A special-occasion dinner or two, budgeted separately from your everyday food spend.
              </p>
            </div>
          </button>

          {wantsSplurge && (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-sage-100 bg-sage-50/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">How many splurge outings?</p>
                <Stepper value={splurgeCount} min={1} max={10} onChange={setSplurgeCount} />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Budget per person, for those</p>
                <div className="flex gap-2">
                  {SPLURGE_RANGES.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => { setUseCustomSplurge(false); setSplurgeRange(r); setErrors((e) => ({ ...e, splurge: undefined })); }}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                        !useCustomSplurge && splurgeRange?.min === r.min && splurgeRange?.max === r.max
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setUseCustomSplurge((v) => !v); setErrors((e) => ({ ...e, splurge: undefined })); }}
                  className={cn(
                    "mt-2 w-full rounded-lg border px-3 py-2 text-left text-xs transition-all",
                    useCustomSplurge
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-dashed border-slate-300 text-slate-400 hover:border-brand-400 hover:text-brand-600"
                  )}
                >
                  ✏️ {useCustomSplurge ? "Custom:" : "Enter a custom amount"}
                </button>
                {useCustomSplurge && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-slate-500 text-sm">$</span>
                    <input
                      autoFocus
                      type="number"
                      min="10"
                      value={customSplurgeMin}
                      onChange={(e) => { setCustomSplurgeMin(e.target.value); setErrors((er) => ({ ...er, splurge: undefined })); }}
                      placeholder="e.g. 150"
                      className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <span className="text-slate-400 text-xs">to (optional)</span>
                    <input
                      type="number"
                      min="10"
                      value={customSplurgeMax}
                      onChange={(e) => { setCustomSplurgeMax(e.target.value); setErrors((er) => ({ ...er, splurge: undefined })); }}
                      placeholder="e.g. 250"
                      className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <span className="text-slate-400 text-xs">per person</span>
                  </div>
                )}
                {errors.splurge && <p className="mt-1 text-xs text-red-500">{errors.splurge}</p>}
              </div>

              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">
                  Anything special we should know? <span className="font-normal text-slate-400">(optional)</span>
                </p>
                <textarea
                  value={splurgeNotes}
                  onChange={(e) => setSplurgeNotes(e.target.value)}
                  rows={2}
                  placeholder={`e.g. "We're celebrating our anniversary and want something special and romantic" or "It's a birthday — something fun and lively"`}
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Summary line ── */}
        {(travelers !== 2 || rooms !== 1 || lodgingTiers.length > 0 || useCustomRange || (foodPreset && foodPreset !== "custom") || wantsSplurge) && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700 mb-1">Your group summary</p>
            <p>👥 {travelers} traveller{travelers !== 1 ? "s" : ""}, {rooms} room{rooms !== 1 ? "s" : ""} per night</p>
            {lodgingTiers.length > 0 && (
              <p>🏨 Lodging: {lodgingTiers.map((t) => BUDGET_LABELS[t]).join(" or ")}</p>
            )}
            {useCustomRange && customMin && customMax && (
              <p>🏨 Lodging: ${customMin}–${customMax}/room/night</p>
            )}
            {typeof foodPreset === "number" && (
              <p>🍽️ Food: ${foodPreset}/person/day</p>
            )}
            {wantsSplurge && (() => {
              const min = useCustomSplurge ? customSplurgeMin : splurgeRange?.min;
              const max = useCustomSplurge ? customSplurgeMax : splurgeRange?.max;
              if (!min) return null;
              return (
                <p>
                  🥂 Splurge: {splurgeCount} outing{splurgeCount !== 1 ? "s" : ""} at ${min}{max ? `–${max}` : "+"}/person
                  {splurgeNotes.trim() && ` — "${splurgeNotes.trim()}"`}
                </p>
              );
            })()}
          </div>
        )}
      </div>
    </StepShell>
  );
}
