"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { OtherInput } from "@/components/ui/OtherInput";
import { useTripStore } from "@/lib/store/tripStore";
import { getTransitNote } from "@/lib/data/transitAwareness";
import type { TransportMode } from "@/types/trip";

const MODES: { id: TransportMode; label: string; icon: string; sublabel: string }[] = [
  { id: "rental_car",     label: "Rental Car",       icon: "🚗", sublabel: "Maximum flexibility, great for road trips" },
  { id: "rideshare",      label: "Rideshare / Taxi",  icon: "🚕", sublabel: "Uber, Lyft, Grab — on demand" },
  { id: "private_driver", label: "Private Driver",    icon: "🚐", sublabel: "Full-day or half-day hire, door to door" },
  { id: "public_transit", label: "Public Transit",    icon: "🚆", sublabel: "Metro, bus, rail — budget-friendly" },
];

export function TransportationStep() {
  const { trip, setTransportation } = useTripStore();
  const [selected,    setSelected   ] = useState<TransportMode[]>(trip.preferences.transportation);
  const [otherOpen,   setOtherOpen  ] = useState(false);
  const [otherValue,  setOtherValue ] = useState("");

  function toggle(id: TransportMode) {
    setSelected((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
  }

  function handleContinue() {
    const all = [...selected];
    if (otherOpen && otherValue.trim()) {
      all.push(otherValue.trim() as TransportMode);
    }
    setTransportation(all);
  }

  const hasSelection = selected.length > 0 || (otherOpen && !!otherValue.trim());
  const transitNote = getTransitNote(trip.preferences.destination);

  return (
    <StepShell
      stepId="transportation"
      onContinue={handleContinue}
      continueDisabled={!hasSelection}
      subtitle="How will you get around once you're there? Choose all that apply."
    >
      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
        <Lightbulb size={15} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">{transitNote}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODES.map((m) => (
          <SelectChip
            key={m.id}
            label={m.label}
            icon={m.icon}
            sublabel={m.sublabel}
            selected={selected.includes(m.id)}
            onClick={() => toggle(m.id)}
            className="w-full"
          />
        ))}
        <OtherInput
          selected={otherOpen}
          value={otherValue}
          onChange={setOtherValue}
          onToggle={() => setOtherOpen((v) => !v)}
          placeholder="e.g. Scooter rental, Bicycle…"
        />
      </div>
    </StepShell>
  );
}
