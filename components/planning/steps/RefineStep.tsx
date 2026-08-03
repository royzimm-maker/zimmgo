"use client";

import { useState, useMemo } from "react";
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
import { X, Sparkles, BookMarked, ArrowRight } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { ChooseModePrompt } from "@/components/planning/ChooseModePrompt";
import { fetchSmartPick } from "@/lib/api/smartPick";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import type { ActivityOption, RestaurantOption } from "@/types/trip";

// ─── Emoji lookups ────────────────────────────────────────────────────────────

const ACTIVITY_EMOJI: Record<string, string> = {
  skiing: "⛷️", hiking: "🥾", sailing: "⛵", food: "🍽️", diving: "🤿",
  cycling: "🚴", cultural: "🏛️", photography: "📸", wellness: "🧘",
  adventure: "🧗", guided_walking_tour: "🚶", guided_food_tour: "🍜",
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
            {activity.price > 0 && <span>{formatCurrency(activity.price)}</span>}
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
            <BookMarked size={12} />
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
            <BookMarked size={12} />
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
  const { trip, goToStep, saveFinalizedPlan, addWanderlogItem } = useTripStore();
  const itinerary = trip.itineraries[trip.itineraries.length - 1] ?? null;

  const activities = useMemo<ActivityOption[]>(
    () => itinerary?.activities ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itinerary?.id]
  );
  const restaurants = useMemo<RestaurantOption[]>(
    () => itinerary?.restaurants ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itinerary?.id]
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
  const [autoPlanCities, setAutoPlanCities] = useState<Set<string>>(new Set());
  // Returning users who already personalized skip straight to the board
  const [mode, setMode] = useState<"prompt" | "manual">(() => (itinerary?.finalizedPlan ? "manual" : "prompt"));

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
      const cardLoc = getCardLocation(cardId);
      if (destDay?.location && cardLoc && !locationsMatch(cardLoc, destDay.location)) return;
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
    addWanderlogItem(itinerary.id, { label: name, source: info.kind, location: getCardLocation(cardId) });
    setBank((prev) => prev.filter((id) => id !== cardId));
  }

  async function arrangeCity(city: string): Promise<void> {
    const cityDays = days.filter((d) => !d.location || locationsMatch(d.location, city));
    const cityBankIds = bank.filter((id) => {
      const loc = getCardLocation(id);
      return !loc || locationsMatch(loc, city);
    });
    if (cityBankIds.length === 0) return;

    const cityActivities = cityBankIds
      .map((id) => cardMap[id]?.activity)
      .filter((a): a is ActivityOption => Boolean(a));
    const cityRestaurants = cityBankIds
      .map((id) => cardMap[id]?.restaurant)
      .filter((r): r is RestaurantOption => Boolean(r));

    const data = await fetchSmartPick({
      kind: "schedule",
      city,
      preferences: trip.preferences,
      days: cityDays,
      activities: cityActivities,
      restaurants: cityRestaurants,
    });

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
    try {
      await arrangeCity(effectiveCity);
    } catch {
      // Silently fail — manual drag-and-drop still works
    } finally {
      setArranging(false);
    }
  }

  async function handleAutoPlanAll() {
    setArranging(true);
    setAutoPlanCities(new Set(cities));
    try {
      await Promise.allSettled(
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
    } finally {
      setArranging(false);
      setAutoPlanCities(new Set());
      setMode("manual");
    }
  }

  function handleDone() {
    if (itinerary) {
      saveFinalizedPlan(itinerary.id, { dayCards, bankCards: bank });
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

  if (mode === "prompt") {
    return (
      <StepShell
        stepId="refine"
        continueLabel="I'll build it myself"
        onContinue={() => { setMode("manual"); return false; }}
        subtitle="How do you want to personalize your plan?"
      >
        <ChooseModePrompt
          manualLabel="I'll build it myself"
          manualDescription="Drag activities and restaurants onto each day yourself, one city at a time."
          zigyLabel="Let ZiGy plan it for me"
          zigyLoadingLabel={
            autoPlanCities.size > 0
              ? `ZiGy is arranging — ${Array.from(autoPlanCities).join(", ")}…`
              : "ZiGy is arranging…"
          }
          zigyDescription="ZiGy sequences every city's activities and restaurants across the days — you can still review and adjust anything after."
          onManual={() => setMode("manual")}
          onZigy={handleAutoPlanAll}
          loading={arranging}
        />
      </StepShell>
    );
  }

  const placedCount = Object.values(dayCards).flat().length;
  const activeCard = activeId ? cardMap[activeId] : null;

  // Scope the board to one city at a time — reduces clutter on multi-city trips
  // and matches the location constraint already enforced on drag-and-drop.
  const visibleDays = effectiveCity
    ? days.filter((d) => !d.location || locationsMatch(d.location, effectiveCity))
    : days;
  const visibleBank = effectiveCity
    ? bank.filter((cardId) => {
        const loc = getCardLocation(cardId);
        return !loc || locationsMatch(loc, effectiveCity);
      })
    : bank;
  const cityStats = cities.map((city) => {
    const total = allCards.filter((c) => locationsMatch(getCardLocation(c.cardId), city)).length;
    const unplaced = bank.filter((id) => locationsMatch(getCardLocation(id), city)).length;
    return { city, total, placed: total - unplaced };
  });

  // Prompt to move on once the active city's bank is empty, rather than leaving
  // the user to notice the city tabs on their own.
  const activeCityStats = effectiveCity ? cityStats.find((s) => s.city === effectiveCity) : undefined;
  const activeCityIdx = effectiveCity ? cities.indexOf(effectiveCity) : -1;
  const nextCity = activeCityIdx >= 0 && activeCityIdx < cities.length - 1 ? cities[activeCityIdx + 1] : null;
  const showNextCityPrompt = Boolean(
    effectiveCity && nextCity && activeCityStats && activeCityStats.total > 0 && visibleBank.length === 0
  );

  return (
    <StepShell
      stepId="refine"
      continueLabel="Done — view my plan"
      onContinue={handleDone}
      subtitle="Drag activities and restaurants onto each day to personalize your plan."
    >
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

      {/* Prompt to move to the next city once this one's items are all placed */}
      {showNextCityPrompt && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-sage-200 bg-sage-50 px-3 py-2.5">
          <p className="text-xs text-sage-700">
            <span className="font-semibold">{effectiveCity} is all set!</span> Ready to personalize {nextCity}?
          </p>
          <button
            type="button"
            onClick={() => setActiveCity(nextCity)}
            className="shrink-0 flex items-center gap-1 rounded-md bg-sage-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-sage-700 transition-colors"
          >
            Next: {nextCity} <ArrowRight size={12} />
          </button>
        </div>
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
            {arranging ? "ZiGy is arranging…" : `Let ZiGy arrange ${effectiveCity}`}
          </button>
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
                      compatible={!activeId || !day.location || locationsMatch(getCardLocation(activeId), day.location)}
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
