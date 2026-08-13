"use client";

import { Sparkles, AlertCircle } from "lucide-react";

interface Props {
  label: string;
  onZigy: () => void;
  loading: boolean;
  // Short note on what ZiGy bases the pick on — shown under the row so
  // "let ZiGy pick" doesn't read like a shot in the dark. Defaults to the
  // same phrasing used everywhere else this pattern appears.
  reassurance?: string;
  // Set when a previous ZiGy pick attempt failed — a real failure (bad API
  // key, network blip) should never look identical to "ZiGy picked nothing."
  error?: string | null;
}

const DEFAULT_REASSURANCE =
  "ZiGy decides based on your inputs so far and everything we know about your destinations.";

// Sits at the top of a step's manual form so users who picked "I'll pick myself"
// can still hand off to ZiGy without navigating back through earlier steps.
export function ModeToggleBanner({ label, onZigy, loading, reassurance = DEFAULT_REASSURANCE, error }: Props) {
  return (
    <div className="mb-4 flex flex-col gap-1 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
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
      {reassurance && !error && <p className="text-[10px] text-slate-400">{reassurance}</p>}
      {error && (
        <p className="flex items-center gap-1 text-[10px] text-red-600">
          <AlertCircle size={10} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
