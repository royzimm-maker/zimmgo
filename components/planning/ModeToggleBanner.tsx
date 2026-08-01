"use client";

import { Sparkles } from "lucide-react";

interface Props {
  label: string;
  onZigy: () => void;
  loading: boolean;
}

// Sits at the top of a step's manual form so users who picked "I'll pick myself"
// can still hand off to ZiGy without navigating back through earlier steps.
export function ModeToggleBanner({ label, onZigy, loading }: Props) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <button
        type="button"
        onClick={onZigy}
        disabled={loading}
        className="shrink-0 flex items-center gap-1 rounded-md border border-brand-300 bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60 transition-colors"
      >
        <Sparkles size={11} />
        {loading ? "ZiGy is choosing…" : "Let ZiGy pick for me"}
      </button>
    </div>
  );
}
