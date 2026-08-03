import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getAnthropicClient, DEFAULT_MODEL, TRAVEL_ADVISOR_SYSTEM_PROMPT } from "@/lib/ai/client";
import { TRAVEL_TOOLS } from "@/lib/ai/tools";
import { buildItineraryPrompt } from "@/lib/ai/prompts";
import { searchFlights } from "@/lib/api/flights";
import { searchHotels } from "@/lib/api/hotels";
import { searchActivities } from "@/lib/api/activities";
import { searchRestaurants } from "@/lib/api/restaurants";
import { getNeighborhoodsByDestination } from "@/lib/data/destinationNeighborhoods";
import { applyReviewSourcePref } from "@/lib/data/reviewSources";
import { applyBeliPreference } from "@/lib/data/beli";
import { groupByLocation } from "@/lib/utils";
import { BUDGET_LABELS, BUDGET_MAX } from "@/types/trip";
import type { TripPreferences, GeneratedItinerary, FlightOption, HotelOption, ActivityOption, RestaurantOption, ItineraryDay } from "@/types/trip";

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

// Highest ceiling across every lodging tier the user selected (or the custom
// range's max, if set) — a hotel search capped to the lowest tier would filter
// out options within any of the other tiers the user also said they'd consider.
function maxNightlyBudget(preferences: TripPreferences): number {
  if (preferences.customBudgetRange) return preferences.customBudgetRange.max;
  if (preferences.budgetRanges?.length) return Math.max(...preferences.budgetRanges.map((r) => BUDGET_MAX[r]));
  return 300;
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
      return searchHotels(input as unknown as Parameters<typeof searchHotels>[0]);
    case "search_activities":
      return searchActivities(input as unknown as Parameters<typeof searchActivities>[0]);
    case "search_restaurants":
      return searchRestaurants(input as unknown as Parameters<typeof searchRestaurants>[0]);
    case "generate_itinerary":
      // This tool signals that the AI is ready to synthesise
      return { status: "ready_to_synthesise", input };
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function POST(request: NextRequest) {
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

    // We allow up to 8 tool-call rounds to prevent infinite loops
    for (let round = 0; round < 8; round++) {
      const response = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 4096,
        system: TRAVEL_ADVISOR_SYSTEM_PROMPT,
        tools: TRAVEL_TOOLS,
        messages,
      });

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

    // ── Deduplicate by name across all cities ──
    activities  = dedup(activities);
    restaurants = dedup(restaurants);
    hotels      = dedup(hotels);

    // ── Synthesise final itinerary from collected data ──
    const itinerary = assembleItinerary({
      tripId,
      preferences,
      flights,
      hotels,
      activities,
      restaurants,
      aiSummary: finalText,
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
}

function assembleItinerary(p: AssembleParams): GeneratedItinerary {
  const { preferences, flights, activities, restaurants, aiSummary, tripId } = p;
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
    const start = new Date(startDate);
    const end   = new Date(endDate);
    numDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  }

  const days: ItineraryDay[] = buildDays(new Date(startDate), numDays, activities, restaurants, preferences);

  // If user pre-selected a hotel in the Lodging step, use it; otherwise use AI-searched results
  if (preferences.selectedHotel) {
    hotels = [preferences.selectedHotel, ...hotels.filter((h) => h.id !== preferences.selectedHotel!.id)];
  }

  const travelers    = preferences.travelers ?? 2;
  const rooms        = preferences.rooms ?? 1;
  const hotelTotal   = hotels[0]  ? hotels[0].pricePerNight * numDays * rooms : 0;
  // Flights are alternative options — only count the first two (outbound + return)
  const flightTotal  = flights.slice(0, 2).reduce((s, f) => s + f.price, 0) * travelers;
  const actTotal     = activities.slice(0, 4).reduce((s, a) => s + a.price, 0) * travelers;

  const dest = preferences.destination?.displayName ?? "your destination";
  const acts = (preferences.activities ?? []).slice(0, 3).join(", ");
  const vibeList = (preferences.vibes ?? []).slice(0, 2).join(" and ");

  const summaryFallback = aiSummary ||
    `**${numDays}-day itinerary for ${dest}**\n\n` +
    `Your plan is built around what matters most to you:\n` +
    `- ${acts || "local experiences"}\n` +
    `- Hand-picked restaurants and neighbourhood discoveries\n` +
    `- Logical day-by-day sequencing to minimise travel time`;

  const budgetLabel = preferences.customBudgetRange
    ? `$${preferences.customBudgetRange.min}–$${preferences.customBudgetRange.max}`
    : preferences.budgetRanges?.length
    ? preferences.budgetRanges.map((r) => BUDGET_LABELS[r]).join(" or ")
    : "chosen";
  const whyFallback =
    `- Activities near each other are grouped on the same day\n` +
    `- Lodging matches your ${budgetLabel} budget tier\n` +
    (vibeList ? `- Itinerary leans into the **${vibeList}** vibe you selected` : "- Balanced mix of culture, food, and exploration");

  const destName = preferences.destination?.displayName ?? "";
  const neighborhoods = getNeighborhoodsByDestination(destName);

  // Cap hotels per city (not globally) so every destination stays represented
  const hotelsByCity = groupByLocation(hotels, (h) => h.city ?? h.location);
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

  return {
    id: uuid(),
    tripId,
    version: 1,
    createdAt: new Date().toISOString(),
    days,
    flights,
    hotels: ratedHotels,
    activities: ratedActivities,
    restaurants: ratedRestaurants.length ? ratedRestaurants : undefined,
    totalEstimatedCost: hotelTotal + flightTotal + actTotal,
    currency: "USD",
    aiSummary: summaryFallback,
    whyThisWorks: whyFallback,
    neighborhoods: neighborhoods.length ? neighborhoods : undefined,
  };
}

function buildDays(
  start: Date,
  numDays: number,
  activities: ActivityOption[],
  restaurants: RestaurantOption[],
  preferences: TripPreferences
): ItineraryDay[] {
  const dest = preferences.destination?.displayName ?? "the destination";
  const cities = preferences.destination?.cities?.filter(Boolean) ?? [];
  const themes = generateThemes(numDays, preferences);

  return Array.from({ length: numDays }, (_, i) => {
    const date    = new Date(start);
    date.setDate(date.getDate() + i);
    const isoDate = date.toISOString().slice(0, 10);

    const dayActivities = activities.filter((_, idx) => idx % numDays === i % numDays);

    // Distribute cities evenly across days; fall back to full destination name
    const location = cities.length > 1
      ? cities[Math.floor((i / numDays) * cities.length)]
      : (cities[0] ?? dest);

    // Use the city name for in-day activity text, not the full destination string
    const cityLabel = location;

    return {
      date: isoDate,
      dayNumber: i + 1,
      theme: themes[i],
      location,
      morning:   buildTimeBlock("morning",   i, dayActivities, cityLabel),
      afternoon: buildTimeBlock("afternoon", i, dayActivities, cityLabel),
      evening:   buildTimeBlock("evening",   i, dayActivities, cityLabel),
      meals:     buildMeals(i, numDays, preferences, restaurants),
      notes: i === 0 ? "Allow time for jet lag recovery — keep the first evening light." : undefined,
    };
  });
}

function generateThemes(numDays: number, preferences: TripPreferences): string[] {
  const dest = preferences.destination?.displayName ?? "destination";
  const base = [
    `Arrival & First Impressions of ${dest}`,
    "Iconic Landmarks & Cultural Immersion",
    "Local Neighbourhoods & Hidden Gems",
    "Day Trip & Natural Scenery",
    "Food, Markets & Evening Atmosphere",
    "Adventure & Active Exploration",
    "Relaxation, Shopping & Farewell Dinner",
  ];
  return Array.from({ length: numDays }, (_, i) => base[i % base.length]);
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
      ["Rest and explore the immediate neighbourhood", "Light lunch at a recommended spot"],
      ["Guided museum or landmark tour", "Afternoon pick-me-up at an artisan coffee shop"],
      ["Scenic hike or guided activity", "Explore a design or arts district"],
    ],
    evening: [
      ["Early dinner to adjust to the timezone", "Easy stroll and early night"],
      ["Pre-dinner aperitivo at a rooftop bar", "Dinner at a highly-rated local restaurant"],
      ["Night-time city walk or harbour cruise", "Late dinner followed by local bar scene"],
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
    ? [`Neighbourhood bistro with a good-value set lunch`, `Rooftop restaurant with panoramic views`, `Award-winning spot recommended by your concierge`]
    : [`Street food market — follow the locals`, `Casual trattoria or café away from tourist areas`, `Picnic from the local deli — great for outdoor spots`];
  const dinnerFallbacks = isHighBudget
    ? [`Michelin-recognised restaurant — book ahead`, `Chef's tasting menu experience`, `Celebrated local restaurant with strong reviews`]
    : [`Neighbourhood restaurant popular with locals`, `A low-key spot serving regional specialities`, `Wine bar with small plates — great for grazing`];

  const dinnerSuggestion = named(dinnerR, dayIndex, dinnerFallbacks[dayIndex % dinnerFallbacks.length]);

  return [
    { type: "breakfast", suggestion: named(brunchR, dayIndex, breakfastFallbacks[dayIndex % breakfastFallbacks.length]) },
    { type: "lunch",     suggestion: named(lunchR,  dayIndex, lunchFallbacks[dayIndex % lunchFallbacks.length]) },
    { type: "dinner",    suggestion: isSplurgeDay ? `🥂 Splurge night — ${dinnerSuggestion}` : dinnerSuggestion },
  ];
}

