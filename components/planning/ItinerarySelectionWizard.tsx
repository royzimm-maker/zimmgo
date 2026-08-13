"use client";

import { useMemo, useState } from "react";
import { Plane, Hotel, UtensilsCrossed, Star, ArrowLeft, ArrowRight, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTripStore } from "@/lib/store/tripStore";
import { useWanderlogSave } from "@/lib/hooks/useWanderlogSave";
import { useExpandablePreview } from "@/lib/hooks/useExpandablePreview";
import { fetchSmartPick } from "@/lib/api/smartPick";
import { fuzzyCityMatch } from "@/lib/utils";
import {
  Section, FlightPairList, HotelCard, RestaurantCard, ActivityCard,
} from "@/components/planning/ItineraryView";
import type { GeneratedItinerary } from "@/types/trip";

interface Props {
  itinerary: GeneratedItinerary;
  onComplete: () => void;
}

type Stage = "flights" | "hotels" | "restaurants" | "activities";

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

export function ItinerarySelectionWizard({ itinerary, onComplete }: Props) {
  const { trip, setSelectedFlight, setSelectedHotelForCity, toggleSelectedRestaurant, toggleSelectedActivity } = useTripStore();
  const preferences = trip.preferences;

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
    const list: WizardStep[] = [{ stage: "flights", city: null }];
    for (const city of cities) {
      for (const stage of perCityStages) list.push({ stage, city });
    }
    return list;
  }, [cities, perCityStages]);

  const [stepIdx, setStepIdx] = useState(0);
  const [pickingHotel, setPickingHotel] = useState(false);
  const [hotelPickReasons, setHotelPickReasons] = useState<Record<string, string>>({});

  const step = steps[stepIdx];
  const stage = step.stage;
  const currentCity = step.city ?? cities[0];
  const currentCityIdx = cities.indexOf(currentCity);

  const totalSteps = steps.length;
  const currentStep = stepIdx + 1;
  const canGoBack = stepIdx > 0;

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
    try {
      const data = await fetchSmartPick({ kind: "hotel", city: currentCity, preferences, hotels: hotelsForCity });
      const pick = data.picks[0];
      const hotel = pick && hotelsForCity.find((h) => h.id === pick.id);
      if (hotel) {
        setSelectedHotelForCity(currentCity, hotel);
        setHotelPickReasons((prev) => ({ ...prev, [currentCity]: pick.reason }));
      }
    } catch {
      // Silently fail — the picker UI is still there as a fallback
    } finally {
      setPickingHotel(false);
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
    : `Continue to ${STAGE_META[nextStep.stage].label}`;

  return (
    <div className="flex flex-col gap-5">
      {/* Progress header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">
            Reviewing your picks — {currentStep} of {totalSteps}
          </p>
          {stage !== "flights" && cities.length > 1 && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin size={11} /> {currentCityIdx + 1} of {cities.length} cities
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < stepIdx ? "bg-brand-500" : i === stepIdx ? "bg-brand-300" : "bg-slate-100"
              }`}
            />
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
          ) : (
            <EmptyState label="flight options" />
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
                {pickingHotel ? "ZiGy is choosing…" : `Let ZiGy choose for ${currentCity}`}
              </button>
              {hotelPickReasons[currentCity] && (
                <div className="rounded-lg bg-brand-50 px-3 py-2 -mt-1">
                  <p className="text-xs text-brand-600">
                    <Sparkles size={11} className="inline mr-1" />
                    {hotelPickReasons[currentCity]}
                  </p>
                  <p className="mt-1 text-[10px] text-brand-400">
                    You can still adjust this below — nothing here is locked in.
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
