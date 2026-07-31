"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Trophy, CheckCircle2 } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ItineraryView } from "@/components/planning/ItineraryView";
import { ItinerarySelectionWizard } from "@/components/planning/ItinerarySelectionWizard";
import { useTripStore } from "@/lib/store/tripStore";
import type { GeneratedItinerary } from "@/types/trip";

export function ItineraryStep() {
  const { trip, isGenerating, setGenerating, addItinerary, completeStep, goToStep, markItineraryReviewed } = useTripStore();
  const latest = trip.itineraries[trip.itineraries.length - 1] ?? null;
  const isPersonalized = Boolean(latest?.finalizedPlan);

  const [error, setError] = useState<string | null>(null);
  const [showPicksBanner, setShowPicksBanner] = useState(false);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/itinerary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id, preferences: trip.preferences }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: GeneratedItinerary = await res.json();
      addItinerary(data);
      completeStep("itinerary");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  const autoStartRef = useRef(false);
  const prevPersonalizedRef = useRef(isPersonalized);

  useEffect(() => {
    const state = useTripStore.getState();
    const hasItinerary = state.trip.itineraries.length > 0;
    if (!hasItinerary && !state.isGenerating && !autoStartRef.current) {
      autoStartRef.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show a banner when the user returns from the personalize step having just saved picks
  useEffect(() => {
    if (isPersonalized && !prevPersonalizedRef.current) {
      setShowPicksBanner(true);
      const t = setTimeout(() => setShowPicksBanner(false), 4000);
      return () => clearTimeout(t);
    }
    prevPersonalizedRef.current = isPersonalized;
  }, [isPersonalized]);

  return (
    <StepShell
      stepId="itinerary"
      continueLabel={isPersonalized ? "Update personalization" : "Personalize my plan"}
      continueDisabled={!latest}
      onContinue={() => goToStep("refine")}
      subtitle="Your personalised day-by-day itinerary, built around your preferences."
    >
      {/* Personalization saved banner */}
      {showPicksBanner && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-sage-50 to-brand-50 border border-sage-200 px-4 py-3">
          <CheckCircle2 size={18} className="text-sage-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-sage-700">Personalization saved!</p>
            <p className="text-xs text-slate-500">Your picks now appear as chips in each day card below.</p>
          </div>
        </div>
      )}

      {/* Unlock celebration */}
      {latest && !showPicksBanner && (
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-gradient-to-r from-brand-50 to-sage-50 border border-brand-100 px-4 py-3">
          <Trophy size={20} className="text-brand-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-brand-700">
              {isPersonalized ? "Itinerary personalized!" : "Itinerary unlocked!"}
            </p>
            <p className="text-xs text-slate-500">
              {isPersonalized
                ? "Your picks are shown in each day. Use the button below to adjust."
                : "You're ready to travel. Review and refine below."}
            </p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={generate}
              loading={isGenerating}
              className="shrink-0 text-slate-500"
            >
              <RefreshCw size={13} />
              Regenerate
            </Button>
            <p className="text-[10px] text-slate-400 pr-1">Rebuilds everything from scratch</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isGenerating && !latest && <GeneratingProgress />}

      {/* Error state */}
      {error && (
        <Card className="border-red-200 bg-red-50 mb-4">
          <p className="text-sm text-red-700 font-medium">Failed to generate itinerary</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
          <Button variant="outline" size="sm" onClick={generate} className="mt-3">
            Try again
          </Button>
        </Card>
      )}

      {/* Itinerary output */}
      {latest && !latest.reviewCompleted && (
        <ItinerarySelectionWizard
          key={latest.id}
          itinerary={latest}
          onComplete={() => markItineraryReviewed(latest.id)}
        />
      )}
      {latest && latest.reviewCompleted && (
        <ItineraryView key={latest.id} itinerary={latest} hideSelectionSections />
      )}
    </StepShell>
  );
}

const STATUS_MESSAGES = [
  "Searching for the best flights…",
  "Finding hotels that match your vibe…",
  "Curating local experiences…",
  "Building your day-by-day plan…",
  "Checking restaurant picks…",
  "Negotiating with the concierge…",
  "Bribing the maître d' for a better table…",
  "Convincing the locals you're not a tourist…",
  "Building a trip you'll never forget…",
  "This will be worth the wait…",
  "Adding the secret gems only locals know…",
  "Perfecting your itinerary one detail at a time…",
  "Almost there — good things take time…",
  "Packing in more adventures…",
];
const RING_R = 34;
const RING_CIRC = 2 * Math.PI * RING_R;

function GeneratingProgress() {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Exponential easing: fast start, then slows dramatically, caps at 80%
  // At 10s ≈ 45%, 20s ≈ 63%, 30s ≈ 75%, 60s ≈ 80% — never looks "almost done"
  const progress = (1 - Math.exp(-elapsed * 0.05)) * 0.80;
  const dashOffset = RING_CIRC * (1 - progress);
  const statusIdx = Math.floor(elapsed / 6) % STATUS_MESSAGES.length;
  const mm = String(Math.floor(elapsed / 60)).padStart(1, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center">
      {/* Progress ring */}
      <div className="relative">
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={RING_R} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle
            cx="44" cy="44" r={RING_R}
            fill="none"
            stroke="#6366f1"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 44 44)"
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-mono font-semibold text-brand-600">{mm}:{ss}</span>
        </div>
      </div>
      <div>
        <p className="font-semibold text-slate-800">{STATUS_MESSAGES[statusIdx]}</p>
        <p className="text-sm text-slate-500 mt-1">
          This usually takes a minute or two — good trips take time to build.
        </p>
      </div>
      <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 max-w-xs text-center">
        <p className="text-xs font-semibold text-brand-700 mb-0.5">While you wait…</p>
        <p className="text-xs text-slate-600">Feel free to chat with ZiGy about your trip — ask about visa requirements, what to pack, or the best time to visit.</p>
      </div>
    </div>
  );
}
