import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getAnthropicClient, DEFAULT_MODEL, TRAVEL_ADVISOR_SYSTEM_PROMPT } from "@/lib/ai/client";
import { TRAVEL_TOOLS } from "@/lib/ai/tools";
import { buildItineraryPrompt } from "@/lib/ai/prompts";
import { searchFlights } from "@/lib/api/flights";
import { searchHotels } from "@/lib/api/hotels";
import { searchActivities } from "@/lib/api/activities";
import { getNeighborhoodsByDestination } from "@/lib/data/destinationNeighborhoods";
import type { TripPreferences, GeneratedItinerary, FlightOption, HotelOption, ActivityOption, ItineraryDay } from "@/types/trip";

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

    let flights:    FlightOption[]   = [];
    let hotels:     HotelOption[]    = [];
    let activities: ActivityOption[] = [];
    let finalText   = "";

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

        // Stash typed results for itinerary assembly
        if (block.name === "search_flights")    flights    = result as FlightOption[];
        if (block.name === "search_hotels")     hotels     = result as HotelOption[];
        if (block.name === "search_activities") activities = result as ActivityOption[];

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: "user", content: toolResults });
    }

    // ── Synthesise final itinerary from collected data ──
    const itinerary = assembleItinerary({
      tripId,
      preferences,
      flights,
      hotels,
      activities,
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
  aiSummary: string;
}

function assembleItinerary(p: AssembleParams): GeneratedItinerary {
  const { preferences, flights, hotels, activities, aiSummary, tripId } = p;

  const startDate = preferences.dates?.startDate
    ?? new Date().toISOString().slice(0, 10);
  const endDate   = preferences.dates?.endDate
    ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const start   = new Date(startDate);
  const end     = new Date(endDate);
  const numDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

  const days: ItineraryDay[] = buildDays(start, numDays, activities, preferences);

  const travelers    = preferences.travelers ?? 2;
  const rooms        = preferences.rooms ?? 1;
  const hotelTotal   = hotels[0]  ? hotels[0].pricePerNight * numDays * rooms : 0;
  const flightTotal  = flights.reduce((s, f) => s + f.price, 0) * travelers;
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

  const whyFallback =
    `- Activities near each other are grouped on the same day\n` +
    `- Lodging matches your ${preferences.budgetRange?.replace(/_/g, " ") ?? "chosen"} budget tier\n` +
    (vibeList ? `- Itinerary leans into the **${vibeList}** vibe you selected` : "- Balanced mix of culture, food, and exploration");

  const destName = preferences.destination?.displayName ?? "";
  const neighborhoods = getNeighborhoodsByDestination(destName);

  return {
    id: uuid(),
    tripId,
    version: 1,
    createdAt: new Date().toISOString(),
    days,
    flights,
    hotels: hotels.slice(0, 3),
    activities,
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
  preferences: TripPreferences
): ItineraryDay[] {
  const dest = preferences.destination?.displayName ?? "the destination";
  const themes = generateThemes(numDays, preferences);

  return Array.from({ length: numDays }, (_, i) => {
    const date    = new Date(start);
    date.setDate(date.getDate() + i);
    const isoDate = date.toISOString().slice(0, 10);

    const dayActivities = activities.filter((_, idx) => idx % numDays === i % numDays);

    return {
      date: isoDate,
      dayNumber: i + 1,
      theme: themes[i],
      morning:   buildTimeBlock("morning",   i, dayActivities, dest),
      afternoon: buildTimeBlock("afternoon", i, dayActivities, dest),
      evening:   buildTimeBlock("evening",   i, dayActivities, dest),
      meals:     buildMeals(i, preferences),
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

function buildMeals(
  dayIndex: number,
  preferences: TripPreferences
): ItineraryDay["meals"] {
  const foodBudget = preferences.dailyFoodBudgetPerPerson;
  const isHighBudget =
    (foodBudget !== undefined && foodBudget >= 150) ||
    (foodBudget === undefined && (preferences.budgetRange === "750_1000" || preferences.budgetRange === "1000_plus"));
  const dest = preferences.destination?.displayName ?? "local";

  const breakfasts = [
    `Hotel breakfast or a café near your accommodation`,
    `Local bakery — try a regional pastry and filter coffee`,
    `Morning market breakfast with seasonal produce`,
  ];
  const lunches = isHighBudget
    ? [`Award-winning lunch spot recommended by your concierge`, `Neighbourhood bistro with a good value lunch menu`, `Rooftop restaurant with panoramic views`]
    : [`Casual local spot — ask the hotel reception for their favourite`, `Street food market or food court`, `Picnic from the local deli — great for outdoor spots`];
  const dinners = isHighBudget
    ? [`Reservations recommended — try the restaurant at your hotel`, `Michelin-recognised or highly-rated ${dest} restaurant`, `Chef's tasting menu experience`]
    : [`Neighbourhood restaurant with strong local reviews`, `A popular spot with locals, away from tourist areas`, `Regional speciality — ask for the menu in the local language`];

  return [
    { type: "breakfast", suggestion: breakfasts[dayIndex % breakfasts.length] },
    { type: "lunch",     suggestion: lunches[dayIndex % lunches.length] },
    { type: "dinner",    suggestion: dinners[dayIndex % dinners.length] },
  ];
}

