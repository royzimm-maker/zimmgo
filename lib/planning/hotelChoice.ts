import { resolveCity } from "@/lib/location";
import type { GeneratedItinerary, HotelOption } from "@/types/trip";

// The one answer to "which hotel is this city's stay?" — used by the trip
// plan (lib/itinerary/tripPlan.ts) behind the day view, "Copy itinerary"
// and the Word export, and by Trip at a Glance, so they can't disagree.
//
// There's one place a traveller's choice is stored: the itinerary's
// selections.hotelsByCity, keyed by its cities (lib/location.ts
// itineraryCities). The review wizard, the Refine step and auto-plan write
// there, and the Lodging step's pick seeds it (lib/planning/selections.ts). Without a choice, the city's first hotel in the itinerary is ZimmGo's
// recommendation — generation puts the hotel its summary describes first.

export interface HotelChoice {
  hotel: HotelOption;
  /** True when the traveller (or auto-plan on their behalf) chose it. */
  byTraveller: boolean;
}

export function chosenHotelForCity(
  city: string,
  itinerary: Pick<GeneratedItinerary, "hotels" | "selections">,
  cities: string[]
): HotelChoice | null {
  const picked = itinerary.selections?.hotelsByCity?.[city];
  if (picked) return { hotel: picked, byTraveller: true };
  const recommended = itinerary.hotels.find((h) => resolveCity(h.city ?? h.location, cities) === city);
  return recommended ? { hotel: recommended, byTraveller: false } : null;
}
