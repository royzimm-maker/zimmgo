// Pure data-shaping for the itinerary Word-doc export — no docx-js here.
// Maps ZimmGo's GeneratedItinerary/TripPreferences onto the structure the
// itinerary-format skill (v2) expects, so this half is unit-testable
// without asserting on generated XML. See lib/docx/renderItineraryDocx.ts
// for the actual docx-js construction from this model.
//
// Deliberately omits GROUP NOTES (no named travellers/subgroups in ZimmGo's
// data model) and CAR LOGISTICS boxes (no rental-car handoff tracking) — v2
// of the skill also dropped OPTIONAL/TIP boxes entirely in favor of plain
// bullets, so an activity's `isLocalFavorite` flag gets no special
// treatment as a bullet. One box type is back by request: a per-day
// "if you only do one thing today" callout, built strictly from a real
// isLocalFavorite pick placed on that day in the traveller's finalizedPlan
// (see resolveDayHighlight) — never fabricated, and simply absent for a day
// that has no such pick or hasn't been scheduled yet.
// The glance table's column stays labeled "Notes", not "Confirmed
// Bookings" like the reference example — nothing in ZimmGo is an actual
// confirmed booking, and relabeling the column to imply otherwise would
// cut against the skill's own accuracy rules even though no individual
// cell claims a booking that doesn't exist.
import {
  groupItineraryDaysByLocation, formatDate, parseLocalDate,
} from "@/lib/utils";
import { resolveCity, sameLocation } from "@/lib/location";
import { chosenHotelForCity } from "@/lib/planning/hotelChoice";
import { selectionsOf } from "@/lib/planning/selections";
import { buildTripPlan, dayLines, type DayPlan } from "@/lib/itinerary/tripPlan";
import { getVisaRequirementsForTrip } from "@/lib/data/visaRequirements";
import type {
  GeneratedItinerary, TripPreferences, RestaurantOption, HotelOption,
} from "@/types/trip";

export interface DocxPickRow {
  name: string;
  notes: string;
  isTravellerPick: boolean; // renders "✓ Your pick" — never "BOOKED", ZimmGo has no real booking data
}

export interface DocxHotel {
  name: string;
  writeup: string; // a single prose sentence built from real HotelOption fields
  isTravellerPick: boolean;
}

export interface DocxDay {
  dayNumber: number;
  weekday: string; // "Friday"
  dateLabel: string; // "May 15"
  theme: string;
  bullets: string[];
  // "If you only do one thing today" callout — only set when a real
  // isLocalFavorite activity was placed on this day in the finalized plan.
  highlight: { name: string; reason: string } | null;
}

export interface DocxSection {
  location: string;
  dateRangeLabel: string; // "May 15 – 17"
  nightCount: number;
  hotel: DocxHotel | null;
  gettingThere: string[]; // logistics bullets; empty means the block is skipped entirely
  days: DocxDay[];
  restaurantsBooked: DocxPickRow[];
  restaurantsOptions: DocxPickRow[];
}

export interface DocxGlanceRow {
  dateLabel: string;
  weekday: string;
  location: string;
  hotel: string;
  notes: string;
  isTransitionDay: boolean;
}

export interface DocxModel {
  title: string;
  dateRangeLabel: string;
  travelersLabel: string | null;
  regionsLine: string;
  glanceRows: DocxGlanceRow[];
  sections: DocxSection[];
  visaEntries: { country: string; summary: string }[];
  seasonalNote: string | null;
  bookInAdvance: string[];
}

// A day's bullets and highlight come from the shared plan
// (lib/itinerary/tripPlan.ts) — the same day contents the on-screen
// itinerary and "Copy itinerary" show.
function dayBullets(dayPlan: DayPlan | undefined): string[] {
  if (!dayPlan) return [];
  const lines = dayLines(dayPlan).map((l) => (l.label ? `${l.label}: ${l.text}` : l.text));
  return lines.length || dayPlan.source !== "traveller" ? lines : ["Free day — nothing scheduled"];
}

// Only ever from an activity the traveller actually scheduled — ZimmGo's
// suggestions have no structured link back to a specific activity, so an
// unarranged day gets no highlight rather than a guessed one.
function dayHighlight(dayPlan: DayPlan | undefined): { name: string; reason: string } | null {
  for (const item of dayPlan?.items ?? []) {
    if (item.kind === "activity" && item.activity.isLocalFavorite && item.activity.description) {
      return { name: item.name, reason: item.activity.description };
    }
  }
  return null;
}

function hotelWriteup(hotel: HotelOption): string {
  const highlights = hotel.highlights.slice(0, 3).join(" · ");
  return highlights ? `${hotel.location}. ${highlights}.` : `${hotel.location}.`;
}

// Same choice the on-screen itinerary shows (lib/planning/hotelChoice.ts).
function pickHotelForLocation(
  location: string,
  itinerary: GeneratedItinerary,
  preferences: TripPreferences,
  cities: string[]
): DocxHotel | null {
  const city = resolveCity(location, cities, { fallbackToLast: true }) ?? location;
  const choice = chosenHotelForCity(city, itinerary, cities);
  if (!choice) return null;
  return { name: choice.hotel.name, writeup: hotelWriteup(choice.hotel), isTravellerPick: choice.byTraveller };
}

function splitRestaurantsForLocation(
  location: string,
  itinerary: GeneratedItinerary,
  restaurants: RestaurantOption[]
): { booked: DocxPickRow[]; options: DocxPickRow[] } {
  const inLocation = restaurants.filter((r) => sameLocation(r.location, location));
  const confirmedIds = new Set(selectionsOf(itinerary).restaurantIds ?? []);
  const toRow = (r: RestaurantOption): DocxPickRow => ({
    name: r.name,
    notes: `${r.cuisine} · ${r.priceRange}${r.mustOrder ? ` · Try: ${r.mustOrder}` : ""}`,
    isTravellerPick: confirmedIds.has(r.id),
  });
  const booked = inLocation.filter((r) => confirmedIds.has(r.id)).map(toRow);
  const options = inLocation.filter((r) => !confirmedIds.has(r.id)).slice(0, 5).map(toRow);
  return { booked, options };
}

// GETTING THERE is its own logistics block, not folded into day one's
// bullets — the first section describes the flight in; every later section
// describes the ground-transport pick for that leg, falling back to the
// AI's own inter-city travel note (day.notes) when there's no structured
// pick. Empty array when there's nothing real to say — the renderer skips
// the block entirely rather than showing an empty header.
function gettingThereFor(
  legIndex: number,
  legOpenerDay: GeneratedItinerary["days"][number],
  location: string,
  itinerary: GeneratedItinerary
): string[] {
  if (legIndex === 0) {
    const flight = selectionsOf(itinerary).flight ?? itinerary.flights[0];
    if (!flight) return [];
    // An estimate has no airline — say what it is rather than "Any airline".
    return [flight.priceIsEstimate ? `✈ Fly ${flight.origin} → ${flight.destination} — search Google Flights for fares` : `✈ ${flight.airline} — ${flight.origin} → ${flight.destination}`];
  }
  const transportPick = selectionsOf(itinerary).transportByLeg?.[location];
  if (transportPick) {
    const icon = transportPick.mode === "ferry" ? "🚢" : "🚆";
    return [`${icon} ${transportPick.provider} to ${location}, ${transportPick.duration}`];
  }
  return legOpenerDay.notes ? [legOpenerDay.notes] : [];
}

export function assembleItineraryDocxModel(
  itinerary: GeneratedItinerary,
  preferences: TripPreferences
): DocxModel {
  const plan = buildTripPlan(itinerary, preferences);
  const planFor = new Map(plan.days.map((d) => [d.day.dayNumber, d]));
  const cities = plan.cities;
  const fallbackLocation = preferences.destination?.displayName ?? "Your destination";
  const legs = groupItineraryDaysByLocation(itinerary.days, fallbackLocation);

  let prevLocation: string | null = null;
  const glanceRows: DocxGlanceRow[] = itinerary.days.map((day) => {
    const location = day.location ?? fallbackLocation;
    const dow = parseLocalDate(day.date).toLocaleDateString("en-US", { weekday: "short" });
    const hotel = pickHotelForLocation(location, itinerary, preferences, cities);
    const isTransitionDay = prevLocation !== null && location !== prevLocation;
    prevLocation = location;
    return {
      dateLabel: formatDate(day.date),
      weekday: dow,
      location,
      hotel: hotel?.name ?? "—",
      notes: day.notes ?? day.theme,
      isTransitionDay,
    };
  });

  const sections: DocxSection[] = legs.map((leg, legIndex) => {
    const legDays = itinerary.days.filter((d) => leg.dates.includes(d.date) && (d.location ?? fallbackLocation) === leg.location);
    const days: DocxDay[] = legDays.map((day) => ({
      dayNumber: day.dayNumber,
      weekday: parseLocalDate(day.date).toLocaleDateString("en-US", { weekday: "long" }),
      dateLabel: formatDate(day.date).replace(/^\w+,\s*/, ""),
      theme: day.theme,
      bullets: dayBullets(planFor.get(day.dayNumber)),
      highlight: dayHighlight(planFor.get(day.dayNumber)),
    }));

    const { booked, options } = splitRestaurantsForLocation(leg.location, itinerary, itinerary.restaurants ?? []);

    return {
      location: leg.location,
      dateRangeLabel: leg.dates.length > 1 ? `${formatDate(leg.dates[0])} – ${formatDate(leg.dates[leg.dates.length - 1])}` : formatDate(leg.dates[0]),
      nightCount: Math.max(0, leg.dayCount - 1) || leg.dayCount,
      hotel: pickHotelForLocation(leg.location, itinerary, preferences, cities),
      gettingThere: gettingThereFor(legIndex, legDays[0], leg.location, itinerary),
      days,
      restaurantsBooked: booked,
      restaurantsOptions: options,
    };
  });

  const visaEntries = getVisaRequirementsForTrip(preferences.destination)
    .filter((e) => e.visa.required)
    .map((e) => ({ country: e.country, summary: e.visa.summary }));

  const bookInAdvance: string[] = [];
  for (const section of sections) {
    if (section.hotel?.isTravellerPick) bookInAdvance.push(`${section.hotel.name} — ${section.location}`);
    for (const r of section.restaurantsBooked) {
      bookInAdvance.push(`${r.name} — ${section.location}`);
    }
  }

  return {
    title: preferences.destination?.displayName ?? "Your Trip",
    dateRangeLabel: itinerary.days.length
      ? `${formatDate(itinerary.days[0].date)} – ${formatDate(itinerary.days[itinerary.days.length - 1].date)}`
      : "",
    travelersLabel: preferences.travelers ? `${preferences.travelers} traveller${preferences.travelers === 1 ? "" : "s"}` : null,
    regionsLine: legs.map((l) => l.location).join("  ·  "),
    glanceRows,
    sections,
    visaEntries,
    seasonalNote: preferences.destination?.seasonalNote ?? null,
    bookInAdvance,
  };
}
