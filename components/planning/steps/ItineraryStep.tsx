"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { RefreshCw, CheckCircle2, CalendarDays, MapPin, Pencil, Minus, Plus, X } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ItineraryView } from "@/components/planning/ItineraryView";
import { ItinerarySelectionWizard } from "@/components/planning/ItinerarySelectionWizard";
import { VisaRequirements } from "@/components/planning/VisaRequirements";
import { useTripStore } from "@/lib/store/tripStore";
import { cn, extractApiErrorMessage, formatDate, groupItineraryDaysByLocation, parseLocalDate } from "@/lib/utils";
import { getVisaRequirementsForTrip } from "@/lib/data/visaRequirements";
import { autoPlanTrip } from "@/lib/planning/autoPlanTrip";
import type { GeneratedItinerary } from "@/types/trip";

// Sourced from the generated days themselves, not the raw preferences — the
// AI sometimes extends a too-short date range to actually cover every
// destination (see buildItineraryPrompt), so `days` is what ZiGy actually
// came up with, which may differ from what was originally typed in.
function tripDateRangeLabel(days: GeneratedItinerary["days"]): string | null {
  if (!days.length) return null;
  const start = parseLocalDate(days[0].date);
  const end = parseLocalDate(days[days.length - 1].date);
  const sameYear = start.getFullYear() === end.getFullYear();
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startLabel = start.toLocaleDateString("en-US", opts);
  const endLabel = end.toLocaleDateString("en-US", sameYear ? opts : { ...opts, year: "numeric" });
  return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
}

export function ItineraryStep() {
  const {
    trip, isGenerating, setGenerating, addItinerary, completeStep, goToStep, markItineraryReviewed, setCityNights, setDates,
    setSelectedHotelForCity, setSelectedActivityIds, setSelectedRestaurantIds, saveFinalizedPlan, setAutoPlanEverything,
  } = useTripStore();
  const latest = trip.itineraries[trip.itineraries.length - 1] ?? null;
  const isPersonalized = Boolean(latest?.finalizedPlan);
  const dateRangeLabel = latest ? tripDateRangeLabel(latest.days) : null;
  const legs = latest ? groupItineraryDaysByLocation(latest.days, trip.preferences.destination?.displayName ?? "Unknown") : [];
  // cityList is the canonical, ordered set of legs (from the Destination
  // step) — used for the editor instead of `legs` so a city that somehow
  // ended up with zero days is still editable, not silently missing.
  const cityList = trip.preferences.destination?.cities?.filter(Boolean) ?? [];
  const totalDays = latest?.days.length ?? 0;
  const visaRequired = getVisaRequirementsForTrip(trip.preferences.destination).some((e) => e.visa.required);
  const visaBlocked = visaRequired && !trip.preferences.visaAcknowledged;

  const [error, setError] = useState<string | null>(null);
  const [showPicksBanner, setShowPicksBanner] = useState(false);
  // Visa info is only useful once, right when the itinerary lands — not
  // pinned above every hotel/restaurant/activity screen the traveller
  // clicks through in the wizard afterward. Shown again once review is
  // done, alongside the final read-only view.
  const [wizardStepIdx, setWizardStepIdx] = useState(0);
  // Also forced visible whenever acknowledgment is still outstanding —
  // otherwise a traveller who clicks past step 0 without acknowledging
  // would have no way back to the box short of manually navigating the
  // wizard backward, and Continue below stays disabled the whole time.
  const showVisaInfo = wizardStepIdx === 0 || Boolean(latest?.reviewCompleted) || visaBlocked;
  const [editingSplit, setEditingSplit] = useState(false);
  const [draftCounts, setDraftCounts] = useState<Record<string, number>>({});
  const [editingDates, setEditingDates] = useState(false);
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      // Read fresh from the store rather than the closed-over `trip` — this
      // gets called immediately after saving a day-split edit, and a stale
      // closure would regenerate against the preferences from before that
      // edit landed.
      const current = useTripStore.getState().trip;
      const res = await fetch("/api/itinerary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: current.id, preferences: current.preferences }),
      });
      if (!res.ok) throw new Error(extractApiErrorMessage(await res.text()));
      const data: GeneratedItinerary = await res.json();
      addItinerary(data);
      completeStep("itinerary");
    } catch (e: unknown) {
      // A raw "Failed to fetch" means the connection dropped (e.g. a server
      // timeout) rather than the API returning an error — that message is
      // meaningless to a user, so give them something actionable instead.
      const message = e instanceof Error ? e.message : "Something went wrong";
      setError(
        message === "Failed to fetch"
          ? "Lost connection while building your itinerary — this can happen on a slow connection. Please try again."
          : message
      );
    } finally {
      setGenerating(false);
    }
  }

  function openSplitEditor() {
    const counts: Record<string, number> = {};
    const evenShare = cityList.length ? Math.max(1, Math.round(totalDays / cityList.length)) : 0;
    for (const city of cityList) {
      counts[city] = legs.find((l) => l.location === city)?.dayCount ?? evenShare;
    }
    setDraftCounts(counts);
    setEditingDates(false);
    setEditingSplit(true);
  }

  // Same idea as the day-split editor, but for the overall date range —
  // available here too, not just on the flexible-dates confirm screen in
  // the review wizard, so shifting dates never means leaving this step and
  // re-clicking through everything to get back.
  function openDateEditor() {
    setDraftStart(latest?.days[0]?.date ?? trip.preferences.dates?.startDate ?? "");
    setDraftEnd(latest?.days[latest.days.length - 1]?.date ?? trip.preferences.dates?.endDate ?? "");
    setDateError(null);
    setEditingSplit(false);
    setEditingDates(true);
  }

  function saveDatesAndRebuild() {
    if (!draftStart || !draftEnd || draftStart > draftEnd) {
      setDateError("Enter a valid range — the end date needs to be after the start date.");
      return;
    }
    setDates({ ...trip.preferences.dates, type: "exact", startDate: draftStart, endDate: draftEnd });
    setEditingDates(false);
    generate();
  }

  function adjustDraftCount(city: string, delta: number) {
    setDraftCounts((prev) => ({ ...prev, [city]: Math.max(1, (prev[city] ?? 1) + delta) }));
  }

  const draftTotal = Object.values(draftCounts).reduce((a, b) => a + b, 0);
  const draftValid = draftTotal === totalDays;

  function saveSplitAndRebuild() {
    if (!draftValid) return;
    setCityNights(draftCounts);
    setEditingSplit(false);
    generate();
  }

  const autoStartRef = useRef(false);
  const prevPersonalizedRef = useRef(isPersonalized);

  // "Let ZiGy plan my whole trip" (chosen on the Planning Mode step) — once
  // the itinerary lands, run the same hotel/activities/restaurants smart-
  // picks and day-by-day arranging the wizard and Refine step would
  // otherwise ask for one screen at a time, city by city, then mark review
  // complete so the traveller lands straight on the finished plan.
  const [autoPlanning, setAutoPlanning] = useState(false);
  const [autoPlanError, setAutoPlanError] = useState<string | null>(null);
  const autoPlanRef = useRef(false);

  useEffect(() => {
    if (!latest || latest.reviewCompleted || !trip.preferences.autoPlanEverything) return;
    if (autoPlanRef.current) return;
    autoPlanRef.current = true;
    (async () => {
      setAutoPlanning(true);
      setAutoPlanError(null);
      try {
        const currentPrefs = useTripStore.getState().trip.preferences;
        const result = await autoPlanTrip(latest, currentPrefs);
        for (const [city, hotel] of Object.entries(result.selectedHotelsByCity)) {
          setSelectedHotelForCity(city, hotel);
        }
        setSelectedActivityIds(result.selectedActivityIds);
        setSelectedRestaurantIds(result.selectedRestaurantIds);
        const placed = new Set(Object.values(result.dayCards).flat());
        const allCardIds = [
          ...latest.activities.map((a) => `act-${a.id}`),
          ...(latest.restaurants ?? []).map((r) => `rest-${r.id}`),
        ];
        const bankCards = allCardIds.filter((id) => !placed.has(id));
        saveFinalizedPlan(latest.id, { dayCards: result.dayCards, bankCards });
        markItineraryReviewed(latest.id);
      } catch (e: unknown) {
        // Fall back to the manual wizard rather than leaving the traveller
        // stuck on a permanent loading state — a real failure here (bad API
        // key, network blip) shouldn't block the whole trip from being planned.
        setAutoPlanError(
          e instanceof Error
            ? `ZiGy couldn't finish planning automatically (${e.message}) — go through it yourself below instead.`
            : "ZiGy couldn't finish planning automatically — go through it yourself below instead."
        );
        setAutoPlanEverything(false);
      } finally {
        setAutoPlanning(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id, latest?.reviewCompleted, trip.preferences.autoPlanEverything]);

  useEffect(() => {
    const state = useTripStore.getState();
    const hasItinerary = state.trip.itineraries.length > 0;
    if (!hasItinerary && !state.isGenerating && !autoStartRef.current) {
      autoStartRef.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show a banner when the user returns from the personalize step having just saved picks
  useEffect(() => {
    if (isPersonalized && !prevPersonalizedRef.current) {
      setShowPicksBanner(true);
      const t = setTimeout(() => setShowPicksBanner(false), 4000);
      return () => clearTimeout(t);
    }
    prevPersonalizedRef.current = isPersonalized;
  }, [isPersonalized]);

  return (
    <StepShell
      stepId="itinerary"
      continueLabel={isPersonalized ? "Update my schedule" : "Review & fine-tune my plan"}
      continueDisabled={!latest || visaBlocked}
      onContinue={() => goToStep("refine")}
      // "Skip" would go to the same next step ("refine") as the primary
      // button above — a second button for the same destination is just
      // confusing, not an actual alternate path.
      hideSkip
      subtitle="Your personalised day-by-day itinerary, built around your preferences."
    >
      {/* Personalization saved banner */}
      {showPicksBanner && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-sage-50 to-brand-50 border border-sage-200 px-4 py-3">
          <CheckCircle2 size={18} className="text-sage-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-sage-700">Schedule saved!</p>
            <p className="text-xs text-slate-500">Your picks now appear as chips in each day card below.</p>
          </div>
        </div>
      )}

      {/* Unlock celebration */}
      {latest && !showPicksBanner && (
        <div className="mb-5 flex items-center gap-4 rounded-xl bg-gradient-to-r from-brand-50 to-sage-50 border border-brand-100 px-4 py-3">
          <Image
            src="/zigy-memories-avatar.png"
            alt=""
            width={64}
            height={64}
            className="shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm"
          />
          <div>
            <p className="text-sm font-semibold text-brand-700">
              {isPersonalized ? "Itinerary scheduled!" : "Itinerary unlocked!"}
            </p>
            <p className="text-xs text-slate-500">
              {isPersonalized
                ? "Your picks are shown in each day. Use the button below to adjust."
                : "You're ready to travel. Review and refine below."}
            </p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={generate}
              loading={isGenerating}
              className="shrink-0 text-slate-500"
            >
              <RefreshCw size={13} />
              Regenerate
            </Button>
            <p className="text-[10px] text-slate-400 pr-1">Rebuilds everything from scratch</p>
          </div>
        </div>
      )}

      {/* Dates & destinations ZiGy landed on — the first concrete facts a
          user should see once the itinerary unlocks, before flights/hotels. */}
      {latest && !showPicksBanner && (dateRangeLabel || legs.length > 0) && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {dateRangeLabel && (
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-brand-500 shrink-0" />
                <span className="text-sm font-medium text-slate-700">{dateRangeLabel}</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1">
              {!editingDates && (
                <Button variant="ghost" size="sm" onClick={openDateEditor} className="text-slate-500 -my-1">
                  <Pencil size={12} />
                  Adjust dates
                </Button>
              )}
              {legs.length > 1 && !editingSplit && (
                <Button variant="ghost" size="sm" onClick={openSplitEditor} className="text-slate-500 -my-1">
                  <Pencil size={12} />
                  Adjust days per city
                </Button>
              )}
            </div>
          </div>

          {/* Date-range editor */}
          {editingDates && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-2.5">Adjust your travel dates</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={draftStart}
                  onChange={(e) => { setDraftStart(e.target.value); setDateError(null); }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={draftEnd}
                  onChange={(e) => { setDraftEnd(e.target.value); setDateError(null); }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              {dateError && <p className="mt-2 text-xs text-red-600">{dateError}</p>}
              <div className="mt-3 flex items-center justify-between">
                <button type="button" onClick={() => setEditingDates(false)} className="text-xs text-slate-500 hover:text-slate-700">
                  Cancel
                </button>
                <Button variant="primary" size="sm" onClick={saveDatesAndRebuild} loading={isGenerating}>
                  Save & rebuild
                </Button>
              </div>
            </div>
          )}

          {legs.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-2 pt-2.5 border-t border-slate-100">
              {legs.map((leg, i) => (
                <div key={`${leg.location}-${i}`} className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <MapPin size={12} className="text-brand-500 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-700 leading-tight">{leg.location}</p>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        {formatDate(leg.dates[0])}
                        {leg.dayCount > 1 && `–${formatDate(leg.dates[leg.dates.length - 1])}`}
                        {" · "}{leg.dayCount} day{leg.dayCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  {i < legs.length - 1 && <span className="text-slate-300 text-xs">→</span>}
                </div>
              ))}
            </div>
          )}

          {/* Day-split editor — redistributes the SAME total day count across
              cities; changing trip length itself is a Dates-step change, not
              this control's job. */}
          {editingSplit && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-semibold text-slate-700">How many days in each city?</p>
                <button type="button" onClick={() => setEditingSplit(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {cityList.map((city) => (
                  <div key={city} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700 truncate">{city}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => adjustDraftCount(city, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-30"
                        disabled={(draftCounts[city] ?? 1) <= 1}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-slate-800 tabular-nums">
                        {draftCounts[city] ?? 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustDraftCount(city, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-600"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className={cn("text-xs", draftValid ? "text-slate-400" : "text-red-600 font-medium")}>
                  {draftTotal} of {totalDays} days allocated
                  {!draftValid && (draftTotal > totalDays ? " — remove some to match your trip length" : " — add more to match your trip length")}
                </p>
                <Button variant="primary" size="sm" onClick={saveSplitAndRebuild} disabled={!draftValid} loading={isGenerating}>
                  Save & rebuild
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visa requirements — shown as soon as the itinerary lands and again
          in the final view, but not pinned above every wizard stage in
          between. Continue below is still gated on acknowledgment
          regardless of whether the box is currently visible. */}
      {latest && !showPicksBanner && showVisaInfo && (
        <div className="mb-5">
          <VisaRequirements preferences={trip.preferences} />
        </div>
      )}

      {/* Loading state */}
      {isGenerating && !latest && <GeneratingProgress />}

      {/* Error state */}
      {error && (
        <Card className="border-red-200 bg-red-50 mb-4">
          <p className="text-sm text-red-700 font-medium">Failed to generate itinerary</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
          <Button variant="outline" size="sm" onClick={generate} className="mt-3">
            Try again
          </Button>
        </Card>
      )}

      {/* Auto-plan error — falls back to the manual wizard below once shown */}
      {autoPlanError && (
        <Card className="border-amber-200 bg-amber-50 mb-4">
          <p className="text-sm text-amber-700">{autoPlanError}</p>
        </Card>
      )}

      {/* Auto-plan loading state */}
      {autoPlanning && (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="h-8 w-8 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-700">ZiGy is planning your whole trip…</p>
          <p className="text-xs text-slate-400 max-w-xs">Lodging, activities, restaurants, and the day-by-day schedule — one city at a time.</p>
        </div>
      )}

      {/* Itinerary output */}
      {latest && !latest.reviewCompleted && !autoPlanning && !trip.preferences.autoPlanEverything && (
        <ItinerarySelectionWizard
          key={latest.id}
          itinerary={latest}
          onComplete={() => markItineraryReviewed(latest.id)}
          onRegenerate={generate}
          onStepChange={setWizardStepIdx}
        />
      )}
      {latest && latest.reviewCompleted && (
        <ItineraryView key={latest.id} itinerary={latest} hideSelectionSections />
      )}
    </StepShell>
  );
}

const STATUS_MESSAGES = [
  "Searching for the best flights…",
  "Finding hotels that match your vibe…",
  "Curating local experiences…",
  "Building your day-by-day plan…",
  "Checking restaurant picks…",
  "Negotiating with the concierge…",
  "Bribing the maître d' for a better table…",
  "Convincing the locals you're not a tourist…",
  "Building a trip you'll never forget…",
  "This will be worth the wait…",
  "Adding the secret gems only locals know…",
  "Perfecting your itinerary one detail at a time…",
  "Almost there — good things take time…",
  "Packing in more adventures…",
];
const RING_R = 34;
const RING_CIRC = 2 * Math.PI * RING_R;

function GeneratingProgress() {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Exponential easing: fast start, then slows dramatically, caps at 80%
  // At 10s ≈ 45%, 20s ≈ 63%, 30s ≈ 75%, 60s ≈ 80% — never looks "almost done"
  const progress = (1 - Math.exp(-elapsed * 0.05)) * 0.80;
  const dashOffset = RING_CIRC * (1 - progress);
  const statusIdx = Math.floor(elapsed / 6) % STATUS_MESSAGES.length;
  const mm = String(Math.floor(elapsed / 60)).padStart(1, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center">
      {/* Progress ring */}
      <div className="relative">
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={RING_R} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle
            cx="44" cy="44" r={RING_R}
            fill="none"
            stroke="#6366f1"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 44 44)"
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-mono font-semibold text-brand-600">{mm}:{ss}</span>
        </div>
      </div>
      <div>
        <p className="font-semibold text-slate-800">{STATUS_MESSAGES[statusIdx]}</p>
        <p className="text-sm text-slate-500 mt-1">
          This usually takes a minute or two — good trips take time to build.
        </p>
      </div>
      <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 max-w-xs text-center">
        <p className="text-xs font-semibold text-brand-700 mb-0.5">While you wait…</p>
        <p className="text-xs text-slate-600">Feel free to chat with ZiGy about your trip — ask about visa requirements, what to pack, or the best time to visit.</p>
      </div>
    </div>
  );
}
