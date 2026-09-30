import { resolveCity } from "@/lib/location";
import type { GeneratedItinerary, HotelOption, TripPreferences } from "@/types/trip";

// The one answer to "which hotel is this city's stay?" — used by the trip
// plan (lib/itinerary/tripPlan.ts) behind the day view, "Copy itinerary"
// and the Word export, and by Trip at a Glance, so they can't disagree.
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
