"use client";

import { Sparkles } from "lucide-react";

interface Props {
  manualLabel: string;
  manualDescription: string;
  zigyLabel?: string;
  zigyLoadingLabel?: string;
  zigyDescription: string;
  // Short note on what ZiGy bases the pick on, shown under zigyDescription —
  // defaults to the same phrasing used everywhere else this pattern appears.
  zigyReassurance?: string;
  onManual: () => void;
  onZigy: () => void;
  loading: boolean;
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
  onManual,
  onZigy,
  loading,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onManual}
        disabled={loading}
        className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-brand-300 hover:shadow-sm transition-all disabled:opacity-60"
      >
        <p className="text-sm font-semibold text-slate-800">{manualLabel}</p>
        <p className="text-xs text-slate-500 mt-1">{manualDescription}</p>
      </button>
      <button
        type="button"
        onClick={onZigy}
        disabled={loading}
        className="rounded-xl border border-brand-300 bg-brand-50/50 p-4 text-left hover:border-brand-400 hover:shadow-sm transition-all disabled:opacity-70"
      >
        <p className="text-sm font-semibold text-brand-700 flex items-center gap-1.5">
          <Sparkles size={14} />
          {loading ? zigyLoadingLabel : zigyLabel}
        </p>
        <p className="text-xs text-slate-500 mt-1">{zigyDescription}</p>
        {zigyReassurance && <p className="text-[10px] text-slate-400 mt-1.5">{zigyReassurance}</p>}
      </button>
    </div>
  );
}
