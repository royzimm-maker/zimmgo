"use client";

import { useRef, useState } from "react";
import { MapPin, X, ChevronDown, Lightbulb, Route } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { useTripStore } from "@/lib/store/tripStore";
import { getFilteredRoutingSuggestion } from "@/lib/data/airportRouting";
import type { Destination } from "@/types/trip";
import type { RoutingSuggestion } from "@/lib/data/airportRouting";
import { cn } from "@/lib/utils";

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function mentionsExcluded(text: string, excluded: string[]): boolean {
  return excluded.some((p) =>
    new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)
  );
}

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

  const [freeText,    setFreeText   ] = useState(saved?.freeText ?? saved?.displayName ?? "");
  const [routing,     setRouting    ] = useState<RoutingSuggestion | null>(null);
  const [excluded,    setExcluded   ] = useState<string[]>([]);
  const [showRouting, setShowRouting] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  function findRoutes() {
    const { routing: r, excludedPlaces } = getFilteredRoutingSuggestion(freeText);
    setRouting(r);
    setExcluded(excludedPlaces);
    setShowRouting(true);
  }

  function handleFreeTextChange(value: string) {
    setFreeText(value);
    setRouting(null);
    setExcluded([]);
    clearTimeout(debounceRef.current);
    // Persist draft so text survives any re-mount
    const existing = useTripStore.getState().trip.preferences.destination;
    setDestination({
      cities: [],
      ...(existing ?? {}),
      freeText: value,
      displayName: value,
    });
  }

  function applyQuickPick(label: string) {
    handleFreeTextChange(label);
  }

  function handleContinue() {
    const text = freeText.trim();
    if (!text) return;

    const bestArrival = routing?.arrivalAirports.find((a) => a.recommended && !a.transitOnly)?.code;
    const routeUsable = routing && !mentionsExcluded(routing.suggestedRoute, excluded) && !mentionsExcluded(routing.routingWhy, excluded);

    const existing = useTripStore.getState().trip.preferences.destination;
    const dest: Destination = {
      ...(existing ?? {}),
      displayName: text,
      freeText: text,
      cities: routing?.arrivalAirports.filter((a) => !a.transitOnly).map((a) => a.city) ?? [],
      arrivalAirport: bestArrival ?? existing?.arrivalAirport,
      routingNote: routeUsable ? `${routing.suggestedRoute}\n\nWhy this works: ${routing.routingWhy}` : undefined,
    };
    setDestination(dest);
  }

  const canContinue = freeText.trim().length > 0;

  return (
    <StepShell
      stepId="destination"
      onContinue={handleContinue}
      continueDisabled={!canContinue}
      subtitle="Tell us where you want to go — the more detail the better. We'll suggest the smartest route."
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && freeText.trim().length > 3) {
                e.preventDefault();
                findRoutes();
              }
            }}
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
        {freeText.trim().length > 3 && !routing && (
          <button
            type="button"
            onClick={findRoutes}
            className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            <Route size={12} />
            Find routes
            <span className="ml-1 text-brand-300 font-normal hidden sm:inline">⌘↵</span>
          </button>
        )}
        <p className="mt-1.5 text-[11px] text-slate-400">
          Be as specific or as vague as you like — we'll work with it.
        </p>
      </div>

      {/* ── Routing suggestion card ── */}
      {routing && (
        <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowRouting((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <Route size={14} className="text-brand-600 shrink-0" />
              <span className="text-sm font-semibold text-brand-800">Suggested routing</span>
            </div>
            <ChevronDown
              size={14}
              className={cn("text-brand-500 transition-transform", !showRouting && "-rotate-90")}
            />
          </button>

          {showRouting && (
            <div className="px-4 pb-4 flex flex-col gap-4 border-t border-brand-100">
              {/* Exclusions detected */}
              {excluded.length > 0 && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    <span className="font-semibold">Noted — skipping {excluded.map(capitalize).join(", ")}.</span>{" "}
                    Your itinerary will avoid {excluded.length === 1 ? "it" : "them"}.
                    Gateway airport options for your trip are shown in the Flights step.
                  </p>
                </div>
              )}

              {/* Route suggestion */}
              {!mentionsExcluded(routing.suggestedRoute, excluded) && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-2 flex items-center gap-1">
                    <MapPin size={10} /> Suggested route
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">{routing.suggestedRoute}</p>
                </div>
              )}

              {/* Why it works */}
              {!mentionsExcluded(routing.routingWhy, excluded) && (
                <div className="rounded-lg bg-brand-100/60 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-600 mb-1">
                    Why this routing makes sense
                  </p>
                  <p className="text-xs text-brand-800 leading-relaxed">{routing.routingWhy}</p>
                </div>
              )}

              {/* Tips */}
              {routing.travelTips.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-2 flex items-center gap-1">
                    <Lightbulb size={10} /> Local tips
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {routing.travelTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600 leading-snug">
                        <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-400" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Popular quick-picks — only shown before user types anything ── */}
      {!freeText.trim() && <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Quick picks — tap to fill
        </p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {POPULAR.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => applyQuickPick(label)}
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
      </div>}
    </StepShell>
  );
}
