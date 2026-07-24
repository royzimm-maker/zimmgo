"use client";

import { useState } from "react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { OtherInput } from "@/components/ui/OtherInput";
import { useTripStore } from "@/lib/store/tripStore";
import type { VibeTag } from "@/types/trip";

const VIBES: { id: VibeTag; label: string; icon: string; sublabel: string }[] = [
  { id: "romantic",             label: "Romantic",            icon: "💑",  sublabel: "Couple-focused, slow-paced, indulgent" },
  { id: "nightlife",            label: "Nightlife",           icon: "🎉",  sublabel: "Bars, clubs, late nights" },
  { id: "beaches",              label: "Beaches",             icon: "🏖️",  sublabel: "Sun, sand, and sea" },
  { id: "shopping",             label: "Shopping",            icon: "🛍️",  sublabel: "Local markets to luxury boutiques" },
  { id: "architecture",         label: "Architecture",        icon: "🏰",  sublabel: "Iconic buildings and design" },
  { id: "family_friendly",      label: "Family Friendly",    icon: "👨‍👩‍👧", sublabel: "Great for all ages" },
  { id: "off_the_beaten_path",  label: "Off the Beaten Path", icon: "🗺️", sublabel: "Local gems, no tour groups" },
];

export function VibeStep() {
  const { trip, setVibes } = useTripStore();
  const [selected, setSelected] = useState<VibeTag[]>(trip.preferences.vibes);
  const [otherOpen,  setOtherOpen ] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  function toggle(id: VibeTag) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  function handleContinue() {
    const all = [...selected];
    if (otherOpen && otherValue.trim()) {
      all.push(otherValue.trim() as VibeTag);
    }
    setVibes(all);
  }

  const hasSelection = selected.length > 0 || (otherOpen && !!otherValue.trim());

  return (
    <StepShell
      stepId="vibe"
      onContinue={handleContinue}
      continueDisabled={!hasSelection}
      subtitle="What's the feel of this trip? Pick as many as apply."
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {VIBES.map((v) => (
          <SelectChip
            key={v.id}
            label={v.label}
            icon={v.icon}
            sublabel={v.sublabel}
            selected={selected.includes(v.id)}
            onClick={() => toggle(v.id)}
          />
        ))}
        <OtherInput
          selected={otherOpen}
          value={otherValue}
          onChange={setOtherValue}
          onToggle={() => setOtherOpen((v) => !v)}
          placeholder="e.g. Pet-friendly, Accessible travel…"
        />
      </div>
    </StepShell>
  );
}
