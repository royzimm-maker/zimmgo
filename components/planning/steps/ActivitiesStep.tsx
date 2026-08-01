"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { OtherInput } from "@/components/ui/OtherInput";
import { ChooseModePrompt } from "@/components/planning/ChooseModePrompt";
import { useSmartPick } from "@/lib/hooks/useSmartPick";
import { useTripStore } from "@/lib/store/tripStore";
import type { ActivityCategory } from "@/types/trip";

const GENERAL: { id: ActivityCategory; label: string; icon: string; sublabel: string }[] = [
  { id: "guided_walking_tour", label: "Guided Walking Tour", icon: "🚶", sublabel: "Expert-led neighbourhood & history walks" },
  { id: "guided_food_tour",    label: "Guided Food Tour",    icon: "🍽️", sublabel: "Curated culinary walks with a local expert" },
  { id: "hiking",              label: "Hiking",              icon: "🥾", sublabel: "Trails, peaks, national parks" },
  { id: "skiing",              label: "Skiing",              icon: "⛷️", sublabel: "Downhill, backcountry, snow" },
  { id: "sailing",             label: "Sailing",             icon: "⛵", sublabel: "Charters, coastal cruising" },
  { id: "food",                label: "Food Experiences",    icon: "🍜", sublabel: "Markets, tastings, restaurants" },
  { id: "diving",              label: "Diving & Snorkel",    icon: "🤿", sublabel: "Reefs, wrecks, marine life" },
  { id: "cycling",             label: "Cycling",             icon: "🚴", sublabel: "Road biking, mountain biking" },
  { id: "cultural",            label: "Cultural",            icon: "🏛️", sublabel: "History, arts, local traditions" },
  { id: "photography",         label: "Photography",         icon: "📷", sublabel: "Landscapes, architecture, street" },
  { id: "wellness",            label: "Wellness & Spa",      icon: "🧘", sublabel: "Retreats, yoga, thermal baths" },
  { id: "adventure",           label: "Adventure Sports",    icon: "🪂", sublabel: "Paragliding, bungee, white water" },
];

export function ActivitiesStep() {
  const { trip, setActivities } = useTripStore();

  const [mode, setMode] = useState<"prompt" | "manual">(
    () => (trip.preferences.activities.length > 0 ? "manual" : "prompt")
  );
  const { picking, summary: pickSummary, run: runSmartPick } = useSmartPick();

  const [selectedGeneral, setSelectedGeneral] = useState<ActivityCategory[]>(
    trip.preferences.activities.filter((a): a is ActivityCategory =>
      GENERAL.some((g) => g.id === a)
    )
  );
  const [otherOpen,  setOtherOpen ] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  function toggleGeneral(id: ActivityCategory) {
    setSelectedGeneral((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  async function handleZigyPick() {
    const picks = await runSmartPick({
      kind: "activities",
      preferences: trip.preferences,
      candidates: GENERAL.map((g) => ({ id: g.id, label: g.label })),
    });
    const picked = picks
      .map((p) => p.id)
      .filter((id): id is ActivityCategory => GENERAL.some((g) => g.id === id));
    setSelectedGeneral(picked);
    setMode("manual");
  }

  function handleContinue() {
    const all: string[] = [
      ...selectedGeneral,
      ...(otherOpen && otherValue.trim() ? [otherValue.trim()] : []),
    ];
    setActivities(all);
  }

  const totalSelected =
    selectedGeneral.length + (otherOpen && otherValue.trim() ? 1 : 0);

  if (mode === "prompt") {
    return (
      <StepShell
        stepId="activities"
        continueLabel="I'll pick myself"
        onContinue={() => { setMode("manual"); return false; }}
        subtitle="How do you want to choose your activities?"
      >
        <ChooseModePrompt
          manualLabel="I'll pick myself"
          manualDescription="Browse the categories and choose what sounds good."
          zigyDescription="ZiGy picks 3-5 categories that fit your destination — you can still adjust before continuing."
          onManual={() => setMode("manual")}
          onZigy={handleZigyPick}
          loading={picking}
        />
      </StepShell>
    );
  }

  return (
    <StepShell
      stepId="activities"
      onContinue={handleContinue}
      continueDisabled={totalSelected === 0}
      subtitle="What kind of experiences do you love? We'll weave these into your itinerary."
    >
      {pickSummary && (
        <p className="mb-4 text-xs text-brand-600 bg-brand-50 rounded-lg px-3 py-2">
          <Sparkles size={11} className="inline mr-1" />
          {pickSummary}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {GENERAL.map((a) => (
          <SelectChip
            key={a.id}
            label={a.label}
            icon={a.icon}
            sublabel={a.sublabel}
            selected={selectedGeneral.includes(a.id)}
            onClick={() => toggleGeneral(a.id)}
          />
        ))}
        <OtherInput
          selected={otherOpen}
          value={otherValue}
          onChange={setOtherValue}
          onToggle={() => setOtherOpen((v) => !v)}
          placeholder="e.g. Surfing, Bird watching…"
        />
      </div>

      {totalSelected > 0 && (
        <p className="mt-4 text-xs text-slate-500">
          {totalSelected} activit{totalSelected === 1 ? "y" : "ies"} selected
        </p>
      )}
    </StepShell>
  );
}
