// The finished plan, in one shape every output renders from — the on-screen
// itinerary, "Copy itinerary" and the Word export — so they can't disagree
// about what a day holds or where the traveller is staying.
//
// An itinerary carries two schedules with different roles:
//   • days[].morning/afternoon/evening — ZimmGo's suggestions, filled in by
//     generation from the city's activities.
//   • finalizedPlan.dayCards — the traveller's own arrangement, made in the
//     Refine step (or by auto-plan on their behalf).
// Once the traveller has arranged their days, that arrangement is the plan
// and each day shows only what they put on it — a day they left empty is a
// deliberately free day, not a gap to backfill. Before then, the plan is
// ZimmGo's suggestions.
import { itineraryCities, resolveCity } from "@/lib/location";
import { chosenHotelForCity, type HotelChoice } from "@/lib/planning/hotelChoice";
import { activityCardId, restaurantCardId } from "@/lib/planning/cityPicks";
import type { ActivityOption, GeneratedItinerary, ItineraryDay, RestaurantOption, TripPreferences } from "@/types/trip";

export type PlannedItem =
  | { cardId: string; kind: "activity"; name: string; activity: ActivityOption }
  | { cardId: string; kind: "restaurant"; name: string; restaurant: RestaurantOption };

export interface DayPlan {
  day: ItineraryDay;
  city: string;
  stay: HotelChoice | null;
  /** Whose schedule the day shows: the traveller's arrangement, or ZimmGo's suggestions. */
  source: "traveller" | "suggested";
  /** The traveller's items for the day, in order ("traveller" only; empty = a free day). */
  items: PlannedItem[];
}

export interface TripPlan {
  cities: string[];
  /** One stay per city: the traveller's choice, or ZimmGo's recommendation. */
  stays: { city: string; choice: HotelChoice }[];
  days: DayPlan[];
}

export function buildTripPlan(itinerary: GeneratedItinerary, preferences: TripPreferences): TripPlan {
  const cities = itineraryCities(itinerary, preferences.destination);
  const cards = new Map<string, PlannedItem>();
  for (const a of itinerary.activities) cards.set(activityCardId(a), { cardId: activityCardId(a), kind: "activity", name: a.name, activity: a });
  for (const r of itinerary.restaurants ?? []) cards.set(restaurantCardId(r), { cardId: restaurantCardId(r), kind: "restaurant", name: r.name, restaurant: r });

  const plan = itinerary.finalizedPlan;
  const stayFor = (city: string) => chosenHotelForCity(city, itinerary, cities);

  return {
    cities,
    stays: cities.flatMap((city) => {
      const choice = stayFor(city);
      return choice ? [{ city, choice }] : [];
    }),
    days: itinerary.days.map((day) => {
      const city = resolveCity(day.location, cities, { fallbackToLast: true }) ?? cities[0] ?? day.location ?? "";
      const items = plan
        ? (plan.dayCards[day.dayNumber] ?? []).map((id) => cards.get(id)).filter((i): i is PlannedItem => Boolean(i))
        : [];
      return { day, city, stay: city ? stayFor(city) : null, source: plan ? "traveller" : "suggested", items };
    }),
  };
}

/** How an item reads in a text plan: "Colosseum tour", "Brunch: Café X", "Dinner: Da Enzo". */
export function itemLabel(item: PlannedItem): string {
  if (item.kind === "activity") return item.name;
  return `${item.restaurant.tier === "brunch" ? "Brunch" : "Dinner"}: ${item.name}`;
}

/**
 * A day's contents as text lines, the one way every text output lists them:
 * the traveller's items, or ZimmGo's suggestions by time of day. An empty list
 * means a day the traveller deliberately left free.
 */
export function dayLines(dayPlan: DayPlan): { label?: string; text: string }[] {
  if (dayPlan.source === "traveller") return dayPlan.items.map((item) => ({ text: itemLabel(item) }));
  const { morning, afternoon, evening } = dayPlan.day;
  return [
    { label: "Morning", items: morning },
    { label: "Afternoon", items: afternoon },
    { label: "Evening", items: evening },
  ]
    .filter((slot) => slot.items.length)
    .map((slot) => ({ label: slot.label, text: slot.items.join(", ") }));
}
