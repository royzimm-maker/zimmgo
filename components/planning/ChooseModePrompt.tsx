"use client";

import { Check, Sparkles, AlertCircle } from "lucide-react";

export type ModeChoice = "manual" | "zigy";

interface Props {
  manualLabel: string;
  manualDescription: string;
  zigyLabel?: string;
  zigyLoadingLabel?: string;
  zigyDescription: string;
  // Short note on what ZiGy bases the pick on, shown under zigyDescription —
  // defaults to the same phrasing used everywhere else this pattern appears.
  zigyReassurance?: string;
  // Which card is currently highlighted — selecting a card doesn't act on it
  // right away; the step's own Continue button (disabled until a choice is
  // made) is what actually switches views or triggers the ZiGy pick, so a
  // click here can't be mistaken for an accidental commit.
  selected: ModeChoice | null;
  onSelect: (choice: ModeChoice) => void;
  loading: boolean;
  // Set when a previous ZiGy pick attempt failed — a real failure (bad API
  // key, network blip) should never look identical to "ZiGy picked nothing."
  error?: string | null;
}

const DEFAULT_REASSURANCE =
  "ZiGy decides based on your inputs so far and everything we know about your destinations.";

export function ChooseModePrompt({
  manualLabel,
  manualDescription,
  zigyLabel = "Let ZiGy choose for me",
  zigyLoadingLabel = "ZiGy is choosing…",
  zigyDescription,
  zigyReassurance = DEFAULT_REASSURANCE,
  selected,
  onSelect,
  loading,
  error,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => onSelect("manual")}
        disabled={loading}
        className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-left transition-all disabled:opacity-60 ${
          selected === "manual"
            ? "border-brand-500 ring-2 ring-brand-200 shadow-md bg-white"
            : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm"
        }`}
      >
        <div>
          <p className="text-sm font-semibold text-slate-800">{manualLabel}</p>
          <p className="text-xs text-slate-500 mt-1">{manualDescription}</p>
        </div>
        {selected === "manual" && (
          <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => onSelect("zigy")}
        disabled={loading}
        className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-left transition-all disabled:opacity-70 ${
          selected === "zigy"
            ? "border-brand-500 ring-2 ring-brand-200 shadow-md bg-brand-50/50"
            : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm"
        }`}
      >
        <div>
          <p className="text-sm font-semibold text-brand-700 flex items-center gap-1.5">
            <Sparkles size={14} />
            {loading ? zigyLoadingLabel : zigyLabel}
          </p>
          <p className="text-xs text-slate-500 mt-1">{zigyDescription}</p>
          {zigyReassurance && <p className="text-[10px] text-slate-400 mt-1.5">{zigyReassurance}</p>}
        </div>
        {selected === "zigy" && (
          <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </button>
    </div>
  );
}
