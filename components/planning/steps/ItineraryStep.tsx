"use client";

import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, Trophy } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ItineraryView } from "@/components/planning/ItineraryView";
import { useTripStore } from "@/lib/store/tripStore";
import type { GeneratedItinerary } from "@/types/trip";

export function ItineraryStep() {
  const { trip, isGenerating, setGenerating, addItinerary, completeStep } = useTripStore();
  const latest = trip.itineraries[trip.itineraries.length - 1] ?? null;

  const [error, setError] = useState<string | null>(null);

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

  // Auto-generate on first mount if no itinerary yet
  useEffect(() => {
    if (!latest && !isGenerating) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StepShell
      stepId="itinerary"
      continueLabel="Personalize my plan →"
      continueDisabled={!latest}
      subtitle="Your personalised day-by-day itinerary, built around your preferences."
    >
      {/* Unlock celebration */}
      {latest && (
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-gradient-to-r from-brand-50 to-sage-50 border border-brand-100 px-4 py-3">
          <Trophy size={20} className="text-brand-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-brand-700">Itinerary unlocked!</p>
            <p className="text-xs text-slate-500">You&apos;re ready to travel. Review and refine below.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={generate}
            loading={isGenerating}
            className="ml-auto shrink-0 text-slate-500"
          >
            <RefreshCw size={13} />
            Regenerate
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isGenerating && !latest && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="relative">
            <Sparkles size={36} className="text-brand-400 animate-pulse" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Building your itinerary…</p>
            <p className="text-sm text-slate-500 mt-1">
              We&apos;re matching flights, hotels, and activities to your preferences.
            </p>
          </div>
          <div className="flex gap-1 mt-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-brand-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

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
      {latest && <ItineraryView itinerary={latest} />}
    </StepShell>
  );
}
