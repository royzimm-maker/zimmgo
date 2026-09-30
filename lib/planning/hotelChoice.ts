import { resolveCity } from "@/lib/location";
import type { GeneratedItinerary, HotelOption, ItineraryDay, TripPreferences } from "@/types/trip";

// The one answer to "which hotel is this city's stay?" — used by the day
// view, Trip at a Glance and the Word export, so they can't disagree.
//
// There's one place a traveller's choice is stored: selectedHotelsByCity,
// keyed by the itinerary's cities (lib/location.ts itineraryCities). The
// Lodging step, the review wizard, the Refine step and auto-plan all write
// there. Without a choice, the city's first hotel in the itinerary is ZiGy's
// recommendation — generation puts the hotel its summary describes first.

export interface HotelChoice {
  hotel: HotelOption;
  /** True when the traveller (or auto-plan on their behalf) chose it. */
  byTraveller: boolean;
}

export function chosenHotelForCity(
  city: string,
  itinerary: Pick<GeneratedItinerary, "hotels">,
  preferences: Pick<TripPreferences, "selectedHotelsByCity">,
  cities: string[]
): HotelChoice | null {
  const picked = preferences.selectedHotelsByCity?.[city];
  if (picked) return { hotel: picked, byTraveller: true };
  const recommended = itinerary.hotels.find((h) => resolveCity(h.city ?? h.location, cities) === city);
  return recommended ? { hotel: recommended, byTraveller: false } : null;
}

/** The hotel shown as "Staying at" on a day: its city's chosen hotel. */
export function hotelForDay(
  day: Pick<ItineraryDay, "location">,
  itinerary: Pick<GeneratedItinerary, "hotels">,
  preferences: Pick<TripPreferences, "selectedHotelsByCity">,
  cities: string[]
): HotelOption | undefined {
  const city = resolveCity(day.location, cities, { fallbackToLast: true }) ?? cities[0];
  return city ? chosenHotelForCity(city, itinerary, preferences, cities)?.hotel : undefined;
}
