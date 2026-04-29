"use client";

import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OtherInputProps {
  selected: boolean;
  value: string;
  onChange: (val: string) => void;
  onToggle: () => void;
  placeholder?: string;
}

/**
 * A "Other…" chip that expands into a text input when selected.
 * Compose with SelectChip grids across all planning steps.
 */
export function OtherInput({
  selected,
  value,
  onChange,
  onToggle,
  placeholder = "Describe it…",
}: OtherInputProps) {
  const [committed, setCommitted] = useState(!!value);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && value.trim()) setCommitted(true);
    if (e.key === "Escape") { onToggle(); }
  }

  // Collapsed chip
  if (!selected) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-500 transition-all hover:border-brand-400 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Pencil size={14} />
        Other…
      </button>
    );
  }

  // Expanded: show text input inline
  return (
    <div className="col-span-full flex items-center gap-2 rounded-xl border-2 border-brand-500 bg-brand-50 px-3 py-2">
      <Pencil size={14} className="shrink-0 text-brand-500" />
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setCommitted(false); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
      />
      {value.trim() && (
        <button
          type="button"
          onClick={() => setCommitted(true)}
          className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white hover:bg-brand-600"
        >
          <Check size={11} strokeWidth={3} />
        </button>
      )}
      <button
        type="button"
        onClick={() => { onChange(""); onToggle(); }}
        className="shrink-0 text-xs text-slate-400 hover:text-slate-600"
      >
        ✕
      </button>
    </div>
  );
}
