"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search, X, Plane, ChevronDown, Lightbulb, Route } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { useTripStore } from "@/lib/store/tripStore";
import { getRoutingSuggestion, searchAirports } from "@/lib/data/airportRouting";
import type { Destination } from "@/types/trip";
import type { RoutingSuggestion, Airport } from "@/lib/data/airportRouting";
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

  const [freeText,    setFreeText   ] = useState(saved?.freeText ?? saved?.displayName ?? "");
  const [departure,   setDeparture  ] = useState(saved?.departureAirport ?? "");
  const [routing,     setRouting    ] = useState<RoutingSuggestion | null>(null);
  const [depResults,  setDepResults ] = useState<Airport[]>([]);
  const [depOpen,     setDepOpen    ] = useState(false);
  const [showRouting, setShowRouting] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const depRef      = useRef<HTMLDivElement>(null);

  // Detect routing suggestions as user types (debounced 400ms)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (freeText.trim().length > 3) {
        setRouting(getRoutingSuggestion(freeText));
      } else {
        setRouting(null);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [freeText]);

  // Close departure dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (depRef.current && !depRef.current.contains(e.target as Node)) {
        setDepOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleDepInput(value: string) {
    setDeparture(value);
    const results = searchAirports(value);
    setDepResults(results);
    setDepOpen(results.length > 0);
  }

  function selectDeparture(airport: Airport) {
    setDeparture(`${airport.city} (${airport.code})`);
    setDepOpen(false);
  }

  function applyQuickPick(label: string) {
    setFreeText(label);
  }

  function handleContinue() {
    const text = freeText.trim();
    if (!text) return;

    // Extract a clean displayName from the free text (first clause before " — " or full text)
    const displayName = text;
    const bestArrival = routing?.arrivalAirports.find((a) => a.recommended)?.code;

    const dest: Destination = {
      displayName,
      freeText: text,
      cities: routing?.arrivalAirports.map((a) => a.city) ?? [],
      departureAirport: departure.trim() || undefined,
      arrivalAirport:   bestArrival,
      routingNote:      routing ? `${routing.suggestedRoute}\n\nWhy this works: ${routing.routingWhy}` : undefined,
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
        <textarea
          rows={3}
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder={`e.g. "Italy, especially Tuscany and maybe the Dolomites, and I'd love to finish somewhere along the Amalfi Coast"\n\nor "Greece for 10 days — Athens, two islands, and maybe Istanbul at the end"`}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none leading-relaxed"
        />
        <p className="mt-1 text-[11px] text-slate-400">
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
              {/* Arrival airports */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mt-3 mb-2 flex items-center gap-1">
                  <Plane size={10} /> Recommended gateway airports
                </p>
                <div className="flex flex-col gap-2">
                  {routing.arrivalAirports.map((ap) => (
                    <div key={ap.code} className={cn(
                      "flex items-start gap-3 rounded-lg border px-3 py-2.5",
                      ap.recommended ? "border-brand-300 bg-white" : "border-slate-200 bg-white/60"
                    )}>
                      <div className={cn(
                        "shrink-0 rounded font-mono text-xs font-bold px-1.5 py-1 mt-0.5",
                        ap.recommended ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
                      )}>
                        {ap.code}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-slate-800">{ap.city}</p>
                          {ap.recommended && (
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-700">
                              Best gateway
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{ap.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Route suggestion */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-2 flex items-center gap-1">
                  <MapPin size={10} /> Suggested route
                </p>
                <p className="text-xs text-slate-700 leading-relaxed">{routing.suggestedRoute}</p>
              </div>

              {/* Why it works */}
              <div className="rounded-lg bg-brand-100/60 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-600 mb-1">
                  Why this routing makes sense
                </p>
                <p className="text-xs text-brand-800 leading-relaxed">{routing.routingWhy}</p>
              </div>

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

      {/* ── Departure airport ── */}
      <div className="mb-6 relative" ref={depRef}>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Where are you flying from? <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={departure}
            onChange={(e) => handleDepInput(e.target.value)}
            onFocus={() => departure && setDepOpen(depResults.length > 0)}
            placeholder="City or airport code — e.g. New York, JFK, Chicago…"
            className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
          {departure && (
            <button
              type="button"
              onClick={() => { setDeparture(""); setDepOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {depOpen && depResults.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
            {depResults.map((ap) => (
              <button
                key={ap.code}
                type="button"
                onClick={() => selectDeparture(ap)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
              >
                <span className="font-mono text-xs font-bold text-brand-600 w-10 shrink-0">{ap.code}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{ap.city}</p>
                  <p className="text-[10px] text-slate-400 truncate">{ap.name} · {ap.country}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Popular quick-picks ── */}
      <div>
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
      </div>
    </StepShell>
  );
}
