"use client";

import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { X, Sparkles, Heart, ArrowRight, Hotel, UtensilsCrossed, Star, CalendarDays, CheckCircle2, AlertCircle } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { fetchSmartPick } from "@/lib/api/smartPick";
import { formatCurrency, formatDate, fuzzyCityMatch, scrollStepToTop } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import type { ActivityOption, RestaurantOption } from "@/types/trip";

// ─── Emoji lookups ────────────────────────────────────────────────────────────

const ACTIVITY_EMOJI: Record<string, string> = {
  skiing: "⛷️", hiking: "🥾", sailing: "⛵", food: "🍽️", diving: "🤿",
  cycling: "🚴", cultural: "🏛️", photography: "📸", wellness: "🧘",
  adventure: "🧗", guided_walking_tour: "🚶",
};

const RESTAURANT_EMOJI: Record<string, string> = {
  fine_dining: "⭐", upscale: "🥂", midrange: "🍽️",
  casual: "🍴", street_food: "🥙", brunch: "🥞",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardInfo {
  cardId: string;
  kind: "activity" | "restaurant";
  activity?: ActivityOption;
  restaurant?: RestaurantOption;
}

// ─── CardInner — shared between DraggableCard and DragOverlay ─────────────────

function CardInner({
  info,
  onRemove,
  onSave,
  overlay = false,
}: {
  info: CardInfo;
  onRemove?: () => void;
  onSave?: () => void;
  overlay?: boolean;
}) {
  const { activity, restaurant } = info;
  const { trip } = useTripStore();

  const base = overlay
    ? "flex items-center gap-2 rounded-lg border px-2.5 py-2 shadow-2xl ring-2 select-none"
    : "flex items-center gap-2 rounded-lg border px-2.5 py-2 shadow-sm hover:shadow-md transition-shadow select-none cursor-grab";

  if (activity) {
    const emoji = ACTIVITY_EMOJI[activity.category] ?? "🎯";
    return (
      <div className={`${base} ${overlay ? "border-brand-300 bg-white ring-brand-200" : "border-slate-200 bg-white"}`}>
        <span className="text-sm shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{activity.name}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
            {activity.location && <span className="font-medium text-brand-600 truncate">{activity.location}</span>}
            {activity.duration && <span>{activity.duration}</span>}
            {activity.price > 0 && <span>{formatCurrency(activity.price, trip.preferences.preferredCurrency)}</span>}
          </div>
        </div>
        {onSave && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSave(); }}
            className="shrink-0 text-slate-300 hover:text-brand-500 transition-colors"
            title="Save to Wanderlog instead"
          >
            <Heart size={12} />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="shrink-0 text-slate-300 hover:text-red-400 transition-colors"
            title="Return to bank"
          >
            <X size={12} />
          </button>
        )}
      </div>
    );
  }

  if (restaurant) {
    const emoji = RESTAURANT_EMOJI[restaurant.tier] ?? "🍽️";
    return (
      <div className={`${base} ${overlay ? "border-amber-300 bg-amber-50 ring-amber-200" : "border-amber-200 bg-amber-50/60"}`}>
        <span className="text-sm shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{restaurant.name}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
            {restaurant.location && <span className="font-medium text-amber-700 truncate">{restaurant.location}</span>}
            <span>{restaurant.cuisine}</span>
            <span className="font-medium text-amber-600">{restaurant.priceRange}</span>
          </div>
        </div>
        {onSave && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSave(); }}
            className="shrink-0 text-slate-300 hover:text-brand-500 transition-colors"
            title="Save to Wanderlog instead"
          >
            <Heart size={12} />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="shrink-0 text-slate-300 hover:text-red-400 transition-colors"
            title="Return to bank"
          >
            <X size={12} />
          </button>
        )}
      </div>
    );
  }

  return null;
}

// ─── DraggableCard ────────────────────────────────────────────────────────────

function DraggableCard({ info, onRemove, onSave }: { info: CardInfo; onRemove?: () => void; onSave?: () => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: info.cardId });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.15 : 1, touchAction: "none" }}
    >
      <CardInner info={info} onRemove={onRemove} onSave={onSave} />
    </div>
  );
}

// Case-insensitive check: do two location strings refer to the same place?
function locationsMatch(a?: string, b?: string): boolean {
  if (!a || !b) return true; // no location info → allow drop
  // Strip a leading "the" so it never becomes the "first word" two different
  // places both happen to share (e.g. "the Dolomites" vs "the Amalfi Coast").
  const norm = (s: string) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, " ").trim();
  const na = norm(a), nb = norm(b);
  // Extract first meaningful word for fuzzy matching (e.g. "Dolomites, Italy" → "dolomites")
  const firstWord = (s: string) => s.split(/\s+/)[0];
  return na === nb || na.includes(nb) || nb.includes(na) ||
    (firstWord(na) === firstWord(nb) && firstWord(na).length > 0);
}

// Activities/restaurants are tagged by the AI with specific town/region names
// (e.g. "Vik and South Coast Iceland") that often share no word with the
// trip's coarse city labels (e.g. "the Ring Road") used for day.location —
// locationsMatch alone would leave those cards unbucketable in every city tab,
// stuck in the bank with no day they can ever be dropped on. Resolve each card
// to one of the trip's known cities, falling back to the last one (the
// touring/loop leg in road-trip style itineraries) so nothing is orphaned.
function resolveCardCity(location: string | undefined, cities: string[]): string | undefined {
  if (!location || cities.length === 0) return undefined;
  return cities.find((c) => locationsMatch(location, c)) ?? cities[cities.length - 1];
}

// ─── DroppableContainer ───────────────────────────────────────────────────────

function DroppableContainer({
  id,
  isEmpty,
  compatible = true,
  children,
}: {
  id: string;
  isEmpty: boolean;
  compatible?: boolean;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const blocked = isOver && !compatible;
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[52px] rounded-lg transition-all duration-100 ${
        blocked
          ? "ring-2 ring-red-300 ring-inset bg-red-50"
          : isOver && compatible
          ? "ring-2 ring-brand-400 ring-inset bg-brand-50"
          : isEmpty
          ? "border-2 border-dashed border-slate-200"
          : ""
      } p-1.5`}
    >
      {isEmpty ? (
        <p className={`text-[11px] text-center py-2.5 ${
          blocked ? "text-red-400 font-medium" :
          isOver && compatible ? "text-brand-500 font-medium" :
          "text-slate-400"
        }`}>
          {blocked ? "Wrong location" : isOver && compatible ? "Release to add" : "Drop here"}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">{children}</div>
      )}
    </div>
  );
}

// ─── Main RefineStep ──────────────────────────────────────────────────────────

export function RefineStep() {
  const { trip, goToStep, saveFinalizedPlan, markItineraryReviewed, addWanderlogItem, setSelectedHotelForCity } = useTripStore();
  const itinerary = trip.itineraries[trip.itineraries.length - 1] ?? null;

  // Only the activities/restaurants the traveller actually picked in the
  // review wizard belong on this board — the full generated list (including
  // everything they skipped) would make it look like nothing was selected
  // at all, and mismatch the "Where things stand" counts above, which are
  // already scoped to these same selected-id lists.
  const activities = useMemo<ActivityOption[]>(
    () => (itinerary?.activities ?? []).filter((a) => (trip.preferences.selectedActivityIds ?? []).includes(a.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itinerary?.id, trip.preferences.selectedActivityIds]
  );
  const restaurants = useMemo<RestaurantOption[]>(
    () => (itinerary?.restaurants ?? []).filter((r) => (trip.preferences.selectedRestaurantIds ?? []).includes(r.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itinerary?.id, trip.preferences.selectedRestaurantIds]
  );
  const days = itinerary?.days ?? [];

  // Distinct cities in trip order, derived from day locations
  const cities = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const day of days) {
      if (day.location && !seen.has(day.location)) {
        seen.add(day.location);
        list.push(day.location);
      }
    }
    return list;
  }, [days]);

  const [activeCity, setActiveCity] = useState<string | null>(null);
  const effectiveCity = activeCity ?? cities[0] ?? null;

  // Switching city tabs updates internal state without remounting this step,
  // so it doesn't scroll back to the top the way a fresh step normally does.
  useEffect(() => {
    scrollStepToTop();
  }, [effectiveCity]);

  const allCards = useMemo<CardInfo[]>(() => [
    ...activities.map((a) => ({ cardId: `act-${a.id}`, kind: "activity" as const, activity: a })),
    ...restaurants.map((r) => ({ cardId: `rest-${r.id}`, kind: "restaurant" as const, restaurant: r })),
  ], [activities, restaurants]);

  const cardMap = useMemo<Record<string, CardInfo>>(() => {
    const m: Record<string, CardInfo> = {};
    allCards.forEach((c) => { m[c.cardId] = c; });
    return m;
  }, [allCards]);

  // Restore previous state if this itinerary was already personalized
  const [bank, setBank] = useState<string[]>(() => {
    if (itinerary?.finalizedPlan) return itinerary.finalizedPlan.bankCards;
    return allCards.map((c) => c.cardId);
  });

  const [dayCards, setDayCards] = useState<Record<number, string[]>>(() => {
    if (itinerary?.finalizedPlan) return itinerary.finalizedPlan.dayCards;
    const d: Record<number, string[]> = {};
    days.forEach((day) => { d[day.dayNumber] = []; });
    return d;
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [arranging, setArranging] = useState(false);
  const [arrangeSummaries, setArrangeSummaries] = useState<Record<string, string>>({});
  const [arrangeError, setArrangeError] = useState<string | null>(null);
  const [autoPlanCities, setAutoPlanCities] = useState<Set<string>>(new Set());
  // "Let ZiGy schedule every city" already covered every destination in one
  // shot — once that's happened, the per-city "move on to {nextCity}" nudge
  // below is misleading (it implies a sequential walk-through the user never
  // asked for). Swaps that nudge for a single trip-wide message instead.
  // Resets if the user goes back to arranging one city at a time by hand.
  const [bulkArranged, setBulkArranged] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  function findContainer(cardId: string): string | null {
    if (bank.includes(cardId)) return "bank";
    for (const [dayNum, cards] of Object.entries(dayCards)) {
      if ((cards as string[]).includes(cardId)) return `day-${dayNum}`;
    }
    return null;
  }

  function getCardLocation(cardId: string): string | undefined {
    const info = cardMap[cardId];
    if (!info) return undefined;
    return info.kind === "activity" ? info.activity?.location : info.restaurant?.location;
  }

  // Resolving a card's city does fuzzy string matching against every trip city,
  // so precompute it once per card here rather than re-running it on every
  // getCardCity() call in cityStats/visibleBank/the drag-compatible check.
  const cardCityMap = useMemo<Record<string, string | undefined>>(() => {
    const m: Record<string, string | undefined> = {};
    allCards.forEach((c) => { m[c.cardId] = resolveCardCity(getCardLocation(c.cardId), cities); });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCards, cities]);

  function getCardCity(cardId: string): string | undefined {
    return cardCityMap[cardId];
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const cardId = active.id as string;
    const destId = over.id as string;
    const srcId = findContainer(cardId);
    if (!srcId || srcId === destId) return;

    // Enforce location constraint: card can only go into a day with a matching location
    if (destId !== "bank") {
      const destDayNum = parseInt(destId.replace("day-", ""), 10);
      const destDay = days.find((d) => d.dayNumber === destDayNum);
      const cardCity = getCardCity(cardId);
      if (destDay?.location && cardCity && cardCity !== destDay.location) return;
    }

    // Remove from source
    if (srcId === "bank") {
      setBank((prev) => prev.filter((id) => id !== cardId));
    } else {
      const n = parseInt(srcId.replace("day-", ""), 10);
      setDayCards((prev) => ({ ...prev, [n]: prev[n].filter((id) => id !== cardId) }));
    }

    // Add to destination
    if (destId === "bank") {
      setBank((prev) => [cardId, ...prev]);
    } else {
      const n = parseInt(destId.replace("day-", ""), 10);
      setDayCards((prev) => ({ ...prev, [n]: [...(prev[n] ?? []), cardId] }));
    }
  }

  function removeFromDay(cardId: string, dayNum: number) {
    setDayCards((prev) => ({ ...prev, [dayNum]: prev[dayNum].filter((id) => id !== cardId) }));
    setBank((prev) => [cardId, ...prev]);
  }

  function handleSaveToWanderlog(cardId: string) {
    if (!itinerary) return;
    const info = cardMap[cardId];
    if (!info) return;
    const name = info.kind === "activity" ? info.activity?.name : info.restaurant?.name;
    if (!name) return;
    const description = info.kind === "activity" ? info.activity?.description : info.restaurant?.description;
    addWanderlogItem(itinerary.id, { label: name, source: info.kind, location: getCardLocation(cardId), description });
    setBank((prev) => prev.filter((id) => id !== cardId));
  }

  // "Let ZiGy arrange {city}" only used to handle day-by-day scheduling of
  // already-picked restaurants/activities — it left a hotel gap completely
  // untouched even though the same "Where things stand" panel right above it
  // calls that gap out ("No hotel picked yet"). Fill it in here too, the same
  // way the flights/hotels/restaurants/activities wizard's smart-pick does.
  async function pickHotelIfNeeded(city: string): Promise<void> {
    if (trip.preferences.selectedHotelsByCity?.[city]) return;
    const airbnbOnly = Boolean(
      trip.preferences.lodging?.types?.length && trip.preferences.lodging.types.every((t) => t === "airbnb")
    );
    if (airbnbOnly) return;
    const cityHotels = (itinerary?.hotels ?? []).filter((h) => fuzzyCityMatch(h.city ?? h.location, city));
    if (!cityHotels.length) return;

    const data = await fetchSmartPick({ kind: "hotel", city, preferences: trip.preferences, hotels: cityHotels });
    const pick = data.picks[0];
    const hotel = pick && cityHotels.find((h) => h.id === pick.id);
    if (hotel) setSelectedHotelForCity(city, hotel);
  }

  async function arrangeCity(city: string): Promise<void> {
    const cityDays = days.filter((d) => !d.location || locationsMatch(d.location, city));
    const cityBankIds = bank.filter((id) => {
      const loc = getCardLocation(id);
      return !loc || getCardCity(id) === city;
    });

    const hotelPromise = pickHotelIfNeeded(city);

    if (cityBankIds.length === 0) {
      await hotelPromise;
      return;
    }

    const cityActivities = cityBankIds
      .map((id) => cardMap[id]?.activity)
      .filter((a): a is ActivityOption => Boolean(a));
    const cityRestaurants = cityBankIds
      .map((id) => cardMap[id]?.restaurant)
      .filter((r): r is RestaurantOption => Boolean(r));

    const [data] = await Promise.all([
      fetchSmartPick({
        kind: "schedule",
        city,
        preferences: trip.preferences,
        days: cityDays,
        activities: cityActivities,
        restaurants: cityRestaurants,
      }),
      hotelPromise,
    ]);

    const validDayNums = new Set(cityDays.map((d) => d.dayNumber));
    const toPlace = data.picks.filter(
      (p) => p.dayNumber !== undefined && validDayNums.has(p.dayNumber) && cityBankIds.includes(p.id)
    );

    if (toPlace.length) {
      const placedIds = new Set(toPlace.map((p) => p.id));
      setBank((prev) => prev.filter((id) => !placedIds.has(id)));
      setDayCards((prev) => {
        const next = { ...prev };
        for (const p of toPlace) {
          next[p.dayNumber!] = [...(next[p.dayNumber!] ?? []), p.id];
        }
        return next;
      });
    }
    setArrangeSummaries((prev) => ({ ...prev, [city]: data.summary }));
  }

  async function handleSmartArrange() {
    if (!effectiveCity) return;
    setArranging(true);
    setArrangeError(null);
    setBulkArranged(false);
    try {
      await arrangeCity(effectiveCity);
    } catch (e: unknown) {
      // A real failure (bad API key, network blip) shouldn't look identical
      // to "ZiGy just didn't place anything" — manual drag-and-drop is still
      // there as a fallback either way, but the user deserves to know why.
      setArrangeError(e instanceof Error ? e.message : "ZiGy couldn't arrange this city right now");
    } finally {
      setArranging(false);
    }
  }

  async function handleAutoPlanAll() {
    setArranging(true);
    setArrangeError(null);
    setBulkArranged(true);
    setAutoPlanCities(new Set(cities));
    try {
      const results = await Promise.allSettled(
        cities.map((city) =>
          arrangeCity(city).finally(() => {
            setAutoPlanCities((prev) => {
              const next = new Set(prev);
              next.delete(city);
              return next;
            });
          })
        )
      );
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed.length) {
        const reason = failed[0].reason;
        setArrangeError(reason instanceof Error ? reason.message : "ZiGy couldn't arrange some cities right now");
      }
    } finally {
      setArranging(false);
      setAutoPlanCities(new Set());
    }
  }

  function handleDone() {
    if (itinerary) {
      saveFinalizedPlan(itinerary.id, { dayCards, bankCards: bank });
      // Reaching Refine at all (via the wizard's own "Finish review" or by
      // jumping here directly from ItineraryStep's top-level Continue,
      // which skips the wizard entirely) means the traveller is done
      // reviewing — without this, a traveller who jumped straight here
      // landed back on a wizard restarted from the flights stage instead
      // of the finished itinerary view.
      markItineraryReviewed(itinerary.id);
    }
    goToStep("itinerary");
  }

  if (!itinerary) {
    return (
      <StepShell stepId="refine" continueLabel="Done — view my plan" onContinue={() => goToStep("itinerary")}>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-slate-500 text-sm">No itinerary generated yet.</p>
          <p className="text-xs text-slate-400">Go back to the Itinerary step to generate your plan first.</p>
        </div>
      </StepShell>
    );
  }

  const placedCount = Object.values(dayCards).flat().length;

  // What's already been decided in earlier steps, per city — the point of
  // this summary is to make clear that hotel/restaurant/activity picks
  // aren't starting from scratch here, only day-by-day scheduling is.
  const cityDecisions = cities.map((city) => {
    const hotelName = trip.preferences.selectedHotelsByCity?.[city]?.name;
    const restaurantCount = (itinerary.restaurants ?? []).filter(
      (r) => resolveCardCity(r.location, cities) === city && (trip.preferences.selectedRestaurantIds ?? []).includes(r.id)
    ).length;
    const activityCount = itinerary.activities.filter(
      (a) => resolveCardCity(a.location, cities) === city && (trip.preferences.selectedActivityIds ?? []).includes(a.id)
    ).length;
    const cityDays = days.filter((d) => !d.location || locationsMatch(d.location, city));
    const scheduledDays = cityDays.filter((d) => (dayCards[d.dayNumber] ?? []).length > 0).length;
    return { city, hotelName, restaurantCount, activityCount, totalDays: cityDays.length, scheduledDays };
  });
  const activeCard = activeId ? cardMap[activeId] : null;

  // Scope the board to one city at a time — reduces clutter on multi-city trips
  // and matches the location constraint already enforced on drag-and-drop.
  const visibleDays = effectiveCity
    ? days.filter((d) => !d.location || locationsMatch(d.location, effectiveCity))
    : days;
  const visibleBank = effectiveCity
    ? bank.filter((cardId) => {
        const loc = getCardLocation(cardId);
        return !loc || getCardCity(cardId) === effectiveCity;
      })
    : bank;
  const cityStats = cities.map((city) => {
    const total = allCards.filter((c) => getCardCity(c.cardId) === city).length;
    const unplaced = bank.filter((id) => getCardCity(id) === city).length;
    return { city, total, placed: total - unplaced };
  });

  // Prompt to move on once the active city has some placed items, rather than
  // leaving the user to notice the city tabs on their own — shown even if a
  // few items are still sitting unplaced, since a user who's decided to skip
  // those souldn't be stuck with no nudge to move to the next city.
  // Suppressed once nothing's left unplaced anywhere in the trip (e.g. right
  // after "Let ZiGy schedule every city") — there's nothing left to fine-tune,
  // so nudging through each city's tab just to look at it is pure friction;
  // "Done — view my plan" is the only action left worth surfacing.
  const activeCityStats = effectiveCity ? cityStats.find((s) => s.city === effectiveCity) : undefined;
  const activeCityIdx = effectiveCity ? cities.indexOf(effectiveCity) : -1;
  const nextCity = activeCityIdx >= 0 && activeCityIdx < cities.length - 1 ? cities[activeCityIdx + 1] : null;
  const activeCityComplete = visibleBank.length === 0;
  const showNextCityPrompt = Boolean(
    bank.length > 0 && effectiveCity && nextCity && activeCityStats && activeCityStats.total > 0 && activeCityStats.placed > 0
  );

  return (
    <StepShell
      stepId="refine"
      continueLabel="Done — view my plan"
      onContinue={handleDone}
      subtitle="Here's what's already set — fill in any gaps or fine-tune the schedule below."
    >
      {/* What's already decided, per city — the hotel/restaurant/activity
          picks came from the review wizard, not from scratch here. Gaps are
          called out neutrally: an empty day or no hotel yet might be
          deliberate for travellers who want to keep things loose. */}
      <div className="rounded-xl border border-slate-200 bg-white mb-4 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-700">Where things stand</p>
          {cities.length > 1 && (
            <button
              type="button"
              onClick={handleAutoPlanAll}
              disabled={arranging}
              className="flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700 transition-colors disabled:opacity-60"
            >
              <Sparkles size={11} />
              {arranging
                ? autoPlanCities.size > 0
                  ? `Arranging ${Array.from(autoPlanCities).join(", ")}…`
                  : "Arranging…"
                : "Let ZiGy schedule every city"}
            </button>
          )}
        </div>
        {arrangeError && (
          <div className="flex items-start gap-2 border-b border-red-100 bg-red-50 px-4 py-2">
            <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{arrangeError}</p>
          </div>
        )}
        <div className="divide-y divide-slate-100">
          {cityDecisions.map(({ city, hotelName, restaurantCount, activityCount, totalDays, scheduledDays }) => {
            const allScheduled = totalDays > 0 && scheduledDays === totalDays;
            return (
              <div key={city} className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className="text-xs font-semibold text-slate-800 min-w-[80px]">{city}</p>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Hotel size={11} className={hotelName ? "text-brand-400" : "text-amber-500"} />
                  {hotelName ?? "No hotel picked yet"}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <UtensilsCrossed size={11} className="text-brand-400" />
                  {restaurantCount} restaurant{restaurantCount !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Star size={11} className="text-brand-400" />
                  {activityCount} activit{activityCount !== 1 ? "ies" : "y"}
                </span>
                <span className={`ml-auto flex items-center gap-1 text-[11px] font-medium ${allScheduled ? "text-sage-600" : "text-slate-400"}`}>
                  {allScheduled ? <CheckCircle2 size={11} /> : <CalendarDays size={11} />}
                  {scheduledDays} of {totalDays} day{totalDays !== 1 ? "s" : ""} scheduled
                </span>
              </div>
            );
          })}
        </div>
        <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100">
          An empty day just means nothing's scheduled for it yet — that's fine if you'd rather keep things open. Drag items below to fill it in, or ask ZiGy.
        </p>
      </div>

      {/* Progress hint */}
      <div className="flex items-center justify-between text-xs mb-4">
        <span className="text-slate-500">
          {placedCount} of {allCards.length} items placed
        </span>
        {bank.length > 0 && (
          <span className="text-amber-600 font-medium">{bank.length} unplaced</span>
        )}
      </div>

      {/* City tabs — work through one city at a time on multi-city trips */}
      {cities.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {cityStats.map(({ city, total, placed }) => (
            <button
              key={city}
              type="button"
              onClick={() => setActiveCity(city)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                city === effectiveCity
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {city}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  city === effectiveCity ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {placed}/{total}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Once "Let ZiGy schedule every city" has run, every destination was
          already handled in one shot — a "move on to {nextCity}" nudge would
          misleadingly imply a sequential walk-through the user never asked
          for, so it's replaced with a single trip-wide message instead. */}
      {bulkArranged ? (
        <div className="mb-4 rounded-lg border border-sage-200 bg-sage-50 px-3 py-2.5">
          <p className="text-xs text-sage-700">
            <span className="font-semibold">ZiGy has arranged every city.</span>{" "}
            {bank.length > 0
              ? "A few items didn't fit and are still sitting unplaced below — drag them in if you'd like, or leave them and review your plan whenever you're ready."
              : "Review your plan below, then finalize whenever you're ready."}
          </p>
        </div>
      ) : (
        /* Prompt to move to the next city — always available once you've placed
           something here, not just once every last item is placed, so leaving
           a few items unplaced on purpose doesn't strand you without a nudge. */
        showNextCityPrompt && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-sage-200 bg-sage-50 px-3 py-2.5">
            <p className="text-xs text-sage-700">
              {activeCityComplete ? (
                <><span className="font-semibold">{effectiveCity} is all set!</span> Ready to fine-tune {nextCity}?</>
              ) : (
                <>{effectiveCity} looks good — move on to {nextCity} whenever you're ready.</>
              )}
            </p>
            <button
              type="button"
              onClick={() => setActiveCity(nextCity)}
              className="shrink-0 flex items-center gap-1 rounded-md bg-sage-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-sage-700 transition-colors"
            >
              Next: {nextCity} <ArrowRight size={12} />
            </button>
          </div>
        )
      )}

      {/* Let ZiGy auto-arrange the active city's unplaced items across its days */}
      {effectiveCity && visibleBank.length > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={handleSmartArrange}
            disabled={arranging}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-60"
          >
            <Sparkles size={14} />
            {arranging
              ? "ZiGy is arranging…"
              // Once a summary exists, ZiGy has already had a pass at this
              // city — repeating the exact same "Let ZiGy arrange" prompt
              // reads as if nothing happened, even though some items were
              // placed and only what's left is still sitting in the bank.
              : arrangeSummaries[effectiveCity]
              ? `Ask ZiGy to arrange what's left in ${effectiveCity}`
              : `Let ZiGy arrange ${effectiveCity}`}
          </button>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center">
            ZiGy decides based on your inputs so far and everything we know about your destinations.
          </p>
          {arrangeSummaries[effectiveCity] && (
            <p className="text-xs text-brand-600 bg-brand-50 rounded-lg px-3 py-2 mt-2">
              <Sparkles size={11} className="inline mr-1" />
              {arrangeSummaries[effectiveCity]}
            </p>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-3">

          {/* ── Activity Bank (grouped by location) ── */}
          <div className="sm:w-48 sm:shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
              Available ({visibleBank.length})
            </p>
            <DroppableContainer id="bank" isEmpty={visibleBank.length === 0}>
              {(() => {
                // Group bank cards by location
                const grouped: Record<string, string[]> = {};
                for (const cardId of visibleBank) {
                  const loc = getCardLocation(cardId) ?? "Other";
                  if (!grouped[loc]) grouped[loc] = [];
                  grouped[loc].push(cardId);
                }
                return Object.entries(grouped).map(([loc, ids]) => (
                  <div key={loc}>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-0.5 pt-1 pb-0.5 truncate">{loc}</p>
                    {ids.map((cardId) => {
                      const info = cardMap[cardId];
                      if (!info) return null;
                      return (
                        <DraggableCard
                          key={cardId}
                          info={info}
                          onSave={() => handleSaveToWanderlog(cardId)}
                        />
                      );
                    })}
                  </div>
                ));
              })()}
            </DroppableContainer>
          </div>

          {/* ── Day Columns ── */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {visibleDays.map((day) => {
              const cards = dayCards[day.dayNumber] ?? [];
              return (
                <div
                  key={day.dayNumber}
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                >
                  {/* Day header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-bold">
                      {day.dayNumber}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{day.theme}</p>
                      <p className="text-[10px] text-slate-400">
                        {formatDate(day.date)}{day.location ? ` · ${day.location}` : ""}
                      </p>
                    </div>
                    {cards.length > 0 && (
                      <span className="ml-auto shrink-0 rounded-full bg-brand-100 text-brand-600 text-[10px] font-semibold px-1.5 py-0.5">
                        {cards.length}
                      </span>
                    )}
                  </div>

                  {/* Drop zone */}
                  <div className="p-2">
                    <DroppableContainer
                      id={`day-${day.dayNumber}`}
                      isEmpty={cards.length === 0}
                      compatible={!activeId || !day.location || getCardCity(activeId) === day.location}
                    >
                      {cards.map((cardId) => {
                        const info = cardMap[cardId];
                        if (!info) return null;
                        return (
                          <DraggableCard
                            key={cardId}
                            info={info}
                            onRemove={() => removeFromDay(cardId, day.dayNumber)}
                          />
                        );
                      })}
                    </DroppableContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating drag preview */}
        <DragOverlay dropAnimation={null}>
          {activeCard && (
            <div style={{ transform: "rotate(1.5deg)" }}>
              <CardInner info={activeCard} overlay />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </StepShell>
  );
}
