// Structured, keyword-matched providers for inter-city ferry/train transport
// — same shape and matching approach as lib/data/airportRouting.ts's
// ROUTING_DB, but scoped to the handful of destinations with a real regional
// operator worth naming, rather than every destination this app has content
// for. An unmatched destination (most of the world) simply gets no
// ground-transport stage in the itinerary review wizard — see
// getGroundTransportProvider.

export interface GroundTransportProvider {
  keywords: string[];
  mode: "ferry" | "train";
  provider: string;
  // A real provider search-results URL with {from}/{to}/{date} placeholders,
  // filled in by lib/api/groundTransport.ts's searchGroundTransport(). Exact
  // query-param names aren't guaranteed to match either site's actual
  // frontend precisely — see the PRODUCTION SWAP POINT comment there for why
  // that's fine for now.
  bookingUrlTemplate: string;
}

const PROVIDERS: GroundTransportProvider[] = [
  {
    keywords: ["greece", "athens", "santorini", "mykonos", "crete", "rhodes", "corfu", "ios", "paros", "naxos", "cyclades"],
    mode: "ferry",
    provider: "Ferryhopper",
    bookingUrlTemplate: "https://www.ferryhopper.com/en/search/{from}/{to}/{date}",
  },
  {
    keywords: ["france", "paris", "provence", "nice", "lyon", "bordeaux", "normandy", "alsace", "french riviera", "côte d'azur", "monaco"],
    mode: "train",
    provider: "SNCF Connect",
    bookingUrlTemplate: "https://www.sncf-connect.com/en/search?origin={from}&destination={to}&outwardDate={date}",
  },
];

export function getGroundTransportProvider(text: string): GroundTransportProvider | null {
  const lower = text.toLowerCase();
  return PROVIDERS.find((p) => p.keywords.some((kw) => lower.includes(kw))) ?? null;
}
