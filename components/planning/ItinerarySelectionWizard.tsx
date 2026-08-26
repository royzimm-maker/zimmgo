"use client";

import { useEffect, useMemo, useState } from "react";
import { Plane, Hotel, UtensilsCrossed, Star, ArrowLeft, ArrowRight, Sparkles, Search, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTripStore } from "@/lib/store/tripStore";
import { useWanderlogSave } from "@/lib/hooks/useWanderlogSave";
import { useExpandablePreview } from "@/lib/hooks/useExpandablePreview";
import { fetchSmartPick } from "@/lib/api/smartPick";
import { fetchFlightSearch } from "@/lib/api/searchFlights";
import { cn, formatDate, fuzzyCityMatch, scrollStepToTop } from "@/lib/utils";
import {
  Section, FlightPairList, HotelCard, RestaurantCard, ActivityCard,
} from "@/components/planning/ItineraryView";
import type { GeneratedItinerary } from "@/types/trip";

interface Props {
  itinerary: GeneratedItinerary;
  onComplete: () => void;
  // Rebuilds the whole itinerary from the current preferences — passed down
  // from ItineraryStep (which owns the actual fetch/error-handling) so a
  // date edit made here can trigger the same rebuild without navigating
  // away and losing the traveller's place in this wizard.
  onRegenerate: () => void;
}

type Stage = "flights" | "hotels" | "restaurants" | "activities";

// "2026-11" -> "November 2026"
function flexibleMonthLabel(yyyyMm: string): string {
  const [yr, mo] = yyyyMm.split("-").map(Number);
  if (!yr || !mo) return yyyyMm;
  return new Date(yr, mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const RESTAURANT_PREVIEW_COUNT = 3;
const ACTIVITY_PREVIEW_COUNT = 4;

const STAGE_META: Record<Stage, { label: string; icon: React.ReactNode }> = {
  flights:     { label: "Flights",     icon: <Plane size={16} /> },
  hotels:      { label: "Hotels",      icon: <Hotel size={16} /> },
  restaurants: { label: "Restaurants", icon: <UtensilsCrossed size={16} /> },
  activities:  { label: "Activities",  icon: <Star size={16} /> },
};

// One entry in the flattened step list — flights has no city; every other
// stage belongs to exactly one city, so the wizard fully personalizes a
// single location (hotel, then restaurants, then activities) before moving
// to the next one, instead of doing one category across every city at a time.
interface WizardStep {
  stage: Stage;
  city: string | null;
}

export function ItinerarySelectionWizard({ itinerary, onComplete, onRegenerate }: Props) {
  const { trip, setSelectedFlight, setSelectedHotelForCity, toggleSelectedRestaurant, toggleSelectedActivity, setItineraryFlights, setDates, goToStep } = useTripStore();
  const preferences = trip.preferences;

  const [searchingFlights, setSearchingFlights] = useState(false);
  const [flightSearchError, setFlightSearchError] = useState<string | null>(null);

  // The itinerary already resolved a flexible date window into real
  // calendar dates (see buildDays in the generate route — it lands on the
  // 15th of the chosen month and runs for the chosen duration) before any
  // of this wizard ever renders. Locking those in as "exact" just updates
  // the stored preference to match what's already true, so flight search
  // (which needs real dates) can run — it isn't asking the traveller to
  // redo anything they haven't already decided.
  function confirmResolvedDates() {
    if (!itinerary.days.length) return;
    setDates({
      ...preferences.dates,
      type: "exact",
      startDate: itinerary.days[0].date,
      endDate: itinerary.days[itinerary.days.length - 1].date,
    });
  }

  // Inline date adjustment, right here, instead of sending the traveller
  // back to the Dates step — which would mean re-clicking Continue through
  // every step just to return to where they already were.
  const [editingDates, setEditingDates] = useState(false);
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);

  function openDateEditor() {
    setDraftStart(itinerary.days[0]?.date ?? "");
    setDraftEnd(itinerary.days[itinerary.days.length - 1]?.date ?? "");
    setDateError(null);
    setEditingDates(true);
  }

  function saveDatesAndRebuild() {
    if (!draftStart || !draftEnd || draftStart > draftEnd) {
      setDateError("Enter a valid range — the end date needs to be after the start date.");
      return;
    }
    setDates({ ...preferences.dates, type: "exact", startDate: draftStart, endDate: draftEnd });
    setEditingDates(false);
    onRegenerate();
  }

  async function handleSearchFlights() {
    setSearchingFlights(true);
    setFlightSearchError(null);
    try {
      const flights = await fetchFlightSearch(preferences);
      setItineraryFlights(itinerary.id, flights);
    } catch (e: unknown) {
      setFlightSearchError(e instanceof Error ? e.message : "Flight search failed");
    } finally {
      setSearchingFlights(false);
    }
  }

  const { wanderlogLabels, handleSaveToWanderlog } = useWanderlogSave(itinerary);

  // Skip the Hotels stage entirely for Airbnb-only trips — itinerary.hotels
  // still gets populated during generation regardless of lodging type, so
  // without this the wizard showed a hotel-picking stage nobody asked to see.
  const airbnbOnlyLodging = Boolean(
    preferences.lodging?.types?.length && preferences.lodging.types.every((t) => t === "airbnb")
  );

  const cities = useMemo(() => {
    const c = preferences.destination?.cities?.filter(Boolean) ?? [];
    return c.length ? c : [preferences.destination?.displayName ?? "Your destination"];
  }, [preferences.destination]);

  const perCityStages = useMemo<Stage[]>(
    () => (airbnbOnlyLodging ? ["restaurants", "activities"] : ["hotels", "restaurants", "activities"]),
    [airbnbOnlyLodging]
  );

  const steps = useMemo<WizardStep[]>(() => {
    // Road trips / other no-flight itineraries skip the flights review
    // entirely — there's nothing to search or select.
    const list: WizardStep[] = preferences.noFlightsNeeded ? [] : [{ stage: "flights", city: null }];
    for (const city of cities) {
      for (const stage of perCityStages) list.push({ stage, city });
    }
    return list;
  }, [cities, perCityStages, preferences.noFlightsNeeded]);

  const [stepIdx, setStepIdx] = useState(0);

  // This wizard advances between stages/cities via internal state, not by
  // mounting a new component, so the page doesn't scroll back to the top on
  // its own the way a fresh step normally does.
  useEffect(() => {
    scrollStepToTop();
  }, [stepIdx]);
  const [pickingHotel, setPickingHotel] = useState(false);
  const [hotelPickReasons, setHotelPickReasons] = useState<Record<string, string>>({});
  const [hotelPickError, setHotelPickError] = useState<string | null>(null);
  const [pickingActivities, setPickingActivities] = useState(false);
  const [activityPickReasons, setActivityPickReasons] = useState<Record<string, string>>({});
  const [activityPickError, setActivityPickError] = useState<string | null>(null);

  const step = steps[stepIdx];
  const stage = step.stage;
  const currentCity = step.city ?? cities[0];

  // Auto-run the same search a user would otherwise have to click "Search
  // for flights" to trigger, whenever the itinerary landed here with none
  // (e.g. the AI's search_flights call came back empty). Only fires once per
  // itinerary — a failed attempt leaves flightSearchError set, which blocks
  // re-firing so it doesn't retry-loop against a real backend error.
  const [autoSearchedFlightsFor, setAutoSearchedFlightsFor] = useState<string | null>(null);
  useEffect(() => {
    if (stage !== "flights") return;
    if (itinerary.flights.length > 0) return;
    if (autoSearchedFlightsFor === itinerary.id) return;
    if (searchingFlights || flightSearchError) return;
    const dates = preferences.dates;
    if (dates?.type !== "exact" || !dates.startDate || !dates.endDate || dates.skipFlightSearch) return;
    if (!preferences.destination?.departureAirport || !preferences.destination?.arrivalAirport) return;

    setAutoSearchedFlightsFor(itinerary.id);
    handleSearchFlights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, itinerary.id, itinerary.flights.length, preferences.dates, preferences.destination]);

  const canGoBack = stepIdx > 0;

  // Consecutive steps sharing a city (or the leading flights step) clustered
  // together, so the progress bar visually groups by destination instead of
  // reading as one flat, undifferentiated row of ticks.
  const stepGroups = useMemo(() => {
    const groups: { key: string; idxs: number[] }[] = [];
    steps.forEach((s, i) => {
      const key = s.city ?? "__flights__";
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.idxs.push(i);
      else groups.push({ key, idxs: [i] });
    });
    return groups;
  }, [steps]);

  const cityStepIdxsCurrent = steps.reduce<number[]>((acc, s, idx) => (s.city === currentCity ? [...acc, idx] : acc), []);
  const cityStagePosition = cityStepIdxsCurrent.indexOf(stepIdx) + 1;
  const cityStageTotal = cityStepIdxsCurrent.length;

  function goNext() {
    if (stepIdx < steps.length - 1) {
      setStepIdx((i) => i + 1);
      return;
    }
    onComplete();
  }

  function goBack() {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  }

  const hotelsForCity = useMemo(
    () => itinerary.hotels.filter((h) => fuzzyCityMatch(h.city ?? h.location, currentCity)),
    [itinerary.hotels, currentCity]
  );

  async function handleSmartPickHotel() {
    setPickingHotel(true);
    setHotelPickError(null);
    try {
      const data = await fetchSmartPick({ kind: "hotel", city: currentCity, preferences, hotels: hotelsForCity });
      const pick = data.picks[0];
      const hotel = pick && hotelsForCity.find((h) => h.id === pick.id);
      if (hotel) {
        setSelectedHotelForCity(currentCity, hotel);
        setHotelPickReasons((prev) => ({ ...prev, [currentCity]: pick.reason }));
      }
    } catch (e: unknown) {
      // A real failure (bad API key, network blip) shouldn't look identical
      // to "ZiGy picked nothing" — the picker UI is still there as a fallback
      // either way, but the user deserves to know why.
      setHotelPickError(e instanceof Error ? e.message : "ZiGy couldn't pick a hotel right now");
    } finally {
      setPickingHotel(false);
    }
  }

  // The Lodging step's own "Let ZiGy choose for me" only ever searches and
  // picks a hotel for the trip's primary city — it has no way to know about
  // the other stops in a multi-city trip. Honor that same choice here for
  // every city (including the primary one, which also never got a pick
  // written into selectedHotelsByCity) by auto-running the same per-city
  // smart pick a user would otherwise have to click "Let ZiGy choose the
  // hotel for {city}" to trigger themselves. A city the traveller already
  // picked for (manually or via a previous auto-pick) is left alone, and a
  // failed attempt isn't retried — it just falls back to the manual picker.
  const [autoPickedHotelFor, setAutoPickedHotelFor] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (stage !== "hotels") return;
    if (!preferences.autoPickHotels) return;
    if (preferences.selectedHotelsByCity?.[currentCity]) return;
    if (autoPickedHotelFor.has(currentCity)) return;
    if (pickingHotel || hotelsForCity.length === 0) return;

    setAutoPickedHotelFor((prev) => new Set(prev).add(currentCity));
    handleSmartPickHotel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentCity, preferences.autoPickHotels, preferences.selectedHotelsByCity, hotelsForCity, pickingHotel]);
  async function handleSmartPickActivities() {
    setPickingActivities(true);
    setActivityPickError(null);
    try {
      const data = await fetchSmartPick({ kind: "activities_for_city", city: currentCity, preferences, activities: activitiesForCity });
      for (const pick of data.picks) {
        if (!(preferences.selectedActivityIds ?? []).includes(pick.id)) toggleSelectedActivity(pick.id);
      }
      setActivityPickReasons((prev) => ({ ...prev, [currentCity]: data.summary }));
    } catch (e: unknown) {
      setActivityPickError(e instanceof Error ? e.message : "ZiGy couldn't pick activities right now");
    } finally {
      setPickingActivities(false);
    }
  }

  // Highest-rated first, so capping to the preview count always surfaces the best options.
  const restaurantsForCity = useMemo(
    () => (itinerary.restaurants ?? [])
      .filter((r) => fuzzyCityMatch(r.location, currentCity))
      .sort((a, b) => b.rating - a.rating),
    [itinerary.restaurants, currentCity]
  );
  const {
    visible: visibleRestaurants,
    hasMore: hasMoreRestaurants,
    expanded: restaurantsExpanded,
    expand: expandRestaurants,
  } = useExpandablePreview(restaurantsForCity, RESTAURANT_PREVIEW_COUNT, currentCity);

  const activitiesForCity = useMemo(
    () => itinerary.activities
      .filter((a) => fuzzyCityMatch(a.location, currentCity))
      .sort((a, b) => b.rating - a.rating),
    [itinerary.activities, currentCity]
  );
  const {
    visible: visibleActivities,
    hasMore: hasMoreActivities,
    expanded: activitiesExpanded,
    expand: expandActivities,
  } = useExpandablePreview(activitiesForCity, ACTIVITY_PREVIEW_COUNT, currentCity);

  // Since a city's hotel/restaurants/activities are now reviewed back-to-back,
  // this recap shows what's already locked in for this city as you move
  // through its later stages (e.g. the hotel you just picked, visible while
  // you're now looking at restaurants).
  const cityRecap = useMemo(() => {
    const hotel = preferences.selectedHotelsByCity?.[currentCity]?.name;
    const restaurantCount = (itinerary.restaurants ?? [])
      .filter((r) => fuzzyCityMatch(r.location, currentCity) && (preferences.selectedRestaurantIds ?? []).includes(r.id))
      .length;
    const activityCount = itinerary.activities
      .filter((a) => fuzzyCityMatch(a.location, currentCity) && (preferences.selectedActivityIds ?? []).includes(a.id))
      .length;
    return { hotel, restaurantCount, activityCount };
  }, [currentCity, itinerary.restaurants, itinerary.activities, preferences.selectedHotelsByCity, preferences.selectedRestaurantIds, preferences.selectedActivityIds]);

  const sectionTitle = stage === "flights" ? "Flights" : `${STAGE_META[stage].label} — ${currentCity}`;
  const sectionSubtitle = stage === "flights"
    ? "Select your preferred option — prices are roundtrip per person, estimated."
    : stage === "hotels"
    ? "Tap a hotel to pick it for this city — you can change it later."
    : "Tap \"Add\" to include a pick in your plan — the bookmark saves it to your Wanderlog instead, without scheduling it.";

  // What "Continue" advances to, so it reads as "move to the next thing in
  // this picks review" rather than looking like the page-level navigation
  // (Back / Skip / Personalize) that sits right below this wizard.
  const nextStep = steps[stepIdx + 1];
  const isLastStep = !nextStep;
  const nextLabel = isLastStep
    ? "Finish review"
    : nextStep.city !== step.city
    ? `Continue to ${nextStep.city}`
    : `Continue to ${STAGE_META[nextStep.stage].label} in ${nextStep.city}`;

  return (
    <div className="flex flex-col gap-5">
      {/* Progress header */}
      <div>
        {/* City breadcrumb — which destinations are fully reviewed, which is
            current, and which are still ahead. Completed cities jump back to
            re-check picks; upcoming ones aren't clickable yet since their
            content hasn't been reached. */}
        {cities.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 mb-2.5">
            {cities.map((city, i) => {
              const cityStepIdxs = steps.reduce<number[]>((acc, s, idx) => (s.city === city ? [...acc, idx] : acc), []);
              const cityFirstIdx = cityStepIdxs[0];
              const cityLastIdx = cityStepIdxs[cityStepIdxs.length - 1];
              const isDone = stepIdx > cityLastIdx;
              const isCurrent = stepIdx >= cityFirstIdx && stepIdx <= cityLastIdx;
              const isVisited = stepIdx >= cityFirstIdx;
              return (
                <div key={city} className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={!isVisited || isCurrent}
                    onClick={() => setStepIdx(cityFirstIdx)}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                      isDone
                        ? "bg-sage-50 text-sage-700 hover:bg-sage-100"
                        : isCurrent
                        ? "bg-brand-500 text-white"
                        : "bg-slate-100 text-slate-400"
                    )}
                  >
                    {isDone && <Check size={10} />}
                    {city}
                  </button>
                  {i < cities.length - 1 && <ArrowRight size={9} className="text-slate-300 shrink-0" />}
                </div>
              );
            })}
          </div>
        )}

        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-500">
          {stage === "flights" ? "Flights" : `${currentCity} — step ${cityStagePosition} of ${cityStageTotal}`}
        </p>
        <div className="flex items-center gap-2.5">
          {stepGroups.map((g) => (
            <div key={g.key} className="flex flex-1 gap-1.5">
              {g.idxs.map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < stepIdx ? "bg-brand-500" : i === stepIdx ? "bg-brand-300" : "bg-slate-100"
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
        {stage !== "flights" && (cityRecap.hotel || cityRecap.restaurantCount > 0 || cityRecap.activityCount > 0) && (
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-400">So far in {currentCity}:</span>
            {cityRecap.hotel && (
              <span className="inline-flex items-center gap-1"><Hotel size={11} className="text-brand-400" /> {cityRecap.hotel}</span>
            )}
            {cityRecap.restaurantCount > 0 && (
              <span className="inline-flex items-center gap-1"><UtensilsCrossed size={11} className="text-brand-400" /> {cityRecap.restaurantCount} restaurant{cityRecap.restaurantCount !== 1 ? "s" : ""}</span>
            )}
            {cityRecap.activityCount > 0 && (
              <span className="inline-flex items-center gap-1"><Star size={11} className="text-brand-400" /> {cityRecap.activityCount} activit{cityRecap.activityCount !== 1 ? "ies" : "y"}</span>
            )}
          </p>
        )}
      </div>

      {/* Stage content */}
      <Section title={sectionTitle} icon={STAGE_META[stage].icon} subtitle={sectionSubtitle}>
        {stage === "flights" && (
          itinerary.flights.length > 0 ? (
            <FlightPairList
              flights={itinerary.flights}
              arrivalAirport={preferences.destination?.arrivalAirport ?? ""}
              selectedFlightId={preferences.selectedFlight?.id}
              onSelect={(f) => setSelectedFlight(preferences.selectedFlight?.id === f.id ? null : f)}
            />
          ) : preferences.dates?.type === "exact" && preferences.dates.skipFlightSearch ? (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-6 text-center">
              <p className="text-sm text-amber-800">Flight search was skipped for this trip.</p>
              <p className="text-xs text-amber-700 mt-1">
                Your dates are further out than airlines typically open bookings for — but you can search now anyway if you'd like.
              </p>
              <SearchFlightsButton
                onClick={handleSearchFlights}
                loading={searchingFlights}
                disabled={!preferences.destination?.departureAirport || !preferences.destination?.arrivalAirport}
                error={flightSearchError}
              />
            </div>
          ) : preferences.dates?.type !== "exact" ? (
            <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/50 px-4 py-6 text-center">
              {editingDates ? (
                <>
                  <p className="text-sm font-medium text-slate-700 mb-3">Adjust your travel dates</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
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
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingDates(false)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveDatesAndRebuild}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                    >
                      <Check size={14} />
                      Save & rebuild
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-700">
                    ZiGy landed on {formatDate(itinerary.days[0]?.date)} – {formatDate(itinerary.days[itinerary.days.length - 1]?.date)}
                    {preferences.dates?.flexibleMonth ? ` for your flexible ${flexibleMonthLabel(preferences.dates.flexibleMonth)} window.` : "."}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Confirm these dates to search real flight options, or adjust them first if they don&apos;t work.
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={openDateEditor}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Adjust dates
                    </button>
                    <button
                      type="button"
                      onClick={confirmResolvedDates}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                    >
                      <Check size={14} />
                      Confirm these dates
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : preferences.destination?.departureAirport && preferences.destination?.arrivalAirport ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
              <p className="text-sm text-slate-500">
                {searchingFlights ? "Searching for flights…" : "No specific flight options found yet."}
              </p>
              <p className="text-xs text-slate-400 mt-1">Ask ZiGy in the chat panel for suggestions, or search again below.</p>
              <SearchFlightsButton onClick={handleSearchFlights} loading={searchingFlights} error={flightSearchError} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
              <p className="text-sm text-slate-500">Flight search needs a departure airport.</p>
              <p className="text-xs text-slate-400 mt-1">
                You haven't set where you're flying from yet — add it on the Flights step to see options here.
              </p>
              <button
                type="button"
                onClick={() => goToStep("airlines")}
                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors"
              >
                <ArrowLeft size={14} />
                Go to Flights
              </button>
            </div>
          )
        )}

        {stage === "hotels" && (
          hotelsForCity.length > 0 ? (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleSmartPickHotel}
                disabled={pickingHotel}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-60"
              >
                <Sparkles size={14} />
                {pickingHotel
                  ? "ZiGy is choosing…"
                  : hotelPickReasons[currentCity]
                  ? "Ask ZiGy to pick a different hotel"
                  : `Let ZiGy choose the hotel for ${currentCity}`}
              </button>
              {hotelPickReasons[currentCity] && !pickingHotel && (
                <p className="-mt-2 text-[11px] text-slate-400 text-center">
                  This swaps your current hotel below for a new ZiGy pick — you can still change it manually after.
                </p>
              )}
              {hotelPickError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 -mt-1">
                  <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{hotelPickError}</p>
                </div>
              )}
              {hotelPickReasons[currentCity] && (
                <div className="rounded-lg bg-brand-50 px-3 py-2 -mt-1">
                  <p className="text-xs text-brand-600">
                    <Sparkles size={11} className="inline mr-1" />
                    {hotelPickReasons[currentCity]}
                  </p>
                  <p className="mt-1 text-[10px] text-brand-400">
                    Nothing's locked in — tweak away below!
                  </p>
                </div>
              )}
              {hotelsForCity.map((h) => {
                const selected = preferences.selectedHotelsByCity?.[currentCity]?.id === h.id;
                return (
                  <HotelCard
                    key={h.id}
                    hotel={h}
                    selected={selected}
                    onSelect={() => setSelectedHotelForCity(currentCity, selected ? null : h)}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState label={`hotels for ${currentCity}`} />
          )
        )}

        {stage === "restaurants" && (
          restaurantsForCity.length > 0 ? (
            <div className="flex flex-col gap-3">
              {visibleRestaurants.map((r) => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  saved={wanderlogLabels.has(r.name)}
                  onSave={() => handleSaveToWanderlog(r.name, "restaurant", r.location, r.description)}
                  selected={(preferences.selectedRestaurantIds ?? []).includes(r.id)}
                  onSelect={() => toggleSelectedRestaurant(r.id)}
                />
              ))}
              {hasMoreRestaurants && !restaurantsExpanded && (
                <button
                  type="button"
                  onClick={expandRestaurants}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors"
                >
                  <Sparkles size={14} />
                  Ask ZiGy for more restaurants in {currentCity}
                </button>
              )}
            </div>
          ) : (
            <EmptyState label={`restaurants for ${currentCity}`} />
          )
        )}

        {stage === "activities" && (
          activitiesForCity.length > 0 ? (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleSmartPickActivities}
                disabled={pickingActivities}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-60"
              >
                <Sparkles size={14} />
                {pickingActivities
                  ? "ZiGy is choosing…"
                  : activityPickReasons[currentCity]
                  ? "Ask ZiGy for more picks"
                  : `Let ZiGy choose activities for ${currentCity}`}
              </button>
              {activityPickReasons[currentCity] && !pickingActivities && (
                <p className="-mt-2 text-[11px] text-slate-400 text-center">
                  This adds more ZiGy picks on top of what's already selected below — it won't remove anything.
                </p>
              )}
              {activityPickError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 -mt-1">
                  <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{activityPickError}</p>
                </div>
              )}
              {activityPickReasons[currentCity] && (
                <div className="rounded-lg bg-brand-50 px-3 py-2 -mt-1">
                  <p className="text-xs text-brand-600">
                    <Sparkles size={11} className="inline mr-1" />
                    {activityPickReasons[currentCity]}
                  </p>
                  <p className="mt-1 text-[10px] text-brand-400">
                    Nothing's locked in — tweak away below!
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleActivities.map((a) => (
                  <ActivityCard
                    key={a.id}
                    activity={a}
                    saved={wanderlogLabels.has(a.name)}
                    onSave={() => handleSaveToWanderlog(a.name, "activity", a.location, a.description)}
                    selected={(preferences.selectedActivityIds ?? []).includes(a.id)}
                    onSelect={() => toggleSelectedActivity(a.id)}
                  />
                ))}
              </div>
              {hasMoreActivities && !activitiesExpanded && (
                <button
                  type="button"
                  onClick={expandActivities}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors"
                >
                  <Sparkles size={14} />
                  Show more activities in {currentCity}
                </button>
              )}
            </div>
          ) : (
            <EmptyState label={`activities for ${currentCity}`} />
          )
        )}
      </Section>

      {/* Navigation — deliberately "outline" rather than "primary" so this
          in-wizard nav doesn't visually match the solid-blue page-level
          Back/Skip/Personalize bar that sits directly below it. */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <Button variant="ghost" size="sm" onClick={goBack} disabled={!canGoBack} className="text-slate-500">
          <ArrowLeft size={14} />
          Back
        </Button>
        <Button variant="outline" size="sm" onClick={goNext}>
          {nextLabel}
          <ArrowRight size={14} />
        </Button>
      </div>

      {/* Reassurance: skipping this review doesn't hold back personalization —
          it only leaves the flight/hotel shown in the summary as ZiGy's
          default pick instead of one you chose. */}
      <p className="text-xs text-slate-400 -mt-2 text-center">
        You can jump ahead any time — ZiGy can make these picks for you based on your trip
        preferences and the best each destination has to offer, and you can always change them later.
      </p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
      <p className="text-sm text-slate-500">No specific {label} found yet.</p>
      <p className="text-xs text-slate-400 mt-1">Ask ZiGy in the chat panel for suggestions — you can move on for now.</p>
    </div>
  );
}

function SearchFlightsButton({
  onClick,
  loading,
  disabled = false,
  error,
}: {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
  error: string | null;
}) {
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onClick}
        disabled={loading || disabled}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-60"
      >
        <Search size={14} />
        {loading ? "Searching…" : "Search for flights"}
      </button>
      {disabled && !loading && (
        <p className="text-[11px] text-slate-400 mt-1.5">
          Set a departure airport on the Flights step first.
        </p>
      )}
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
