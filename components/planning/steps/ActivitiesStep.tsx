"use client";

import { useState } from "react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { OtherInput } from "@/components/ui/OtherInput";
import { useTripStore } from "@/lib/store/tripStore";
import type { ActivityCategory } from "@/types/trip";

const ACTIVITIES: { id: ActivityCategory; label: string; icon: string; sublabel: string }[] = [
  { id: "hiking",      label: "Hiking",           icon: "🥾", sublabel: "Trails, peaks, national parks" },
  { id: "skiing",      label: "Skiing",            icon: "⛷️", sublabel: "Downhill, backcountry, snow" },
  { id: "sailing",     label: "Sailing",           icon: "⛵", sublabel: "Charters, coastal cruising" },
  { id: "food",        label: "Food Experiences",  icon: "🍜", sublabel: "Markets, tastings, restaurants" },
  { id: "diving",      label: "Diving & Snorkel",  icon: "🤿", sublabel: "Reefs, wrecks, marine life" },
  { id: "cycling",     label: "Cycling",           icon: "🚴", sublabel: "Road biking, mountain biking" },
  { id: "cultural",    label: "Cultural",          icon: "🏛️", sublabel: "History, arts, local traditions" },
  { id: "photography", label: "Photography",       icon: "📷", sublabel: "Landscapes, architecture, street" },
  { id: "wellness",    label: "Wellness & Spa",    icon: "🧘", sublabel: "Retreats, yoga, thermal baths" },
  { id: "adventure",   label: "Adventure Sports",  icon: "🪂", sublabel: "Paragliding, bungee, white water" },
];

export function ActivitiesStep() {
  const { trip, setActivities } = useTripStore();
  const [selected, setSelected] = useState<ActivityCategory[]>(trip.preferences.activities);
  const [otherOpen,  setOtherOpen ] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  function toggle(id: ActivityCategory) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function handleContinue() {
    const all = [...selected];
    if (otherOpen && otherValue.trim()) {
      all.push(otherValue.trim() as ActivityCategory);
    }
    setActivities(all);
  }

  const hasSelection = selected.length > 0 || (otherOpen && !!otherValue.trim());

  return (
    <StepShell
      stepId="activities"
      onContinue={handleContinue}
      continueDisabled={!hasSelection}
      subtitle="Choose everything you'd love to do. We'll weight the most important ones later."
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ACTIVITIES.map((a) => (
          <SelectChip
            key={a.id}
            label={a.label}
            icon={a.icon}
            sublabel={a.sublabel}
            selected={selected.includes(a.id)}
            onClick={() => toggle(a.id)}
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
      {hasSelection && (
        <p className="mt-3 text-xs text-slate-500">
          {selected.length + (otherOpen && otherValue.trim() ? 1 : 0)} activit
          {selected.length + (otherOpen && otherValue.trim() ? 1 : 0) === 1 ? "y" : "ies"} selected
        </p>
      )}
    </StepShell>
  );
}
