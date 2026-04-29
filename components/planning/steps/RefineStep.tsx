"use client";

import { useState, useCallback } from "react";
import {
  MapPin, CheckCircle2, Circle, MessageCircle, Send, RefreshCw,
  Sparkles, Hotel, Star, X
} from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { Badge } from "@/components/ui/Badge";
import { useTripStore } from "@/lib/store/tripStore";
import { formatCurrency } from "@/lib/utils";
import type { ActivityOption, NeighborhoodOption, TripPreferences } from "@/types/trip";

// ─── Inline AI Q&A panel ──────────────────────────────────────────────────────

interface AskPanelProps {
  itemName: string;
  itemType: "activity" | "neighborhood";
  preferences: TripPreferences;
  onClose: () => void;
}

function AskPanel({ itemName, itemType, preferences, onClose }: AskPanelProps) {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch("/api/itinerary/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          contextItem: itemName,
          contextType: itemType,
          preferences,
        }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      setReply(data.reply ?? data.error ?? "Sorry, something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-brand-700 flex items-center gap-1">
          <Sparkles size={11} /> Ask ZimmGo AI about {itemType === "neighborhood" ? "this neighbourhood" : "this activity"}
        </span>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={13} />
        </button>
      </div>

      {reply && (
        <div className="mb-3 rounded-lg bg-white border border-brand-100 px-3 py-2 text-xs text-slate-700 leading-relaxed">
          {reply}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={
            itemType === "neighborhood"
              ? "e.g. Is it walkable? Safe at night? Good for families?"
              : "e.g. How long does it take? Is booking required? Good for beginners?"
          }
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading || !question.trim()}
          className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40 transition-colors"
        >
          {loading ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
        </button>
      </div>
    </div>
  );
}

// ─── Neighborhood card ────────────────────────────────────────────────────────

interface NeighborhoodCardProps {
  neighborhood: NeighborhoodOption;
  selected: boolean;
  onSelect: () => void;
  onAsk: () => void;
  showAsk: boolean;
  preferences: TripPreferences;
  onCloseAsk: () => void;
}

function NeighborhoodCard({
  neighborhood: n,
  selected,
  onSelect,
  onAsk,
  showAsk,
  preferences,
  onCloseAsk,
}: NeighborhoodCardProps) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 transition-all duration-150 ${
        selected ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">{n.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold text-sm ${selected ? "text-brand-700" : "text-slate-800"}`}>
                {n.name}
              </span>
              <span className="text-xs text-slate-400">{n.priceRange}</span>
              {selected && (
                <Badge variant="success">Selected</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs italic text-brand-500">{n.vibe}</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">{n.description}</p>
            <p className="mt-1.5 text-xs text-slate-400">
              <span className="font-medium text-slate-500">Best for:</span> {n.bestFor}
            </p>
          </div>
          <span className={`shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
            selected ? "border-brand-500 bg-brand-500" : "border-slate-300"
          }`}>
            {selected && (
              <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        </div>
      </button>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onAsk}
          className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 transition-colors"
        >
          <MessageCircle size={11} />
          Ask ZimmGo AI
        </button>
      </div>

      {showAsk && (
        <AskPanel
          itemName={n.name}
          itemType="neighborhood"
          preferences={preferences}
          onClose={onCloseAsk}
        />
      )}
    </div>
  );
}

// ─── Activity row ─────────────────────────────────────────────────────────────

interface ActivityRowProps {
  activity: ActivityOption;
  included: boolean;
  onToggle: () => void;
  onAsk: () => void;
  showAsk: boolean;
  preferences: TripPreferences;
  onCloseAsk: () => void;
}

function ActivityRow({
  activity: a,
  included,
  onToggle,
  onAsk,
  showAsk,
  preferences,
  onCloseAsk,
}: ActivityRowProps) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 transition-all duration-150 ${
        included ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <button type="button" onClick={onToggle} className="shrink-0 mt-0.5">
          {included ? (
            <CheckCircle2 size={20} className="text-brand-500" />
          ) : (
            <Circle size={20} className="text-slate-300" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium text-sm ${included ? "text-slate-800" : "text-slate-400 line-through"}`}>
              {a.name}
            </span>
            {a.isLocalFavorite && included && <Badge variant="success">Local pick</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{a.description}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
            {a.duration && <span>⏱ {a.duration}</span>}
            {a.rating > 0 && <span>⭐ {a.rating}</span>}
            {a.price > 0 && <span className="font-medium text-slate-600">{formatCurrency(a.price)}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={onAsk}
          className="shrink-0 flex items-center gap-1 text-xs text-brand-400 hover:text-brand-600 transition-colors"
          title="Ask ZimmGo AI about this activity"
        >
          <MessageCircle size={13} />
        </button>
      </div>

      {showAsk && (
        <AskPanel
          itemName={a.name}
          itemType="activity"
          preferences={preferences}
          onClose={onCloseAsk}
        />
      )}
    </div>
  );
}

// ─── Main RefineStep ──────────────────────────────────────────────────────────

export function RefineStep() {
  const { trip, goToStep } = useTripStore();
  const itinerary = trip.itineraries[trip.itineraries.length - 1] ?? null;

  const neighborhoods = itinerary?.neighborhoods ?? [];
  const activities: ActivityOption[] = itinerary?.activities ?? [];

  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [includedIds, setIncludedIds] = useState<Set<string>>(
    () => new Set(activities.map((a) => a.id))
  );
  const [askingAbout, setAskingAbout] = useState<string | null>(null);

  const toggleActivity = useCallback((id: string) => {
    setIncludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function toggleAsk(id: string) {
    setAskingAbout((prev) => (prev === id ? null : id));
  }

  // Navigate back to the itinerary view so the user lands on their finished plan.
  function handleDone() {
    goToStep("itinerary");
  }

  const includedCount = includedIds.size;
  const totalCount = activities.length;

  if (!itinerary) {
    return (
      <StepShell stepId="refine" continueLabel="Done" onContinue={handleDone}>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-slate-500 text-sm">No itinerary generated yet.</p>
          <p className="text-xs text-slate-400">Go back to the Itinerary step to generate your plan.</p>
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell
      stepId="refine"
      continueLabel="Done — view my plan"
      onContinue={handleDone}
      subtitle="Choose your neighbourhood, select the activities you want, and ask our AI any questions."
    >
      {/* ── Neighbourhood picker ── */}
      {neighborhoods.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Hotel size={15} className="text-brand-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Where would you like to stay?</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            We recommend these neighbourhoods based on your preferences. Select one to note your choice.
          </p>
          <div className="flex flex-col gap-3">
            {neighborhoods.map((n) => (
              <NeighborhoodCard
                key={n.id}
                neighborhood={n}
                selected={selectedNeighborhood === n.id}
                onSelect={() => setSelectedNeighborhood((prev) => (prev === n.id ? null : n.id))}
                onAsk={() => toggleAsk(`nbhd-${n.id}`)}
                showAsk={askingAbout === `nbhd-${n.id}`}
                preferences={trip.preferences}
                onCloseAsk={() => setAskingAbout(null)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Activity picker ── */}
      {activities.length > 0 && (
        <section className={neighborhoods.length > 0 ? "border-t border-slate-100 pt-6" : ""}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Star size={15} className="text-brand-500" />
              <h3 className="font-semibold text-slate-800 text-sm">Your experiences</h3>
            </div>
            <span className="text-xs text-slate-400">
              {includedCount} of {totalCount} selected
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Uncheck any activity you'd like to remove, or tap{" "}
            <MessageCircle size={10} className="inline" />{" "}
            to ask our AI for more information or alternatives.
          </p>
          <div className="flex flex-col gap-2">
            {activities.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                included={includedIds.has(a.id)}
                onToggle={() => toggleActivity(a.id)}
                onAsk={() => toggleAsk(`act-${a.id}`)}
                showAsk={askingAbout === `act-${a.id}`}
                preferences={trip.preferences}
                onCloseAsk={() => setAskingAbout(null)}
              />
            ))}
          </div>
        </section>
      )}

      {/* No data fallback */}
      {neighborhoods.length === 0 && activities.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Sparkles size={32} className="text-brand-300" />
          <p className="text-slate-500 text-sm">
            Your itinerary is ready — use the AI chat panel to ask any follow-up questions or request changes.
          </p>
        </div>
      )}

      {/* Summary */}
      {(selectedNeighborhood || includedCount < totalCount) && (
        <div className="mt-5 rounded-xl bg-sage-50 border border-sage-200 px-4 py-3 text-xs text-slate-600">
          {selectedNeighborhood && (
            <p className="flex items-center gap-1.5 mb-1">
              <MapPin size={11} className="text-sage-600" />
              <span>
                Staying in:{" "}
                <strong>{neighborhoods.find((n) => n.id === selectedNeighborhood)?.name}</strong>
              </span>
            </p>
          )}
          {includedCount < totalCount && (
            <p className="flex items-center gap-1.5">
              <CheckCircle2 size={11} className="text-sage-600" />
              <span>
                {totalCount - includedCount} activit{totalCount - includedCount === 1 ? "y" : "ies"} removed from your plan
              </span>
            </p>
          )}
        </div>
      )}
    </StepShell>
  );
}
