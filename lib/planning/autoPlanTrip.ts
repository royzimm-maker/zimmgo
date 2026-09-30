// End-to-end auto-plan orchestration for "Let ZiGy plan my whole trip"
// (see components/planning/steps/PlanningModeStep.tsx). Mirrors the same
// per-city smart-pick patterns already used one screen at a time in
// ItinerarySelectionWizard (hotel/activities/restaurants picks) and
// RefineStep (schedule arranging) — this just runs all of them across every
// city so the traveller lands straight on the finished plan instead of
// clicking "let ZiGy pick" on each screen in turn.
//
// Runs server-side as a background job (/api/itinerary/auto-plan); the pick
// function is injected so it calls the AI directly there and stays testable.
import { itineraryCities, resolveCity } from "@/lib/location";
import type { GeneratedItinerary, TripPreferences, HotelOption } from "@/types/trip";
import {
  arrangeDays, chooseActivities, chooseHotel, chooseRestaurants, isAirbnbOnly,
  activityCardId, restaurantCardId, type PickFn,
} from "@/lib/planning/cityPicks";

export type { PickFn } from "@/lib/planning/cityPicks";

export interface AutoPlanResult {
  selectedHotelsByCity: Record<string, HotelOption>;
  selectedActivityIds: string[];
  selectedRestaurantIds: string[];
  dayCards: Record<number, string[]>;
  // Every activity/restaurant card not placed on a day.
  bankCards: string[];
  // Cities whose picks failed even after a retry — their items are left
  // unscheduled in bankCards for the traveller to place themselves.
  failedCities: string[];
}

// How many cities are planned at once; each runs up to 3 AI calls in parallel.
const CITY_CONCURRENCY = 3;

interface CityPlan {
  city: string;
  hotel?: HotelOption;
  activityIds: string[];
  restaurantIds: string[];
  dayCards: Record<number, string[]>;
}

// Assigns each item to exactly one city, so nothing is picked or scheduled
// twice when city names overlap. Uses the same resolution as the Refine
// step's city tabs and the review wizard (lib/location.ts), so an item
// auto-plan schedules in a city is the one the traveller sees under it.
function partition<T>(
  items: T[],
  cities: string[],
  locate: (item: T) => string | undefined,
  fallbackToLast: boolean
): Map<string, T[]> {
  const byCity = new Map<string, T[]>(cities.map((c) => [c, []]));
  for (const item of items) {
    const city = resolveCity(locate(item), cities, { fallbackToLast });
    if (city) byCity.get(city)!.push(item);
  }
  return byCity;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function autoPlanTrip(
  itinerary: GeneratedItinerary,
  preferences: TripPreferences,
  pick: PickFn,
  onProgress: (message: string) => Promise<void> | void = () => {}
): Promise<AutoPlanResult> {
  // Same city keys the wizard and Refine step use, so picks line up.
  const cities = itineraryCities(itinerary, preferences.destination);

  const existingHotels = preferences.selectedHotelsByCity ?? {};
  const alreadyPickedActs = new Set(preferences.selectedActivityIds ?? []);
  const alreadyPickedRests = new Set(preferences.selectedRestaurantIds ?? []);
  const airbnbOnly = isAirbnbOnly(preferences.lodging?.types);

  // A hotel in the wrong city is worse than none, so hotels don't fall back;
  // activities/restaurants tagged with a town no city matches go to the last
  // (touring) leg, as they do in the Refine step.
  const hotelsByCity = partition(itinerary.hotels, cities, (h) => h.city ?? h.location, false);
  const actsByCity = partition(itinerary.activities, cities, (a) => a.location, true);
  const restsByCity = partition(itinerary.restaurants ?? [], cities, (r) => r.location, true);
  // Days without a location go to the first city — each day must be in
  // exactly one city's schedule, or two cities could book the same day.
  const daysByCity = partition(itinerary.days, cities, (d) => d.location || cities[0], true);

  async function planCity(city: string): Promise<CityPlan> {
    const cityHotels = hotelsByCity.get(city)!;
    const cityActivities = actsByCity.get(city)!;
    const cityRestaurants = restsByCity.get(city)!;
    const cityDays = daysByCity.get(city)!;

    const newActs = cityActivities.filter((a) => !alreadyPickedActs.has(a.id));
    const newRests = cityRestaurants.filter((r) => !alreadyPickedRests.has(r.id));

    // Hotel, activity and restaurant picks are independent — run them together.
    // The steps themselves are shared with the wizard and Refine step
    // (lib/planning/cityPicks.ts), so every screen checks ZiGy's answers alike.
    const [hotelChoice, actChoice, restChoice] = await Promise.all([
      !airbnbOnly && !existingHotels[city] ? chooseHotel(pick, city, preferences, cityHotels) : Promise.resolve(null),
      chooseActivities(pick, city, preferences, newActs),
      chooseRestaurants(pick, city, preferences, newRests),
    ]);

    const actIds = new Set(actChoice.ids);
    const restIds = new Set(restChoice.ids);
    const pickedActs = cityActivities.filter((a) => alreadyPickedActs.has(a.id) || actIds.has(a.id));
    const pickedRests = cityRestaurants.filter((r) => alreadyPickedRests.has(r.id) || restIds.has(r.id));
    const { dayCards } = await arrangeDays(pick, city, preferences, cityDays, pickedActs, pickedRests);
    const hotel = hotelChoice?.hotel;

    return {
      city,
      hotel,
      activityIds: cityActivities.filter((a) => actIds.has(a.id)).map((a) => a.id),
      restaurantIds: cityRestaurants.filter((r) => restIds.has(r.id)).map((r) => r.id),
      dayCards,
    };
  }

  let done = 0;
  await onProgress(`Planning ${cities.length === 1 ? cities[0] : `${cities.length} cities`}…`);
  const planOne = async (city: string) => {
    const plan = await planCity(city).catch(() => planCity(city)); // one retry for a transient failure
    done++;
    if (cities.length > 1) await onProgress(`Planned ${done} of ${cities.length} cities…`);
    return plan;
  };
  const settled = await mapWithConcurrency(cities, CITY_CONCURRENCY, planOne);

  const failedCities = cities.filter((_, i) => settled[i].status === "rejected");
  if (cities.length && failedCities.length === cities.length) {
    const first = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
    throw first?.reason instanceof Error ? first.reason : new Error("ZiGy couldn't plan your trip");
  }

  const selectedHotelsByCity: Record<string, HotelOption> = { ...existingHotels };
  const selectedActivityIds = new Set(alreadyPickedActs);
  const selectedRestaurantIds = new Set(alreadyPickedRests);
  const dayCards: Record<number, string[]> = {};
  itinerary.days.forEach((d) => { dayCards[d.dayNumber] = []; });

  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const plan = s.value;
    if (plan.hotel) selectedHotelsByCity[plan.city] = plan.hotel;
    plan.activityIds.forEach((id) => selectedActivityIds.add(id));
    plan.restaurantIds.forEach((id) => selectedRestaurantIds.add(id));
    for (const [day, cards] of Object.entries(plan.dayCards)) {
      dayCards[Number(day)] = [...(dayCards[Number(day)] ?? []), ...cards];
    }
  }

  const placed = new Set(Object.values(dayCards).flat());
  const bankCards = [
    ...itinerary.activities.map(activityCardId),
    ...(itinerary.restaurants ?? []).map(restaurantCardId),
  ].filter((id) => !placed.has(id));

  return {
    selectedHotelsByCity,
    selectedActivityIds: Array.from(selectedActivityIds),
    selectedRestaurantIds: Array.from(selectedRestaurantIds),
    dayCards,
    bankCards,
    failedCities,
  };
}
