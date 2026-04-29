"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface SelectChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: React.ReactNode;
  label: string;
  sublabel?: string;
}

export function SelectChip({ selected, icon, label, sublabel, className, ...props }: SelectChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        selected
          ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm",
        className
      )}
      {...props}
    >
      {selected && (
        <span className="absolute top-2 right-2 text-brand-600">
          <Check size={14} strokeWidth={2.5} />
        </span>
      )}
      {icon && <span className="text-xl mb-0.5">{icon}</span>}
      <span className="text-sm font-medium">{label}</span>
      {sublabel && <span className="text-xs text-slate-500">{sublabel}</span>}
    </button>
  );
}
