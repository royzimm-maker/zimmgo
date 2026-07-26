// Lat/lng lookup for airports and cities used in itinerary maps

export interface LatLng { lat: number; lng: number }

// IATA airport code → coordinates
export const AIRPORT_COORDS: Record<string, LatLng> = {
  // North America (departures only — kept for completeness)
  JFK: { lat: 40.6413, lng: -73.7781 },
  EWR: { lat: 40.6895, lng: -74.1745 },
  LGA: { lat: 40.7769, lng: -73.8740 },
  LAX: { lat: 33.9425, lng: -118.4081 },
  ORD: { lat: 41.9742, lng: -87.9073 },
  SFO: { lat: 37.6213, lng: -122.3790 },
  MIA: { lat: 25.7959, lng: -80.2870 },
  BOS: { lat: 42.3656, lng: -71.0096 },
  DFW: { lat: 32.8998, lng: -97.0403 },
  ATL: { lat: 33.6407, lng: -84.4277 },
  SEA: { lat: 47.4502, lng: -122.3088 },
  DEN: { lat: 39.8561, lng: -104.6737 },
  IAD: { lat: 38.9531, lng: -77.4565 },
  DCA: { lat: 38.8521, lng: -77.0377 },
  YYZ: { lat: 43.6777, lng: -79.6248 },
  // Europe arrivals
  LHR: { lat: 51.4700, lng: -0.4543 },
  LGW: { lat: 51.1537, lng: -0.1821 },
  CDG: { lat: 49.0097, lng:  2.5479 },
  ORY: { lat: 48.7262, lng:  2.3652 },
  AMS: { lat: 52.3086, lng:  4.7639 },
  FRA: { lat: 50.0379, lng:  8.5622 },
  MUC: { lat: 48.3538, lng: 11.7861 },
  FCO: { lat: 41.7999, lng: 12.2462 },
  CIA: { lat: 41.7994, lng: 12.5949 },
  MXP: { lat: 45.6306, lng:  8.7281 },
  VCE: { lat: 45.5053, lng: 12.3519 },
  NAP: { lat: 40.8860, lng: 14.2908 },
  BCN: { lat: 41.2974, lng:  2.0833 },
  MAD: { lat: 40.4983, lng: -3.5676 },
  LIS: { lat: 38.7742, lng: -9.1342 },
  ATH: { lat: 37.9364, lng: 23.9445 },
  PRG: { lat: 50.1008, lng: 14.2600 },
  VIE: { lat: 48.1103, lng: 16.5697 },
  ZRH: { lat: 47.4647, lng:  8.5492 },
  CPH: { lat: 55.6181, lng: 12.6561 },
  OSL: { lat: 60.1939, lng: 11.1004 },
  ARN: { lat: 59.6519, lng: 17.9186 },
  HEL: { lat: 60.3172, lng: 24.9633 },
  KEF: { lat: 63.9850, lng: -22.6056 },
  DUB: { lat: 53.4213, lng: -6.2701 },
  // Asia arrivals
  NRT: { lat: 35.7720, lng: 140.3929 },
  HND: { lat: 35.5494, lng: 139.7798 },
  KIX: { lat: 34.4347, lng: 135.2440 },
  ICN: { lat: 37.4602, lng: 126.4407 },
  PVG: { lat: 31.1443, lng: 121.8083 },
  HKG: { lat: 22.3080, lng: 113.9185 },
  SIN: { lat:  1.3644, lng: 103.9915 },
  BKK: { lat: 13.6900, lng: 100.7501 },
  DEL: { lat: 28.5562, lng: 77.1000 },
  BOM: { lat: 19.0896, lng: 72.8656 },
  DXB: { lat: 25.2532, lng: 55.3657 },
  DOH: { lat: 25.2609, lng: 51.6138 },
  // Americas
  CUN: { lat: 21.0365, lng: -86.8771 },
  GRU: { lat: -23.4356, lng: -46.4731 },
  EZE: { lat: -34.8222, lng: -58.5358 },
  // Africa / Oceania
  JNB: { lat: -26.1392, lng: 28.2460 },
  SYD: { lat: -33.9399, lng: 151.1753 },
  AKL: { lat: -37.0082, lng: 174.7850 },
};

// City / region name → coordinates (lowercase keys for easy matching)
export const CITY_COORDS: Record<string, LatLng> = {
  // Italy
  rome:           { lat: 41.9028, lng: 12.4964 },
  "amalfi coast": { lat: 40.6333, lng: 14.6029 },
  amalfi:         { lat: 40.6333, lng: 14.6029 },
  positano:       { lat: 40.6282, lng: 14.4852 },
  dolomites:      { lat: 46.4102, lng: 11.8440 },
  venice:         { lat: 45.4408, lng: 12.3155 },
  florence:       { lat: 43.7696, lng: 11.2558 },
  milan:          { lat: 45.4654, lng:  9.1859 },
  naples:         { lat: 40.8518, lng: 14.2681 },
  sicily:         { lat: 37.5999, lng: 14.0154 },
  tuscany:        { lat: 43.7711, lng: 11.2486 },
  // France
  paris:          { lat: 48.8566, lng:  2.3522 },
  nice:           { lat: 43.7102, lng:  7.2620 },
  marseille:      { lat: 43.2965, lng:  5.3698 },
  lyon:           { lat: 45.7640, lng:  4.8357 },
  bordeaux:       { lat: 44.8378, lng: -0.5792 },
  // Spain
  barcelona:      { lat: 41.3851, lng:  2.1734 },
  madrid:         { lat: 40.4168, lng: -3.7038 },
  seville:        { lat: 37.3886, lng: -5.9823 },
  granada:        { lat: 37.1773, lng: -3.5986 },
  // Portugal
  lisbon:         { lat: 38.7223, lng: -9.1393 },
  porto:          { lat: 41.1579, lng: -8.6291 },
  algarve:        { lat: 37.0179, lng: -7.9306 },
  // Japan
  tokyo:          { lat: 35.6762, lng: 139.6503 },
  kyoto:          { lat: 35.0116, lng: 135.7681 },
  osaka:          { lat: 34.6937, lng: 135.5023 },
  hiroshima:      { lat: 34.3853, lng: 132.4553 },
  nara:           { lat: 34.6851, lng: 135.8048 },
  hakone:         { lat: 35.2322, lng: 139.1069 },
  // Iceland
  reykjavik:      { lat: 64.1466, lng: -21.9426 },
  "south iceland":{ lat: 63.9996, lng: -19.6057 },
  akureyri:       { lat: 65.6885, lng: -18.1262 },
  // Greece
  athens:         { lat: 37.9838, lng: 23.7275 },
  santorini:      { lat: 36.3932, lng: 25.4615 },
  mykonos:        { lat: 37.4467, lng: 25.3289 },
  crete:          { lat: 35.2401, lng: 24.8093 },
  // UK
  london:         { lat: 51.5074, lng: -0.1278 },
  edinburgh:      { lat: 55.9533, lng: -3.1883 },
  bath:           { lat: 51.3811, lng: -2.3590 },
  oxford:         { lat: 51.7520, lng: -1.2577 },
  // Thailand
  bangkok:        { lat: 13.7563, lng: 100.5018 },
  "chiang mai":   { lat: 18.7883, lng: 98.9853 },
  phuket:         { lat:  7.8804, lng: 98.3923 },
  "koh samui":    { lat:  9.5120, lng: 100.0136 },
  // Other
  amsterdam:      { lat: 52.3676, lng:  4.9041 },
  prague:         { lat: 50.0755, lng: 14.4378 },
  vienna:         { lat: 48.2082, lng: 16.3738 },
  budapest:       { lat: 47.4979, lng: 19.0402 },
  berlin:         { lat: 52.5200, lng: 13.4050 },
  zurich:         { lat: 47.3769, lng:  8.5417 },
  dubai:          { lat: 25.2048, lng: 55.2708 },
  istanbul:       { lat: 41.0082, lng: 28.9784 },
  singapore:      { lat:  1.3521, lng: 103.8198 },
  bali:           { lat: -8.3405, lng: 115.0920 },
  "new york":     { lat: 40.7128, lng: -74.0060 },
  "los angeles":  { lat: 34.0522, lng: -118.2437 },
  sydney:         { lat: -33.8688, lng: 151.2093 },
  melbourne:      { lat: -37.8136, lng: 144.9631 },
};

export function lookupAirport(code: string): LatLng | null {
  return AIRPORT_COORDS[code.toUpperCase()] ?? null;
}

export function lookupCity(name: string): LatLng | null {
  const lower = name.toLowerCase().trim();
  // Exact match first
  if (CITY_COORDS[lower]) return CITY_COORDS[lower];
  // Partial match — find the first key that appears in the name or vice versa
  const key = Object.keys(CITY_COORDS).find(
    (k) => lower.includes(k) || k.includes(lower)
  );
  return key ? CITY_COORDS[key] : null;
}
