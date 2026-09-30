// The steps of "let ZiGy choose" for one city, written once and used
// everywhere: the server-side auto-plan job (lib/planning/autoPlanTrip.ts),
// the review wizard, the Lodging step and the Refine step's arranging.
//
// Each step takes the call to the AI as a parameter (`pick`): the server
// passes runSmartPick, the browser passes fetchSmartPick. So the steps can't
// drift apart between screens — in particular, every answer is checked the
// same way: only items that were actually offered, only real days, nothing
// placed twice.
import type { ActivityOption, HotelOption, ItineraryDay, LodgingType, RestaurantOption, TripPreferences } from "@/types/trip";
import type { SmartPickRequestBody, SmartPickResponse } from "@/types/smartPick";

export type PickFn = (body: SmartPickRequestBody) => Promise<SmartPickResponse>;

/** Airbnb-only lodging means there's no hotel to choose. */
export function isAirbnbOnly(types: (LodgingType | string)[] | undefined): boolean {
  return Boolean(types?.length && types.every((t) => t === "airbnb"));
}

/** ZiGy's hotel for a city, from the hotels offered — or null if it chose none of them. */
export async function chooseHotel(
  pick: PickFn,
  city: string,
  preferences: TripPreferences,
  hotels: HotelOption[]
): Promise<{ hotel: HotelOption; reason: string } | null> {
  if (!hotels.length) return null;
  const data = await pick({ kind: "hotel", city, preferences, hotels });
  for (const p of data.picks) {
    const hotel = hotels.find((h) => h.id === p.id);
    if (hotel) return { hotel, reason: p.reason };
  }
  return null;
}

// The ids ZiGy picked that were among the ones offered, once each, in its order.
function offeredIds(data: SmartPickResponse, offered: { id: string }[]): string[] {
  const valid = new Set(offered.map((o) => o.id));
  const ids: string[] = [];
  for (const p of data.picks) if (valid.has(p.id) && !ids.includes(p.id)) ids.push(p.id);
  return ids;
}

export async function chooseActivities(
  pick: PickFn,
  city: string,
  preferences: TripPreferences,
  activities: ActivityOption[]
): Promise<{ ids: string[]; summary: string }> {
  if (!activities.length) return { ids: [], summary: "" };
  const data = await pick({ kind: "activities_for_city", city, preferences, activities });
  return { ids: offeredIds(data, activities), summary: data.summary };
}

export async function chooseRestaurants(
  pick: PickFn,
  city: string,
  preferences: TripPreferences,
  restaurants: RestaurantOption[]
): Promise<{ ids: string[]; summary: string }> {
  if (!restaurants.length) return { ids: [], summary: "" };
  const data = await pick({ kind: "restaurants_for_city", city, preferences, restaurants });
  return { ids: offeredIds(data, restaurants), summary: data.summary };
}

/** A schedule card's id: the same ids the Refine board and finalizedPlan use. */
export const activityCardId = (a: { id: string }) => `act-${a.id}`;
export const restaurantCardId = (r: { id: string }) => `rest-${r.id}`;

/**
 * ZiGy's arrangement of a city's chosen activities and restaurants across
 * its days, as day number → card ids. Only the cards and days offered are
 * used, and no card is placed twice.
 */
export async function arrangeDays(
  pick: PickFn,
  city: string,
  preferences: TripPreferences,
  days: ItineraryDay[],
  activities: ActivityOption[],
  restaurants: RestaurantOption[]
): Promise<{ dayCards: Record<number, string[]>; summary: string }> {
  if (!days.length || (!activities.length && !restaurants.length)) return { dayCards: {}, summary: "" };
  const data = await pick({ kind: "schedule", city, preferences, days, activities, restaurants });
  const validDays = new Set(days.map((d) => d.dayNumber));
  const validCards = new Set([...activities.map(activityCardId), ...restaurants.map(restaurantCardId)]);
  const placed = new Set<string>();
  const dayCards: Record<number, string[]> = {};
  for (const p of data.picks) {
    if (p.dayNumber === undefined || !validDays.has(p.dayNumber)) continue;
    if (!validCards.has(p.id) || placed.has(p.id)) continue;
    placed.add(p.id);
    (dayCards[p.dayNumber] ??= []).push(p.id);
  }
  return { dayCards, summary: data.summary };
}
