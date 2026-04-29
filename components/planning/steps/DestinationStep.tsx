"use client";

import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { Input } from "@/components/ui/Input";
import { SelectChip } from "@/components/ui/SelectChip";
import { useTripStore } from "@/lib/store/tripStore";
import type { Destination } from "@/types/trip";

const POPULAR: { displayName: string; region?: string; country?: string; cities: string[] }[] = [
  { displayName: "Tokyo, Japan",            country: "Japan",       cities: ["Tokyo"] },
  { displayName: "Paris, France",           country: "France",      cities: ["Paris"] },
  { displayName: "Patagonia",               region:  "Patagonia",   cities: ["El Calafate", "Puerto Natales"] },
  { displayName: "Iceland",                 country: "Iceland",     cities: ["Reykjavik"] },
  { displayName: "Southeast Asia",          region:  "Southeast Asia", cities: ["Bangkok", "Chiang Mai", "Hanoi"] },
  { displayName: "New York, USA",           country: "USA",         cities: ["New York City"] },
  { displayName: "Amalfi Coast, Italy",     country: "Italy",       cities: ["Positano", "Ravello", "Sorrento"] },
  { displayName: "Kyoto, Japan",            country: "Japan",       cities: ["Kyoto"] },
  { displayName: "Queenstown, New Zealand", country: "New Zealand", cities: ["Queenstown"] },
  { displayName: "Morocco",                 country: "Morocco",     cities: ["Marrakech", "Fès"] },
  { displayName: "Tuscany, Italy",          country: "Italy",       cities: ["Florence", "Siena"] },
  { displayName: "Maldives",               country: "Maldives",    cities: ["Malé"] },
];

export function DestinationStep() {
  const { trip, setDestination } = useTripStore();
  const current = trip.preferences.destination;

  const [query, setQuery] = useState(current?.displayName ?? "");
  const [selected, setSelected] = useState<Destination | null>(current ?? null);

  function pickPopular(d: typeof POPULAR[number]) {
    const dest: Destination = {
      displayName: d.displayName,
      country: d.country,
      region: d.region,
      cities: d.cities,
    };
    setSelected(dest);
    setQuery(d.displayName);
  }

  function applyCustomQuery() {
    if (!query.trim()) return;
    const dest: Destination = { displayName: query.trim(), cities: [] };
    setSelected(dest);
  }

  function handleContinue() {
    if (selected) setDestination(selected);
  }

  return (
    <StepShell
      stepId="destination"
      onContinue={handleContinue}
      continueDisabled={!selected}
      subtitle="Pick a destination or type your own — we'll validate and suggest alternatives."
    >
      {/* Free-text search */}
      <div className="mb-5">
        <Input
          label="Search destination"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          onBlur={applyCustomQuery}
          onKeyDown={(e) => e.key === "Enter" && applyCustomQuery()}
          placeholder="e.g. Tuscany, Costa Rica, Bali…"
          icon={<Search size={14} />}
        />
        {query && !selected && (
          <button
            type="button"
            onClick={applyCustomQuery}
            className="mt-2 text-xs text-brand-600 hover:underline"
          >
            Use &ldquo;{query}&rdquo; as destination →
          </button>
        )}
      </div>

      {/* Popular quick-picks */}
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
        Popular destinations
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {POPULAR.map((d) => (
          <SelectChip
            key={d.displayName}
            label={d.displayName}
            icon={<MapPin size={16} className="text-brand-500" />}
            selected={selected?.displayName === d.displayName}
            onClick={() => pickPopular(d)}
          />
        ))}
      </div>
    </StepShell>
  );
}
