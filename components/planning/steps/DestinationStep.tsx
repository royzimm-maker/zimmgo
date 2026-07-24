"use client";

import { useState } from "react";
import { MapPin, X, Route } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { useTripStore } from "@/lib/store/tripStore";
import { getFilteredRoutingSuggestion } from "@/lib/data/airportRouting";
import type { Destination } from "@/types/trip";
import { cn } from "@/lib/utils";

const POPULAR = [
  "Greece — Athens & the Islands",
  "Italy — Rome, Florence & Amalfi Coast",
  "Japan — Tokyo, Kyoto & Osaka",
  "France — Paris & Provence",
  "Spain — Barcelona & Andalusia",
  "Portugal — Lisbon & Porto",
  "Iceland",
  "Morocco — Marrakech & the Sahara",
  "Thailand & Southeast Asia",
  "Turkey — Istanbul & Cappadocia",
  "UK — London & Scotland",
  "Patagonia",
];

export function DestinationStep() {
  const { trip, setDestination } = useTripStore();
  const saved = trip.preferences.destination;

  const [freeText, setFreeText] = useState(saved?.freeText ?? saved?.displayName ?? "");

  function handleFreeTextChange(value: string) {
    setFreeText(value);
    // Persist draft so text survives any re-mount
    const existing = useTripStore.getState().trip.preferences.destination;
    setDestination({
      cities: [],
      ...(existing ?? {}),
      freeText: value,
      displayName: value,
    });
  }

  function handleContinue() {
    const text = freeText.trim();
    if (!text) return;

    // Silently compute routing to pass context to the AI and pre-fill Flights step
    const { routing, excludedPlaces } = getFilteredRoutingSuggestion(text);
    const mentionsExcluded = (s: string) =>
      excludedPlaces.some((p) =>
        new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s)
      );

    const bestArrival = routing?.arrivalAirports.find((a) => a.recommended && !a.transitOnly)?.code;
    const routeUsable = routing &&
      !mentionsExcluded(routing.suggestedRoute) &&
      !mentionsExcluded(routing.routingWhy);

    const existing = useTripStore.getState().trip.preferences.destination;
    const dest: Destination = {
      ...(existing ?? {}),
      displayName: text,
      freeText: text,
      cities: routing?.arrivalAirports.filter((a) => !a.transitOnly).map((a) => a.city) ?? [],
      arrivalAirport: bestArrival ?? existing?.arrivalAirport,
      routingNote: routeUsable
        ? `${routing.suggestedRoute}\n\nWhy this works: ${routing.routingWhy}`
        : undefined,
    };
    setDestination(dest);
  }

  const canContinue = freeText.trim().length > 0;

  return (
    <StepShell
      stepId="destination"
      onContinue={handleContinue}
      continueDisabled={!canContinue}
      subtitle="Tell us where you want to go — the more detail the better."
    >
      {/* ── Free-text destination input ── */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Where do you dream of going?
        </label>
        <div className="relative">
          <textarea
            rows={3}
            value={freeText}
            onChange={(e) => handleFreeTextChange(e.target.value)}
            placeholder={`e.g. "Italy, especially Tuscany and maybe the Dolomites, and I'd love to finish somewhere along the Amalfi Coast"\n\nor "Greece for 10 days — Athens, two islands, and maybe Istanbul at the end"`}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none leading-relaxed"
          />
          {freeText && (
            <button
              type="button"
              onClick={() => handleFreeTextChange("")}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Clear destination"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">
          Be as specific or as vague as you like — we&apos;ll work with it.
        </p>
      </div>

      {/* ── Popular quick-picks — only shown before user types anything ── */}
      {!freeText.trim() && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Quick picks — tap to fill
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {POPULAR.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => handleFreeTextChange(label)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-all",
                  freeText === label
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <MapPin size={11} className="text-brand-400 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </StepShell>
  );
}
