// Hotels API module
// Production: integrate with Booking.com Demand API or Airbnb API
// Booking.com docs: https://developers.booking.com

import { v4 as uuid } from "uuid";
import type { HotelOption } from "@/types/trip";
import { randomInt } from "@/lib/utils";

interface HotelSearchParams {
  destination: string;
  check_in?: string;
  check_out?: string;
  min_stars?: number;
  types?: string[];
  max_price_per_night?: number;
  amenities?: string[];
}

// Hotel type tags used to filter by accommodation preference
type HotelType = "hotel" | "boutique" | "resort" | "guesthouse";

// Curated mock hotel data per destination keyword
const HOTEL_DB: Record<string, (Partial<HotelOption> & { hotelType?: HotelType })[]> = {
  tokyo: [
    { name: "Aman Tokyo",            stars: 5, hotelType: "boutique", location: "Otemachi, Tokyo",    rating: 9.6, ratingSource: "Google Reviews", reviewCount: 1240, highlights: ["Stunning city views", "Aman spa", "Traditional aesthetics"] },
    { name: "The Peninsula Tokyo",   stars: 5, hotelType: "hotel",    location: "Yurakucho, Tokyo",   rating: 9.4, ratingSource: "TripAdvisor",    reviewCount: 2180, highlights: ["Impeccable service", "Michelin dining", "Ginza proximity"] },
    { name: "Park Hyatt Tokyo",      stars: 5, hotelType: "hotel",    location: "Shinjuku, Tokyo",    rating: 9.2, ratingSource: "Booking.com",    reviewCount: 3400, highlights: ["Lost in Translation fame", "Pool with Mt. Fuji views", "Jazz bar"] },
    { name: "Shinjuku Granbell",     stars: 4, hotelType: "boutique", location: "Shinjuku, Tokyo",    rating: 8.5, ratingSource: "Booking.com",    reviewCount: 4100, highlights: ["Design hotel", "Rooftop bar", "Great value"] },
    { name: "APA Hotel Shinjuku",    stars: 3, hotelType: "hotel",    location: "Kabukicho, Tokyo",   rating: 7.9, ratingSource: "TripAdvisor",    reviewCount: 6800, highlights: ["Central location", "Compact & clean", "Budget-friendly"] },
    { name: "Khaosan Tokyo Ninja",   stars: 3, hotelType: "guesthouse", location: "Asakusa, Tokyo",   rating: 8.1, ratingSource: "Booking.com",    reviewCount: 3200, highlights: ["Cultural district", "Quirky design", "Walking to temples"] },
  ],
  paris: [
    { name: "Le Bristol Paris",       stars: 5, hotelType: "hotel",    location: "8th arr., Paris",   rating: 9.5, ratingSource: "Google Reviews", reviewCount: 2100, highlights: ["Palace hotel", "3★ Michelin restaurant", "Garden courtyard"] },
    { name: "Hôtel Costes",           stars: 4, hotelType: "boutique", location: "Rue Saint-Honoré",  rating: 8.9, ratingSource: "TripAdvisor",    reviewCount: 1850, highlights: ["Iconic Paris bar", "Stunning decor", "Fashion district"] },
    { name: "Mama Shelter Paris",     stars: 4, hotelType: "boutique", location: "20th arr., Paris",  rating: 8.4, ratingSource: "Booking.com",    reviewCount: 5200, highlights: ["Design-led boutique", "Great rooftop", "Vibrant neighbourhood"] },
    { name: "Ibis Paris Gare de Lyon",stars: 3, hotelType: "hotel",    location: "12th arr., Paris",  rating: 7.8, ratingSource: "Booking.com",    reviewCount: 7400, highlights: ["Metro access", "Clean & reliable", "Budget pick"] },
    { name: "Generator Paris",        stars: 3, hotelType: "guesthouse", location: "10th arr., Paris",rating: 8.0, ratingSource: "TripAdvisor",    reviewCount: 4900, highlights: ["Trendy hostel-hotel", "Canal Saint-Martin", "Social atmosphere"] },
  ],
  iceland: [
    { name: "ION Adventure Hotel",    stars: 4, hotelType: "boutique", location: "Nesjavellir Geothermal Area", rating: 9.1, ratingSource: "TripAdvisor",    reviewCount: 870,  highlights: ["Northern lights viewing", "Lava field views", "Hot springs"] },
    { name: "Reykjavik EDITION",      stars: 5, hotelType: "hotel",    location: "Reykjavik harbour",           rating: 9.3, ratingSource: "Google Reviews", reviewCount: 1200, highlights: ["Harbour views", "Rooftop bar", "Spa"] },
    { name: "Hotel Rangá",            stars: 4, hotelType: "boutique", location: "South Iceland",               rating: 9.4, ratingSource: "Booking.com",    reviewCount: 640,  highlights: ["Aurora observatory", "Romantic", "Remote wilderness"] },
    { name: "Guesthouse Baldursbra",  stars: 3, hotelType: "guesthouse", location: "Reykjavik",                 rating: 8.3, ratingSource: "Booking.com",    reviewCount: 1100, highlights: ["Cosy guesthouse", "Walking distance to city", "Friendly hosts"] },
  ],
  default: [
    { name: "Four Seasons",           stars: 5, hotelType: "resort",   location: "City centre",       rating: 9.3, ratingSource: "Google Reviews", reviewCount: 2800, highlights: ["World-class service", "Exceptional dining", "Spa"] },
    { name: "Rosewood Collection",    stars: 5, hotelType: "boutique", location: "Prime location",    rating: 9.1, ratingSource: "TripAdvisor",    reviewCount: 1900, highlights: ["Iconic design", "Butler service", "Local experiences"] },
    { name: "The Grand",              stars: 5, hotelType: "hotel",    location: "City centre",       rating: 9.0, ratingSource: "Google Reviews", reviewCount: 2400, highlights: ["Grand heritage building", "Fine dining", "Concierge"] },
    { name: "Maison Boutique",        stars: 4, hotelType: "boutique", location: "Old town",          rating: 8.9, ratingSource: "Google Reviews", reviewCount: 1800, highlights: ["Local art collection", "Rooftop terrace", "Neighbourhood feel"] },
    { name: "The Mercure",            stars: 3, hotelType: "hotel",    location: "City centre",       rating: 8.0, ratingSource: "Booking.com",    reviewCount: 4500, highlights: ["Reliable mid-range", "Good location", "Clean rooms"] },
    { name: "ibis Styles",            stars: 3, hotelType: "hotel",    location: "Central district",  rating: 7.7, ratingSource: "TripAdvisor",    reviewCount: 5800, highlights: ["Great value", "Modern design", "Easy access"] },
  ],
};

function findHotelBase(destination: string): (Partial<HotelOption> & { hotelType?: HotelType })[] {
  const lower = (destination ?? "").toLowerCase();
  const key = Object.keys(HOTEL_DB).find((k) => lower.includes(k));
  return HOTEL_DB[key ?? "default"];
}


export async function searchHotels(params: HotelSearchParams): Promise<HotelOption[]> {
  // --- PRODUCTION SWAP POINT ---
  // const response = await fetch("https://distribution-xml.booking.com/2.0/json/hotels?...", {
  //   headers: { Authorization: `Basic ${process.env.BOOKING_API_KEY}` },
  // });
  // return transformBookingResponse(response);

  const base = findHotelBase(params.destination);
  const maxPrice = params.max_price_per_night ?? 1200;
  const minStars = params.min_stars ?? 4;
  const requestedTypes = (params.types ?? []) as HotelType[];

  // Per-night price bands by star rating
  const priceBand: Record<number, [number, number]> = {
    5: [350, 900],
    4: [150, 350],
    3: [60, 150],
  };

  // Map user-facing lodging types to internal hotel type tags
  // "boutique" → boutique only; "hotel" → hotel/resort; everything else → any type
  function matchesType(h: Partial<HotelOption> & { hotelType?: HotelType }): boolean {
    if (requestedTypes.length === 0) return true;
    const ht = h.hotelType ?? "hotel";
    return requestedTypes.some((t) => {
      if (t === "boutique") return ht === "boutique";
      if (t === "hotel")    return ht === "hotel";
      if (t === "resort")   return ht === "resort";
      return true; // airbnb, other types → show all (AirBnB-only handled in UI)
    });
  }

  return base
    .filter((h) => (h.stars ?? 5) >= minStars)
    .filter((h) => {
      const [lo] = priceBand[h.stars ?? 5] ?? [60, 900];
      return lo <= maxPrice;
    })
    .filter(matchesType)
    .slice(0, 3)
    .map((h) => {
      const [lo, hi] = priceBand[h.stars ?? 5] ?? [60, 900];
      const GENERIC = new Set(["city centre", "prime location", "old town", "central district"]);
      const rawLoc = (h.location ?? "").toLowerCase();
      const fullLocation = GENERIC.has(rawLoc) ? params.destination : (h.location ?? params.destination);
      return {
        id: uuid(),
        name: h.name!,
        stars: h.stars!,
        location: fullLocation,
        pricePerNight: Math.min(randomInt(lo, hi), maxPrice),
        currency: "USD",
        rating: h.rating!,
        ratingSource: h.ratingSource,
        reviewCount: h.reviewCount!,
        highlights: h.highlights!,
        imageUrl: `https://picsum.photos/seed/${encodeURIComponent(h.name!)}/800/400`,
        bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(h.name + " " + params.destination)}&order=score`,
      };
    });
}
