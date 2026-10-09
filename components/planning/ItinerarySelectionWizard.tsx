"use client";

import { useEffect, useMemo, useState } from "react";
import { Plane, Hotel, UtensilsCrossed, Star, ArrowLeft, ArrowRight, Sparkles, Search, AlertCircle, Check, Ship } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTripStore } from "@/lib/store/tripStore";
import { useWanderlogSave } from "@/lib/hooks/useWanderlogSave";
import { useExpandablePreview } from "@/lib/hooks/useExpandablePreview";
import { fetchSmartPick } from "@/lib/client/smartPick";
import { chooseActivities, chooseHotel, chooseRestaurants, isAirbnbOnly } from "@/lib/planning/cityPicks";
import { selectionsOf } from "@/lib/planning/selections";
import { fetchFlightSearch } from "@/lib/client/searchFlights";
import { fetchGroundTransport } from "@/lib/client/searchGroundTransport";
import { cn, formatDate, scrollStepToTop } from "@/lib/utils";
import { itineraryCities } from "@/lib/location";
import { useAsyncTask, useCityPick } from "@/lib/hooks/useAsyncTask";
import {
  STAGE_LABELS, buildWizardSteps, cityOptions, cityRecap as recapFor, groupStepsByCity, nextStepLabel, stepIdxsForCity, type Stage,
} from "@/lib/planning/wizardSteps";
import { arrangedLodgingCities } from "@/lib/planning/route";
import { noFlightsToPlan } from "@/types/trip";
import {
  Section, FlightPairList, HotelCard, RestaurantCard, ActivityCard, TransportCard,
} from "@/components/planning/ItineraryCards";
import type { GeneratedItinerary, TransportOption } from "@/types/trip";

interface Props {
  itinerary: GeneratedItinerary;
  onComplete: () => void;
  // Rebuilds the whole itinerary from the current preferences — passed down
  // from ItineraryStep (which owns the actual fetch/error-handling) so a
  // date edit made here can trigger the same rebuild without navigating
  // away and losing the traveller's place in this wizard.
  onRegenerate: () => void;
  // Lets ItineraryStep know which step the wizard is on — used to show the
  // visa requirements box only on the first step (flights) rather than
  // pinned above every hotel/restaurant/activity screen the traveller
  // clicks through afterward.
  onStepChange?: (stepIdx: number) => void;
}

// "2026-11" -> "November 2026"
function flexibleMonthLabel(yyyyMm: string): string {
  const [yr, mo] = yyyyMm.split("-").map(Number);
  if (!yr || !mo) return yyyyMm;
  return new Date(yr, mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const RESTAURANT_PREVIEW_COUNT = 3;
const ACTIVITY_PREVIEW_COUNT = 4;

const STAGE_ICONS: Record<Stage, React.ReactNode> = {
  flights:     <Plane size={16} />,
  transport:   <Ship size={16} />,
  hotels:      <Hotel size={16} />,
  restaurants: <UtensilsCrossed size={16} />,
  activities:  <Star size={16} />,
};

// The review UI. What it walks through and what each city offers live in
// lib/planning/wizardSteps.ts; the picks themselves in lib/planning/cityPicks.ts.
export function ItinerarySelectionWizard({ itinerary, onComplete, onRegenerate, onStepChange }: Props) {
  const { trip, setSelectedFlight, setSelectedTransportForLeg, setSelectedHotelForCity, toggleSelectedRestaurant, toggleSelectedActivity, setItineraryFlights, setDates, goToStep } = useTripStore();
  const preferences = trip.preferences;
  // The traveller's choices from this itinerary (lib/planning/selections.ts),
  // read from the store's copy so a pick shows the moment it's made.
  const chosen = selectionsOf(trip.itineraries.find((i) => i.id === itinerary.id) ?? itinerary);

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

  const flightSearch = useAsyncTask("Flight search failed");
  const searchingFlights = flightSearch.running;
  const flightSearchError = flightSearch.error;
  function handleSearchFlights() {
    return flightSearch.run(async () => setItineraryFlights(itinerary.id, await fetchFlightSearch(preferences)));
  }

  const { wanderlogLabels, handleSaveToWanderlog } = useWanderlogSave(itinerary);

  // The cities this itinerary was planned for — the keys picks are stored
  // under, shared with the Refine step and auto-plan (lib/location.ts). A
  // city the itinerary gave no days isn't reviewed.
  const cities = useMemo(() => {
    const c = itineraryCities(itinerary, preferences.destination);
    return c.length ? c : ["Your destination"];
  }, [itinerary, preferences.destination]);

  const airbnbOnly = isAirbnbOnly(preferences.lodging?.types);
  const steps = useMemo(
    () => buildWizardSteps(cities, { airbnbOnly, noFlights: noFlightsToPlan(preferences), arrangedLodging: arrangedLodgingCities(preferences) }),
    [cities, airbnbOnly, preferences]
  );
  const stepGroups = useMemo(() => groupStepsByCity(steps), [steps]);

  const [stepIdx, setStepIdx] = useState(0);

  // This wizard advances between stages/cities via internal state, not by
  // mounting a new component, so the page doesn't scroll back to the top on
  // its own the way a fresh step normally does.
  useEffect(() => {
    scrollStepToTop();
    onStepChange?.(stepIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

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
  const cityStepIdxsCurrent = stepIdxsForCity(steps, currentCity);
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

  const options = useMemo(() => cityOptions(itinerary, cities, currentCity), [itinerary, cities, currentCity]);
  const hotelsForCity = options.hotels;
  const restaurantsForCity = options.restaurants;
  const activitiesForCity = options.activities;
  const cityRecap = recapFor(itinerary, cities, currentCity, chosen);

  // The "transport" stage is keyed by the arriving city; the departing city
  // is the one before it in the trip's ordered city list.
  const transportFromCity = stage === "transport" ? cities[cities.indexOf(currentCity) - 1] ?? null : null;

  // Manual fallback for a leg generation didn't produce any options for.
  const transportSearch = useAsyncTask("Ground transport search failed");
  const searchingTransport = transportSearch.running;
  const transportSearchError = transportSearch.error;
  const [manualTransportResults, setManualTransportResults] = useState<TransportOption[]>([]);
  function handleSearchTransport() {
    if (!transportFromCity) return;
    const date = itinerary.days.find((d) => d.location === currentCity)?.date ?? itinerary.days[0]?.date ?? "";
    return transportSearch.run(async () => setManualTransportResults(await fetchGroundTransport(transportFromCity, currentCity, date, preferences)));
  }
  const displayedTransportOptions = options.transport.length ? options.transport : manualTransportResults;

  // The traveller's (or ZimmGo's) current pick for this city shown first —
  // otherwise it can land anywhere in the raw search-result order.
  const pickedHotelId = chosen.hotelsByCity?.[currentCity]?.id;
  const displayHotels = useMemo(() => {
    const picked = hotelsForCity.find((h) => h.id === pickedHotelId);
    return picked ? [picked, ...hotelsForCity.filter((h) => h.id !== pickedHotelId)] : hotelsForCity;
  }, [hotelsForCity, pickedHotelId]);

  // ZimmGo's picks for the current city. Only options offered for this city
  // can be picked (checked in lib/planning/cityPicks.ts).
  const hotelPick = useCityPick("ZimmGo couldn't pick a hotel right now");
  const activityPick = useCityPick("ZimmGo couldn't pick activities right now");
  const restaurantPick = useCityPick("ZimmGo couldn't pick restaurants right now");
  const [pickingHotel, hotelPickReasons, hotelPickError] = [hotelPick.running, hotelPick.reasons, hotelPick.error];
  const [pickingActivities, activityPickReasons, activityPickError] = [activityPick.running, activityPick.reasons, activityPick.error];
  const [pickingRestaurants, restaurantPickReasons, restaurantPickError] = [restaurantPick.running, restaurantPick.reasons, restaurantPick.error];

  function handleSmartPickHotel() {
    const city = currentCity;
    return hotelPick.run(city, async () => {
      const choice = await chooseHotel(fetchSmartPick, city, preferences, hotelsForCity);
      if (!choice) return undefined;
      setSelectedHotelForCity(city, choice.hotel);
      return choice.reason;
    });
  }

  function handleSmartPickActivities() {
    const city = currentCity;
    return activityPick.run(city, async () => {
      const { ids, summary } = await chooseActivities(fetchSmartPick, city, preferences, activitiesForCity);
      for (const id of ids) if (!(chosen.activityIds ?? []).includes(id)) toggleSelectedActivity(id);
      return summary;
    });
  }

  function handleSmartPickRestaurants() {
    const city = currentCity;
    return restaurantPick.run(city, async () => {
      const { ids, summary } = await chooseRestaurants(fetchSmartPick, city, preferences, restaurantsForCity);
      for (const id of ids) if (!(chosen.restaurantIds ?? []).includes(id)) toggleSelectedRestaurant(id);
      return summary;
    });
  }

  // The Lodging step's "Let ZimmGo choose for me" only picks a hotel for the
  // trip's primary city. Honor that choice here for every city by
  // auto-running the same per-city pick the traveller could click. A city
  // with a hotel already chosen is left alone, and a failed attempt isn't
  // retried — it falls back to the manual picker.
  const [autoPickedHotelFor, setAutoPickedHotelFor] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (stage !== "hotels") return;
    if (!preferences.autoPickHotels) return;
    if (chosen.hotelsByCity?.[currentCity]) return;
    if (autoPickedHotelFor.has(currentCity)) return;
    if (pickingHotel || hotelsForCity.length === 0) return;

    setAutoPickedHotelFor((prev) => new Set(prev).add(currentCity));
    handleSmartPickHotel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentCity, preferences.autoPickHotels, chosen.hotelsByCity, hotelsForCity, pickingHotel]);

  const {
    visible: visibleRestaurants,
    hasMore: hasMoreRestaurants,
    expanded: restaurantsExpanded,
    expand: expandRestaurants,
  } = useExpandablePreview(restaurantsForCity, RESTAURANT_PREVIEW_COUNT, currentCity);
  const {
    visible: visibleActivities,
    hasMore: hasMoreActivities,
    expanded: activitiesExpanded,
    expand: expandActivities,
  } = useExpandablePreview(activitiesForCity, ACTIVITY_PREVIEW_COUNT, currentCity);

  const sectionTitle = stage === "flights" ? "Flights" : `${STAGE_LABELS[stage]} — ${currentCity}`;
  const sectionSubtitle = stage === "flights"
    ? itinerary.flights.some((f) => f.priceIsEstimate)
      ? "A typical fare for your route — search Google Flights for real flights, times and prices."
      : "Select your preferred option — prices are roundtrip per person, estimated."
    : stage === "transport"
    ? `Select an option for ${transportFromCity ? `${transportFromCity} → ${currentCity}` : "this leg"}, or skip and arrange it yourself.`
    : stage === "hotels"
    ? "Tap a hotel to pick it for this city — you can change it later."
    : "Tap \"Add\" to include a pick in your plan — the bookmark saves it to your Wanderlog instead, without scheduling it.";

  const nextLabel = nextStepLabel(step, steps[stepIdx + 1]);

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
              const cityStepIdxs = stepIdxsForCity(steps, city);
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
      <Section title={sectionTitle} icon={STAGE_ICONS[stage]} subtitle={sectionSubtitle}>
        {stage === "flights" && (
          itinerary.flights.length > 0 ? (
            <FlightPairList
              flights={itinerary.flights}
              arrivalAirport={preferences.destination?.arrivalAirport ?? ""}
              selectedFlightId={chosen.flight?.id}
              onSelect={(f) => setSelectedFlight(chosen.flight?.id === f.id ? null : f)}
            />
          ) : preferences.dates?.type === "exact" && preferences.dates.skipFlightSearch ? (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-6 text-center">
              <p className="text-sm text-amber-800">Flight search was skipped for this trip.</p>
              <p className="text-xs text-amber-700 mt-1">
                Your dates are further out than airlines typically open bookings for — but you can search now anyway if you&apos;d like.
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
                    ZimmGo landed on {formatDate(itinerary.days[0]?.date)} – {formatDate(itinerary.days[itinerary.days.length - 1]?.date)}
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
              <p className="text-xs text-slate-400 mt-1">Ask ZimmGo in the chat panel for suggestions, or search again below.</p>
              <SearchFlightsButton onClick={handleSearchFlights} loading={searchingFlights} error={flightSearchError} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
              <p className="text-sm text-slate-500">Flight search needs a departure airport.</p>
              <p className="text-xs text-slate-400 mt-1">
                You haven&apos;t set where you&apos;re flying from yet — add it on the Flights step to see options here.
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

        {stage === "transport" && (
          displayedTransportOptions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {displayedTransportOptions.map((t) => (
                <TransportCard
                  key={t.id}
                  option={t}
                  selected={chosen.transportByLeg?.[currentCity]?.id === t.id}
                  onSelect={() => {
                    const already = chosen.transportByLeg?.[currentCity]?.id === t.id;
                    setSelectedTransportForLeg(currentCity, already ? null : t);
                  }}
                />
              ))}
              <p className="text-[10px] text-slate-400 text-center">
                Estimates only — prices change. Booking opens the provider&apos;s site in a new tab.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
              <p className="text-sm text-slate-500">
                {searchingTransport ? "Searching…" : "No specific options found yet."}
              </p>
              <p className="text-xs text-slate-400 mt-1">This leg is entirely optional to book here — skip it and arrange it yourself if you&apos;d rather.</p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleSearchTransport}
                  disabled={searchingTransport}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-60"
                >
                  <Search size={14} />
                  {searchingTransport ? "Searching…" : "Search again"}
                </button>
                {transportSearchError && (
                  <p className="text-xs text-red-600 mt-2">{transportSearchError}</p>
                )}
              </div>
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
                  ? "ZimmGo is choosing…"
                  : hotelPickReasons[currentCity]
                  ? "Ask ZimmGo to pick a different hotel"
                  : `Let ZimmGo choose the hotel for ${currentCity}`}
              </button>
              {!pickingHotel && (
                <p className="-mt-2 text-[11px] text-slate-400 text-center">
                  Feel free to select a different hotel from the choices below — or ask ZimmGo to make a different selection above.
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
                    Nothing&apos;s locked in — tweak away below!
                  </p>
                </div>
              )}
              {displayHotels.map((h) => {
                const selected = chosen.hotelsByCity?.[currentCity]?.id === h.id;
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
              <button
                type="button"
                onClick={handleSmartPickRestaurants}
                disabled={pickingRestaurants}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-60"
              >
                <Sparkles size={14} />
                {pickingRestaurants
                  ? "ZimmGo is choosing…"
                  : restaurantPickReasons[currentCity]
                  ? "Ask ZimmGo for more picks"
                  : `Let ZimmGo choose restaurants for ${currentCity}`}
              </button>
              {restaurantPickReasons[currentCity] && !pickingRestaurants && (
                <p className="-mt-2 text-[11px] text-slate-400 text-center">
                  This adds more ZimmGo picks on top of what&apos;s already selected below — it won&apos;t remove anything.
                </p>
              )}
              {restaurantPickError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 -mt-1">
                  <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{restaurantPickError}</p>
                </div>
              )}
              {restaurantPickReasons[currentCity] && (
                <div className="rounded-lg bg-brand-50 px-3 py-2 -mt-1">
                  <p className="text-xs text-brand-600">
                    <Sparkles size={11} className="inline mr-1" />
                    {restaurantPickReasons[currentCity]}
                  </p>
                </div>
              )}
              {visibleRestaurants.map((r) => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  saved={wanderlogLabels.has(r.name)}
                  onSave={() => handleSaveToWanderlog(r.name, "restaurant", r.location, r.description)}
                  selected={(chosen.restaurantIds ?? []).includes(r.id)}
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
                  Ask ZimmGo for more restaurants in {currentCity}
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
                  ? "ZimmGo is choosing…"
                  : activityPickReasons[currentCity]
                  ? "Ask ZimmGo for more picks"
                  : `Let ZimmGo choose activities for ${currentCity}`}
              </button>
              {activityPickReasons[currentCity] && !pickingActivities && (
                <p className="-mt-2 text-[11px] text-slate-400 text-center">
                  This adds more ZimmGo picks on top of what&apos;s already selected below — it won&apos;t remove anything.
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
                    Nothing&apos;s locked in — tweak away below!
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
                    selected={(chosen.activityIds ?? []).includes(a.id)}
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
          it only leaves the flight/hotel shown in the summary as ZimmGo's
          default pick instead of one you chose. */}
      <p className="text-xs text-slate-400 -mt-2 text-center">
        You can jump ahead any time — ZimmGo can make these picks for you based on your trip
        preferences and the best each destination has to offer, and you can always change them later.
      </p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
      <p className="text-sm text-slate-500">No specific {label} found yet.</p>
      <p className="text-xs text-slate-400 mt-1">Ask ZimmGo in the chat panel for suggestions — you can move on for now.</p>
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
