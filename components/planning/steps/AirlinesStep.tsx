"use client";

import { useEffect, useRef, useState } from "react";
import { Plane, TrendingDown, Check, Search, X, Car } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import { getFilteredRoutingSuggestion, searchAirports } from "@/lib/data/airportRouting";
import type { AirlinePreference, AirlineAlliance } from "@/types/trip";
import type { Airport, ArrivalSuggestion } from "@/lib/data/airportRouting";

const AIRLINES = [
  { name: "Delta Air Lines",   code: "DL", icon: "✈️" },
  { name: "United Airlines",   code: "UA", icon: "✈️" },
  { name: "American Airlines", code: "AA", icon: "✈️" },
  { name: "Alaska Airlines",   code: "AS", icon: "✈️" },
  { name: "Emirates",          code: "EK", icon: "✈️" },
  { name: "Singapore Airlines",code: "SQ", icon: "✈️" },
  { name: "Lufthansa",         code: "LH", icon: "✈️" },
  { name: "British Airways",   code: "BA", icon: "✈️" },
  { name: "Air France",        code: "AF", icon: "✈️" },
  { name: "Qatar Airways",     code: "QR", icon: "✈️" },
  { name: "Cathay Pacific",    code: "CX", icon: "✈️" },
];

// Exported so ChatPanel can turn a chat-driven update's raw ids back into
// friendly labels for its confirmation banner.
export const ALLIANCES: { id: AirlineAlliance; label: string; members: string }[] = [
  { id: "star_alliance", label: "Star Alliance", members: "United, Lufthansa, Singapore, ANA + more" },
  { id: "oneworld",      label: "Oneworld",      members: "American, British Airways, Cathay, Qantas + more" },
  { id: "skyteam",       label: "SkyTeam",       members: "Delta, Air France, KLM, Korean Air + more" },
];

const CABINS = ["economy", "premium_economy", "business", "first"] as const;
export const CABIN_LABELS: Record<string, string> = {
  economy: "Economy", premium_economy: "Premium Economy",
  business: "Business", first: "First Class",
};

export function AirlinesStep() {
  const { trip, setAirlines, setDestination, setNoFlightsNeeded, defaultDepartureAirport, setDefaultDepartureAirport } = useTripStore();
  const existing   = trip.preferences.airlinePrefs;
  const destination = trip.preferences.destination;

  // Set at destination-parse time when flying is unmistakably required
  // (crossing an ocean, an island region, intercontinental travel) — offering
  // a "no flights needed" toggle in that case would just be confusing.
  const flightsObviouslyRequired = destination?.flightsObviouslyRequired ?? false;

  // Road trips and other no-flight itineraries — skips the departure-airport
  // requirement below entirely and tells the AI not to search for flights.
  const [noFlights, setNoFlights] = useState((trip.preferences.noFlightsNeeded ?? false) && !flightsObviouslyRequired);

  // Defensive: if the destination was edited into something that obviously
  // needs flights while "no flights needed" was already set from an earlier
  // state, don't leave that stale preference silently in place.
  useEffect(() => {
    if (flightsObviouslyRequired && noFlights) setNoFlights(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightsObviouslyRequired]);

  // ── Departure airport ──────────────────────────────────────────────────────
  // Falls back to the remembered default from a previous trip when this trip
  // hasn't set one yet, so returning users don't retype their home airport.
  const [departure,   setDeparture  ] = useState(destination?.departureAirport ?? defaultDepartureAirport ?? "");
  const [depResults,  setDepResults ] = useState<Airport[]>([]);
  const [depOpen,     setDepOpen    ] = useState(false);
  const [askDefault,  setAskDefault ] = useState<string | null>(null);
  const depRef = useRef<HTMLDivElement>(null);

  // ── Gateway airports from routing suggestion ───────────────────────────────
  const [gateways,     setGateways    ] = useState<ArrivalSuggestion[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | undefined>(destination?.arrivalAirport);

  useEffect(() => {
    if (!destination?.freeText) return;
    const { routing } = getFilteredRoutingSuggestion(destination.freeText);
    if (routing) {
      setGateways(routing.arrivalAirports);
      // Pre-select the stored arrival airport, or the recommended one
      if (!selectedCode) {
        const rec = routing.arrivalAirports.find((a) => a.recommended && !a.transitOnly);
        if (rec) setSelectedCode(rec.code);
      }
    }
  }, [destination?.freeText]);

  // Close departure dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (depRef.current && !depRef.current.contains(e.target as Node)) setDepOpen(false);
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
    const label = `${airport.city} (${airport.code})`;
    setDeparture(label);
    setDepOpen(false);
    if (label !== defaultDepartureAirport) setAskDefault(label);
  }

  // ── Airline preferences ───────────────────────────────────────────────────
  const [lowestFare,        setLowestFare       ] = useState(existing?.prioritizeLowestFare ?? false);
  const [selectedAirlines,  setSelectedAirlines ] = useState<string[]>(existing?.airlines ?? []);
  const [selectedAlliances, setSelectedAlliances] = useState<AirlineAlliance[]>(existing?.alliances ?? []);
  const [preferNonstop,     setPreferNonstop    ] = useState(existing?.preferNonstop ?? true);
  const [cabins,            setCabins           ] = useState<string[]>(existing?.cabinClasses ?? []);

  // This step keeps its own draft state and only writes back to the store on
  // Continue — so a chat-driven edit while sitting on this step wouldn't
  // otherwise be visible until navigating away and back. Re-sync whenever
  // the underlying preference changes from outside this component.
  useEffect(() => {
    if (!existing) return;
    setLowestFare(existing.prioritizeLowestFare ?? false);
    setSelectedAirlines(existing.airlines);
    setSelectedAlliances(existing.alliances);
    setPreferNonstop(existing.preferNonstop);
    setCabins(existing.cabinClasses ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  // Write every change straight to the store instead of only on Continue —
  // otherwise a manual pick made here is invisible to chat (which only reads
  // the store) and gets silently clobbered the moment chat applies its own
  // update, since that overwrites the store and this step's own sync-from-
  // store effect above then overwrites the local draft to match.
  function assembleAirlines(overrides: Partial<{
    lowestFare: boolean; airlines: string[]; alliances: AirlineAlliance[];
    preferNonstop: boolean; cabins: string[];
  }> = {}): AirlinePreference {
    const lf = overrides.lowestFare ?? lowestFare;
    const al = overrides.airlines ?? selectedAirlines;
    const an = overrides.alliances ?? selectedAlliances;
    const ns = overrides.preferNonstop ?? preferNonstop;
    const cb = overrides.cabins ?? cabins;
    const firstCabin = (cb[0] ?? "economy") as AirlinePreference["cabinClass"];
    // Lowest-fare mode still zeroes out airline/alliance/cabin picks — those
    // are genuinely incompatible with "search all carriers in economy" — but
    // nonstop is an independent routing preference, not an airline/cabin
    // preference, so it stays whatever the user set even in this mode.
    return lf
      ? { airlines: [], alliances: [], preferNonstop: ns, cabinClass: "economy", cabinClasses: [], prioritizeLowestFare: true }
      : { airlines: al, alliances: an, preferNonstop: ns, cabinClass: firstCabin, cabinClasses: cb, prioritizeLowestFare: false };
  }
  function syncAirlines(overrides?: Parameters<typeof assembleAirlines>[0]) {
    setAirlines(assembleAirlines(overrides));
  }

  function toggleAirline(name: string) {
    const next = selectedAirlines.includes(name) ? selectedAirlines.filter((a) => a !== name) : [...selectedAirlines, name];
    setSelectedAirlines(next);
    syncAirlines({ airlines: next });
  }
  function toggleAlliance(id: AirlineAlliance) {
    const next = selectedAlliances.includes(id) ? selectedAlliances.filter((a) => a !== id) : [...selectedAlliances, id];
    setSelectedAlliances(next);
    syncAirlines({ alliances: next });
  }
  function toggleCabin(c: string) {
    const next = cabins.includes(c) ? cabins.filter((x) => x !== c) : [...cabins, c];
    setCabins(next);
    syncAirlines({ cabins: next });
  }
  function toggleLowestFare() {
    const next = !lowestFare;
    setLowestFare(next);
    syncAirlines({ lowestFare: next });
  }
  function togglePreferNonstop() {
    const next = !preferNonstop;
    setPreferNonstop(next);
    syncAirlines({ preferNonstop: next });
  }

  function handleContinue() {
    setNoFlightsNeeded(noFlights);
    if (destination) {
      setDestination({
        ...destination,
        departureAirport: noFlights ? undefined : departure.trim() || undefined,
        arrivalAirport:   noFlights ? undefined : selectedCode,
        // Open-jaw (returnAirport) is on hold — see Destination["returnAirport"] for the shelved implementation.
        returnAirport:    undefined,
      });
    }
    if (!noFlights) setAirlines(assembleAirlines());
  }

  return (
    <StepShell
      stepId="airlines"
      onContinue={handleContinue}
      continueDisabled={!noFlights && !departure.trim()}
      subtitle="Tell us where you're flying from — we'll use this to find the best routes."
    >
      <div className="flex flex-col gap-6">

        {/* ── Road trip / no flights — omitted entirely (not even a
            "flights needed" notice) when flightsObviouslyRequired, rather
            than replacing it with a statement nobody asked to see. ── */}
        {!flightsObviouslyRequired && (
          <button
            type="button"
            onClick={() => setNoFlights((v) => !v)}
            className={cn(
              "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all",
              noFlights ? "border-sage-500 bg-sage-50" : "border-slate-200 bg-white hover:border-slate-300"
            )}
          >
            <span className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              noFlights ? "bg-sage-500 text-white" : "bg-slate-100 text-slate-500"
            )}>
              {noFlights ? <Check size={16} /> : <Car size={16} />}
            </span>
            <div className="flex-1">
              <p className={cn("font-semibold text-sm", noFlights ? "text-sage-800" : "text-slate-800")}>
                I&rsquo;m driving — no flights needed
              </p>
              <p className={cn("text-xs mt-0.5", noFlights ? "text-sage-700" : "text-slate-500")}>
                Road trips and other no-flight itineraries — skips flight search entirely.
              </p>
            </div>
          </button>
        )}

        {noFlights && (
          <p className="-mt-3 text-xs text-slate-400">
            No problem — we&rsquo;ll skip flights and build your plan around hotels, activities, and getting around by road.
          </p>
        )}

        {/* ── Everything below is irrelevant once "I'm driving" is on — hidden
            entirely rather than just dimmed, so the step doesn't turn into a
            long scroll of inert content before reaching Continue. ── */}
        {!noFlights && (
        <>
        {/* ── Departure airport ── */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">
            Where are you flying from? <span className="text-red-400 font-normal text-xs">required to continue</span>
          </p>
          <div className="relative" ref={depRef}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={departure}
                onChange={(e) => handleDepInput(e.target.value)}
                onFocus={() => departure && setDepOpen(depResults.length > 0)}
                placeholder="City or airport code — e.g. New York, JFK, Chicago…"
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-9 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
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
          {askDefault && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
              <p className="flex-1 text-[11px] text-brand-700">
                Set <span className="font-semibold">{askDefault}</span> as your default departure airport for future trips?
              </p>
              <button
                type="button"
                onClick={() => { setDefaultDepartureAirport(askDefault); setAskDefault(null); }}
                className="shrink-0 rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setAskDefault(null)}
                className="shrink-0 text-[11px] text-brand-500 hover:text-brand-700"
              >
                No thanks
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">

        {/* ── Gateway airports ── */}
        {gateways.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">
              Do you have a preferred airport to fly into? <span className="text-slate-400 font-normal">(optional)</span>
            </p>
            <p className="mb-2.5 text-[11px] text-slate-400">
              We've pre-selected the best gateway based on your destination — change it if you have a preference.
            </p>
            <div className="flex flex-col gap-2">
              {gateways.map((ap) => (
                <button
                  key={ap.code}
                  type="button"
                  onClick={() => !ap.transitOnly && setSelectedCode(ap.code)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                    ap.transitOnly
                      ? "border-slate-200 bg-slate-50/60 opacity-60 cursor-default"
                      : selectedCode === ap.code
                        ? "border-brand-500 bg-brand-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <div className={cn(
                    "shrink-0 rounded font-mono text-xs font-bold px-1.5 py-1 mt-0.5",
                    ap.transitOnly   ? "bg-slate-200 text-slate-500" :
                    selectedCode === ap.code ? "bg-brand-600 text-white" :
                    "bg-slate-100 text-slate-600"
                  )}>
                    {ap.code}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-800">{ap.city}</p>
                      {ap.recommended && !ap.transitOnly && (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-700">
                          Best gateway
                        </span>
                      )}
                      {ap.transitOnly && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                          Transit hub
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{ap.reason}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Lowest fares override ── */}
        <button
          type="button"
          onClick={toggleLowestFare}
          className={cn(
            "flex items-center gap-4 rounded-xl border-2 px-4 py-4 text-left transition-all",
            lowestFare
              ? "border-sage-500 bg-sage-50"
              : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <span className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            lowestFare ? "bg-sage-500 text-white" : "bg-slate-100 text-slate-500"
          )}>
            {lowestFare ? <Check size={18} /> : <TrendingDown size={18} />}
          </span>
          <div className="flex-1">
            <p className={cn("font-semibold text-sm", lowestFare ? "text-sage-800" : "text-slate-800")}>
              Find me the lowest fares
            </p>
            <p className={cn("text-xs mt-0.5", lowestFare ? "text-sage-700 font-medium" : "text-slate-500")}>
              Searches all airlines in economy — overrides airline and cabin preferences below (your nonstop preference still applies)
            </p>
          </div>
          {lowestFare && (
            <span className="shrink-0 rounded-full bg-sage-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sage-700">
              Active
            </span>
          )}
        </button>

        {/* ── Airline / alliance / cabin — dimmed when lowest-fare is active,
            since that mode searches all carriers in economy regardless ── */}
        <div className={cn("flex flex-col gap-6 transition-opacity", lowestFare && "opacity-40 pointer-events-none select-none")}>
          {/* Airlines */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Preferred airlines <span className="text-slate-400 font-normal">(optional)</span></p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AIRLINES.map((a) => (
                <SelectChip
                  key={a.name}
                  label={a.name}
                  icon={a.icon}
                  selected={selectedAirlines.includes(a.name)}
                  onClick={() => toggleAirline(a.name)}
                />
              ))}
            </div>
          </div>

          {/* Alliances */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Or choose by alliance</p>
            <div className="flex flex-col gap-2">
              {ALLIANCES.map((al) => (
                <SelectChip
                  key={al.id}
                  label={al.label}
                  sublabel={al.members}
                  selected={selectedAlliances.includes(al.id)}
                  onClick={() => toggleAlliance(al.id)}
                  className="w-full"
                />
              ))}
            </div>
          </div>

          {/* Cabin class */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Cabin class <span className="text-slate-400 font-normal">(pick all you want to compare)</span>
            </p>
            <div className="flex flex-col gap-1.5">
              {CABINS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCabin(c)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-left transition-all",
                    cabins.includes(c)
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  <Plane size={12} />
                  {CABIN_LABELS[c]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Prices are estimates — verify directly with airlines before booking.
            </p>
          </div>
        </div>

        {/* ── Routing — a nonstop preference is independent of airline/cabin
            choice, so it stays enabled even in lowest-fare mode ── */}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Routing</p>
          <button
            type="button"
            onClick={togglePreferNonstop}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all w-full sm:w-auto",
              preferNonstop
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            )}
          >
            ✈️ Prefer nonstop
          </button>
        </div>
        </div>
        </>
        )}
      </div>
    </StepShell>
  );
}
