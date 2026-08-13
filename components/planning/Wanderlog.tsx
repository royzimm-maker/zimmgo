"use client";

import { useState } from "react";
import { Heart, ChevronDown, ChevronUp, X, Plus } from "lucide-react";
import { useTripStore } from "@/lib/store/tripStore";
import type { GeneratedItinerary } from "@/types/trip";

const SOURCE_LABEL: Record<string, string> = {
  activity: "Activity",
  restaurant: "Restaurant",
  discovery: "Local pick",
  custom: "Your note",
};

interface Props {
  itinerary: GeneratedItinerary;
}

export function Wanderlog({ itinerary }: Props) {
  const { addWanderlogItem, removeWanderlogItem, updateWanderlogNote } = useTripStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const items = itinerary.wanderlog ?? [];

  function handleAddCustom() {
    const label = draft.trim();
    if (!label) return;
    addWanderlogItem(itinerary.id, { label, source: "custom" });
    setDraft("");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Heart size={15} className="text-brand-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-semibold text-slate-800">ZiGy&apos;s Wanderlog</span>
            {!open && (
              <p className="text-[11px] text-slate-400 truncate">
                Your save-for-later list — heart any restaurant or activity to keep it without scheduling it.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {items.length > 0 && (
            <span className="text-xs text-slate-400 font-medium">{items.length} saved</span>
          )}
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500 mb-3">
            A save-for-later list, separate from your day-by-day plan. Tap the <Heart size={10} className="inline -mt-0.5" /> heart on any restaurant or activity to add it here instead of scheduling it — good for backups, "if we have time" ideas, or things you want to remember without committing to a day. Been already? Leave yourself a note for next time.
          </p>

          {items.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {items.map((w) => (
                <div key={w.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-800">{w.label}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wide text-brand-500 bg-brand-50 rounded px-1.5 py-0.5">
                          {SOURCE_LABEL[w.source] ?? w.source}
                        </span>
                      </div>
                      {w.location && <p className="text-[10px] text-slate-400 mt-0.5">{w.location}</p>}
                      {w.description && <p className="text-[11px] text-slate-500 mt-1 leading-snug">{w.description}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWanderlogItem(itinerary.id, w.id)}
                      className="shrink-0 text-slate-300 hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={w.note ?? ""}
                    onChange={(e) => updateWanderlogNote(itinerary.id, w.id, e.target.value)}
                    placeholder="Add a note…"
                    className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
              placeholder="Add your own — a tip from a friend, something you spotted…"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!draft.trim()}
              className="flex items-center gap-1 rounded-lg bg-brand-600 text-white px-2.5 py-1.5 text-xs font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>

          {items.length === 0 && (
            <p className="text-xs text-slate-400 text-center mt-3">
              Nothing saved yet — use the bookmark icon on any activity or restaurant to add it here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
