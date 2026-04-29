import type { TripPreferences } from "@/types/trip";
import { BUDGET_LABELS, BUDGET_MAX } from "@/types/trip";

// Builds the user-facing prompt for itinerary generation from the stored preferences
export function buildItineraryPrompt(preferences: TripPreferences): string {
  const parts: string[] = [];

  const dest = preferences.destination?.displayName ?? "the destination";
  parts.push(`Please create a comprehensive travel plan for **${dest}**.`);

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

  if (preferences.budgetRange) {
    const label = BUDGET_LABELS[preferences.budgetRange];
    const max   = BUDGET_MAX[preferences.budgetRange];
    parts.push(`Daily budget: ${label} (max $${max}/day per person including lodging and meals).`);
  }

  if (preferences.lodging) {
    const l = preferences.lodging;
    parts.push(
      `Lodging: ${l.types.join(" or ")} (minimum ${l.minStars}★)` +
      (l.amenities.length ? `, with: ${l.amenities.join(", ")}` : "") + "."
    );
  }

  if (preferences.airlinePrefs) {
    const a = preferences.airlinePrefs;
    const airlineStr = [
      a.airlines.length ? `preferred airlines: ${a.airlines.join(", ")}` : null,
      a.alliances.length ? `alliances: ${a.alliances.join(", ")}` : null,
      `cabin class: ${a.cabinClass}`,
      a.preferNonstop ? "nonstop preferred" : null,
    ].filter(Boolean).join("; ");
    parts.push(`Flight preferences: ${airlineStr}.`);
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
    contextLines.push(`Current destination: ${preferences.destination.displayName}`);
  }
  if (preferences.activities.length) {
    contextLines.push(`Activities: ${preferences.activities.join(", ")}`);
  }
  if (preferences.vibes.length) {
    contextLines.push(`Vibe: ${preferences.vibes.join(", ")}`);
  }
  if (preferences.budgetRange) {
    contextLines.push(`Budget: ${BUDGET_LABELS[preferences.budgetRange]}`);
  }

  const context = contextLines.length
    ? `\n\nCurrent trip context:\n${contextLines.map((l) => `- ${l}`).join("\n")}`
    : "";

  return `You are an AI travel advisor helping plan a trip. Answer questions, offer suggestions, and help the user refine their preferences.${context}

Keep responses concise and specific. If asked about something outside the trip (e.g. unrelated topics), gently redirect to trip planning.`;
}
