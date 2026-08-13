"use client";

import { useState } from "react";
import { Heart, X, Plus } from "lucide-react";
import { useTripStore } from "@/lib/store/tripStore";
import type { GeneratedItinerary, WanderlogItem } from "@/types/trip";

const GROUP_ORDER: WanderlogItem["source"][] = ["restaurant", "activity", "discovery", "custom"];
const GROUP_LABEL: Record<WanderlogItem["source"], string> = {
  activity: "Activities",
  restaurant: "Dining",
  discovery: "Local picks",
  custom: "Your notes",
};

// Compact sidebar counterpart to Wanderlog — same data and actions, but grouped
// by type (dining/activities/local picks/notes) and sized for the narrow chat
// column rather than the full-width itinerary page.
export function WanderlogPanel({ itinerary }: { itinerary: GeneratedItinerary }) {
  const { addWanderlogItem, removeWanderlogItem, updateWanderlogNote } = useTripStore();
  const [draft, setDraft] = useState("");
  const items = itinerary.wanderlog ?? [];

  function handleAddCustom() {
    const label = draft.trim();
    if (!label) return;
    addWanderlogItem(itinerary.id, { label, source: "custom" });
    setDraft("");
  }

  const groups = GROUP_ORDER
    .map((source) => ({ source, items: items.filter((w) => w.source === source) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-200 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Heart size={13} className="text-brand-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-800">ZiGy&apos;s Wanderlog</span>
          {items.length > 0 && (
            <span className="ml-auto text-[10px] text-slate-400 font-medium">{items.length} saved</span>
          )}
        </div>
        <p className="mt-1 text-[10px] text-slate-400 leading-snug">
          Your save-for-later list — click <Heart size={9} className="inline -mt-0.5" /> on any suggestion to save it here for when you're actually travelling.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-3">
        {groups.length === 0 && (
          <p className="text-[11px] text-slate-400 text-center py-4">
            Nothing saved yet — tap the heart on any pick to add it here.
          </p>
        )}
        {groups.map(({ source, items: groupItems }) => (
          <div key={source}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              {GROUP_LABEL[source]}
            </p>
            <div className="flex flex-col gap-1.5">
              {groupItems.map((w) => (
                <div key={w.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-800 truncate">{w.label}</p>
                      {w.location && <p className="text-[9px] text-slate-400 truncate">{w.location}</p>}
                      {w.description && <p className="text-[10px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{w.description}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWanderlogItem(itinerary.id, w.id)}
                      className="shrink-0 text-slate-300 hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <X size={11} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={w.note ?? ""}
                    onChange={(e) => updateWanderlogNote(itinerary.id, w.id, e.target.value)}
                    placeholder="Add a note…"
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 flex items-center gap-1.5 border-t border-slate-200 px-3 py-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
          placeholder="Add your own…"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
        <button
          type="button"
          onClick={handleAddCustom}
          disabled={!draft.trim()}
          className="flex items-center gap-1 rounded-lg bg-brand-600 text-white px-2 py-1.5 text-[11px] font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors"
        >
          <Plus size={11} />
        </button>
      </div>
    </div>
  );
}
