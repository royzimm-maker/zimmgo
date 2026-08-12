import type { TripPreferences, HotelOption, ActivityOption, RestaurantOption, ItineraryDay } from "@/types/trip";
import { resolveBudget } from "@/types/trip";

// "Where do you want to go?" free-text input — parsed with parse_destination
export function buildDestinationParsePrompt(text: string): string {
  return `The traveller typed this into a "where do you want to go?" field:\n\n"${text}"\n\nCall parse_destination with the real place names they mentioned (respecting any explicit constraints they stated, like "just X" or "no side trips" implying a single city) and a clean display label.`;
}

// Builds the user-facing prompt for itinerary generation from the stored preferences
export function buildItineraryPrompt(preferences: TripPreferences): string {
  const parts: string[] = [];

  const destNames = preferences.destination?.displayName ?? "the destination";
  // destination.cities is the authoritative city list (parsed once, on the
  // Destination step) — displayName is just a label and often contains its
  // own commas (e.g. "Barcelona, Spain"), so splitting it here would
  // misdetect single-city trips as multi-destination.
  const isMulti = (preferences.destination?.cities?.length ?? 0) > 1;

  const cityList = preferences.destination?.cities?.filter(Boolean) ?? [];

  if (isMulti) {
    parts.push(
      `Please create a comprehensive **multi-destination** travel plan covering: **${destNames}**.` +
      ` Allocate days across all destinations and include logical travel connections between them.` +
      ` The day-by-day plan is built programmatically around exactly these ${cityList.length} legs, in this order: ${cityList.map((c) => `"${c}"`).join(", ")}.` +
      ` You MUST call search_hotels, search_activities, and search_restaurants using these exact strings as the \`destination\` parameter — one set of calls per leg, no more, no fewer. ` +
      `Do not substitute a more specific sub-area (e.g. a particular neighbourhood or nearby city) as the \`destination\` value, even if you think it's more precise — that would cause the results to be dropped, since nothing downstream in this pipeline knows about it. ` +
      `If you want to mention specific neighbourhoods or nearby towns worth visiting within one of these legs, do that in your descriptive text, not as a separate \`destination\` value. ` +
      `Your final written summary must describe the trip strictly as these ${cityList.length} legs with the same city names — do not present a different, more granular breakdown (e.g. splitting one leg into named sub-cities with their own night counts) than what these tool calls and the day-by-day structure actually use.`
    );
  } else {
    parts.push(`Please create a comprehensive travel plan for **${destNames}**.`);
  }

  if (preferences.dates) {
    const d = preferences.dates;
    if (d.type === "exact") {
      parts.push(`Travel dates: ${d.startDate} to ${d.endDate}.`);
    } else {
      parts.push(`Flexible travel: ~${d.flexibleDuration} days in ${d.flexibleMonth}.`);
    }
  }

  if (preferences.activities.length) {
    parts.push(`Preferred activities: ${preferences.activities.join(", ")}.`);
  }

  if (preferences.vibes.length) {
    parts.push(`Trip vibe: ${preferences.vibes.join(", ")}.`);
  }

  if (preferences.travelers || preferences.rooms) {
    const t = preferences.travelers ?? 2;
    const r = preferences.rooms ?? 1;
    parts.push(`Group: ${t} traveller${t !== 1 ? "s" : ""}, ${r} room${r !== 1 ? "s" : ""} per night.`);
  }

  const budget = resolveBudget(preferences);
  if (budget) {
    parts.push(`Lodging budget: ${budget.label} (max $${budget.max} per room per night).`);
  }

  if (preferences.dailyFoodBudgetPerPerson) {
    parts.push(`Food budget: $${preferences.dailyFoodBudgetPerPerson} per person per day.`);
  }
  if (preferences.splurge) {
    const s = preferences.splurge;
    const amount = s.budgetPerPersonMax
      ? `$${s.budgetPerPerson}–${s.budgetPerPersonMax}`
      : `around $${s.budgetPerPerson}`;
    parts.push(
      `The traveller wants ${s.count} special-occasion splurge meal${s.count !== 1 ? "s" : ""} ` +
      `over the trip at ${amount} per person, on top of the regular daily food budget.` +
      (s.notes ? ` Context for these splurge meals: ${s.notes}. Pick restaurants and phrase suggestions to fit this occasion.` : "")
    );
  }

  if (preferences.lodging) {
    const l = preferences.lodging;
    parts.push(
      `Lodging: ${l.types.join(" or ")} (minimum ${l.minStars}★)` +
      (l.amenities.length ? `, with: ${l.amenities.join(", ")}` : "") + "."
    );
  }

  if (preferences.destination?.departureAirport) {
    parts.push(`Departing from: ${preferences.destination.departureAirport}.`);
  }
  if (preferences.destination?.arrivalAirport) {
    parts.push(`Flying into: ${preferences.destination.arrivalAirport} (preferred gateway).`);
  }
  if (preferences.destination?.returnAirport) {
    parts.push(`Open-jaw trip: the traveler returns via ${preferences.destination.returnAirport}, NOT back to ${preferences.destination.departureAirport ?? "the departure city"}. Return flight = vacation endpoint (${preferences.destination.arrivalAirport ?? "destination airport"}) → ${preferences.destination.returnAirport}.`);
  }

  if (preferences.airlinePrefs) {
    const a = preferences.airlinePrefs;
    if (a.prioritizeLowestFare) {
      parts.push(
        `Flight preferences: lowest available fares — ignore airline/alliance preferences, prioritise economy class and cheapest options. ` +
        `Call search_flights with lowest_fare_mode: true.` +
        (a.preferNonstop ? ` They also want nonstop — also pass nonstop_only: true.` : "")
      );
    } else {
      const airlineStr = [
        a.airlines.length ? `preferred airlines: ${a.airlines.join(", ")}` : null,
        a.alliances.length ? `alliances: ${a.alliances.join(", ")}` : null,
        `cabin class: ${a.cabinClass}`,
        a.preferNonstop ? "nonstop preferred" : null,
      ].filter(Boolean).join("; ");
      parts.push(`Flight preferences: ${airlineStr}.`);
    }
  }

  if (preferences.transportation.length) {
    parts.push(`Local transport: ${preferences.transportation.join(", ")}.`);
  }

  const returnLegInstruction = preferences.destination?.returnAirport
    ? `For the return leg (open-jaw): call search_flights with origin = arrivalAirport (${preferences.destination.arrivalAirport ?? "destination airport"}) and destination = ${preferences.destination.returnAirport}. Do NOT use the departure airport as the return destination.`
    : `For the return leg: call search_flights with origin = arrivalAirport and destination = departureAirport (standard roundtrip), using the end date.`;

  parts.push(
    "\nPlease use the available tools to search for flights, hotels, and activities, then synthesise everything into a final day-by-day itinerary. " +
    "For flights: call search_flights TWICE — once for the outbound leg (departureAirport → arrivalAirport, using the start date). " +
    returnLegInstruction + " " +
    "All flight prices are per person, one-way. " +
    "For every day in the itinerary, set the `location` field to the city or region for that day (e.g. \"Rome\", \"Amalfi Coast\", \"Dolomites\"). " +
    "For multi-destination trips: call search_hotels SEPARATELY for EACH destination city — one tool call per city, using the correct city name. " +
    "For multi-destination trips: call search_activities AND search_restaurants SEPARATELY for EACH destination city — one tool call per city. Do NOT call these tools for the departure airport city. " +
    "For activities and restaurants: include a `location` field on every item naming the specific city or neighbourhood it belongs to (e.g. \"Rome\", \"Amalfi Coast\"). " +
    "Always pass max_price_per_night and min_stars to search_hotels based on the traveler's stated budget and lodging preferences. " +
    "For each recommendation, briefly explain why it's the best fit for this traveller's specific preferences. " +
    `When you're ready to finish, call generate_itinerary and include \`selected_hotels\`: one entry per destination city (${
      cityList.length ? cityList.map((c) => `"${c}"`).join(", ") : `"${destNames}"`
    }), each with the exact id of the specific hotel you're recommending and writing about in your final summary. ` +
    "This must be a hotel id you actually got back from search_hotels for that city — don't invent one. " +
    "The app displays whichever hotel you name here, so if your summary describes a specific property (name, price, why it's a good fit), that same hotel must be the one you select here — never describe one hotel in your prose and select a different one."
  );

  return parts.join(" ");
}

// Prompt for the conversational advisor chat
export function buildChatSystemPrompt(
  preferences: TripPreferences,
  itineraryContext?: { activities: string[]; restaurants: string[] },
  stepContext?: string
): string {
  const contextLines: string[] = [];

  if (preferences.destination) {
    const label = preferences.destination.displayName.includes(", ")
      ? `Destinations: ${preferences.destination.displayName}`
      : `Destination: ${preferences.destination.displayName}`;
    contextLines.push(label);
  }
  if (preferences.activities.length) {
    contextLines.push(`Activities: ${preferences.activities.join(", ")}`);
  }
  if (preferences.vibes.length) {
    contextLines.push(`Vibe: ${preferences.vibes.join(", ")}`);
  }
  if (preferences.travelers || preferences.rooms) {
    const t = preferences.travelers ?? 2;
    const r = preferences.rooms ?? 1;
    contextLines.push(`Group: ${t} traveller${t !== 1 ? "s" : ""}, ${r} room${r !== 1 ? "s" : ""}`);
  }
  const chatBudget = resolveBudget(preferences);
  if (chatBudget) {
    contextLines.push(`Lodging budget: ${chatBudget.label}`);
  }
  if (preferences.dailyFoodBudgetPerPerson) {
    contextLines.push(`Food budget: $${preferences.dailyFoodBudgetPerPerson}/person/day`);
  }
  if (preferences.lodging) {
    const l = preferences.lodging;
    contextLines.push(
      `Lodging: ${l.types.join(" or ") || "not yet chosen"} (min ${l.minStars}★)` +
      (l.amenities.length ? `, amenities: ${l.amenities.join(", ")}` : "")
    );
  }
  if (preferences.airlinePrefs) {
    const a = preferences.airlinePrefs;
    contextLines.push(
      a.prioritizeLowestFare
        ? `Flight preferences: lowest fares, any airline; ${a.preferNonstop ? "nonstop preferred" : "connections OK"}`
        : `Flight preferences: ${a.airlines.length ? `airlines: ${a.airlines.join(", ")}` : "no airline preference"}` +
          (a.alliances.length ? `; alliances: ${a.alliances.join(", ")}` : "") +
          `; ${a.preferNonstop ? "nonstop preferred" : "connections OK"}` +
          (a.cabinClasses?.length ? `; cabin: ${a.cabinClasses.join(", ")}` : "")
    );
  }

  const context = contextLines.length
    ? `\n\nCurrent trip context:\n${contextLines.map((l) => `- ${l}`).join("\n")}`
    : "";

  const itineraryNote = itineraryContext?.activities.length || itineraryContext?.restaurants.length
    ? `\n\nItems already in this trip's itinerary you can reference:\n${[
        ...(itineraryContext.activities.length ? [`Activities: ${itineraryContext.activities.join(", ")}`] : []),
        ...(itineraryContext.restaurants.length ? [`Restaurants: ${itineraryContext.restaurants.join(", ")}`] : []),
      ].map((l) => `- ${l}`).join("\n")}`
    : "";

  const lodgingEditNote = stepContext === "lodging"
    ? `\n\nThe traveller is currently on the Lodging step. If they ask to change their accommodation type, star rating, or amenities (e.g. "find me resorts instead", "add a pool", "I want something more remote"), call the update_lodging_preferences tool instead of just replying in text — don't just describe the change, apply it.`
    : "";
  const activitiesEditNote = stepContext === "activities"
    ? `\n\nThe traveller is currently on the Activities step. If they ask to change what kinds of experiences they want (e.g. "add hiking", "swap food tours for adventure sports", "I don't want anything cultural"), call the update_activity_preferences tool instead of just replying in text — don't just describe the change, apply it.`
    : "";
  const vibeEditNote = stepContext === "vibe"
    ? `\n\nThe traveller is currently on the Vibe step. If they ask to change the mood/feel of the trip (e.g. "make it more romantic", "drop nightlife, add beaches"), call the update_vibe_preferences tool instead of just replying in text — don't just describe the change, apply it.`
    : "";
  const airlinesEditNote = stepContext === "airlines"
    ? `\n\nThe traveller is currently on the Flights step. If they ask to change preferred airlines, alliances, cabin class, nonstop preference, or ask for the cheapest fares (e.g. "add nonstop only", "business class please", "just find me the cheapest option"), call the update_airline_preferences tool instead of just replying in text — don't just describe the change, apply it. This tool doesn't cover departure/arrival airport changes — for those, tell the traveller to update the airport field directly.`
    : "";

  return `You are an AI travel advisor helping plan a trip. Answer questions, offer suggestions, and help the user refine their preferences.${context}${itineraryNote}

Keep responses concise and specific. If asked about something outside the trip (e.g. unrelated topics), gently redirect to trip planning.

If the user asks you to save, remember, bookmark, or add something to their Wanderlog, call the add_to_wanderlog tool instead of just replying in text — match against the itinerary items above by name when the user is clearly referring to one of them, source "custom" otherwise.${
    itineraryContext ? "" : " There's no itinerary yet, though — if asked to save something now, tell the user to generate their itinerary first rather than calling the tool."
  }${lodgingEditNote}${activitiesEditNote}${vibeEditNote}${airlinesEditNote}`;
}

// "Let ZiGy choose" — pick the single best hotel for one city
export function buildHotelPickPrompt(
  city: string,
  preferences: TripPreferences,
  hotels: HotelOption[]
): string {
  const vibeStr = preferences.vibes.length ? ` The trip's vibe: ${preferences.vibes.join(", ")}.` : "";
  const hotelBudget = resolveBudget(preferences);
  const budgetStr = hotelBudget ? ` Lodging budget tier: ${hotelBudget.label}.` : "";
  const list = hotels.map((h) =>
    `- id="${h.id}" | ${h.name} | ${h.stars}★ | $${h.pricePerNight}/night | ${h.location} | ${h.highlights.join(", ")}`
  ).join("\n");

  return `Pick the single best hotel in ${city} for this traveller.${vibeStr}${budgetStr}\n\nOptions:\n${list}\n\nCall make_selection with exactly one pick — its id and a one-sentence reason it's the right fit for this trip.`;
}

// "Let ZiGy arrange" — assign a city's activities and restaurants across its days
export function buildSchedulePickPrompt(
  city: string,
  preferences: TripPreferences,
  days: ItineraryDay[],
  activities: ActivityOption[],
  restaurants: RestaurantOption[]
): string {
  const vibeStr = preferences.vibes.length ? ` Trip vibe: ${preferences.vibes.join(", ")}.` : "";
  const dayList = days.map((d) => `- day ${d.dayNumber}: "${d.theme}" (${d.date})`).join("\n");
  const actList = activities.map((a) =>
    `- id="act-${a.id}" [activity] ${a.name} | ${a.duration} | $${a.price} | ${a.description}`
  ).join("\n");
  const restList = restaurants.map((r) =>
    `- id="rest-${r.id}" [restaurant] ${r.name} | ${r.tier} | ${r.cuisine} | ${r.description}`
  ).join("\n");

  return `Arrange ${city}'s activities and restaurants across its ${days.length} day(s) in this itinerary.${vibeStr}\n\n` +
    `Days:\n${dayList}\n\nActivities:\n${actList}\n\nRestaurants:\n${restList}\n\n` +
    `For each item worth including, call make_selection with its id and the dayNumber you're assigning it to, plus a one-sentence reason. ` +
    `Guidelines: don't overload a single day (roughly 1-2 activities and 1-2 restaurants per day is plenty), sequence logically, ` +
    `and it's fine to leave out an item entirely if the day is already full or it doesn't fit the pacing. ` +
    `Also include a 1-2 sentence "summary" explaining your overall approach for this city.`;
}

// "Let ZiGy choose" — pick activity categories, vibes, or lodging type/stars/amenities
// on the traveller's behalf, before they've told us anything about that category yet.
export function buildPreferencePickPrompt(
  kind: "activities" | "vibes" | "lodging",
  preferences: TripPreferences,
  candidates: { id: string; label: string }[]
): string {
  const dest = preferences.destination?.displayName ?? "the destination";
  const list = candidates.map((c) => `- id="${c.id}" ${c.label}`).join("\n");
  const prefBudget = resolveBudget(preferences);
  const budgetStr = prefBudget ? ` Lodging budget tier: ${prefBudget.label}.` : "";
  const vibeStr = kind !== "vibes" && preferences.vibes.length ? ` Trip vibe: ${preferences.vibes.join(", ")}.` : "";

  const instructions: Record<typeof kind, string> = {
    activities: `Pick 3-5 activity categories that best suit a trip to ${dest}.${vibeStr}`,
    vibes: `Pick 2-4 trip vibes that best suit a trip to ${dest}.`,
    lodging: `Pick the lodging type(s) (usually just 1), exactly one star-rating tier, and 2-4 amenities that best suit a trip to ${dest}.${budgetStr}${vibeStr}`,
  };

  return `${instructions[kind]}\n\nOptions:\n${list}\n\nCall make_selection with your picks (their ids) and a one-sentence reason each, plus a 1-2 sentence overall summary of your approach.`;
}
