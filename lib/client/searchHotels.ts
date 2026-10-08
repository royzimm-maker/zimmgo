import type { HotelOption, LodgingType } from "@/types/trip";

// Hotel search for the Lodging step. An error response comes back as an
// empty list — the step shows "no hotels" and the traveller adjusts filters.
export async function fetchHotelSearch(query: {
  destination: string;
  minStars: number;
  maxPricePerNight: number;
  types: LodgingType[];
  // The stay, when known — real hotels link to prices for these dates.
  checkIn?: string;
  checkOut?: string;
}): Promise<HotelOption[]> {
  const res = await fetch("/api/hotels/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      destination: query.destination,
      min_stars: query.minStars,
      max_price_per_night: query.maxPricePerNight,
      types: query.types.length > 0 ? query.types : undefined,
      check_in: query.checkIn,
      check_out: query.checkOut,
    }),
  });
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as HotelOption[]) : [];
}
