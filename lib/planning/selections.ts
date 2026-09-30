// The traveller's choices from an itinerary — hotels, activities,
// restaurants, flight, transport — live on that itinerary
// (GeneratedItinerary.selections), not in TripPreferences: they're decisions
// about its specific options. This module decides how a new itinerary's
// choices start.
import { itineraryCities, resolveCity } from "@/lib/location";
import type { Destination, GeneratedItinerary, HotelOption, ItinerarySelections } from "@/types/trip";

export function selectionsOf(itinerary: Pick<GeneratedItinerary, "selections"> | null | undefined): ItinerarySelections {
  return itinerary?.selections ?? {};
}

/** Which of the itinerary's cities a hotel belongs to (the first city if it can't be placed). */
export function cityForHotel(hotel: HotelOption, cities: string[]): string | undefined {
  return resolveCity(hotel.city ?? hotel.location, cities) ?? cities[0];
}

/**
 * A new itinerary's starting choices: whatever the traveller chose on the
 * previous one that still applies — a hotel for a city it still visits,
 * activities/restaurants/flight/transport that are still among its options —
 * plus the Lodging step's pick for its city if nothing's chosen there yet.
 * Choices that no longer apply are dropped rather than left dangling.
 */
export function carryOverSelections(
  previous: ItinerarySelections | undefined,
  lodgingPick: HotelOption | undefined,
  next: Pick<GeneratedItinerary, "days" | "activities" | "restaurants" | "flights" | "groundTransport">,
  destination: Destination | undefined
): ItinerarySelections {
  const cities = itineraryCities(next, destination);
  const hotelsByCity: Record<string, HotelOption> = {};
  for (const [city, hotel] of Object.entries(previous?.hotelsByCity ?? {})) {
    if (cities.includes(city)) hotelsByCity[city] = hotel;
  }
  if (lodgingPick) {
    const city = cityForHotel(lodgingPick, cities);
    if (city && !hotelsByCity[city]) hotelsByCity[city] = lodgingPick;
  }

  const activityIds = new Set(next.activities.map((a) => a.id));
  const restaurantIds = new Set((next.restaurants ?? []).map((r) => r.id));
  const transportIds = new Set((next.groundTransport ?? []).map((t) => t.id));
  const transportByLeg: Record<string, NonNullable<ItinerarySelections["transportByLeg"]>[string]> = {};
  for (const [city, option] of Object.entries(previous?.transportByLeg ?? {})) {
    if (cities.includes(city) && transportIds.has(option.id)) transportByLeg[city] = option;
  }
  const flight = previous?.flight && next.flights.some((f) => f.id === previous.flight!.id) ? previous.flight : undefined;

  return {
    ...(Object.keys(hotelsByCity).length ? { hotelsByCity } : {}),
    ...(previous?.activityIds ? { activityIds: previous.activityIds.filter((id) => activityIds.has(id)) } : {}),
    ...(previous?.restaurantIds ? { restaurantIds: previous.restaurantIds.filter((id) => restaurantIds.has(id)) } : {}),
    ...(flight ? { flight } : {}),
    ...(Object.keys(transportByLeg).length ? { transportByLeg } : {}),
  };
}
