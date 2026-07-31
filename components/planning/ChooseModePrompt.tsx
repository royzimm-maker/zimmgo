"use client";

import { Sparkles } from "lucide-react";

interface Props {
  manualLabel: string;
  manualDescription: string;
  zigyDescription: string;
  onManual: () => void;
  onZigy: () => void;
  loading: boolean;
}

export function ChooseModePrompt({ manualLabel, manualDescription, zigyDescription, onManual, onZigy, loading }: Props) {
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
          {loading ? "ZiGy is choosing…" : "Let ZiGy choose for me"}
        </p>
        <p className="text-xs text-slate-500 mt-1">{zigyDescription}</p>
      </button>
    </div>
  );
}
