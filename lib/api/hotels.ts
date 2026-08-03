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
  limit?: number;
}

// Hotel type tags used to filter by accommodation preference
type HotelType = "hotel" | "boutique" | "resort" | "guesthouse";

// Curated mock hotel data per destination keyword
const HOTEL_DB: Record<string, (Partial<HotelOption> & { hotelType?: HotelType })[]> = {
  rome: [
    { name: "Hotel de Russie",          stars: 5, hotelType: "hotel",    location: "Via del Babuino, Rome",      rating: 9.5, ratingSource: "Google Reviews", reviewCount: 2100, highlights: ["Secret garden", "Rocco Forte spa", "Steps from Piazza del Popolo"] },
    { name: "J.K. Place Roma",          stars: 5, hotelType: "boutique", location: "Via di Monte d'Oro, Rome",   rating: 9.4, ratingSource: "TripAdvisor",    reviewCount: 980,  highlights: ["Intimate boutique feel", "Rooftop terrace", "Near the Pantheon"] },
    { name: "Hotel Raphael",            stars: 4, hotelType: "boutique", location: "Largo Febo, Rome",           rating: 9.0, ratingSource: "Booking.com",    reviewCount: 2400, highlights: ["Ivy-covered façade", "Rooftop with Pantheon views", "Art collection"] },
    { name: "Hotel Santa Maria",        stars: 4, hotelType: "hotel",    location: "Trastevere, Rome",           rating: 8.8, ratingSource: "Google Reviews", reviewCount: 3100, highlights: ["Trastevere neighbourhood", "Orange garden courtyard", "Quiet side streets"] },
    { name: "Hotel Arco del Lauro",     stars: 3, hotelType: "guesthouse", location: "Trastevere, Rome",         rating: 8.6, ratingSource: "Booking.com",    reviewCount: 4200, highlights: ["Charming guesthouse", "Walking distance to everything", "Great value"] },
    { name: "Hotel Navona",             stars: 3, hotelType: "hotel",    location: "Piazza Navona, Rome",        rating: 8.2, ratingSource: "TripAdvisor",    reviewCount: 5600, highlights: ["Unbeatable location", "Simple and clean", "Budget-friendly"] },
  ],
  amalfi: [
    { name: "Hotel Santa Caterina",     stars: 5, hotelType: "hotel",    location: "Amalfi town",                rating: 9.6, ratingSource: "Google Reviews", reviewCount: 1450, highlights: ["Clifftop with sea elevator", "Saltwater pool", "Lemon grove gardens"] },
    { name: "Le Sirenuse",              stars: 5, hotelType: "boutique", location: "Positano",                   rating: 9.5, ratingSource: "TripAdvisor",    reviewCount: 1820, highlights: ["Iconic Positano views", "Pool terrace", "La Sponda restaurant"] },
    { name: "Hotel Luna Convento",      stars: 4, hotelType: "hotel",    location: "Amalfi town",                rating: 8.9, ratingSource: "Booking.com",    reviewCount: 2300, highlights: ["Former 13th-century convent", "Seafront pool", "Byzantine cloister"] },
    { name: "Casa Angelina",            stars: 4, hotelType: "boutique", location: "Praiano",                    rating: 9.2, ratingSource: "Google Reviews", reviewCount: 1100, highlights: ["Clifftop infinity pool", "White minimalist design", "Quieter than Positano"] },
    { name: "Hotel Buca di Bacco",      stars: 3, hotelType: "hotel",    location: "Positano",                   rating: 8.4, ratingSource: "Booking.com",    reviewCount: 3400, highlights: ["Right on the beach", "Terrace restaurant", "Lively atmosphere"] },
    { name: "Albergo A'Scalinatella",   stars: 3, hotelType: "guesthouse", location: "Ravello",                  rating: 8.7, ratingSource: "TripAdvisor",    reviewCount: 1900, highlights: ["Quiet Ravello hilltop", "Garden with views", "Family-run charm"] },
  ],
  dolomit: [
    { name: "Rosa Alpina",              stars: 5, hotelType: "boutique", location: "San Cassiano, Alta Badia",   rating: 9.7, ratingSource: "Google Reviews", reviewCount: 890,  highlights: ["St. Hubertus 3★ Michelin", "Ski-in/ski-out", "Legendary spa"] },
    { name: "Cristallo Resort & Spa",   stars: 5, hotelType: "resort",   location: "Cortina d'Ampezzo",          rating: 9.3, ratingSource: "TripAdvisor",    reviewCount: 1540, highlights: ["Palace hotel since 1901", "Panoramic Dolomite views", "Full spa"] },
    { name: "Hotel Adler Dolomiti",     stars: 4, hotelType: "resort",   location: "Val Gardena",                rating: 9.1, ratingSource: "Booking.com",    reviewCount: 2100, highlights: ["Ski-in/ski-out", "Panoramic pool", "Traditional South Tyrolean style"] },
    { name: "Chalet Gerard",            stars: 4, hotelType: "boutique", location: "Corvara, Alta Badia",        rating: 9.0, ratingSource: "Google Reviews", reviewCount: 1200, highlights: ["Authentic mountain chalet", "Panoramic terrace", "Local wine cellar"] },
    { name: "Hotel Posta Zirm",         stars: 3, hotelType: "hotel",    location: "Corvara, Alta Badia",        rating: 8.5, ratingSource: "Booking.com",    reviewCount: 2800, highlights: ["Classic mountain hotel", "Good ski access", "Traditional cuisine"] },
    { name: "Garni Pia",                stars: 3, hotelType: "guesthouse", location: "Ortisei, Val Gardena",     rating: 8.8, ratingSource: "TripAdvisor",    reviewCount: 1600, highlights: ["Family-run guesthouse", "Mountain breakfast", "Great value"] },
  ],
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

const HOTEL_ALIASES: Record<string, string> = {
  "positano": "amalfi", "ravello": "amalfi", "praiano": "amalfi", "sorrento": "amalfi",
  "cortina":  "dolomit","bolzano": "dolomit","merano":  "dolomit","alta badia": "dolomit",
  "val gardena": "dolomit","ortisei": "dolomit","corvara": "dolomit",
  "florence": "rome",   "tuscany": "rome",   "venice": "rome",    "naples": "rome",
  "milan":    "rome",   "sicily":  "rome",   "bologna": "rome",   "italy": "rome",
};

function findHotelBase(destination: string): (Partial<HotelOption> & { hotelType?: HotelType })[] {
  const lower = (destination ?? "").toLowerCase();
  const direct = Object.keys(HOTEL_DB).find((k) => lower.includes(k));
  if (direct) return HOTEL_DB[direct];
  const alias = Object.entries(HOTEL_ALIASES).find(([a]) => lower.includes(a));
  return HOTEL_DB[alias?.[1] ?? "default"];
}


export async function searchHotels(params: HotelSearchParams): Promise<HotelOption[]> {
  // --- PRODUCTION SWAP POINT ---
  // const response = await fetch("https://distribution-xml.booking.com/2.0/json/hotels?...", {
  //   headers: { Authorization: `Basic ${process.env.BOOKING_API_KEY}` },
  // });
  // return transformBookingResponse(response);

  const base = findHotelBase(params.destination);
  const maxPrice = params.max_price_per_night ?? 300;  // conservative default — AI should pass explicit value
  const minStars = params.min_stars ?? 3;
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
    // Highest-rated first — callers that only want a handful (e.g. the AI's
    // own itinerary-generation search) slice afterward; the Lodging step's
    // "load more" shows the rest of this same rating-ordered list. Capped at
    // `limit` (well above what any caller currently shows) so a real
    // production API — potentially returning hundreds of results — doesn't
    // get fully constructed here just to be discarded downstream.
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, params.limit ?? 12)
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
        city: params.destination,
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
