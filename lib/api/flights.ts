// Flights API module
// Production: swap mock data for real Amadeus API calls
// Amadeus docs: https://developers.amadeus.com/self-service/category/flights

import { v4 as uuid } from "uuid";
import type { FlightOption } from "@/types/trip";
import { randomInt } from "@/lib/utils";

interface FlightSearchParams {
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  cabin_class?: string;
  preferred_airlines?: string[];
  nonstop_only?: boolean;
  lowest_fare_mode?: boolean;
}

// Realistic mock data keyed by destination region
const AIRLINE_BOOKING_URLS: Record<string, string> = {
  "DL": "https://www.delta.com/us/en/flight-search/book-a-flight",
  "UA": "https://www.united.com/en/us/fsr/choose-flights",
  "AA": "https://www.aa.com/booking/find-flights",
  "SQ": "https://www.singaporeair.com/en_UK/ppsclub-krisflyer/flights/search-flights",
  "EK": "https://www.emirates.com/us/english/book/flights",
  "BA": "https://www.britishairways.com/travel/fx/public/en_gb",
  "LH": "https://www.lufthansa.com/us/en/homepage",
  "AF": "https://wwws.airfrance.us/",
  "QR": "https://www.qatarairways.com/en-us/flights.html",
  "CX": "https://www.cathaypacific.com/cx/en_US/book-a-trip/flights.html",
  "ITA": "https://www.ita-airways.com/en_us",
  "AZ": "https://www.ita-airways.com/en_us",
  "AS": "https://www.alaskaair.com/booking/reservation-flights",
};

const MOCK_AIRLINES = [
  { name: "Delta Air Lines",    code: "DL", alliance: "skyteam"       },
  { name: "United Airlines",    code: "UA", alliance: "star_alliance"  },
  { name: "American Airlines",  code: "AA", alliance: "oneworld"       },
  { name: "Alaska Airlines",    code: "AS", alliance: "oneworld"       },
  { name: "Singapore Airlines", code: "SQ", alliance: "star_alliance"  },
  { name: "Emirates",           code: "EK", alliance: "none"           },
  { name: "British Airways",    code: "BA", alliance: "oneworld"       },
  { name: "Lufthansa",          code: "LH", alliance: "star_alliance"  },
  { name: "Air France",         code: "AF", alliance: "skyteam"        },
];

const CABIN_MULTIPLIER: Record<string, number> = {
  economy: 1, premium_economy: 2.2, business: 4.5, first: 8,
};


function pickAirlines(
  preferred: string[] = [],
  count = 3
): typeof MOCK_AIRLINES[number][] {
  const matched = MOCK_AIRLINES.filter((a) =>
    preferred.some((p) => a.name.toLowerCase().includes(p.toLowerCase()))
  );
  const rest = MOCK_AIRLINES.filter((a) => !matched.includes(a));
  const pool = [...matched, ...rest];
  return pool.slice(0, count);
}

export async function searchFlights(params: FlightSearchParams): Promise<FlightOption[]> {
  // --- PRODUCTION SWAP POINT ---
  // const amadeusToken = await getAmadeusToken();
  // const response = await fetch(`https://test.api.amadeus.com/v2/shopping/flight-offers?...`);
  // return transformAmadeusResponse(response);

  // Guard against malformed tool calls from the AI (missing required params)
  if (!params.origin || !params.destination || !params.departure_date) return [];

  // Lowest-fare mode: ignore airline prefs, use all carriers, economy default
  const lowestFare = params.lowest_fare_mode ?? false;
  const effectiveCabin = lowestFare ? "economy" : (params.cabin_class ?? "economy");
  const effectiveMult  = CABIN_MULTIPLIER[effectiveCabin];
  const airlines = lowestFare
    ? [...MOCK_AIRLINES].sort(() => Math.random() - 0.5).slice(0, 3)
    : pickAirlines(params.preferred_airlines ?? [], 3);

  const basePrice = lowestFare ? randomInt(300, 900) : randomInt(600, 2400);

  const results = airlines.map((airline, idx) => ({
    id: uuid(),
    airline: airline.name,
    flightNumber: `${airline.code}${randomInt(100, 999)}`,
    origin: params.origin,
    destination: params.destination,
    departureTime: `${params.departure_date}T${randomInt(6, 14).toString().padStart(2, "0")}:${["00","15","30","45"][idx % 4]}:00`,
    arrivalTime: `${params.departure_date}T${randomInt(14, 23).toString().padStart(2, "0")}:${["00","30"][idx % 2]}:00`,
    duration: `${randomInt(9, 17)}h ${randomInt(0, 59)}m`,
    // Nonstop preference applies regardless of lowest-fare mode — the two
    // are independent filters, not mutually exclusive.
    stops: params.nonstop_only ? 0 : (idx === 0 ? 0 : randomInt(0, 1)),
    price: Math.round((basePrice + idx * randomInt(80, 250)) * effectiveMult),
    currency: "USD",
    cabinClass: effectiveCabin,
    bookingUrl: AIRLINE_BOOKING_URLS[airline.code] ?? `https://www.google.com/travel/flights`,
  }));

  // In lowest-fare mode, sort cheapest first
  return lowestFare ? results.sort((a, b) => a.price - b.price) : results;
}
