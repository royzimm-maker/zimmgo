"use client";

import { useEffect, useState } from "react";
import { Sparkles, AlertCircle, Timer, MapPinned } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { OtherInput } from "@/components/ui/OtherInput";
import { ModeToggleBanner } from "@/components/planning/ModeToggleBanner";
import { BeliConnect } from "@/components/planning/BeliConnect";
import { useSmartPick } from "@/lib/hooks/useSmartPick";
import { useTripStore } from "@/lib/store/tripStore";
import { getIrrelevantCategories } from "@/lib/data/activityRelevance";
import { cn } from "@/lib/utils";
import type { ActivityCategory } from "@/types/trip";

// Exported so ChatPanel can turn a chat-driven update's raw category ids
// back into friendly labels for its confirmation banner.
export const GENERAL: { id: ActivityCategory; label: string; icon: string; sublabel: string }[] = [
  { id: "guided_walking_tour", label: "Guided Walking Tour", icon: "🚶", sublabel: "Expert-led neighborhood & history walks" },
  { id: "hiking",              label: "Hiking",              icon: "🥾", sublabel: "Trails, peaks, national parks" },
  { id: "skiing",              label: "Skiing",              icon: "⛷️", sublabel: "Downhill, backcountry, snow" },
  { id: "sailing",             label: "Sailing & Boating",   icon: "⛵", sublabel: "Charters, boat excursions, coastal cruising" },
  { id: "food",                label: "Food Experiences",    icon: "🍜", sublabel: "Guided food tours, markets, tastings, cooking classes" },
  { id: "diving",              label: "Diving & Snorkel",    icon: "🤿", sublabel: "Reefs, wrecks, marine life" },
  { id: "cycling",             label: "Cycling",             icon: "🚴", sublabel: "Road biking, mountain biking" },
  { id: "cultural",            label: "Cultural",            icon: "🏛️", sublabel: "History, arts, local traditions" },
  { id: "photography",         label: "Photography",         icon: "📷", sublabel: "Landscapes, architecture, street" },
  { id: "wellness",            label: "Wellness & Spa",      icon: "🧘", sublabel: "Retreats, yoga, thermal baths" },
  { id: "adventure",           label: "Adventure Sports",    icon: "🪂", sublabel: "Paragliding, bungee, white water" },
];

export function ActivitiesStep() {
  const { trip, setActivities, setAvoidLongQueues, setDayTripRequested } = useTripStore();
  const [avoidQueues, setAvoidQueues] = useState(trip.preferences.avoidLongQueues ?? false);
  const [dayTrip, setDayTrip] = useState(trip.preferences.dayTripRequested ?? false);

  function toggleAvoidQueues() {
    const next = !avoidQueues;
    setAvoidQueues(next);
    setAvoidLongQueues(next);
  }

  function toggleDayTrip() {
    const next = !dayTrip;
    setDayTrip(next);
    setDayTripRequested(next);
  }

  // Don't offer categories that don't fit the destination/season (e.g.
  // skiing for an April Tokyo trip, diving for a Madrid city break) — keeps
  // the picker itself from steering the itinerary toward nonsensical picks.
  const irrelevant = getIrrelevantCategories(trip.preferences.destination, trip.preferences.dates);
  const visibleGeneral = GENERAL.filter((g) => !irrelevant.has(g.id));

  const { picking, pickSummary, error: pickError, run: runSmartPick } = useSmartPick();

  const [selectedGeneral, setSelectedGeneral] = useState<ActivityCategory[]>(
    trip.preferences.activities.filter((a): a is ActivityCategory =>
      GENERAL.some((g) => g.id === a)
    )
  );
  const [otherOpen,  setOtherOpen ] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  // This step keeps its own draft state and only writes back to the store on
  // Continue — so a chat-driven edit (ZiGy applying "add hiking, drop
  // cultural" while the user is sitting on this step) wouldn't otherwise be
  // visible until they navigated away and back. Re-sync whenever the
  // underlying preference changes from outside this component.
  useEffect(() => {
    const known = trip.preferences.activities.filter((a): a is ActivityCategory =>
      GENERAL.some((g) => g.id === a)
    );
    const custom = trip.preferences.activities.find((a) => !GENERAL.some((g) => g.id === a));
    setSelectedGeneral(known);
    if (custom) {
      setOtherOpen(true);
      setOtherValue(custom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.preferences.activities]);

  // Write every change straight to the store instead of only on Continue —
  // otherwise a manual pick made here is invisible to chat (which only reads
  // the store) and gets silently clobbered the moment chat applies its own
  // update, since that overwrites the store and this step's own sync-from-
  // store effect above then overwrites the local draft to match.
  function assembleActivities(overrides: Partial<{
    general: ActivityCategory[]; otherOpen: boolean; otherValue: string;
  }> = {}): string[] {
    const g  = overrides.general ?? selectedGeneral;
    const oo = overrides.otherOpen ?? otherOpen;
    const ov = overrides.otherValue ?? otherValue;
    return [...g, ...(oo && ov.trim() ? [ov.trim()] : [])];
  }
  function syncActivities(overrides?: Parameters<typeof assembleActivities>[0]) {
    setActivities(assembleActivities(overrides));
  }

  function toggleGeneral(id: ActivityCategory) {
    const next = selectedGeneral.includes(id) ? selectedGeneral.filter((a) => a !== id) : [...selectedGeneral, id];
    setSelectedGeneral(next);
    syncActivities({ general: next });
  }

  function handleOtherChange(v: string) {
    setOtherValue(v);
    syncActivities({ otherValue: v });
  }
  function handleOtherToggle() {
    const next = !otherOpen;
    setOtherOpen(next);
    syncActivities({ otherOpen: next });
  }

  async function handleZigyPick() {
    const picks = await runSmartPick({
      kind: "activities",
      preferences: trip.preferences,
      candidates: visibleGeneral.map((g) => ({ id: g.id, label: g.label })),
    });
    const picked = picks
      .map((p) => p.id)
      .filter((id): id is ActivityCategory => visibleGeneral.some((g) => g.id === id));
    setSelectedGeneral(picked);
    syncActivities({ general: picked });
  }

  function handleContinue() {
    setActivities(assembleActivities());
  }

  const totalSelected =
    selectedGeneral.length + (otherOpen && otherValue.trim() ? 1 : 0);

  return (
    <StepShell
      stepId="activities"
      onContinue={handleContinue}
      continueDisabled={totalSelected === 0}
      subtitle="What kind of experiences do you love? We'll weave these into your itinerary."
      headerImage="/zigy-activities.png"
      headerExtra={
        // No separate "how do you want to choose?" screen — this hand-off to
        // ZiGy is the direct replacement for that, so it needs to read as
        // the primary alternative to picking manually, not an easy-to-miss
        // aside. Living in the header's own column also reclaims the empty
        // space a tall header image leaves next to the short title/subtitle.
        <div className="max-w-xs flex flex-col gap-3">
          <ModeToggleBanner
            label="Activities for you to choose from — or let ZiGy pick."
            onZigy={handleZigyPick}
            loading={picking}
            error={pickSummary ? null : pickError}
            picked={!!pickSummary}
            prominent
          />
          {/* A picked banner's own error slot is suppressed above — surface a
              failure separately so it doesn't vanish along with the closed state. */}
          {pickSummary && pickError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{pickError}</p>
            </div>
          )}
          {pickSummary && (
            <div className="rounded-lg bg-brand-50 px-3 py-2">
              <p className="text-xs text-brand-600">
                <Sparkles size={11} className="inline mr-1" />
                {pickSummary}
              </p>
              <p className="mt-1 text-[10px] text-brand-400">
                Nothing's locked in — tweak away below!
              </p>
            </div>
          )}
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={toggleAvoidQueues}
          title="When picking activities, favor early-access and reserved-entry options over general admission — worth it for the main sights, even at a premium."
          className={cn(
            "flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition-all",
            avoidQueues ? "border-sage-500 bg-sage-50" : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <span className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            avoidQueues ? "bg-sage-500 text-white" : "bg-slate-100 text-slate-500"
          )}>
            <Timer size={13} />
          </span>
          <div className="min-w-0">
            <p className={cn("font-semibold text-xs leading-tight", avoidQueues ? "text-sage-800" : "text-slate-800")}>
              Skip-the-line access
            </p>
            <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
              Favor early-access options
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={toggleDayTrip}
          title="Give one day of the itinerary over to a nearby excursion instead of keeping every day in the main destination."
          className={cn(
            "flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition-all",
            dayTrip ? "border-sage-500 bg-sage-50" : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <span className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            dayTrip ? "bg-sage-500 text-white" : "bg-slate-100 text-slate-500"
          )}>
            <MapPinned size={13} />
          </span>
          <div className="min-w-0">
            <p className={cn("font-semibold text-xs leading-tight", dayTrip ? "text-sage-800" : "text-slate-800")}>
              Day trip outside city
            </p>
            <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
              Swap in a nearby excursion
            </p>
          </div>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visibleGeneral.map((a) => (
          <SelectChip
            key={a.id}
            label={a.label}
            icon={a.icon}
            sublabel={a.sublabel}
            selected={selectedGeneral.includes(a.id)}
            onClick={() => toggleGeneral(a.id)}
          />
        ))}
        <OtherInput
          selected={otherOpen}
          value={otherValue}
          onChange={handleOtherChange}
          onToggle={handleOtherToggle}
          placeholder="e.g. Surfing, Bird watching…"
        />
      </div>

      {totalSelected > 0 && (
        <p className="mt-4 text-xs text-slate-500">
          {totalSelected} activit{totalSelected === 1 ? "y" : "ies"} selected
        </p>
      )}

      <BeliConnect />
    </StepShell>
  );
}
