import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getAnthropicClient, DEFAULT_MODEL, TRAVEL_ADVISOR_SYSTEM_PROMPT } from "@/lib/ai/client";
import { TRAVEL_TOOLS } from "@/lib/ai/tools";
import { logApiUsage } from "@/lib/ai/usageLog";
import { buildItineraryPrompt } from "@/lib/ai/prompts";
import { searchFlights } from "@/lib/api/flights";
import { searchHotels } from "@/lib/api/hotels";
import { searchActivities } from "@/lib/api/activities";
import { searchRestaurants } from "@/lib/api/restaurants";
import { searchGroundTransport } from "@/lib/api/groundTransport";
import { getGroundTransportProvider } from "@/lib/data/groundTransportProviders";
import { getNeighborhoodsByDestination } from "@/lib/data/destinationNeighborhoods";
import { applyReviewSourcePref } from "@/lib/data/reviewSources";
import { applyBeliPreference } from "@/lib/data/beli";
import { groupByLocation, parseLocalDate, extractIataCode } from "@/lib/utils";
import { estimateTripBudget } from "@/lib/budget";
import { resolveBudget, DEFAULT_BUDGET_MAX } from "@/types/trip";
import type { TripPreferences, GeneratedItinerary, FlightOption, HotelOption, ActivityOption, RestaurantOption, ItineraryDay, TransportOption } from "@/types/trip";
import { rateLimit } from "@/lib/rateLimit";

// Generation can take several agentic tool-call rounds against the real
// Anthropic API — without this the platform's default function timeout
// (as low as 10s) kills the connection mid-request, surfacing to the
// client as an opaque "Failed to fetch" rather than a real error.
export const maxDuration = 60;

// Keyed by name + location — cities that share a mock content pool (e.g. Rome and
// Florence both draw from the "italy" pool) return identically-named items, and a
// name-only key would silently drop every city but the first.
function dedup<T extends { name?: string; location?: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((x) => {
    const k = `${(x.location ?? "").toLowerCase()}::${(x.name ?? "").toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// A hotel search capped to the lowest tier would filter out options within any
// of the other tiers the user also said they'd consider — resolveBudget already
// picks the highest ceiling across everything they selected.
function maxNightlyBudget(preferences: TripPreferences): number {
  return resolveBudget(preferences)?.max ?? DEFAULT_BUDGET_MAX;
}

// Mock hotel/activity/restaurant pools fall back to a generic "default" entry
// for any destination string they don't recognise, and stamp that entry's
// location with whatever `destination` was passed in — so a call with a
// missing/empty destination produces results with no location at all. Those
// can never be scoped to a city afterwards and end up permanently stuck in
// every city's "available" bank in Personalize. Reject the call instead.
function hasDestination(input: Record<string, unknown>): boolean {
  return typeof input.destination === "string" && input.destination.trim().length > 0;
}

// Tool dispatcher — maps tool_name → actual function call
async function dispatchTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "search_flights":
      return searchFlights(input as unknown as Parameters<typeof searchFlights>[0]);
    case "search_hotels":
      return hasDestination(input) ? searchHotels(input as unknown as Parameters<typeof searchHotels>[0]) : [];
    case "search_activities":
      return hasDestination(input) ? searchActivities(input as unknown as Parameters<typeof searchActivities>[0]) : [];
    case "search_restaurants":
      return hasDestination(input) ? searchRestaurants(input as unknown as Parameters<typeof searchRestaurants>[0]) : [];
    case "generate_itinerary":
      // This tool signals that the AI is ready to synthesise
      return { status: "ready_to_synthesise", input };
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function POST(request: NextRequest) {
  // Full itinerary generation is the most expensive route here — several
  // agentic tool-call rounds per request — so it gets the tightest limit.
  const limited = rateLimit(request, { bucket: "itinerary-generate", limit: 8, windowMs: 10 * 60_000 });
  if (limited) return limited;

  try {
    const body = await request.json() as { tripId: string; preferences: TripPreferences };
    const { tripId, preferences } = body;

    if (!preferences.destination) {
      return NextResponse.json({ error: "Destination is required" }, { status: 400 });
    }

    const client   = getAnthropicClient();
    const userMsg  = buildItineraryPrompt(preferences);

    // ── Agentic loop: let Claude call tools until it reaches a final answer ──
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMsg }];

    let flights:     FlightOption[]     = [];
    let hotels:      HotelOption[]      = [];
    let activities:  ActivityOption[]   = [];
    let restaurants: RestaurantOption[] = [];
    let finalText    = "";
    // The specific hotel per city the AI names in its final written summary —
    // set by its generate_itinerary call so the "Recommended Lodging" card
    // can show that same hotel instead of an arbitrary search result.
    let selectedHotelIdByCity: Record<string, string> = {};
    // How to actually get from the previous city to this one — shown on the
    // first day of each new city leg.
    let travelNoteByCity: Record<string, string> = {};
    let gatewayAdvisory: string | undefined;

    // We allow up to 8 tool-call rounds to prevent infinite loops
    for (let round = 0; round < 8; round++) {
      const response = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 4096,
        system: TRAVEL_ADVISOR_SYSTEM_PROMPT,
        tools: TRAVEL_TOOLS,
        messages,
      });
      await logApiUsage("itinerary-generate", DEFAULT_MODEL, response.usage);

      // Collect tool uses from this response
      const toolUses = response.content.filter((b) => b.type === "tool_use");
      const textBlocks = response.content.filter((b) => b.type === "text");

      if (textBlocks.length) {
        finalText = textBlocks.map((b) => (b as { type: "text"; text: string }).text).join("\n");
      }

      // If Claude is done (no more tool calls), exit the loop
      if (response.stop_reason === "end_turn" || toolUses.length === 0) break;

      // Add Claude's response to the message thread
      messages.push({ role: "assistant", content: response.content });

      // Execute all tool calls and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUses) {
        if (block.type !== "tool_use") continue;
        const result = await dispatchTool(block.name, block.input as Record<string, unknown>);

        // Accumulate results — AI may call these tools multiple times (once per city)
        if (block.name === "search_flights")      flights      = [...flights,      ...(result as FlightOption[])];
        if (block.name === "search_hotels")       hotels       = [...hotels,       ...(result as HotelOption[])];
        if (block.name === "search_activities")   activities   = [...activities,   ...(result as ActivityOption[])];
        if (block.name === "search_restaurants")  restaurants  = [...restaurants,  ...(result as RestaurantOption[])];
        if (block.name === "generate_itinerary") {
          const input = block.input as {
            selected_hotels?: { city: string; hotel_id: string }[];
            inter_city_travel?: { to_city: string; note: string }[];
            gateway_advisory?: string;
          };
          for (const sel of input.selected_hotels ?? []) {
            selectedHotelIdByCity[sel.city] = sel.hotel_id;
          }
          for (const leg of input.inter_city_travel ?? []) {
            travelNoteByCity[leg.to_city] = leg.note;
          }
          if (input.gateway_advisory) gatewayAdvisory = input.gateway_advisory;
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: "user", content: toolResults });
    }

    // ── Ensure every destination city has activities and restaurants ──
    // The AI may only call the tools once (for the whole trip), leaving some cities uncovered.
    // We also filter out any results tagged to the departure city.
    const depCity = (preferences.destination?.departureAirport ?? "")
      .replace(/\s*\(.*\)/, "").trim().toLowerCase(); // e.g. "Seattle-Tacoma International" → "seattle"
    const destCities: string[] = preferences.destination?.cities ?? [];

    if (depCity) {
      activities   = activities.filter((a) => !a.location?.toLowerCase().includes(depCity.split("-")[0]));
      restaurants  = restaurants.filter((r) => !r.location?.toLowerCase().includes(depCity.split("-")[0]));
    }

    // Build hotel search params from preferences for supplemental searches
    const hotelParams = {
      check_in:             preferences.dates?.type === "exact" ? preferences.dates.startDate : undefined,
      check_out:            preferences.dates?.type === "exact" ? preferences.dates.endDate   : undefined,
      min_stars:            preferences.lodging?.minStars,
      types:                preferences.lodging?.types,
      max_price_per_night:  maxNightlyBudget(preferences),
      amenities:            preferences.lodging?.amenities,
    };

    // For each destination city not yet covered, fetch supplemental data in parallel
    const supplementalResults = await Promise.all(
      destCities.flatMap((city) => {
        const lc = city.toLowerCase();
        const needHotels = !hotels.some((h) => h.location?.toLowerCase().includes(lc));
        const needActs   = !activities.some((a)  => a.location?.toLowerCase().includes(lc));
        const needRests  = !restaurants.some((r) => r.location?.toLowerCase().includes(lc));
        return [
          needHotels ? searchHotels({ ...hotelParams, destination: city }) : null,
          needActs   ? searchActivities({ destination: city, categories: preferences.activities as string[] }) : null,
          needRests  ? searchRestaurants({ destination: city }) : null,
        ];
      })
    );
    for (const result of supplementalResults) {
      if (!result) continue;
      if (result.length && "pricePerNight" in result[0]) hotels      = [...hotels,      ...(result as HotelOption[])];
      else if (result.length && "duration" in result[0]) activities  = [...activities,  ...(result as ActivityOption[])];
      else                                               restaurants = [...restaurants, ...(result as RestaurantOption[])];
    }

    // ── Ensure both flight legs exist ──
    // The AI is instructed to call search_flights twice — once outbound, once
    // return — but tool-use adherence isn't guaranteed, and a model that only
    // makes the one call leaves the review screen showing a single one-way
    // leg mislabeled "roundtrip". Backfill whichever leg is missing the same
    // deterministic way the manual "search again" fallback does.
    const flightDest = preferences.destination;
    const flightDates = preferences.dates;
    if (
      !preferences.noFlightsNeeded &&
      flightDest?.departureAirport && flightDest?.arrivalAirport &&
      flightDates?.type === "exact" && flightDates.startDate && flightDates.endDate && !flightDates.skipFlightSearch
    ) {
      const arrivalCode = extractIataCode(flightDest.arrivalAirport);
      const hasOutbound = flights.some((f) => (f.destination ?? "").toUpperCase().includes(arrivalCode));
      const hasReturn   = flights.some((f) => !(f.destination ?? "").toUpperCase().includes(arrivalCode));
      const airlinePrefs = preferences.airlinePrefs;
      const common = {
        cabin_class: airlinePrefs?.cabinClass,
        preferred_airlines: airlinePrefs?.airlines,
        nonstop_only: airlinePrefs?.preferNonstop,
        lowest_fare_mode: airlinePrefs?.prioritizeLowestFare,
      };
      if (!hasOutbound) {
        flights = [...flights, ...await searchFlights({
          origin: flightDest.departureAirport,
          destination: flightDest.arrivalAirport,
          departure_date: flightDates.startDate,
          ...common,
        })];
      }
      if (!hasReturn) {
        flights = [...flights, ...await searchFlights(
          flightDest.returnAirport
            ? { origin: flightDest.arrivalAirport, destination: flightDest.returnAirport, departure_date: flightDates.endDate, ...common }
            : { origin: flightDest.arrivalAirport, destination: flightDest.departureAirport, departure_date: flightDates.endDate, ...common }
        )];
      }
    }

    // ── Deduplicate by name across all cities ──
    activities  = dedup(activities);
    restaurants = dedup(restaurants);
    hotels      = dedup(hotels);

    // ── Synthesise final itinerary from collected data ──
    const itinerary = await assembleItinerary({
      tripId,
      preferences,
      flights,
      hotels,
      activities,
      restaurants,
      aiSummary: finalText,
      selectedHotelIdByCity,
      travelNoteByCity,
      gatewayAdvisory,
    });

    return NextResponse.json(itinerary);
  } catch (error: unknown) {
    console.error("[itinerary/generate]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Itinerary assembly ────────────────────────────────────────────────────────
interface AssembleParams {
  tripId: string;
  preferences: TripPreferences;
  flights: FlightOption[];
  hotels: HotelOption[];
  activities: ActivityOption[];
  restaurants: RestaurantOption[];
  aiSummary: string;
  // City name (matching preferences.destination.cities) → hotel id, from the
  // AI's own generate_itinerary call — see the hotelsByCity reordering below.
  selectedHotelIdByCity: Record<string, string>;
  // City name → how to get there from the previous leg, from the same call.
  travelNoteByCity: Record<string, string>;
  gatewayAdvisory?: string;
}

async function assembleItinerary(p: AssembleParams): Promise<GeneratedItinerary> {
  const { preferences, flights, activities, restaurants, aiSummary, tripId, selectedHotelIdByCity, travelNoteByCity, gatewayAdvisory } = p;
  let hotels = p.hotels;

  let startDate: string;
  let numDays: number;

  if (preferences.dates?.type === "flexible") {
    // Parse "YYYY-MM" and land on the 15th of that month as a placeholder start
    const [yr, mo] = (preferences.dates.flexibleMonth ?? new Date().toISOString().slice(0, 7))
      .split("-").map(Number);
    const d = new Date(yr, mo - 1, 15);
    startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-15`;
    numDays   = Math.max(1, preferences.dates.flexibleDuration ?? 10);
  } else {
    startDate = preferences.dates?.startDate ?? new Date().toISOString().slice(0, 10);
    const endDate = preferences.dates?.endDate
      ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const start = parseLocalDate(startDate);
    const end   = parseLocalDate(endDate);
    numDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  }

  const days: ItineraryDay[] = buildDays(parseLocalDate(startDate), numDays, activities, restaurants, preferences, travelNoteByCity);

  // ── Ground/ferry transport for inter-city legs with a real regional
  // operator (see lib/data/groundTransportProviders.ts) — most legs match
  // nothing here and stay covered only by the AI's prose travel note.
  const groundTransport: TransportOption[] = [];
  for (let i = 1; i < days.length; i++) {
    const fromCity = days[i - 1].location;
    const toCity = days[i].location;
    if (!fromCity || !toCity || fromCity === toCity) continue;
    if (!getGroundTransportProvider(`${fromCity} ${toCity}`)) continue;
    groundTransport.push(...await searchGroundTransport(fromCity, toCity, days[i].date, preferences));
  }

  // If user pre-selected a hotel in the Lodging step, use it; otherwise use AI-searched results
  if (preferences.selectedHotel) {
    hotels = [preferences.selectedHotel, ...hotels.filter((h) => h.id !== preferences.selectedHotel!.id)];
  }

  const dest = preferences.destination?.displayName ?? "your destination";
  const acts = (preferences.activities ?? []).slice(0, 3).join(", ");
  const vibeList = (preferences.vibes ?? []).slice(0, 2).join(" and ");

  const summaryFallback = aiSummary ||
    `**${numDays}-day itinerary for ${dest}**\n\n` +
    `Your plan is built around what matters most to you:\n` +
    `- ${acts || "local experiences"}\n` +
    `- Hand-picked restaurants and neighborhood discoveries\n` +
    `- Logical day-by-day sequencing to minimise travel time`;

  const budgetLabel = resolveBudget(preferences)?.label ?? "chosen";
  const whyFallback =
    `- Activities near each other are grouped on the same day\n` +
    `- Lodging matches your ${budgetLabel} budget tier\n` +
    (vibeList ? `- Itinerary leans into the **${vibeList}** vibe you selected` : "- Balanced mix of culture, food, and exploration");

  const destName = preferences.destination?.displayName ?? "";
  const neighborhoods = getNeighborhoodsByDestination(destName);

  // Cap hotels per city (not globally) so every destination stays represented
  const hotelsByCity = groupByLocation(hotels, (h) => h.city ?? h.location);
  // Put the AI's own pick for this city first — it's the one named and
  // described in its written summary — so "Recommended Lodging" (items[0]
  // per city) can't show a different, arbitrarily-first-fetched hotel.
  for (const group of hotelsByCity) {
    const pickId = selectedHotelIdByCity[group.location];
    if (!pickId) continue;
    const idx = group.items.findIndex((h) => h.id === pickId);
    if (idx > 0) {
      const [picked] = group.items.splice(idx, 1);
      group.items.unshift(picked);
    }
  }
  const topHotels = hotelsByCity.flatMap((g) => g.items.slice(0, 3));

  // Shape ratings per the user's review-source preference (single source vs cross-referenced average)
  const { reviewSourcePref, beliPref } = preferences;
  const ratedHotels      = applyReviewSourcePref(topHotels, reviewSourcePref);
  const ratedActivities  = applyReviewSourcePref(activities, reviewSourcePref);
  const ratedRestaurants = applyBeliPreference(
    applyReviewSourcePref(restaurants, reviewSourcePref),
    beliPref,
    preferences.destination?.cities
  );

  // Same inputs (numDays, flights, hotels, activities) the Estimated Budget
  // Breakdown reads from the returned itinerary below, via the shared
  // estimator — so the two totals shown to the user can never disagree.
  const { total: totalEstimatedCost } = estimateTripBudget(
    { numDays, flights, hotels: ratedHotels, activities: ratedActivities },
    preferences
  );

  return {
    id: uuid(),
    tripId,
    version: 1,
    createdAt: new Date().toISOString(),
    days,
    flights,
    groundTransport: groundTransport.length ? groundTransport : undefined,
    hotels: ratedHotels,
    activities: ratedActivities,
    restaurants: ratedRestaurants.length ? ratedRestaurants : undefined,
    totalEstimatedCost,
    currency: "USD",
    aiSummary: summaryFallback,
    whyThisWorks: whyFallback,
    gatewayAdvisory,
    neighborhoods: neighborhoods.length ? neighborhoods : undefined,
  };
}

function scopeToLocation<T extends { location?: string }>(items: T[], location: string): T[] {
  const lc = location.toLowerCase();
  const matched = items.filter((item) => item.location?.toLowerCase().includes(lc));
  return matched.length ? matched : items;
}

function buildDays(
  start: Date,
  numDays: number,
  activities: ActivityOption[],
  restaurants: RestaurantOption[],
  preferences: TripPreferences,
  travelNoteByCity: Record<string, string> = {}
): ItineraryDay[] {
  const dest = preferences.destination?.displayName ?? "the destination";
  const cities = preferences.destination?.cities?.filter(Boolean) ?? [];
  const themes = generateThemes(numDays, preferences);

  // The traveller can manually rebalance how many days go to each city (the
  // itinerary step's leg editor) — that override must actually change which
  // city each day lands on, not just be described to the AI, since this
  // function assigns `location` deterministically and ignores the AI's own
  // day-by-day output entirely. Only trust it when it exactly accounts for
  // every city and the full day count; otherwise fall back to even division.
  const nights = preferences.cityNights;
  const nightsValid = !!nights
    && cities.length > 0
    && cities.every((c) => Number.isInteger(nights[c]) && nights[c] > 0)
    && cities.reduce((sum, c) => sum + nights[c], 0) === numDays;
  const dayLocations: string[] | null = nightsValid
    ? cities.flatMap((c) => Array(nights![c]).fill(c))
    : null;

  // Days assigned to the same city so far, in order — used below to rotate
  // through that city's activities/restaurants instead of repeating day 1's
  // pick, without pulling in another city's content.
  const cityDayCounts = new Map<string, number>();

  return Array.from({ length: numDays }, (_, i) => {
    const date    = new Date(start);
    date.setDate(date.getDate() + i);
    // Format from local components, not .toISOString() — that converts to
    // UTC first, which would shift the date again in positive-offset zones.
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    // Use the traveller's manual day split when it's valid; otherwise
    // distribute cities evenly across days. Falls back to full destination
    // name for a single-city trip.
    const location = dayLocations
      ? dayLocations[i]
      : cities.length > 1
      ? cities[Math.floor((i / numDays) * cities.length)]
      : (cities[0] ?? dest);

    // Use the city name for in-day activity text, not the full destination string
    const cityLabel = location;

    const cityDayIndex = cityDayCounts.get(location) ?? 0;
    cityDayCounts.set(location, cityDayIndex + 1);

    // Scope activities/restaurants to this day's city — falls back to the
    // full list only if nothing matched (e.g. a bare destination string with
    // no per-city data), so a day never surfaces another city's picks.
    const cityActivities = scopeToLocation(activities, location);
    const cityRestaurants = scopeToLocation(restaurants, location);

    // First day overall gets a jet-lag note; the first day of every
    // subsequent city gets how to actually make that transfer, when the AI
    // supplied one — otherwise that day just has no note, rather than a
    // vague placeholder.
    const isNewCityLeg = i > 0 && cityDayIndex === 0;
    const notes = i === 0
      ? "Allow time for jet lag recovery — keep the first evening light."
      : isNewCityLeg
      ? travelNoteByCity[location]
      : undefined;

    return {
      date: isoDate,
      dayNumber: i + 1,
      theme: themes[i],
      location,
      morning:   buildTimeBlock("morning",   cityDayIndex, cityActivities, cityLabel),
      afternoon: buildTimeBlock("afternoon", cityDayIndex, cityActivities, cityLabel),
      evening:   buildTimeBlock("evening",   cityDayIndex, cityActivities, cityLabel),
      meals:     buildMeals(cityDayIndex, numDays, preferences, cityRestaurants),
      notes,
    };
  });
}

// "Arrival" and "Farewell" only make sense on the first/last day of the whole
// trip — cycling them into the middle pool (the old behaviour) meant any trip
// longer than the pool's length got a day that re-announced "Arrival" deep
// into the itinerary. They're reserved here and never handed out elsewhere.
function generateThemes(numDays: number, preferences: TripPreferences): string[] {
  const dest = preferences.destination?.displayName ?? "destination";
  const arrival = `Arrival & First Impressions of ${dest}`;
  const farewell = "Relaxation, Shopping & Farewell Dinner";
  const middle = [
    "Iconic Landmarks & Cultural Immersion",
    "Local Neighborhoods & Hidden Gems",
    "Day Trip & Natural Scenery",
    "Food, Markets & Evening Atmosphere",
    "Adventure & Active Exploration",
    "Art, History & Architecture",
    "Coastal or Scenic Excursion",
    "Markets, Crafts & Local Makers",
    "A Slower, Wander-as-you-go Day",
  ];

  if (numDays === 1) return [arrival];
  if (numDays === 2) return [arrival, farewell];

  const middleCount = numDays - 2;
  const middleDays = Array.from({ length: middleCount }, (_, i) => middle[i % middle.length]);
  return [arrival, ...middleDays, farewell];
}

function buildTimeBlock(
  period: "morning" | "afternoon" | "evening",
  dayIndex: number,
  activities: ActivityOption[],
  dest: string
): string[] {
  const slots: Record<typeof period, string[][]> = {
    morning: [
      ["Arrive, check in, and freshen up", `Stroll the area around your hotel in ${dest}`],
      ["Visit the main cultural quarter", "Morning espresso at a local café"],
      ["Sunrise viewpoint walk", "Visit a local food market"],
    ],
    afternoon: [
      ["Rest and explore the immediate neighborhood", "Light lunch at a recommended spot"],
      ["Guided museum or landmark tour", "Afternoon pick-me-up at an artisan coffee shop"],
      ["Scenic hike or guided activity", "Explore a design or arts district"],
    ],
    evening: [
      ["Early dinner to adjust to the timezone", "Easy stroll and early night"],
      ["Pre-dinner aperitivo at a rooftop bar", "Dinner at a highly-rated local restaurant"],
      ["Night-time city walk or harbor cruise", "Late dinner followed by local bar scene"],
    ],
  };

  const base = slots[period][dayIndex % slots[period].length];
  // Add one activity per day in the morning slot only, rotating through the pool
  if (period === "morning" && activities.length) {
    base.push(activities[dayIndex % activities.length].name);
  }
  return base;
}

// Spreads `count` splurge outings evenly across the trip (same distribution
// approach used elsewhere in this file for cities-across-days), so a 2-splurge,
// 10-day trip lands them roughly a third and two-thirds of the way through
// rather than bunched at the start.
function splurgeDayIndices(count: number, numDays: number): Set<number> {
  const n = Math.min(count, numDays);
  return new Set(Array.from({ length: n }, (_, k) => Math.floor(((k + 1) / (n + 1)) * numDays)));
}

function buildMeals(
  dayIndex: number,
  numDays: number,
  preferences: TripPreferences,
  restaurants: RestaurantOption[]
): ItineraryDay["meals"] {
  const foodBudget = preferences.dailyFoodBudgetPerPerson;
  const isHighBudget =
    (foodBudget !== undefined && foodBudget >= 150) ||
    (foodBudget === undefined && preferences.budgetRanges?.some((r) => r === "750_1000" || r === "1000_plus"));

  const splurge = preferences.splurge;
  const isSplurgeDay = Boolean(splurge?.count) && splurgeDayIndices(splurge!.count, numDays).has(dayIndex);

  // Pull named restaurants from the fetched list by tier
  const byTier = (tier: string[]) => restaurants.filter((r) => tier.includes(r.tier));
  const brunchR    = byTier(["brunch", "casual"]);
  const lunchR     = byTier(["casual", "midrange", "street_food"]);
  const dinnerR    = (isHighBudget || isSplurgeDay) ? byTier(["fine_dining", "upscale"]) : byTier(["midrange", "casual"]);

  function named(pool: RestaurantOption[], idx: number, fallback: string): string {
    const r = pool[idx % (pool.length || 1)];
    if (!r || pool.length === 0) return fallback;
    return `${r.name} — ${r.description.split(".")[0]}. ${r.mustOrder ? `Must order: ${r.mustOrder}.` : ""}`.trim();
  }

  const breakfastFallbacks = [
    `Local bakery — try a regional pastry and filter coffee`,
    `Morning market breakfast with seasonal produce`,
    `Café near your hotel for coffee and a light bite`,
  ];
  const lunchFallbacks = isHighBudget
    ? [`Neighborhood bistro with a good-value set lunch`, `Rooftop restaurant with panoramic views`, `Award-winning spot recommended by your concierge`]
    : [`Street food market — follow the locals`, `Casual trattoria or café away from tourist areas`, `Picnic from the local deli — great for outdoor spots`];
  const dinnerFallbacks = isHighBudget
    ? [`Michelin-recognised restaurant — book ahead`, `Chef's tasting menu experience`, `Celebrated local restaurant with strong reviews`]
    : [`Neighborhood restaurant popular with locals`, `A low-key spot serving regional specialities`, `Wine bar with small plates — great for grazing`];

  const dinnerSuggestion = named(dinnerR, dayIndex, dinnerFallbacks[dayIndex % dinnerFallbacks.length]);

  return [
    { type: "breakfast", suggestion: named(brunchR, dayIndex, breakfastFallbacks[dayIndex % breakfastFallbacks.length]) },
    { type: "lunch",     suggestion: named(lunchR,  dayIndex, lunchFallbacks[dayIndex % lunchFallbacks.length]) },
    {
      type: "dinner",
      suggestion: isSplurgeDay
        ? `🥂 Splurge night${splurge?.notes ? ` (${splurge.notes})` : ""} — ${dinnerSuggestion}`
        : dinnerSuggestion,
    },
  ];
}

