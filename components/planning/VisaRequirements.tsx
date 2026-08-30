"use client";

import { Stamp, ExternalLink, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import { getVisaRequirementsForTrip } from "@/lib/data/visaRequirements";
import type { TripPreferences } from "@/types/trip";

export function VisaRequirements({ preferences }: { preferences: TripPreferences }) {
  const { setVisaAcknowledged } = useTripStore();
  const entries = getVisaRequirementsForTrip(preferences.destination);
  if (!entries.length) return null;

  const requiredEntries = entries.filter((e) => e.visa.required);
  const anyRequired = requiredEntries.length > 0;
  const acknowledged = preferences.visaAcknowledged ?? false;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <Stamp size={14} className="text-brand-500" />
        <p className="text-xs font-semibold text-slate-700">Visa Requirements</p>
      </div>

      <div className="px-4 py-3 flex flex-col gap-2.5">
        {entries.map((e) => (
          <div key={e.country} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                e.visa.required ? "bg-amber-100 text-amber-800" : "bg-sage-100 text-sage-700"
              )}
            >
              {e.visa.required ? "Visa required" : "No visa needed"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">{e.country}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{e.visa.summary}</p>
              {e.visa.link && (
                <a
                  href={e.visa.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                >
                  {e.visa.linkLabel ?? "Official info"}
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        ))}

        <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
          Assumes a US passport — requirements vary by nationality and change over time. Confirm with official sources before booking.
        </p>
      </div>

      {anyRequired && (
        <div className="border-t border-amber-100 bg-amber-50 px-4 py-3">
          <button
            type="button"
            onClick={() => setVisaAcknowledged(!acknowledged)}
            className="flex w-full items-start gap-2.5 text-left"
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                acknowledged ? "border-amber-600 bg-amber-600" : "border-amber-400 bg-white"
              )}
            >
              {acknowledged && <Check size={11} className="text-white" />}
            </span>
            <span className="text-xs text-amber-800 leading-relaxed">
              <AlertTriangle size={11} className="inline mr-1 -mt-0.5" />
              I understand {requiredEntries.length > 1 ? "these destinations require visas" : `${requiredEntries[0].country} requires a visa`} and will take care of it before departure.
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
