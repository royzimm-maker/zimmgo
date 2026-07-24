// Airport data and destination-specific routing suggestions.
// Arrival airports are matched by keyword against the user's free-text destination.

export interface Airport {
  code: string;   // IATA
  name: string;
  city: string;
  country: string;
}

export interface ArrivalSuggestion {
  code: string;
  city: string;
  reason: string;
  recommended?: boolean;
}

export interface RoutingSuggestion {
  keywords: string[];
  arrivalAirports: ArrivalSuggestion[];
  suggestedRoute: string;
  routingWhy: string;
  travelTips: string[];
}

// ── Major departure airports (for autocomplete) ───────────────────────────────

export const DEPARTURE_AIRPORTS: Airport[] = [
  // North America
  { code: "JFK", name: "John F. Kennedy International",  city: "New York",        country: "USA" },
  { code: "EWR", name: "Newark Liberty International",   city: "Newark / NYC",    country: "USA" },
  { code: "LGA", name: "LaGuardia Airport",              city: "New York",        country: "USA" },
  { code: "LAX", name: "Los Angeles International",      city: "Los Angeles",     country: "USA" },
  { code: "ORD", name: "O'Hare International",           city: "Chicago",         country: "USA" },
  { code: "MDW", name: "Midway International",           city: "Chicago",         country: "USA" },
  { code: "SFO", name: "San Francisco International",    city: "San Francisco",   country: "USA" },
  { code: "MIA", name: "Miami International",            city: "Miami",           country: "USA" },
  { code: "BOS", name: "Logan International",            city: "Boston",          country: "USA" },
  { code: "DFW", name: "Dallas/Fort Worth International",city: "Dallas",          country: "USA" },
  { code: "ATL", name: "Hartsfield-Jackson Atlanta",     city: "Atlanta",         country: "USA" },
  { code: "SEA", name: "Seattle-Tacoma International",   city: "Seattle",         country: "USA" },
  { code: "DEN", name: "Denver International",           city: "Denver",          country: "USA" },
  { code: "IAD", name: "Dulles International",           city: "Washington DC",   country: "USA" },
  { code: "DCA", name: "Reagan National Airport",        city: "Washington DC",   country: "USA" },
  { code: "PHX", name: "Phoenix Sky Harbor",             city: "Phoenix",         country: "USA" },
  { code: "LAS", name: "Harry Reid International",       city: "Las Vegas",       country: "USA" },
  { code: "MSP", name: "Minneapolis–Saint Paul",         city: "Minneapolis",     country: "USA" },
  { code: "DTW", name: "Detroit Metropolitan",           city: "Detroit",         country: "USA" },
  { code: "HOU", name: "William P. Hobby Airport",       city: "Houston",         country: "USA" },
  { code: "YYZ", name: "Toronto Pearson International",  city: "Toronto",         country: "Canada" },
  { code: "YVR", name: "Vancouver International",        city: "Vancouver",       country: "Canada" },
  { code: "YUL", name: "Montréal-Trudeau International", city: "Montreal",        country: "Canada" },
  // Europe
  { code: "LHR", name: "Heathrow Airport",               city: "London",          country: "UK" },
  { code: "LGW", name: "Gatwick Airport",                city: "London",          country: "UK" },
  { code: "CDG", name: "Charles de Gaulle Airport",      city: "Paris",           country: "France" },
  { code: "AMS", name: "Amsterdam Schiphol",             city: "Amsterdam",       country: "Netherlands" },
  { code: "FRA", name: "Frankfurt Airport",              city: "Frankfurt",       country: "Germany" },
  { code: "MUC", name: "Munich Airport",                 city: "Munich",          country: "Germany" },
  { code: "ZRH", name: "Zürich Airport",                 city: "Zürich",          country: "Switzerland" },
  { code: "MAD", name: "Adolfo Suárez Madrid–Barajas",   city: "Madrid",          country: "Spain" },
  { code: "BCN", name: "Josep Tarradellas Barcelona",    city: "Barcelona",       country: "Spain" },
  { code: "FCO", name: "Leonardo da Vinci (Fiumicino)",  city: "Rome",            country: "Italy" },
  { code: "MXP", name: "Milan Malpensa Airport",         city: "Milan",           country: "Italy" },
  // Asia-Pacific
  { code: "NRT", name: "Narita International Airport",   city: "Tokyo",           country: "Japan" },
  { code: "HND", name: "Haneda Airport",                 city: "Tokyo",           country: "Japan" },
  { code: "SIN", name: "Singapore Changi Airport",       city: "Singapore",       country: "Singapore" },
  { code: "HKG", name: "Hong Kong International",        city: "Hong Kong",       country: "Hong Kong" },
  { code: "SYD", name: "Sydney Kingsford Smith",         city: "Sydney",          country: "Australia" },
  { code: "MEL", name: "Melbourne Airport",              city: "Melbourne",       country: "Australia" },
  // Middle East
  { code: "DXB", name: "Dubai International Airport",    city: "Dubai",           country: "UAE" },
  { code: "DOH", name: "Hamad International Airport",    city: "Doha",            country: "Qatar" },
];

// ── Destination routing suggestions ───────────────────────────────────────────

export const ROUTING_DB: RoutingSuggestion[] = [
  {
    keywords: ["italy", "tuscany", "florence", "rome", "amalfi", "dolomites", "venice", "milan", "sicily", "naples", "bologna", "cinque terre", "positano", "ravello"],
    arrivalAirports: [
      { code: "FCO", city: "Rome",   reason: "Best gateway for central Italy — Rome is the natural starting point for Tuscany, Amalfi, and the south.", recommended: true },
      { code: "VCE", city: "Venice", reason: "Ideal if starting in the north — Venice, the Dolomites, and Lake Como are all accessible from here." },
      { code: "MXP", city: "Milan",  reason: "Best entry point for the Italian Lakes, Milan, and the western Dolomites. Good open-jaw option for returning from the south." },
      { code: "NAP", city: "Naples", reason: "Fly directly into Naples if the Amalfi Coast is your primary destination — skips the Rome-to-Amalfi overland journey." },
    ],
    suggestedRoute: "Fly into Rome (FCO) → 2–3 days in Rome → high-speed train to Florence (90 min) → explore Tuscany by car or day-trips → north to the Dolomites by train/car → finish in Venice and fly home from VCE. Alternatively, an open-jaw — fly in to Rome, out from Milan — avoids backtracking entirely.",
    routingWhy: "This routing is efficient because Italy's high-speed rail connects Rome, Florence, and Bologna seamlessly — no car needed until the Dolomites. Finishing in Venice or Milan means you exit where you are rather than retracing your route south to Rome.",
    travelTips: [
      "The Trenitalia Frecciarossa runs Rome–Florence every 30 minutes; book in advance for ~€30 vs €80+ at the door",
      "The Dolomites require a hire car — public transit here is scenic but slow",
      "Amalfi Coast roads are famously narrow — consider basing yourself in Positano or Ravello and taking ferries between towns",
      "Book the Uffizi Gallery (Florence) and Pompeii weeks in advance — timed entry fills up fast",
    ],
  },
  {
    keywords: ["greece", "athens", "santorini", "mykonos", "crete", "rhodes", "corfu", "ios", "paros", "naxos", "cyclades"],
    arrivalAirports: [
      { code: "ATH", city: "Athens",    reason: "The only practical gateway — all island ferries and domestic flights depart from Athens (or Piraeus port, 45 min away).", recommended: true },
      { code: "JTR", city: "Santorini", reason: "Fly direct to Santorini if it's your primary destination — skip the Athens connection if flights allow." },
      { code: "HER", city: "Crete",     reason: "Direct to Heraklion if Crete is your first or only stop — avoids Athens entirely." },
    ],
    suggestedRoute: "Fly into Athens (ATH) → 2 days in Athens → ferry from Piraeus to the Cyclades (Mykonos, Paros, Naxos chain) → fast ferry to Santorini → fly home from Santorini (JTR) or back via Athens. The Cyclades island-hop flows naturally west to east.",
    routingWhy: "Island-hopping west to east (Mykonos → Paros → Naxos → Santorini) follows the natural ferry routes and prevailing winds, meaning faster travel times. Flying back from Santorini instead of returning to Athens saves a day and avoids the busy Piraeus port.",
    travelTips: [
      "Book ferries on ferryscanner.com or directferries.com — don't leave this to chance in July/August",
      "Fast ferries (2–3 hours) vs slow ferries (5–7 hours) — the price difference is worth it for most routes",
      "Santorini's cable car to Oia fills up; consider the donkey path or taxi alternative at busy times",
      "Athens to Piraeus: metro Line 1 to Piraeus station takes 25 minutes — much faster than a taxi",
    ],
  },
  {
    keywords: ["japan", "tokyo", "kyoto", "osaka", "hiroshima", "nara", "hakone", "hokkaido", "okinawa"],
    arrivalAirports: [
      { code: "NRT", city: "Tokyo (Narita)",  reason: "More international connections; better for arriving in Tokyo and exploring east before heading west.", recommended: true },
      { code: "HND", city: "Tokyo (Haneda)",  reason: "Closer to central Tokyo (25 min vs 60 min) — ideal if your first stop is Tokyo itself." },
      { code: "KIX", city: "Osaka (Kansai)", reason: "Fly in to Osaka, do the Kyoto–Nara–Hiroshima loop west-to-east, and exit from Tokyo (HND/NRT) — the perfect open-jaw for Japan." },
    ],
    suggestedRoute: "Open-jaw: fly into Osaka (KIX) → Kyoto → Nara day trip → Hiroshima → Hakone → Tokyo → fly home from Tokyo (NRT/HND). Or reverse it — fly into Tokyo and exit from Osaka. Either way, the Shinkansen connects everything seamlessly.",
    routingWhy: "Japan's Shinkansen bullet train makes the Tokyo–Osaka corridor one of the most efficient in the world (2h30 on the Nozomi). The open-jaw routing means you always travel forward — no doubling back to your arrival city — and you see the most in the least time.",
    travelTips: [
      "The JR Pass pays off if you're travelling Tokyo–Kyoto–Hiroshima and back — calculate your routes at hyperdia.com first",
      "Book the Hiroshima–Miyajima ferry tickets in advance in peak season",
      "7-Eleven and FamilyMart ATMs reliably accept foreign cards — carry some cash for smaller restaurants",
      "IC cards (Suica/Pasmo) can be added to Apple Pay or Google Pay before you land — do this",
    ],
  },
  {
    keywords: ["france", "paris", "provence", "nice", "lyon", "bordeaux", "normandy", "alsace", "french riviera", "côte d'azur", "monaco"],
    arrivalAirports: [
      { code: "CDG", city: "Paris (Charles de Gaulle)", reason: "The main international gateway — direct trains to Paris in 30 minutes, and TGV high-speed trains to Lyon, Nice, Bordeaux all depart from here.", recommended: true },
      { code: "NCE", city: "Nice",                      reason: "Fly directly into Nice for the French Riviera, Monaco, and Provence — avoids the Paris connection entirely." },
      { code: "LYS", city: "Lyon",                      reason: "Best entry for Provence and Burgundy via Lyon — a less congested airport with good TGV connections." },
    ],
    suggestedRoute: "Fly into Paris (CDG) → 2–3 days Paris → TGV to Lyon (2h) → Provence by car → French Riviera (Nice, Monaco, Antibes) → fly home from Nice (NCE). Alternatively open-jaw — in CDG, out NCE.",
    routingWhy: "France's TGV network makes Paris a natural hub — you can reach Lyon in 2 hours, Nice in 5.5 hours, Bordeaux in 2 hours by train. The open-jaw avoids the 5.5-hour train back to Paris and lets you spend that time in Nice instead.",
    travelTips: [
      "Book TGV trains at sncf-connect.com — prices rise sharply close to departure",
      "The French Riviera is best explored by car — coastal trains are slow and crowded in summer",
      "Provence lavender fields peak late June to mid-July depending on the year",
      "Paris museum passes are worth buying if you plan to visit more than 3 major museums",
    ],
  },
  {
    keywords: ["spain", "barcelona", "madrid", "seville", "granada", "valencia", "basque", "san sebastian", "bilbao", "andalusia", "ibiza", "mallorca"],
    arrivalAirports: [
      { code: "MAD", city: "Madrid",    reason: "The natural gateway for central Spain — Renfe AVE high-speed trains to Seville, Barcelona, and Valencia all depart from Madrid.", recommended: true },
      { code: "BCN", city: "Barcelona", reason: "Best entry for Catalonia, the Costa Brava, and southern France. Also well-connected by AVE to Madrid and Valencia." },
      { code: "SVQ", city: "Seville",   reason: "Fly direct into Seville if Andalusia (Granada, Córdoba, Málaga) is your focus — skips Madrid entirely." },
    ],
    suggestedRoute: "Fly into Madrid (MAD) → 2 days Madrid → AVE to Seville (2h30) → Seville, Granada, Ronda loop → AVE or bus to Barcelona → fly home from Barcelona (BCN). Open-jaw saves the Madrid backtrack.",
    routingWhy: "Spain's AVE high-speed rail makes the Madrid–Seville–Barcelona triangle one of the most travel-efficient in Europe. Flying into Madrid and out of Barcelona means you always move forward through the country rather than retracing.",
    travelTips: [
      "Book AVE trains on renfe.com at least 2 weeks ahead — prices triple close to departure",
      "The Alhambra in Granada must be booked months in advance — it sells out without exception",
      "San Sebastián is a worthy detour from Barcelona for 2 nights — one of the best food cities in the world",
      "Ibiza and Mallorca are served by cheap Vueling/Ryanair flights from mainland airports",
    ],
  },
  {
    keywords: ["portugal", "lisbon", "porto", "algarve", "madeira", "azores", "sintra", "douro"],
    arrivalAirports: [
      { code: "LIS", city: "Lisbon",  reason: "The main gateway — best for Lisbon, Sintra, and Alentejo. Day trips to Sintra take 40 minutes by train.", recommended: true },
      { code: "OPO", city: "Porto",   reason: "Best for northern Portugal — Porto, the Douro Valley, and Vinho Verde wine country. Open-jaw with Lisbon is ideal." },
      { code: "FAO", city: "Faro",    reason: "Fly direct to Faro for the Algarve beaches — skips Lisbon entirely if beach relaxation is the priority." },
    ],
    suggestedRoute: "Fly into Lisbon (LIS) → 2–3 days Lisbon → day trip to Sintra → train or rental car north to Porto (3h) → Douro Valley wine region → fly home from Porto (OPO). The open-jaw Lisbon/Porto perfectly follows the country's natural geography.",
    routingWhy: "Portugal is compact and easy to drive — Lisbon to Porto is 3 hours by train or car, and the countryside in between (Óbidos, Nazaré, Coimbra) rewards a leisurely stop. The open-jaw avoids returning south to Lisbon for your flight.",
    travelTips: [
      "Sintra is most enjoyable on a weekday — weekends are extremely crowded",
      "The Douro Valley is best with a hire car — the scenic road along the river takes you through vineyard villages",
      "Pastéis de Belém in Lisbon: go at opening time (8am) or queue. It's worth it.",
      "Porto's trams are more charming than practical — get a rechargeable Andante card for the metro",
    ],
  },
  {
    keywords: ["uk", "england", "london", "scotland", "edinburgh", "highlands", "wales", "ireland", "dublin", "bath", "oxford", "cambridge", "cotswolds", "lake district"],
    arrivalAirports: [
      { code: "LHR", city: "London Heathrow", reason: "Most international connections — and the Elizabeth line now puts you in central London in 40 minutes.", recommended: true },
      { code: "LGW", city: "London Gatwick",  reason: "Good for southern England and easier to navigate than Heathrow. Gatwick Express to Victoria in 30 minutes." },
      { code: "EDI", city: "Edinburgh",       reason: "Fly direct to Edinburgh if Scotland is your first stop — skips London entirely and puts you in the Highlands faster." },
    ],
    suggestedRoute: "Fly into London (LHR) → 2–3 days London → train to Edinburgh (5h or 1h20 by Ryanair) → Scottish Highlands by rental car → fly home from Edinburgh (EDI) or Glasgow (GLA). Alternatively do England first: London → Bath/Cotswolds → north to Edinburgh.",
    routingWhy: "The open-jaw London/Edinburgh routing lets you move continuously northward without backtracking. The Cotswolds and Bath are easily done as a 2-night detour from London before heading north. If Scotland is your focus, flying Edinburgh first and ending in London works equally well.",
    travelTips: [
      "LNER trains London to Edinburgh — book months ahead for ~£30; same-day fares can be £200+",
      "The NC500 (North Coast 500) requires a minimum 5 nights to do justice — plan carefully",
      "An Oyster card or contactless card works on all London transport — don't buy single tickets",
      "Scotland's west coast roads are single-track — add 30–40% to your expected drive times",
    ],
  },
  {
    keywords: ["turkey", "istanbul", "cappadocia", "bodrum", "antalya", "ephesus", "pamukkale", "ankara"],
    arrivalAirports: [
      { code: "IST", city: "Istanbul",    reason: "The main international gateway — Istanbul deserves 2–3 days and connects by domestic flights to Cappadocia and the coast.", recommended: true },
      { code: "AYT", city: "Antalya",     reason: "Fly direct to Antalya if the Turquoise Coast (Fethiye, Bodrum) is your focus — shorter transfers to beach destinations." },
      { code: "ASR", city: "Kayseri",     reason: "The airport serving Cappadocia — fly direct here if Cappadocia is your first or only stop." },
    ],
    suggestedRoute: "Fly into Istanbul (IST) → 2–3 days Istanbul → 1-hour domestic flight to Kayseri (ASR) for Cappadocia → 2–3 nights in Göreme → domestic flight or overnight bus to the Turquoise Coast → fly home from Dalaman (DLM) or Antalya (AYT).",
    routingWhy: "Domestic flights in Turkey are inexpensive (€30–€60) and frequent — covering the Istanbul–Cappadocia–Coast triangle by air is far more efficient than overland. The open-jaw exit from the Aegean coast avoids the long return journey to Istanbul.",
    travelTips: [
      "Book Cappadocia hot-air balloon flights (Butterfly Balloons or Royal Balloon) months in advance for sunrise slots",
      "The Bosphorus cruise is a highlight — take the public ferry from Eminönü rather than a tourist boat",
      "Turkish domestic airlines (Turkish Airlines, Pegasus) are punctual and affordable — book on their websites",
      "The Ephesus ruins are best visited at opening time (8am) before the cruise ship crowds arrive",
    ],
  },
  {
    keywords: ["thailand", "bangkok", "chiang mai", "phuket", "koh samui", "krabi", "pai", "koh lanta", "southeast asia"],
    arrivalAirports: [
      { code: "BKK", city: "Bangkok (Suvarnabhumi)", reason: "The main gateway for Southeast Asia — Bangkok connects to every Thai destination by budget airline, train, or bus.", recommended: true },
      { code: "DMK", city: "Bangkok (Don Mueang)",   reason: "The budget terminal — AirAsia and Nok Air operate cheap domestic flights here to Chiang Mai, Phuket, and Koh Samui." },
      { code: "HKT", city: "Phuket",                 reason: "Fly direct to Phuket if the southern islands are your focus — saves a Bangkok connection." },
    ],
    suggestedRoute: "Fly into Bangkok (BKK) → 2 days Bangkok → overnight train or budget flight to Chiang Mai → explore northern Thailand → budget flight south to Krabi or Phuket → island-hop by ferry → fly home from Phuket (HKT) or Koh Samui (USM).",
    routingWhy: "Thailand's budget airlines (AirAsia, Nok Air, Bangkok Airways) make inter-city flying extremely cheap — often £20–40. The north-to-south routing lets you move continuously without backtracking to Bangkok. Flying out from the islands avoids the 12-hour bus journey back.",
    travelTips: [
      "The overnight sleeper train Bangkok–Chiang Mai is an experience worth taking at least once — book first-class sleeper",
      "Book longtail boat tours directly on the pier rather than through hotels — 30–40% cheaper",
      "Ferries between Thai islands run on published schedules but weather can delay; don't book tight connections",
      "Grab (Southeast Asian Uber equivalent) works across Thailand — much safer than negotiating tuk-tuk fares",
    ],
  },
  {
    keywords: ["iceland", "reykjavik", "golden circle", "northern lights", "blue lagoon", "westfjords", "ring road"],
    arrivalAirports: [
      { code: "KEF", city: "Reykjavik (Keflavík)", reason: "The only international airport in Iceland — all flights land here. The Blue Lagoon is 20 minutes from the airport on the way to Reykjavik.", recommended: true },
    ],
    suggestedRoute: "All routes begin and end at Keflavík (KEF). Day 1: Blue Lagoon on the way from the airport → Reykjavik. Then: Golden Circle day trip → South Coast (Jökulsárlón, Skógafoss) → Westfjords or Snæfellsnes Peninsula → return to Reykjavik. Ring Road requires 8–10 days minimum.",
    routingWhy: "Iceland is a loop by nature — Keflavík is both your entry and exit. The Blue Lagoon is 20 minutes from the airport, making it a natural first or last stop. The Golden Circle and South Coast are the highest-density experiences and easiest if time is short.",
    travelTips: [
      "Pre-book the Blue Lagoon months in advance — it sells out consistently",
      "Rent a 4WD (Dacia Duster minimum) if you plan to leave the Ring Road — F-roads require it by law",
      "Northern Lights: September–March, away from city lights, with a clear sky forecast — the app 'Vedur' tracks them",
      "Petrol stations are far apart in the interior — never let your tank go below half",
    ],
  },
  {
    keywords: ["morocco", "marrakech", "fez", "fès", "casablanca", "chefchaouen", "sahara", "atlas mountains", "essaouira"],
    arrivalAirports: [
      { code: "RAK", city: "Marrakech",  reason: "Best entry for the imperial cities route — Marrakech → Fès loop via the Atlas Mountains.", recommended: true },
      { code: "CMN", city: "Casablanca", reason: "Most international connections — Casablanca is the main hub but requires an onward train or flight to the good stuff." },
      { code: "FEZ", city: "Fès",        reason: "Fly direct to Fès if the ancient medina is your priority and time is short." },
    ],
    suggestedRoute: "Fly into Marrakech (RAK) → 2–3 days Marrakech medina → Atlas Mountains day trip → overnight drive to Sahara (Merzouga) → through the Ziz Valley → Fès → fly home from Fès (FEZ) or Casablanca (CMN). Open-jaw Marrakech/Fès is the classic route.",
    routingWhy: "The Marrakech → Sahara → Fès route covers Morocco's greatest hits while always moving forward. Attempting to return to Marrakech from Fès wastes a full day of driving or an extra flight. The Sahara requires a private driver and 2 full days — budget accordingly.",
    travelTips: [
      "Hire a licensed guide for the Fès medina on day one — it's genuinely labyrinthine and navigating alone costs you time",
      "Marrakech: agree taxi prices before getting in — meters are a myth",
      "The Sahara desert trip is best booked through a riad, not a random tour operator in Djemaa el-Fna",
      "Chefchaouen requires a detour from the Fès–Tangier route — worth 2 nights if your schedule allows",
    ],
  },
];

// ── Lookup functions ───────────────────────────────────────────────────────────

export function getRoutingSuggestion(text: string): RoutingSuggestion | null {
  const lower = text.toLowerCase();
  return ROUTING_DB.find((r) => r.keywords.some((kw) => lower.includes(kw))) ?? null;
}

export function searchAirports(query: string): Airport[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return DEPARTURE_AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q)
  ).slice(0, 6);
}
