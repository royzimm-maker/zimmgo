"use client";

import { useEffect, useState } from "react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { OtherInput } from "@/components/ui/OtherInput";
import { useTripStore } from "@/lib/store/tripStore";
import type { VibeTag } from "@/types/trip";

// Exported so ChatPanel can turn a chat-driven update's raw vibe ids back
// into friendly labels for its confirmation banner.
export const VIBES: { id: VibeTag; label: string; icon: string; sublabel: string }[] = [
  { id: "romantic",             label: "Romantic",            icon: "💑",  sublabel: "Couple-focused, slow-paced, indulgent" },
  { id: "nightlife",            label: "Nightlife",           icon: "🎉",  sublabel: "Bars, clubs, late nights" },
  { id: "beaches",              label: "Beaches",             icon: "🏖️",  sublabel: "Sun, sand, and sea" },
  { id: "shopping",             label: "Shopping",            icon: "🛍️",  sublabel: "Local markets to luxury boutiques" },
  { id: "architecture",         label: "Architecture",        icon: "🏰",  sublabel: "Iconic buildings and design" },
  { id: "family_friendly",      label: "Family Friendly",    icon: "👨‍👩‍👧", sublabel: "Great for all ages" },
  { id: "off_the_beaten_path",  label: "Off the Beaten Path", icon: "🗺️", sublabel: "Local gems, no tour groups" },
];

// No "let ZiGy pick" mode here, unlike Lodging/Activities — vibe is a direct
// input into what ZiGy recommends elsewhere, so it has to come from the user.
export function VibeStep() {
  const { trip, setVibes } = useTripStore();
  const [selected, setSelected] = useState<VibeTag[]>(trip.preferences.vibes);
  const [otherOpen,  setOtherOpen ] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  // This step keeps its own draft state and only writes back to the store on
  // Continue — so a chat-driven edit while sitting on this step wouldn't
  // otherwise be visible until navigating away and back. Re-sync whenever
  // the underlying preference changes from outside this component.
  useEffect(() => {
    const known = trip.preferences.vibes.filter((v) => VIBES.some((x) => x.id === v));
    const custom = trip.preferences.vibes.find((v) => !VIBES.some((x) => x.id === v));
    setSelected(known);
    if (custom) {
      setOtherOpen(true);
      setOtherValue(custom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.preferences.vibes]);

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
      <p className="mb-3 text-xs text-slate-400">
        2–4 tends to work best — picking almost everything won't narrow things down much.
      </p>
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
