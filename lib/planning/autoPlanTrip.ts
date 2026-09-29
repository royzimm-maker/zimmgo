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
import { fuzzyCityMatch } from "@/lib/utils";
import type { GeneratedItinerary, TripPreferences, HotelOption } from "@/types/trip";
import type { SmartPickRequestBody, SmartPickResponse } from "@/types/smartPick";

export type PickFn = (body: SmartPickRequestBody) => Promise<SmartPickResponse>;

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

// Assigns each item to the first city it matches, so no item is picked or
// scheduled twice when city names overlap (e.g. a "Rome" pool shared with
// Florence, or fuzzy matches between neighbouring legs).
function partition<T>(items: T[], cities: string[], locate: (item: T) => string | undefined): Map<string, T[]> {
  const byCity = new Map<string, T[]>(cities.map((c) => [c, []]));
  for (const item of items) {
    const loc = locate(item);
    const city = loc ? cities.find((c) => fuzzyCityMatch(loc, c)) : undefined;
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
  const cities: string[] = [];
  for (const day of itinerary.days) {
    if (day.location && !cities.includes(day.location)) cities.push(day.location);
  }

  const existingHotels = preferences.selectedHotelsByCity ?? {};
  const alreadyPickedActs = new Set(preferences.selectedActivityIds ?? []);
  const alreadyPickedRests = new Set(preferences.selectedRestaurantIds ?? []);
  const airbnbOnly = Boolean(
    preferences.lodging?.types?.length && preferences.lodging.types.every((t) => t === "airbnb")
  );

  const hotelsByCity = partition(itinerary.hotels, cities, (h) => h.city ?? h.location);
  const actsByCity = partition(itinerary.activities, cities, (a) => a.location);
  const restsByCity = partition(itinerary.restaurants ?? [], cities, (r) => r.location);
  // Days without a location go to the first city, like the leg they sit in.
  const daysByCity = partition(itinerary.days, cities, (d) => d.location || cities[0]);

  async function planCity(city: string): Promise<CityPlan> {
    const cityHotels = hotelsByCity.get(city)!;
    const cityActivities = actsByCity.get(city)!;
    const cityRestaurants = restsByCity.get(city)!;
    const cityDays = daysByCity.get(city)!;

    const newActs = cityActivities.filter((a) => !alreadyPickedActs.has(a.id));
    const newRests = cityRestaurants.filter((r) => !alreadyPickedRests.has(r.id));

    // Hotel, activity and restaurant picks are independent — run them together.
    const [hotel, actPicks, restPicks] = await Promise.all([
      !airbnbOnly && !existingHotels[city] && cityHotels.length
        ? pick({ kind: "hotel", city, preferences, hotels: cityHotels })
            .then((d) => cityHotels.find((h) => h.id === d.picks[0]?.id))
        : Promise.resolve(undefined),
      newActs.length
        ? pick({ kind: "activities_for_city", city, preferences, activities: newActs }).then((d) => d.picks.map((p) => p.id))
        : Promise.resolve([] as string[]),
      newRests.length
        ? pick({ kind: "restaurants_for_city", city, preferences, restaurants: newRests }).then((d) => d.picks.map((p) => p.id))
        : Promise.resolve([] as string[]),
    ]);

    const actIds = new Set(actPicks);
    const restIds = new Set(restPicks);
    const pickedActs = cityActivities.filter((a) => alreadyPickedActs.has(a.id) || actIds.has(a.id));
    const pickedRests = cityRestaurants.filter((r) => alreadyPickedRests.has(r.id) || restIds.has(r.id));

    const dayCards: Record<number, string[]> = {};
    if (cityDays.length && (pickedActs.length || pickedRests.length)) {
      const data = await pick({
        kind: "schedule", city, preferences,
        days: cityDays, activities: pickedActs, restaurants: pickedRests,
      });
      const validDayNums = new Set(cityDays.map((d) => d.dayNumber));
      const validCards = new Set([
        ...pickedActs.map((a) => `act-${a.id}`),
        ...pickedRests.map((r) => `rest-${r.id}`),
      ]);
      const placed = new Set<string>();
      for (const p of data.picks) {
        if (p.dayNumber === undefined || !validDayNums.has(p.dayNumber)) continue;
        if (!validCards.has(p.id) || placed.has(p.id)) continue;
        placed.add(p.id);
        (dayCards[p.dayNumber] ??= []).push(p.id);
      }
    }

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
    ...itinerary.activities.map((a) => `act-${a.id}`),
    ...(itinerary.restaurants ?? []).map((r) => `rest-${r.id}`),
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
