// Ground/ferry transport API module.
//
// --- PRODUCTION SWAP POINT ---
// Unlike Amadeus (flights) or Booking.com (hotels), neither Ferryhopper nor
// SNCF Connect publishes a public shopping API a third party can call for
// live prices — a real integration here is realistically an affiliate
// deep-link (send the traveller straight to a pre-filled search-results
// page on the provider's own site) rather than a JSON API this function
// could transform the response of. If that changes, or a booking
// aggregator with real API access gets used instead, swap the mock
// generation below for that call; the shape callers rely on
// (TransportOption[]) stays the same either way.

import { v4 as uuid } from "uuid";
import type { TransportOption, TripPreferences } from "@/types/trip";
import { randomInt } from "@/lib/utils";
import { getGroundTransportProvider } from "@/lib/data/groundTransportProviders";

export async function searchGroundTransport(
  fromCity: string,
  toCity: string,
  date: string,
  // Accepted for parity with searchFlights/hotel search and future use
  // (e.g. cabin-class-style tier filtering) — the mock generation below
  // doesn't need anything from it today.
  _preferences: TripPreferences
): Promise<TransportOption[]> {
  if (!fromCity || !toCity || !date) return [];

  const match = getGroundTransportProvider(`${fromCity} ${toCity}`);
  if (!match) return [];

  const { mode, provider, bookingUrlTemplate } = match;
  const bookingUrl = bookingUrlTemplate
    .replace("{from}", encodeURIComponent(fromCity))
    .replace("{to}", encodeURIComponent(toCity))
    .replace("{date}", date);

  const basePrice = mode === "ferry" ? randomInt(25, 90) : randomInt(40, 140);
  const baseDurationHours = mode === "ferry" ? randomInt(2, 6) : randomInt(1, 5);

  return [0, 1, 2].map((idx) => {
    const departureH = randomInt(6, 18);
    const durationH = Math.max(1, baseDurationHours - idx); // faster/pricier as idx increases
    const arrivalH = (departureH + durationH) % 24;

    return {
      id: uuid(),
      mode,
      provider,
      fromCity,
      toCity,
      departureTime: `${date}T${departureH.toString().padStart(2, "0")}:00:00`,
      arrivalTime: `${date}T${arrivalH.toString().padStart(2, "0")}:00:00`,
      duration: `${durationH}h`,
      price: basePrice + idx * randomInt(10, 30),
      currency: "USD",
      bookingUrl,
    };
  });
}
