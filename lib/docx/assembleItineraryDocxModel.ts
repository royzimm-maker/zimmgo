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
  groupItineraryDaysByLocation, formatDate, parseLocalDate, fuzzyCityMatch,
} from "@/lib/utils";
import { getVisaRequirementsForTrip } from "@/lib/data/visaRequirements";
import type {
  GeneratedItinerary, TripPreferences, ActivityOption, RestaurantOption, HotelOption,
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

function cardLookup(itinerary: GeneratedItinerary) {
  const acts: Record<string, ActivityOption> = {};
  const rests: Record<string, RestaurantOption> = {};
  itinerary.activities.forEach((a) => { acts[`act-${a.id}`] = a; });
  (itinerary.restaurants ?? []).forEach((r) => { rests[`rest-${r.id}`] = r; });
  return { acts, rests };
}

// Resolves a day's actual plan: the traveller's finalized day-by-day picks
// when they've done that step, else the AI's own free-text blurbs — same
// fallback components/planning/ItineraryView.tsx's clipboard-copy already
// uses for an itinerary nobody has scheduled day-by-day yet.
function resolveDayBullets(
  day: GeneratedItinerary["days"][number],
  itinerary: GeneratedItinerary,
  lookup: ReturnType<typeof cardLookup>
): string[] {
  if (itinerary.finalizedPlan) {
    const cardIds = itinerary.finalizedPlan.dayCards[day.dayNumber] ?? [];
    const bullets: string[] = [];
    for (const id of cardIds) {
      const act = lookup.acts[id];
      const rest = lookup.rests[id];
      if (act) bullets.push(act.name);
      else if (rest) bullets.push(`Dinner: ${rest.name}`);
    }
    return bullets;
  }
  return [...day.morning, ...day.afternoon, ...day.evening];
}

// Only ever set from a real, scheduled isLocalFavorite pick — the AI's own
// free-text morning/afternoon/evening blurbs (no finalizedPlan yet) have no
// structured link back to a specific ActivityOption, so a day that hasn't
// been scheduled just gets no highlight rather than a guessed one.
function resolveDayHighlight(
  day: GeneratedItinerary["days"][number],
  itinerary: GeneratedItinerary,
  lookup: ReturnType<typeof cardLookup>
): { name: string; reason: string } | null {
  if (!itinerary.finalizedPlan) return null;
  const cardIds = itinerary.finalizedPlan.dayCards[day.dayNumber] ?? [];
  for (const id of cardIds) {
    const act = lookup.acts[id];
    if (act?.isLocalFavorite && act.description) {
      return { name: act.name, reason: act.description };
    }
  }
  return null;
}

function hotelWriteup(hotel: HotelOption): string {
  const highlights = hotel.highlights.slice(0, 3).join(" · ");
  return highlights ? `${hotel.location}. ${highlights}.` : `${hotel.location}.`;
}

function pickHotelForLocation(
  location: string,
  preferences: TripPreferences,
  hotels: HotelOption[]
): DocxHotel | null {
  const picked =
    preferences.selectedHotelsByCity?.[location] ??
    (preferences.selectedHotel && fuzzyCityMatch(preferences.selectedHotel.city ?? preferences.selectedHotel.location, location)
      ? preferences.selectedHotel
      : undefined) ??
    hotels.find((h) => fuzzyCityMatch(h.city ?? h.location, location));
  if (!picked) return null;
  const isTravellerPick = Boolean(
    preferences.selectedHotelsByCity?.[location]?.id === picked.id ||
    preferences.selectedHotel?.id === picked.id
  );
  return { name: picked.name, writeup: hotelWriteup(picked), isTravellerPick };
}

function splitRestaurantsForLocation(
  location: string,
  preferences: TripPreferences,
  restaurants: RestaurantOption[]
): { booked: DocxPickRow[]; options: DocxPickRow[] } {
  const inLocation = restaurants.filter((r) => fuzzyCityMatch(r.location, location));
  const confirmedIds = new Set(preferences.selectedRestaurantIds ?? []);
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
  itinerary: GeneratedItinerary,
  preferences: TripPreferences
): string[] {
  if (legIndex === 0) {
    const flight = preferences.selectedFlight ?? itinerary.flights[0];
    return flight ? [`✈ ${flight.airline} — ${flight.origin} → ${flight.destination}`] : [];
  }
  const transportPick = preferences.selectedTransportByLeg?.[location];
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
  const lookup = cardLookup(itinerary);
  const fallbackLocation = preferences.destination?.displayName ?? "Your destination";
  const legs = groupItineraryDaysByLocation(itinerary.days, fallbackLocation);

  let prevLocation: string | null = null;
  const glanceRows: DocxGlanceRow[] = itinerary.days.map((day) => {
    const location = day.location ?? fallbackLocation;
    const dow = parseLocalDate(day.date).toLocaleDateString("en-US", { weekday: "short" });
    const hotel = pickHotelForLocation(location, preferences, itinerary.hotels);
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
      bullets: resolveDayBullets(day, itinerary, lookup),
      highlight: resolveDayHighlight(day, itinerary, lookup),
    }));

    const { booked, options } = splitRestaurantsForLocation(leg.location, preferences, itinerary.restaurants ?? []);

    return {
      location: leg.location,
      dateRangeLabel: leg.dates.length > 1 ? `${formatDate(leg.dates[0])} – ${formatDate(leg.dates[leg.dates.length - 1])}` : formatDate(leg.dates[0]),
      nightCount: Math.max(0, leg.dayCount - 1) || leg.dayCount,
      hotel: pickHotelForLocation(leg.location, preferences, itinerary.hotels),
      gettingThere: gettingThereFor(legIndex, legDays[0], leg.location, itinerary, preferences),
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
