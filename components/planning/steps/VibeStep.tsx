"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { OtherInput } from "@/components/ui/OtherInput";
import { ChooseModePrompt } from "@/components/planning/ChooseModePrompt";
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
  const [mode, setMode] = useState<"prompt" | "manual">(
    () => (trip.preferences.vibes.length > 0 ? "manual" : "prompt")
  );
  const [picking, setPicking] = useState(false);
  const [pickSummary, setPickSummary] = useState<string | null>(null);
  const [selected, setSelected] = useState<VibeTag[]>(trip.preferences.vibes);
  const [otherOpen,  setOtherOpen ] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  function toggle(id: VibeTag) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  async function handleZigyPick() {
    setPicking(true);
    try {
      const res = await fetch("/api/itinerary/smart-pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "vibes",
          preferences: trip.preferences,
          candidates: VIBES.map((v) => ({ id: v.id, label: v.label })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: { picks: { id: string; reason: string }[]; summary: string } = await res.json();
      const picked = data.picks
        .map((p) => p.id)
        .filter((id): id is VibeTag => VIBES.some((v) => v.id === id));
      setSelected(picked);
      setPickSummary(data.summary);
    } catch {
      // Fall through to manual — nothing selected yet
    } finally {
      setPicking(false);
      setMode("manual");
    }
  }

  function handleContinue() {
    const all = [...selected];
    if (otherOpen && otherValue.trim()) {
      all.push(otherValue.trim() as VibeTag);
    }
    setVibes(all);
  }

  const hasSelection = selected.length > 0 || (otherOpen && !!otherValue.trim());

  if (mode === "prompt") {
    return (
      <StepShell
        stepId="vibe"
        continueLabel="I'll pick myself"
        onContinue={() => { setMode("manual"); return false; }}
        subtitle="How do you want to set the trip's vibe?"
      >
        <ChooseModePrompt
          manualLabel="I'll pick myself"
          manualDescription="Choose the mood and feel you're going for."
          zigyDescription="ZiGy picks 2-4 vibes that fit your destination — you can still adjust before continuing."
          onManual={() => setMode("manual")}
          onZigy={handleZigyPick}
          loading={picking}
        />
      </StepShell>
    );
  }

  return (
    <StepShell
      stepId="vibe"
      onContinue={handleContinue}
      continueDisabled={!hasSelection}
      subtitle="What's the feel of this trip? Pick as many as apply."
    >
      {pickSummary && (
        <p className="mb-4 text-xs text-brand-600 bg-brand-50 rounded-lg px-3 py-2">
          <Sparkles size={11} className="inline mr-1" />
          {pickSummary}
        </p>
      )}
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
