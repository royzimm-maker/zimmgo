"use client";

import { Sparkles, AlertCircle, Check } from "lucide-react";

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
  // True once ZiGy has actually produced a pick — the row becomes a closed,
  // non-interactive status instead of still inviting another click, since a
  // repeatable-looking "Let ZiGy pick for me" button sitting there after it
  // already ran reads like nothing happened. The actual picks and ZiGy's
  // reasoning are shown separately by the caller — this is just the banner.
  picked?: boolean;
  // Bolder styling (solid button, larger text) for steps that dropped their
  // separate "how do you want to choose?" screen in favor of surfacing this
  // hand-off inline — without the boost it reads as an easy-to-miss aside
  // rather than the primary alternative to picking manually.
  prominent?: boolean;
}

const DEFAULT_REASSURANCE =
  "ZiGy decides based on your inputs so far and everything we know about your destinations.";

// Sits at the top of a step's manual form so users who picked "I'll pick myself"
// can still hand off to ZiGy without navigating back through earlier steps.
export function ModeToggleBanner({ label, onZigy, loading, reassurance = DEFAULT_REASSURANCE, error, picked = false, prominent = false }: Props) {
  if (picked) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs text-slate-500">{label}</p>
        <span className="shrink-0 flex items-center gap-1 rounded-md bg-sage-100 px-2.5 py-1 text-xs font-semibold text-sage-700">
          <Check size={11} />
          Here&rsquo;s what ZiGy recommends
        </span>
      </div>
    );
  }

  if (prominent) {
    return (
      <div className="mb-4 flex flex-col gap-2 rounded-xl border-2 border-brand-200 bg-brand-50 px-4 py-3">
        <p className="text-sm font-semibold text-brand-800">{label}</p>
        <button
          type="button"
          onClick={onZigy}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          <Sparkles size={14} />
          {loading ? "ZiGy is choosing…" : "Let ZiGy pick for me"}
        </button>
        {reassurance && !error && <p className="text-xs text-brand-600">{reassurance}</p>}
        {error && (
          <p className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle size={12} className="shrink-0" />
            {error}
          </p>
        )}
      </div>
    );
  }

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
