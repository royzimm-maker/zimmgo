import type { TripPreferences } from "@/types/trip";
import { BUDGET_LABELS, BUDGET_MAX } from "@/types/trip";

// Builds the user-facing prompt for itinerary generation from the stored preferences
export function buildItineraryPrompt(preferences: TripPreferences): string {
  const parts: string[] = [];

  const destNames = preferences.destination?.displayName ?? "the destination";
  const destList  = destNames.split(", ").filter(Boolean);
  const isMulti   = destList.length > 1;

  if (isMulti) {
    parts.push(
      `Please create a comprehensive **multi-destination** travel plan covering: **${destNames}**.` +
      ` Allocate days across all destinations and include logical travel connections between them.`
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

  if (preferences.budgetRange) {
    const label = BUDGET_LABELS[preferences.budgetRange];
    const max   = BUDGET_MAX[preferences.budgetRange];
    parts.push(`Lodging budget: ${label} (max $${max} per room per night).`);
  }

  if (preferences.dailyFoodBudgetPerPerson) {
    parts.push(`Food budget: $${preferences.dailyFoodBudgetPerPerson} per person per day.`);
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

  if (preferences.airlinePrefs) {
    const a = preferences.airlinePrefs;
    if (a.prioritizeLowestFare) {
      parts.push(`Flight preferences: lowest available fares — ignore airline/alliance preferences, prioritise economy class and cheapest options.`);
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

  parts.push(
    "\nPlease use the available tools to search for flights, hotels, and activities, then synthesise everything into a final day-by-day itinerary. " +
    "For each recommendation, briefly explain why it's the best fit for this traveller's specific preferences."
  );

  return parts.join(" ");
}

// Prompt for the conversational advisor chat
export function buildChatSystemPrompt(preferences: TripPreferences): string {
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
  if (preferences.budgetRange) {
    contextLines.push(`Lodging budget: ${BUDGET_LABELS[preferences.budgetRange]}`);
  }
  if (preferences.dailyFoodBudgetPerPerson) {
    contextLines.push(`Food budget: $${preferences.dailyFoodBudgetPerPerson}/person/day`);
  }

  const context = contextLines.length
    ? `\n\nCurrent trip context:\n${contextLines.map((l) => `- ${l}`).join("\n")}`
    : "";

  return `You are an AI travel advisor helping plan a trip. Answer questions, offer suggestions, and help the user refine their preferences.${context}

Keep responses concise and specific. If asked about something outside the trip (e.g. unrelated topics), gently redirect to trip planning.`;
}
