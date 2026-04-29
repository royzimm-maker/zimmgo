// Hotels API module
// Production: integrate with Booking.com Demand API or Airbnb API
// Booking.com docs: https://developers.booking.com

import { v4 as uuid } from "uuid";
import type { HotelOption } from "@/types/trip";

interface HotelSearchParams {
  destination: string;
  check_in?: string;
  check_out?: string;
  min_stars?: number;
  types?: string[];
  max_price_per_night?: number;
  amenities?: string[];
}

// Rating sources cycled per hotel to show variety
const RATING_SOURCES = ["Google Reviews", "TripAdvisor", "Booking.com", "Google Reviews", "TripAdvisor"];

// Curated mock hotel data per destination keyword
const HOTEL_DB: Record<string, Partial<HotelOption>[]> = {
  tokyo: [
    { name: "Aman Tokyo",          stars: 5, location: "Otemachi, Tokyo",    rating: 9.6, ratingSource: "Google Reviews", reviewCount: 1240, highlights: ["Stunning city views", "Aman spa", "Traditional aesthetics"] },
    { name: "The Peninsula Tokyo", stars: 5, location: "Yurakucho, Tokyo",   rating: 9.4, ratingSource: "TripAdvisor",    reviewCount: 2180, highlights: ["Impeccable service", "Michelin dining", "Ginza proximity"] },
    { name: "Park Hyatt Tokyo",    stars: 5, location: "Shinjuku, Tokyo",    rating: 9.2, ratingSource: "Booking.com",    reviewCount: 3400, highlights: ["Lost in Translation fame", "Pool with Mt. Fuji views", "Jazz bar"] },
  ],
  paris: [
    { name: "Le Bristol Paris",    stars: 5, location: "8th arr., Paris",    rating: 9.5, ratingSource: "Google Reviews", reviewCount: 2100, highlights: ["Palace hotel", "3★ Michelin restaurant", "Garden courtyard"] },
    { name: "Hôtel Costes",        stars: 4, location: "Rue Saint-Honoré",   rating: 8.9, ratingSource: "TripAdvisor",    reviewCount: 1850, highlights: ["Iconic Paris bar", "Stunning decor", "Fashion district"] },
    { name: "Mama Shelter Paris",  stars: 4, location: "20th arr., Paris",   rating: 8.4, ratingSource: "Booking.com",    reviewCount: 5200, highlights: ["Design-led boutique", "Great rooftop", "Vibrant neighbourhood"] },
  ],
  iceland: [
    { name: "ION Adventure Hotel", stars: 4, location: "Nesjavellir Geothermal Area", rating: 9.1, ratingSource: "TripAdvisor",    reviewCount: 870,  highlights: ["Northern lights viewing", "Lava field views", "Hot springs"] },
    { name: "Reykjavik EDITION",   stars: 5, location: "Reykjavik harbour",            rating: 9.3, ratingSource: "Google Reviews", reviewCount: 1200, highlights: ["Harbour views", "Rooftop bar", "Spa"] },
    { name: "Hotel Rangá",         stars: 4, location: "South Iceland",                rating: 9.4, ratingSource: "Booking.com",    reviewCount: 640,  highlights: ["Aurora observatory", "Romantic", "Remote wilderness"] },
  ],
  default: [
    { name: "Four Seasons",          stars: 5, location: "City centre",       rating: 9.3, ratingSource: "Google Reviews", reviewCount: 2800, highlights: ["World-class service", "Exceptional dining", "Spa"] },
    { name: "Rosewood Collection",   stars: 5, location: "Prime location",    rating: 9.1, ratingSource: "TripAdvisor",    reviewCount: 1900, highlights: ["Iconic design", "Butler service", "Local experiences"] },
    { name: "Aman Resorts",          stars: 5, location: "Exclusive setting", rating: 9.7, ratingSource: "Booking.com",    reviewCount: 890,  highlights: ["Serenity & privacy", "Award-winning spa", "Expert guides"] },
    { name: "Boutique Design Hotel", stars: 4, location: "Cultural district", rating: 8.8, ratingSource: "Google Reviews", reviewCount: 3100, highlights: ["Local art collection", "Rooftop terrace", "Neighbourhood feel"] },
  ],
};

function findHotelBase(destination: string): Partial<HotelOption>[] {
  const key = Object.keys(HOTEL_DB).find((k) =>
    destination.toLowerCase().includes(k)
  );
  return HOTEL_DB[key ?? "default"];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

  return base
    .filter((h) => (h.stars ?? 5) >= minStars)
    .slice(0, 3)
    .map((h) => {
      const fullLocation = `${h.location}, ${params.destination}`;
      return {
        id: uuid(),
        name: h.name!,
        stars: h.stars!,
        location: fullLocation,
        pricePerNight: Math.min(randomInt(280, 900), maxPrice),
        currency: "USD",
        rating: h.rating!,
        ratingSource: h.ratingSource,
        reviewCount: h.reviewCount!,
        highlights: h.highlights!,
        imageUrl: undefined,
        // Placeholder — swap for real Booking.com affiliate deep-link
        bookingUrl: `https://www.booking.com/search.html?ss=${encodeURIComponent(h.name + " " + params.destination)}`,
      };
    });
}
