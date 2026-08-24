"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MapPin, X, Clock, Car, Wand2, ChevronDown, ChevronUp } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { TripIntake } from "@/components/planning/TripIntake";
import { useTripStore } from "@/lib/store/tripStore";
import { getFilteredRoutingSuggestion } from "@/lib/data/airportRouting";
import type { Destination } from "@/types/trip";
import { cn } from "@/lib/utils";

const HISTORY_KEY = "zimmgo_recent_destinations";
const HISTORY_MAX = 5;

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveToHistory(text: string) {
  try {
    const prev = readHistory();
    const next = [text, ...prev.filter((h) => h !== text)].slice(0, HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — silently skip
  }
}

const POPULAR = [
  "Japan — Tokyo, Kyoto & Osaka",
  "France — Paris & Provence",
  "Iceland — Reykjavik & the Ring Road",
  "Italy — Rome, Florence & Amalfi Coast",
  "Greece — Athens & the Islands",
  "Morocco — Marrakech & the Sahara",
  "Spain — Barcelona & Andalusia",
  "Portugal — Lisbon & Porto",
  "UK — London & Scotland",
  "Thailand & Southeast Asia",
  "Turkey — Istanbul & Cappadocia",
  "Patagonia",
];

// Fast-path regex parser — only reliable for the curated "Country — City,
// City & City" quick-pick format (it assumes the first special character is
// a dash/colon, before any comma). Free-typed sentences that don't follow
// that exact shape are parsed by the AI instead (see handleContinue) since
// this heuristic mangles them into sentence-fragment "cities".
//   "Italy — Rome, Amalfi Coast & Dolomites"  → ["Rome", "Amalfi Coast", "Dolomites"]
//   "Japan — Tokyo, Kyoto & Osaka"            → ["Tokyo", "Kyoto", "Osaka"]
function parseCitiesFromText(text: string): string[] {
  const stripped = text
    .replace(/^[^,—–\-:]+[—–\-:]\s*/, "") // drop "Country — " or "Country: " prefix
    .replace(/\band\b/gi, ",")            // "and" → comma
    .replace(/&/g, ",");                  // & → comma
  return stripped
    .split(",")
    .map((s) => s.trim().replace(/[.!?]$/, ""))
    .filter((s) => s.length > 1 && !/^(the|a|an|or|for|with|in|at|of|maybe|especially)$/i.test(s));
}

export function DestinationStep() {
  const { trip, setDestination, setNoFlightsNeeded, completeStep, goToStep } = useTripStore();
  const saved = trip.preferences.destination;

  // Only offer the one-shot intake on a genuinely untouched trip — once any
  // step is complete or a destination is set, the step-by-step wizard is
  // already the active mode and switching would just clobber real progress.
  const isFreshTrip = trip.completedSteps.length === 0 && !saved?.cities?.length;
  const [showIntake, setShowIntake] = useState(false);

  const [freeText, setFreeText] = useState(saved?.freeText ?? saved?.displayName ?? "");
  const [parsing, setParsing] = useState(false);
  // Set when the destination parse detects explicit driving language (e.g.
  // "road trip", "driving up") — held for an explicit yes/no instead of
  // silently assuming, since a wrong guess here would wrongly suppress
  // flight search for someone who actually needs it.
  const [roadTripPrompt, setRoadTripPrompt] = useState(false);
  // Read localStorage after mount only — reading it in the initializer would run
  // during SSR too (where it's unavailable), causing a hydration mismatch.
  const [history, setHistory] = useState<string[]>([]);
  // Collapsed by default once there's real history to show (returning users
  // already know where to look) — open by default for a brand-new user, who
  // has nothing else to go on yet. Still just a starting point; either kind
  // of user can toggle it themselves.
  const [showInspiration, setShowInspiration] = useState(false);
  useEffect(() => {
    const h = readHistory();
    setHistory(h);
    setShowInspiration(h.length === 0);
  }, []);

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

  async function handleContinue() {
    const text = freeText.trim();
    if (!text) return false;
    saveToHistory(text);
    setHistory(readHistory());

    // The curated quick-pick strings always match "Country — City, City & City"
    // exactly, so the fast regex parser is reliable for them — skip the AI
    // round-trip. Anything else (real free-typed text) goes through the AI,
    // since the regex heuristic only handles that one specific shape.
    let cities = parseCitiesFromText(text);
    let displayName = text;
    let likelyRoadTrip = false;
    let flightsObviouslyRequired = false;
    let seasonalNote: string | undefined;
    let seasonalWindowStartMonth: number | undefined;
    let seasonalWindowEndMonth: number | undefined;
    if (!POPULAR.includes(text)) {
      setParsing(true);
      try {
        const res = await fetch("/api/destination/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data: {
          cities: string[]; displayName: string; likelyRoadTrip?: boolean; flightsObviouslyRequired?: boolean;
          seasonalNote?: string; seasonalWindowStartMonth?: number; seasonalWindowEndMonth?: number;
        } = await res.json();
        if (data.cities?.length) cities = data.cities;
        if (data.displayName?.trim()) displayName = data.displayName;
        likelyRoadTrip = data.likelyRoadTrip === true;
        flightsObviouslyRequired = data.flightsObviouslyRequired === true;
        seasonalNote = data.seasonalNote?.trim() || undefined;
        if (seasonalNote) {
          seasonalWindowStartMonth = data.seasonalWindowStartMonth;
          seasonalWindowEndMonth = data.seasonalWindowEndMonth;
        }
      } catch {
        // Fall back to the regex heuristic — better than blocking the user entirely
      } finally {
        setParsing(false);
      }
    }

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
      displayName,
      freeText: text,
      cities,
      arrivalAirport: bestArrival ?? existing?.arrivalAirport,
      routingNote: routeUsable
        ? `${routing.suggestedRoute}\n\nWhy this works: ${routing.routingWhy}`
        : undefined,
      flightsObviouslyRequired,
      seasonalNote,
      seasonalWindowStartMonth,
      seasonalWindowEndMonth,
    };
    setDestination(dest);

    // Only interrupt with the road-trip question the first time — once the
    // traveller has answered it (here or on the Flights step), respect that
    // and don't ask again.
    if (likelyRoadTrip && useTripStore.getState().trip.preferences.noFlightsNeeded === undefined) {
      setRoadTripPrompt(true);
      return false;
    }
  }

  function confirmRoadTrip(isRoadTrip: boolean) {
    setNoFlightsNeeded(isRoadTrip);
    setRoadTripPrompt(false);
    completeStep("destination");
    goToStep("dates");
  }

  const canContinue = freeText.trim().length > 0;

  if (showIntake) {
    return <TripIntake onBack={() => setShowIntake(false)} />;
  }

  return (
    <StepShell
      stepId="destination"
      onContinue={handleContinue}
      continueDisabled={!canContinue}
      continueLoading={parsing}
      subtitle="Tell us where you want to go — the more detail the better."
    >
      {isFreshTrip && (
        <button
          type="button"
          onClick={() => setShowIntake(true)}
          className="mb-5 flex w-full items-center gap-2 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-3 py-2.5 text-left text-xs font-medium text-brand-700 hover:bg-brand-50 transition-colors"
        >
          <Wand2 size={13} className="shrink-0" />
          Or, describe your whole trip in one go — dates, budget, dietary needs and all — and skip the wizard
        </button>
      )}

      {/* ── Free-text destination input ── */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1.5">
          <label className="flex-1 text-sm font-medium text-slate-700">
            Where do you dream of going?
          </label>
          <Image
            src="/zigy-dreaming.png"
            alt=""
            width={112}
            height={85}
            className="shrink-0 select-none pointer-events-none"
            priority={false}
          />
        </div>
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

      {/* ── Road trip confirmation — shown once, only when the destination
          parse detected explicit driving language ("road trip", "driving").
          Held for an explicit answer rather than assumed silently. ── */}
      {roadTripPrompt && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <Car size={16} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-brand-800">Sounds like a road trip — no flights needed?</p>
            <p className="mt-0.5 text-xs text-brand-600">
              We&apos;ll skip flight search and build your plan around hotels, activities, and getting around by road. You can change this later on the Flights step.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => confirmRoadTrip(true)}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Yes, no flights
              </button>
              <button
                type="button"
                onClick={() => confirmRoadTrip(false)}
                className="rounded-md border border-brand-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
              >
                No, I&apos;ll need flights
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent searches + quick picks — merged under one disclosure so a
          returning user with history isn't staring at ~17 rows by default;
          only shown before the user types anything. ── */}
      {!freeText.trim() && (
        <div>
          <button
            type="button"
            onClick={() => setShowInspiration((v) => !v)}
            className="flex w-full items-center justify-between gap-2 py-1 text-xs font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
          >
            Need inspiration?
            {showInspiration ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showInspiration && (
            <div className="mt-3 flex flex-col gap-4">
              {history.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                    <Clock size={10} />
                    Recent searches
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {history.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => handleFreeTextChange(h)}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-all group"
                      >
                        <Clock size={11} className="text-slate-300 group-hover:text-brand-400 shrink-0" />
                        <span className="truncate flex-1">{h}</span>
                        <span className="text-[10px] text-slate-300 group-hover:text-brand-300 shrink-0">tap to edit</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-300">
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
            </div>
          )}
        </div>
      )}
    </StepShell>
  );
}
