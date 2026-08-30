// End-to-end auto-plan orchestration for "Let ZiGy plan my whole trip"
// (see components/planning/steps/PlanningModeStep.tsx). Mirrors the same
// per-city smart-pick patterns already used one screen at a time in
// ItinerarySelectionWizard (hotel/activities/restaurants picks) and
// RefineStep (schedule arranging) — this just runs all of them back-to-back
// across every city so the traveller lands straight on the finished plan
// instead of clicking "let ZiGy pick" on each screen in turn.
import { fetchSmartPick } from "@/lib/api/smartPick";
import { fuzzyCityMatch } from "@/lib/utils";
import type { GeneratedItinerary, TripPreferences, HotelOption } from "@/types/trip";

export interface AutoPlanResult {
  selectedHotelsByCity: Record<string, HotelOption>;
  selectedActivityIds: string[];
  selectedRestaurantIds: string[];
  dayCards: Record<number, string[]>;
}

export async function autoPlanTrip(
  itinerary: GeneratedItinerary,
  preferences: TripPreferences
): Promise<AutoPlanResult> {
  const cities: string[] = [];
  for (const day of itinerary.days) {
    if (day.location && !cities.includes(day.location)) cities.push(day.location);
  }

  const selectedHotelsByCity: Record<string, HotelOption> = { ...(preferences.selectedHotelsByCity ?? {}) };
  const selectedActivityIds = new Set(preferences.selectedActivityIds ?? []);
  const selectedRestaurantIds = new Set(preferences.selectedRestaurantIds ?? []);
  const dayCards: Record<number, string[]> = {};
  itinerary.days.forEach((d) => { dayCards[d.dayNumber] = []; });

  const airbnbOnly = Boolean(
    preferences.lodging?.types?.length && preferences.lodging.types.every((t) => t === "airbnb")
  );

  for (const city of cities) {
    if (!airbnbOnly && !selectedHotelsByCity[city]) {
      const cityHotels = itinerary.hotels.filter((h) => fuzzyCityMatch(h.city ?? h.location, city));
      if (cityHotels.length) {
        const data = await fetchSmartPick({ kind: "hotel", city, preferences, hotels: cityHotels });
        const pick = data.picks[0];
        const hotel = pick && cityHotels.find((h) => h.id === pick.id);
        if (hotel) selectedHotelsByCity[city] = hotel;
      }
    }

    const cityActivities = itinerary.activities.filter((a) => fuzzyCityMatch(a.location, city));
    const newActivityPicks = cityActivities.filter((a) => !selectedActivityIds.has(a.id));
    if (newActivityPicks.length) {
      const data = await fetchSmartPick({ kind: "activities_for_city", city, preferences, activities: newActivityPicks });
      data.picks.forEach((p) => selectedActivityIds.add(p.id));
    }

    const cityRestaurants = (itinerary.restaurants ?? []).filter((r) => fuzzyCityMatch(r.location, city));
    const newRestaurantPicks = cityRestaurants.filter((r) => !selectedRestaurantIds.has(r.id));
    if (newRestaurantPicks.length) {
      const data = await fetchSmartPick({ kind: "restaurants_for_city", city, preferences, restaurants: newRestaurantPicks });
      data.picks.forEach((p) => selectedRestaurantIds.add(p.id));
    }

    const cityDays = itinerary.days.filter((d) => !d.location || fuzzyCityMatch(d.location, city));
    const pickedActs = cityActivities.filter((a) => selectedActivityIds.has(a.id));
    const pickedRests = cityRestaurants.filter((r) => selectedRestaurantIds.has(r.id));
    if (pickedActs.length || pickedRests.length) {
      const data = await fetchSmartPick({
        kind: "schedule", city, preferences,
        days: cityDays, activities: pickedActs, restaurants: pickedRests,
      });
      const validDayNums = new Set(cityDays.map((d) => d.dayNumber));
      for (const p of data.picks) {
        if (p.dayNumber === undefined || !validDayNums.has(p.dayNumber)) continue;
        const isActivity = pickedActs.some((a) => `act-${a.id}` === p.id);
        const isRestaurant = !isActivity && pickedRests.some((r) => `rest-${r.id}` === p.id);
        if (isActivity || isRestaurant) {
          dayCards[p.dayNumber] = [...(dayCards[p.dayNumber] ?? []), p.id];
        }
      }
    }
  }

  return {
    selectedHotelsByCity,
    selectedActivityIds: Array.from(selectedActivityIds),
    selectedRestaurantIds: Array.from(selectedRestaurantIds),
    dayCards,
  };
}
