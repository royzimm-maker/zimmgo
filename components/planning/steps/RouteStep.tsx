"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Home, Loader2, MapPin, Plus, Sparkles, Trash2 } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import { tripSpan } from "@/lib/itinerary/dayPlan";
import { addDays, routeStops, stopDates } from "@/lib/planning/route";
import type { RouteRequest, RouteSuggestions } from "@/app/api/trip/suggest-routes/route";
import type { FixedStay, RouteOption, TripStop } from "@/types/trip";

const MIN_NIGHT_CHOICES = [1, 2, 3, 4];
const MAX_NIGHT_CHOICES = [3, 4, 5, 6, 7];

function shortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const sameStops = (a: TripStop[] | undefined, b: TripStop[]) =>
  !!a && a.length === b.length && a.every((s, i) => s.city === b[i].city && s.nights === b[i].nights);

// Sits after Dates: ZimmGo suggests where to stay and for how long, around
// the dates the traveller is already committed to (lib/planning/route.ts
// checks every route against them). Choosing a route sets the trip's cities
// and nights; travellers who already know their cities can skip it.
export function RouteStep() {
  const { trip, setDestination, setStops, setRouteOptions, goToStep } = useTripStore();
  const { destination, dates, routeOptions } = trip.preferences;
  const chosen = routeStops(trip.preferences);
  const ready = Boolean(destination?.displayName && dates);
  const { startDate, numDays } = tripSpan(trip.preferences);
  const tripEnd = addDays(startDate, numDays);

  const [feedback, setFeedback] = useState("");
  const [note, setNote] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fixedStays = destination?.fixedStays ?? [];
  function updateDestination(patch: Partial<NonNullable<typeof destination>>) {
    if (destination) setDestination({ ...destination, ...patch });
  }
  function updateFixedStay(i: number, patch: Partial<FixedStay>) {
    updateDestination({ fixedStays: fixedStays.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  }

  async function suggest() {
    const { trip: current } = useTripStore.getState();
    const p = current.preferences;
    setLoading(true);
    setError(null);
    try {
      const body: RouteRequest = {
        destination: p.destination, dates: p.dates, vibes: p.vibes, activities: p.activities, travelers: p.travelers,
        feedback: feedback.trim() || undefined,
      };
      const res = await fetch("/api/trip/suggest-routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't suggest routes — please try again.");
      const result = data as RouteSuggestions;
      // The traveller may have switched trips meanwhile.
      if (useTripStore.getState().trip.id !== current.id) return;
      setRouteOptions(result.routes);
      setNote(result.note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  }

  // A traveller who asked ZimmGo where to go sees routes straight away.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !ready || !destination?.openToSuggestions || routeOptions?.length) return;
    autoRan.current = true;
    suggest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const hasCities = (destination?.cities?.filter(Boolean).length ?? 0) > 0;
  const datesChanged = !!trip.preferences.stops?.length && !routeStops(trip.preferences, numDays);

  if (!ready) {
    return (
      <StepShell stepId="route" continueDisabled>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          ZimmGo needs your destination and dates to suggest a route.
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={() => goToStep(destination ? "dates" : "destination")}>
              {destination ? "Set your dates" : "Choose a destination"}
            </Button>
          </div>
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell
      stepId="route"
      subtitle="ZimmGo suggests where to base yourself and for how long, around the dates you've already committed to."
      continueLabel={chosen ? "Continue with this route" : "Continue"}
      // Without any cities there's nothing to plan until a route is chosen.
      continueDisabled={!hasCities}
    >
      <div className="flex flex-col gap-6">
        {/* ── What the route must keep ── */}
        <section className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Dates you&apos;re committed to</p>
            <p className="text-xs text-slate-500">e.g. a villa that&apos;s already booked. Every route keeps these exactly.</p>
          </div>
          {fixedStays.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3">
              <input
                aria-label="Place"
                value={f.place}
                onChange={(e) => updateFixedStay(i, { place: e.target.value })}
                placeholder="Place, e.g. Tuscany"
                className="min-w-0 flex-1 basis-40 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
              />
              <input
                type="date" aria-label="Arrive" value={f.startDate} min={startDate} max={tripEnd}
                onChange={(e) => updateFixedStay(i, { startDate: e.target.value })}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date" aria-label="Leave" value={f.endDate} min={startDate} max={tripEnd}
                onChange={(e) => updateFixedStay(i, { endDate: e.target.value })}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={!!f.lodgingArranged} onChange={(e) => updateFixedStay(i, { lodgingArranged: e.target.checked })} />
                Lodging already arranged
              </label>
              <button
                type="button" aria-label="Remove"
                onClick={() => updateDestination({ fixedStays: fixedStays.filter((_, j) => j !== i) })}
                className="ml-auto text-slate-400 hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div>
            <Button
              size="sm" variant="ghost"
              onClick={() => updateDestination({ fixedStays: [...fixedStays, { place: "", startDate, endDate: addDays(startDate, Math.min(3, numDays)) }] })}
            >
              <Plus size={14} /> Add dates you&apos;re committed to
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              At least
              <select
                value={destination?.minNightsPerStop ?? ""}
                onChange={(e) => updateDestination({ minNightsPerStop: e.target.value ? Number(e.target.value) : undefined })}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
              >
                <option value="">any</option>
                {MIN_NIGHT_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2">
              and at most
              <select
                value={destination?.maxNightsPerStop ?? ""}
                onChange={(e) => updateDestination({ maxNightsPerStop: e.target.value ? Number(e.target.value) : undefined })}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
              >
                <option value="">any</option>
                {MAX_NIGHT_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            nights in each place
          </div>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder={routeOptions?.length ? "Anything to change? e.g. \"More beach time\" or \"Include Sicily\"" : "Anything else ZimmGo should know? (optional)"}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <div>
            <Button onClick={suggest} loading={loading} disabled={loading}>
              {!loading && <Sparkles size={14} />}
              {routeOptions?.length ? "Suggest new routes" : "Suggest routes"}
            </Button>
          </div>
        </section>

        {loading && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={14} className="animate-spin" /> ZimmGo is weighing up routes — this can take a minute or two.
          </p>
        )}
        {error && (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        {datesChanged && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            Your dates have changed since you chose a route — choose one again so the nights add up.
          </p>
        )}
        {note && <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{note}</p>}

        {/* ── ZimmGo's routes ── */}
        {!!routeOptions?.length && (
          <section className="flex flex-col gap-4">
            {routeOptions.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                startDate={startDate}
                selected={sameStops(trip.preferences.stops, route.stops)}
                onChoose={() => setStops(route.stops)}
              />
            ))}
          </section>
        )}
      </div>
    </StepShell>
  );
}

function RouteCard({ route, startDate, selected, onChoose }: {
  route: RouteOption; startDate: string; selected: boolean; onChoose: () => void;
}) {
  const stops = stopDates(startDate, route.stops);
  return (
    <div className={cn("rounded-2xl border p-4", selected ? "border-brand-400 bg-brand-50/40 ring-1 ring-brand-300" : "border-slate-200")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{route.title}</h3>
            {route.recommended && <Badge variant="success">ZimmGo&apos;s pick</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-600">{route.summary}</p>
        </div>
        <Button size="sm" variant={selected ? "secondary" : "primary"} onClick={onChoose} disabled={selected}>
          {selected ? <><CheckCircle2 size={14} /> Chosen</> : "Use this route"}
        </Button>
      </div>

      <ol className="mt-4 flex flex-col gap-3">
        {stops.map((s, i) => (
          <li key={i} className="flex gap-3">
            <div className="w-24 shrink-0 text-xs text-slate-500">
              <p className="font-medium text-slate-700">{shortDate(s.startDate)} – {shortDate(s.endDate)}</p>
              <p>{s.nights} night{s.nights === 1 ? "" : "s"}</p>
            </div>
            <div className="min-w-0 text-sm">
              <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-800">
                <MapPin size={12} className="text-brand-500" />
                {s.city}
                {s.area && <span className="font-normal text-slate-500">· {s.area}</span>}
                {s.lodgingArranged && (
                  <span className="flex items-center gap-1 rounded-full bg-sage-50 px-2 py-0.5 text-[11px] font-normal text-sage-700">
                    <Home size={10} /> Your own lodging
                  </span>
                )}
              </p>
              {s.why && <p className="mt-0.5 text-slate-600">{s.why}</p>}
            </div>
          </li>
        ))}
      </ol>

      {route.gettingAround && (
        <p className="mt-4 text-sm text-slate-600"><span className="font-medium text-slate-700">Getting around: </span>{route.gettingAround}</p>
      )}
      {route.leftOut.length > 0 && (
        <div className="mt-3 text-sm text-slate-600">
          <p className="font-medium text-slate-700">Left out</p>
          <ul className="mt-1 list-disc pl-5">
            {route.leftOut.map((l) => <li key={l.place}><span className="font-medium">{l.place}</span> — {l.reason}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
