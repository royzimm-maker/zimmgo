"use client";

import { useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { Input } from "@/components/ui/Input";
import { SelectChip } from "@/components/ui/SelectChip";
import { useTripStore } from "@/lib/store/tripStore";
import type { Destination } from "@/types/trip";

type Place = { displayName: string; country?: string; region?: string; cities: string[] };

const POPULAR: Place[] = [
  { displayName: "Greece",                country: "Greece",       cities: ["Athens", "Santorini", "Mykonos"] },
  { displayName: "Istanbul, Turkey",      country: "Turkey",       cities: ["Istanbul"] },
  { displayName: "Tokyo, Japan",          country: "Japan",        cities: ["Tokyo"] },
  { displayName: "Paris, France",         country: "France",       cities: ["Paris"] },
  { displayName: "Patagonia",             region:  "Patagonia",    cities: ["El Calafate", "Puerto Natales"] },
  { displayName: "Iceland",               country: "Iceland",      cities: ["Reykjavik"] },
  { displayName: "Southeast Asia",        region:  "Southeast Asia", cities: ["Bangkok", "Chiang Mai", "Hanoi"] },
  { displayName: "Amalfi Coast, Italy",   country: "Italy",        cities: ["Positano", "Ravello", "Sorrento"] },
  { displayName: "Kyoto, Japan",          country: "Japan",        cities: ["Kyoto"] },
  { displayName: "Queenstown, NZ",        country: "New Zealand",  cities: ["Queenstown"] },
  { displayName: "Morocco",               country: "Morocco",      cities: ["Marrakech", "Fès"] },
  { displayName: "New York, USA",         country: "USA",          cities: ["New York City"] },
];

function placesEqual(a: Place, b: Place) {
  return a.displayName === b.displayName;
}

export function DestinationStep() {
  const { trip, setDestination } = useTripStore();

  // Restore previously saved destinations as an array of places
  const savedDest = trip.preferences.destination;
  const initialPlaces: Place[] = savedDest
    ? savedDest.displayName.split(", ").map((name) => ({ displayName: name, cities: [] }))
    : [];

  const [selected, setSelected] = useState<Place[]>(initialPlaces);
  const [query,    setQuery   ] = useState("");

  function toggle(place: Place) {
    setSelected((prev) =>
      prev.some((p) => placesEqual(p, place))
        ? prev.filter((p) => !placesEqual(p, place))
        : [...prev, place]
    );
  }

  function addCustom() {
    const trimmed = query.trim();
    if (!trimmed) return;
    const place: Place = { displayName: trimmed, cities: [] };
    if (!selected.some((p) => placesEqual(p, place))) {
      setSelected((prev) => [...prev, place]);
    }
    setQuery("");
  }

  function remove(place: Place) {
    setSelected((prev) => prev.filter((p) => !placesEqual(p, place)));
  }

  function handleContinue() {
    if (!selected.length) return;
    // Merge all selected places into one Destination so the rest of the
    // app (store, prompt builder, itinerary API) receives everything.
    const combined: Destination = {
      displayName: selected.map((p) => p.displayName).join(", "),
      cities: selected.flatMap((p) => p.cities),
      country: selected.length === 1 ? selected[0].country : undefined,
      region:  selected.length === 1 ? selected[0].region  : undefined,
    };
    setDestination(combined);
  }

  return (
    <StepShell
      stepId="destination"
      onContinue={handleContinue}
      continueDisabled={selected.length === 0}
      subtitle="Add one or more destinations — great for multi-city trips."
    >
      {/* Selected destination tags */}
      {selected.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {selected.map((p) => (
            <span
              key={p.displayName}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700"
            >
              <MapPin size={12} />
              {p.displayName}
              <button
                type="button"
                onClick={() => remove(p)}
                className="ml-0.5 rounded-full hover:text-brand-900"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search / custom entry */}
      <div className="mb-5">
        <Input
          label={selected.length ? "Add another destination" : "Search destination"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          placeholder="e.g. Tuscany, Costa Rica, Bali…"
          icon={<Search size={14} />}
        />
        {query.trim() && (
          <button
            type="button"
            onClick={addCustom}
            className="mt-2 text-xs text-brand-600 hover:underline"
          >
            Add &ldquo;{query.trim()}&rdquo; →
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
            selected={selected.some((p) => placesEqual(p, d))}
            onClick={() => toggle(d)}
          />
        ))}
      </div>

      {selected.length > 1 && (
        <p className="mt-4 text-xs text-slate-500">
          {selected.length} destinations selected — we&apos;ll build an itinerary that covers all of them.
        </p>
      )}
    </StepShell>
  );
}
