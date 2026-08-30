// Pure data-shaping for the itinerary Word-doc export — no docx-js here.
// Maps ZimmGo's GeneratedItinerary/TripPreferences onto the structure the
// itinerary-format skill expects, so this half is unit-testable without
// asserting on generated XML. See lib/docx/renderItineraryDocx.ts for the
// actual docx-js construction from this model.
//
// Deliberately omits GROUP NOTES (no named travellers/subgroups in ZimmGo's
// data model), MARKET boxes (no market-day data), CAR LOGISTICS boxes (no
// rental-car handoff tracking), and OPTIONAL/TIP boxes (no per-activity
// "worth building excitement about" or "practical reminder" text ZimmGo
// actually generates) — inventing that content would violate the skill's
// own accuracy rules. HIGHLIGHT boxes are the one box type ZimmGo has real
// data for: an activity's own `isLocalFavorite` flag and `description`.
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

export interface DocxHighlight {
  title: string;
  text: string;
}

export interface DocxDay {
  dayNumber: number;
  weekday: string; // "Friday"
  dateLabel: string; // "May 15"
  theme: string;
  bullets: string[];
  highlights: DocxHighlight[];
}

export interface DocxSection {
  location: string;
  dateRangeLabel: string; // "May 15 – 17"
  nightCount: number;
  hotel: DocxPickRow | null;
  days: DocxDay[];
  restaurants: DocxPickRow[];
}

export interface DocxModel {
  title: string;
  dateRangeLabel: string;
  travelersLabel: string | null;
  regionsLine: string;
  glanceRows: { dateLabel: string; weekday: string; location: string; hotel: string; notes: string }[];
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
): { bullets: string[]; highlights: DocxHighlight[] } {
  const highlights: DocxHighlight[] = [];
  if (itinerary.finalizedPlan) {
    const cardIds = itinerary.finalizedPlan.dayCards[day.dayNumber] ?? [];
    const bullets: string[] = [];
    for (const id of cardIds) {
      const act = lookup.acts[id];
      const rest = lookup.rests[id];
      if (act) {
        bullets.push(act.name);
        if (act.isLocalFavorite) highlights.push({ title: act.name, text: act.description });
      } else if (rest) {
        bullets.push(`Dinner: ${rest.name}`);
      }
    }
    return { bullets, highlights };
  }
  const bullets = [...day.morning, ...day.afternoon, ...day.evening];
  return { bullets, highlights };
}

function pickHotelForLocation(
  location: string,
  preferences: TripPreferences,
  hotels: HotelOption[]
): DocxPickRow | null {
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
  return { name: picked.name, notes: `${picked.location} · Ref: pending`, isTravellerPick };
}

function pickRestaurantsForLocation(
  location: string,
  preferences: TripPreferences,
  restaurants: RestaurantOption[]
): DocxPickRow[] {
  const inLocation = restaurants.filter((r) => fuzzyCityMatch(r.location, location));
  const confirmedIds = new Set(preferences.selectedRestaurantIds ?? []);
  return inLocation.slice(0, 5).map((r) => ({
    name: r.name,
    notes: `${r.cuisine} · ${r.priceRange}${r.mustOrder ? ` · Try: ${r.mustOrder}` : ""}`,
    isTravellerPick: confirmedIds.has(r.id),
  }));
}

export function assembleItineraryDocxModel(
  itinerary: GeneratedItinerary,
  preferences: TripPreferences
): DocxModel {
  const lookup = cardLookup(itinerary);
  const fallbackLocation = preferences.destination?.displayName ?? "Your destination";
  const legs = groupItineraryDaysByLocation(itinerary.days, fallbackLocation);

  const glanceRows = itinerary.days.map((day) => {
    const dow = parseLocalDate(day.date).toLocaleDateString("en-US", { weekday: "short" });
    const hotel = pickHotelForLocation(day.location ?? fallbackLocation, preferences, itinerary.hotels);
    return {
      dateLabel: formatDate(day.date),
      weekday: dow,
      location: day.location ?? fallbackLocation,
      hotel: hotel?.name ?? "—",
      notes: day.notes ?? day.theme,
    };
  });

  const sections: DocxSection[] = legs.map((leg) => {
    const legDays = itinerary.days.filter((d) => leg.dates.includes(d.date) && (d.location ?? fallbackLocation) === leg.location);
    const days: DocxDay[] = legDays.map((day) => {
      const { bullets, highlights } = resolveDayBullets(day, itinerary, lookup);
      const isLegOpener = day.date === leg.dates[0];
      const transportPick = isLegOpener ? preferences.selectedTransportByLeg?.[leg.location] : undefined;
      if (transportPick) {
        const icon = transportPick.mode === "ferry" ? "🚢" : "🚆";
        bullets.unshift(`${icon} ${transportPick.provider} to ${leg.location}, ${transportPick.duration}`);
      }
      return {
        dayNumber: day.dayNumber,
        weekday: parseLocalDate(day.date).toLocaleDateString("en-US", { weekday: "long" }),
        dateLabel: formatDate(day.date).replace(/^\w+,\s*/, ""),
        theme: day.theme,
        bullets,
        highlights,
      };
    });

    return {
      location: leg.location,
      dateRangeLabel: leg.dates.length > 1 ? `${formatDate(leg.dates[0])} – ${formatDate(leg.dates[leg.dates.length - 1])}` : formatDate(leg.dates[0]),
      nightCount: Math.max(0, leg.dayCount - 1) || leg.dayCount,
      hotel: pickHotelForLocation(leg.location, preferences, itinerary.hotels),
      days,
      restaurants: pickRestaurantsForLocation(leg.location, preferences, itinerary.restaurants ?? []),
    };
  });

  const visaEntries = getVisaRequirementsForTrip(preferences.destination)
    .filter((e) => e.visa.required)
    .map((e) => ({ country: e.country, summary: e.visa.summary }));

  const bookInAdvance: string[] = [];
  for (const section of sections) {
    if (section.hotel?.isTravellerPick) bookInAdvance.push(`${section.hotel.name} — ${section.location}`);
    for (const r of section.restaurants) {
      if (r.isTravellerPick) bookInAdvance.push(`${r.name} — ${section.location}`);
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
