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

const STAGES: { id: Stage; label: string; icon: React.ReactNode; perCity: boolean }[] = [
  { id: "flights",     label: "Flights",     icon: <Plane size={16} />,           perCity: false },
  { id: "hotels",      label: "Hotels",      icon: <Hotel size={16} />,           perCity: true  },
  { id: "restaurants", label: "Restaurants", icon: <UtensilsCrossed size={16} />, perCity: true  },
  { id: "activities",  label: "Activities",  icon: <Star size={16} />,            perCity: true  },
];

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
  const stages = useMemo(
    () => STAGES.filter((s) => s.id !== "hotels" || !airbnbOnlyLodging),
    [airbnbOnlyLodging]
  );

  const cities = useMemo(() => {
    const c = preferences.destination?.cities?.filter(Boolean) ?? [];
    return c.length ? c : [preferences.destination?.displayName ?? "Your destination"];
  }, [preferences.destination]);

  const [stageIdx, setStageIdx] = useState(0);
  const [cityIdx, setCityIdx] = useState(0);
  const [pickingHotel, setPickingHotel] = useState(false);
  const [hotelPickReasons, setHotelPickReasons] = useState<Record<string, string>>({});
  const stage = stages[stageIdx];
  const currentCity = cities[cityIdx];

  // Overall step counter across the whole wizard, for the progress label
  const stepsPerStage = stages.map((s) => (s.perCity ? cities.length : 1));
  const totalSteps = stepsPerStage.reduce((a, b) => a + b, 0);
  const currentStep = stepsPerStage.slice(0, stageIdx).reduce((a, b) => a + b, 0) + (stage.perCity ? cityIdx : 0) + 1;

  const canGoBack = currentStep > 1;

  function goNext() {
    if (stage.perCity && cityIdx < cities.length - 1) {
      setCityIdx((i) => i + 1);
      return;
    }
    if (stageIdx < stages.length - 1) {
      setStageIdx((i) => i + 1);
      setCityIdx(0);
      return;
    }
    onComplete();
  }

  function goBack() {
    if (stage.perCity && cityIdx > 0) {
      setCityIdx((i) => i - 1);
      return;
    }
    if (stageIdx > 0) {
      const prevStage = stages[stageIdx - 1];
      setStageIdx((i) => i - 1);
      setCityIdx(prevStage.perCity ? cities.length - 1 : 0);
    }
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

  // Once you're a few cities into a stage, it's easy to lose the sense of
  // "what does this city as a whole look like" — this recap keeps that
  // visible without requiring a restructure into a per-city-complete flow.
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

  const sectionTitle = stage.perCity ? `${stage.label} — ${currentCity}` : stage.label;
  const sectionSubtitle = stage.id === "flights"
    ? "Select your preferred option — prices are roundtrip per person, estimated."
    : stage.id === "hotels"
    ? "Tap a hotel to pick it for this city — you can change it later."
    : stage.id === "restaurants" || stage.id === "activities"
    ? "Tap \"Add\" to include a pick in your plan — the bookmark saves it to your Wanderlog instead, without scheduling it."
    : undefined;

  // What "Continue" advances to, so it reads as "move to the next thing in
  // this picks review" rather than looking like the page-level navigation
  // (Back / Skip / Personalize) that sits right below this wizard.
  const isLastStep = currentStep === totalSteps;
  const nextLabel = isLastStep
    ? "Finish review"
    : stage.perCity && cityIdx < cities.length - 1
    ? `Continue to ${cities[cityIdx + 1]}`
    : `Continue to ${stages[stageIdx + 1]?.label}`;

  return (
    <div className="flex flex-col gap-5">
      {/* Progress header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">
            Reviewing your picks — {currentStep} of {totalSteps}
          </p>
          {stage.perCity && cities.length > 1 && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin size={11} /> {cityIdx + 1} of {cities.length} cities
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          {stages.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full ${
                i < stageIdx ? "bg-brand-500" : i === stageIdx ? "bg-brand-300" : "bg-slate-100"
              }`}
            />
          ))}
        </div>
        {stage.perCity && (cityRecap.hotel || cityRecap.restaurantCount > 0 || cityRecap.activityCount > 0) && (
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
      <Section title={sectionTitle} icon={stage.icon} subtitle={sectionSubtitle}>
        {stage.id === "flights" && (
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

        {stage.id === "hotels" && (
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

        {stage.id === "restaurants" && (
          restaurantsForCity.length > 0 ? (
            <div className="flex flex-col gap-3">
              {visibleRestaurants.map((r) => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  saved={wanderlogLabels.has(r.name)}
                  onSave={() => handleSaveToWanderlog(r.name, "restaurant", r.location)}
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

        {stage.id === "activities" && (
          activitiesForCity.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleActivities.map((a) => (
                  <ActivityCard
                    key={a.id}
                    activity={a}
                    saved={wanderlogLabels.has(a.name)}
                    onSave={() => handleSaveToWanderlog(a.name, "activity", a.location)}
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
