// What the itinerary review wizard walks through, and what each city offers
// at each stage — kept apart from the wizard's UI (ItinerarySelectionWizard)
// so the rules can be read and tested on their own.
import { getGroundTransportProvider } from "@/lib/data/groundTransportProviders";
import { resolveCity } from "@/lib/location";
import type { GeneratedItinerary, ItinerarySelections } from "@/types/trip";

export type Stage = "flights" | "transport" | "hotels" | "restaurants" | "activities";

export const STAGE_LABELS: Record<Stage, string> = {
  flights: "Flights",
  transport: "Getting there",
  hotels: "Hotels",
  restaurants: "Restaurants",
  activities: "Activities",
};

// One entry in the flattened step list — flights has no city; every other
// stage belongs to exactly one city, so the wizard fully personalizes a
// single location (hotel, then restaurants, then activities) before moving
// to the next one, instead of doing one category across every city at a time.
export interface WizardStep {
  stage: Stage;
  city: string | null;
}

export function buildWizardSteps(cities: string[], opts: { airbnbOnly: boolean; noFlights: boolean }): WizardStep[] {
  // Airbnb-only trips skip Hotels: generation still fills itinerary.hotels
  // regardless of lodging type, but nobody asked to pick one.
  const perCity: Stage[] = opts.airbnbOnly ? ["restaurants", "activities"] : ["hotels", "restaurants", "activities"];
  // Road trips / other no-flight itineraries have nothing to search or select.
  const steps: WizardStep[] = opts.noFlights ? [] : [{ stage: "flights", city: null }];
  cities.forEach((city, i) => {
    // A ferry/train stage is the leg INTO this city from the previous one,
    // only where a real regional operator matches — keyed by the arriving
    // city, like selections.transportByLeg.
    const prev = i > 0 ? cities[i - 1] : null;
    if (prev && getGroundTransportProvider(`${prev} ${city}`)) steps.push({ stage: "transport", city });
    for (const stage of perCity) steps.push({ stage, city });
  });
  return steps;
}

/** Consecutive steps sharing a city (or the leading flights step), for the grouped progress bar. */
export function groupStepsByCity(steps: WizardStep[]): { key: string; idxs: number[] }[] {
  const groups: { key: string; idxs: number[] }[] = [];
  steps.forEach((s, i) => {
    const key = s.city ?? "__flights__";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.idxs.push(i);
    else groups.push({ key, idxs: [i] });
  });
  return groups;
}

/** The step indexes belonging to a city, in order. */
export function stepIdxsForCity(steps: WizardStep[], city: string): number[] {
  return steps.flatMap((s, i) => (s.city === city ? [i] : []));
}

/** "Continue" names what it advances to, so it reads as moving through this review rather than page navigation. */
export function nextStepLabel(step: WizardStep, next: WizardStep | undefined): string {
  if (!next) return "Finish review";
  // Straight off Flights, "Continue to {city}" reads like it describes where
  // the flight goes (confusing when the visible card is the return leg).
  if (step.stage === "flights") return `Plan the ${next.city} leg`;
  if (next.city !== step.city) return `Continue to ${next.city}`;
  return `Continue to ${STAGE_LABELS[next.stage]} in ${next.city}`;
}

/** A city's options at each stage; restaurants and activities highest-rated first, so a capped preview shows the best. */
export function cityOptions(itinerary: GeneratedItinerary, cities: string[], city: string) {
  const inCity = (location: string | undefined) => resolveCity(location, cities, { fallbackToLast: true }) === city;
  return {
    hotels: itinerary.hotels.filter((h) => resolveCity(h.city ?? h.location, cities) === city),
    restaurants: (itinerary.restaurants ?? []).filter((r) => inCity(r.location)).sort((a, b) => b.rating - a.rating),
    activities: itinerary.activities.filter((a) => inCity(a.location)).sort((a, b) => b.rating - a.rating),
    transport: (itinerary.groundTransport ?? []).filter((t) => t.toCity === city),
  };
}

/** What's already chosen for a city — shown while reviewing its later stages. */
export function cityRecap(itinerary: GeneratedItinerary, cities: string[], city: string, chosen: ItinerarySelections) {
  const { restaurants, activities } = cityOptions(itinerary, cities, city);
  return {
    hotel: chosen.hotelsByCity?.[city]?.name,
    restaurantCount: restaurants.filter((r) => (chosen.restaurantIds ?? []).includes(r.id)).length,
    activityCount: activities.filter((a) => (chosen.activityIds ?? []).includes(a.id)).length,
  };
}
