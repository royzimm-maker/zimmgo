"use client";

import { useState } from "react";
import { ArrowLeft, ChevronRight, Loader2, AlertCircle, Check, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import { getFilteredRoutingSuggestion } from "@/lib/data/airportRouting";
import { VIBES } from "@/components/planning/steps/VibeStep";
import { GENERAL } from "@/components/planning/steps/ActivitiesStep";
import { ORDERED_STEPS, STEP_META, BUDGET_LABELS, type Destination, type StepId, type VibeTag, type BudgetRange } from "@/types/trip";
import type { ParseFullTripResult } from "@/app/api/trip/parse-full/route";

const BUDGET_TIERS = new Set<BudgetRange>(["under_500", "500_750", "750_1000", "1000_plus"]);

const EXAMPLE_PLACEHOLDER = `e.g. "We're a family of four flying out of Chicago to Tokyo and Kyoto for the cherry blossoms in late March — about 10 days, comfortable but not extravagant budget. We love food experiences and cultural sights, want to skip long ticket lines where we can, and would love one day trip outside the city. One of us is vegetarian and gluten-free."`;

function labelFor(list: { id: string; label: string }[], id: string): string {
  return list.find((x) => x.id === id)?.label ?? id;
}

export function TripIntake({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"input" | "loading" | "review" | "error">("input");
  const [parsed, setParsed] = useState<ParseFullTripResult | null>(null);
  const [error, setError] = useState("");

  async function handleParse() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMode("loading");
    setError("");
    try {
      const res = await fetch("/api/trip/parse-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Couldn't parse that — please try again.");
      }
      const data: ParseFullTripResult = await res.json();
      setParsed(data);
      setMode("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
      setMode("error");
    }
  }

  function writeParsedToStore() {
    if (!parsed) return;
    const store = useTripStore.getState();

    // ── Destination ── (mirrors DestinationStep's own handleContinue logic)
    const { routing, excludedPlaces } = getFilteredRoutingSuggestion(text);
    const mentionsExcluded = (s: string) =>
      excludedPlaces.some((p) =>
        new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s)
      );
    const bestArrival = routing?.arrivalAirports.find((a) => a.recommended && !a.transitOnly)?.code;
    const routeUsable = routing && !mentionsExcluded(routing.suggestedRoute) && !mentionsExcluded(routing.routingWhy);

    const dest: Destination = {
      cities: parsed.cities,
      displayName: parsed.displayName,
      freeText: text,
      departureAirport: parsed.departureAirport,
      arrivalAirport: bestArrival,
      routingNote: routeUsable
        ? `${routing.suggestedRoute}\n\nWhy this works: ${routing.routingWhy}`
        : undefined,
      flightsObviouslyRequired: parsed.flightsObviouslyRequired,
      seasonalNote: parsed.seasonalNote,
      seasonalWindowStartMonth: parsed.seasonalNote ? parsed.seasonalWindowStartMonth : undefined,
      seasonalWindowEndMonth: parsed.seasonalNote ? parsed.seasonalWindowEndMonth : undefined,
    };
    store.setDestination(dest);
    store.completeStep("destination");
    if (parsed.likelyRoadTrip) store.setNoFlightsNeeded(true);

    // ── Dates ──
    let datesCompleted = false;
    if (parsed.dates?.type === "exact" && parsed.dates.startDate && parsed.dates.endDate && parsed.dates.startDate <= parsed.dates.endDate) {
      store.setDates({
        type: "exact",
        startDate: parsed.dates.startDate,
        endDate: parsed.dates.endDate,
      });
      datesCompleted = true;
    } else if (parsed.dates?.type === "flexible" && parsed.dates.flexibleMonth && parsed.dates.flexibleDuration) {
      store.setDates({ type: "flexible", flexibleMonth: parsed.dates.flexibleMonth, flexibleDuration: parsed.dates.flexibleDuration });
      datesCompleted = true;
    }
    if (datesCompleted) store.completeStep("dates");

    // ── Airlines ── (only what AirlinesStep itself requires to proceed)
    if (parsed.likelyRoadTrip || parsed.departureAirport) {
      store.completeStep("airlines");
    }

    // ── Budget ──
    if (parsed.budgetTier && BUDGET_TIERS.has(parsed.budgetTier)) {
      store.setBudget([parsed.budgetTier]);
      if (parsed.travelers) store.setBudgetDetails({ travelers: parsed.travelers });
      store.completeStep("budget");
    } else if (parsed.travelers) {
      store.setBudgetDetails({ travelers: parsed.travelers });
    }

    // ── Vibe ──
    const validVibes = (parsed.vibes ?? []).filter((v): v is VibeTag => VIBES.some((x) => x.id === v));
    if (validVibes.length) {
      store.setVibes(validVibes);
      store.completeStep("vibe");
    }

    // ── Activities ──
    if (parsed.activities?.length) {
      store.setActivities(parsed.activities);
      store.completeStep("activities");
    }

    // ── Standalone preferences (don't gate any step's Continue) ──
    if (parsed.dietaryRestrictions?.length || parsed.dietaryNotes) {
      store.setDietaryRestrictions(parsed.dietaryRestrictions ?? [], parsed.dietaryNotes);
    }
    if (parsed.avoidLongQueues) store.setAvoidLongQueues(true);
    if (parsed.dayTripRequested) store.setDayTripRequested(true);
  }

  // Writes everything once, then jumps straight to one step — used both by
  // "Looks good — continue" (jumps to whatever it couldn't confidently fill)
  // and by clicking a specific row (jumps to wherever that field lives),
  // so a "let me fix the dates" click doesn't force clicking Continue
  // through every already-correct screen first.
  function commitAndGo(target: StepId | "auto") {
    writeParsedToStore();
    const store = useTripStore.getState();
    if (target === "auto") {
      const completed = store.trip.completedSteps;
      const next = ORDERED_STEPS.find((s) => !completed.includes(s));
      store.goToStep(next ?? "itinerary");
    } else {
      store.goToStep(target);
    }
  }

  if (mode === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center animate-fade-up">
        <Loader2 size={28} className="animate-spin text-brand-500" />
        <p className="text-sm font-medium text-slate-700">Reading through everything you told me…</p>
        <p className="text-xs text-slate-400">This runs one AI pass over your whole description.</p>
      </div>
    );
  }

  if (mode === "review" && parsed) {
    const rows: { label: string; value: string; step: StepId }[] = [];
    rows.push({ label: "Destination", value: parsed.displayName, step: "destination" });
    if (parsed.departureAirport) rows.push({ label: "Departing from", value: parsed.departureAirport, step: "airlines" });
    if (parsed.likelyRoadTrip) rows.push({ label: "Trip type", value: "Road trip — no flights", step: "airlines" });
    if (parsed.dates?.type === "exact" && parsed.dates.startDate && parsed.dates.endDate) {
      rows.push({
        label: "Dates",
        value: `${formatDate(parsed.dates.startDate)} – ${formatDate(parsed.dates.endDate)}`,
        step: "dates",
      });
    } else if (parsed.dates?.type === "flexible" && parsed.dates.flexibleMonth) {
      rows.push({ label: "Dates", value: `~${parsed.dates.flexibleDuration ?? "?"} days in ${parsed.dates.flexibleMonth}`, step: "dates" });
    }
    if (parsed.travelers) rows.push({ label: "Travelers", value: String(parsed.travelers), step: "budget" });
    if (parsed.budgetTier) rows.push({ label: "Budget", value: BUDGET_LABELS[parsed.budgetTier], step: "budget" });
    if (parsed.dietaryRestrictions?.length || parsed.dietaryNotes) {
      rows.push({
        label: "Dietary",
        value: [parsed.dietaryRestrictions?.join(", "), parsed.dietaryNotes].filter(Boolean).join(" — "),
        step: "budget",
      });
    }
    if (parsed.avoidLongQueues) rows.push({ label: "Pace", value: "Prioritize skip-the-line access", step: "activities" });
    if (parsed.dayTripRequested) rows.push({ label: "Day trip", value: "Include one day outside the city", step: "activities" });
    // Only show vibe tags the Vibe step can actually display/edit — showing
    // "understood" a tag that then gets silently dropped at commit time
    // (because there's no chip for it) would be its own quiet wrong-guess.
    const displayVibes = (parsed.vibes ?? []).filter((v) => VIBES.some((x) => x.id === v));
    if (displayVibes.length) rows.push({ label: "Vibe", value: displayVibes.map((v) => labelFor(VIBES, v)).join(", "), step: "vibe" });
    if (parsed.activities?.length) rows.push({ label: "Activities", value: parsed.activities.map((a) => labelFor(GENERAL, a)).join(", "), step: "activities" });

    return (
      <div className="flex flex-col gap-6 animate-fade-up">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-1">Here&apos;s what I understood</p>
          <h2 className="text-2xl font-bold text-slate-900">Does this look right?</h2>
        </div>

        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-sm text-brand-800 leading-relaxed">{parsed.summary}</p>
        </div>

        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          {rows.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => commitAndGo(r.step)}
              title={`Jump to ${STEP_META[r.step].label} to fix this`}
              className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors group"
            >
              <Check size={14} className="text-sage-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{r.label}</p>
                <p className="text-sm text-slate-800">{r.value}</p>
              </div>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-400 shrink-0 mt-1 transition-colors" />
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-400">
          Something wrong? Tap it above to jump straight there and fix it. Anything I didn&apos;t catch (like lodging style or how you&apos;ll get around) — I&apos;ll ask about it on the next step.
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Button variant="ghost" size="sm" onClick={() => setMode("input")} className="text-slate-500">
            <ArrowLeft size={14} />
            Edit description
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => commitAndGo("destination")}>
              Review from the start
            </Button>
            <Button variant="primary" size="sm" onClick={() => commitAndGo("auto")}>
              Looks good — continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-1">Describe your whole trip</p>
        <h2 className="text-2xl font-bold text-slate-900">Tell ZiGy everything at once</h2>
        <p className="mt-1 text-slate-500 text-sm">
          One paragraph, as much detail as you have — destination, dates, group size, budget, dietary needs, pace. ZiGy fills in as much of the plan as it can, then shows you exactly what it understood before anything is locked in.
        </p>
      </div>

      <div>
        <textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE_PLACEHOLDER}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none leading-relaxed"
        />
      </div>

      {mode === "error" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-800 leading-relaxed">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500">
          <ArrowLeft size={14} />
          Back to step-by-step
        </Button>
        <Button variant="primary" size="sm" onClick={handleParse} disabled={!text.trim()}>
          <Wand2 size={14} />
          Plan my trip
        </Button>
      </div>
    </div>
  );
}
