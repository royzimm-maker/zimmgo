// The trip's route — the stops, in order, and how many nights each gets.
// ZimmGo suggests routes on the Route step (app/api/trip/suggest-routes);
// the rules a route must keep are checked here, by code, so a suggestion
// that misses the traveller's fixed dates never reaches them.
import { parseLocalDate } from "@/lib/utils";
import { resolveCity } from "@/lib/location";
import type { Destination, FixedStay, RouteOption, TripPreferences, TripStop } from "@/types/trip";

export function addDays(iso: string, days: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Nights between two ISO dates. */
export function nightsBetween(startDate: string, endDate: string): number {
  return Math.round((parseLocalDate(endDate).getTime() - parseLocalDate(startDate).getTime()) / 86400000);
}

const samePlace = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Each stop with the date the traveller arrives and the date they leave. */
export function stopDates(startDate: string, stops: TripStop[]): (TripStop & { startDate: string; endDate: string })[] {
  let cursor = startDate;
  return stops.map((stop) => {
    const start = cursor;
    cursor = addDays(cursor, stop.nights);
    return { ...stop, startDate: start, endDate: cursor };
  });
}

/**
 * The chosen route's stops, while they still describe the trip: the same
 * cities as the destination (the traveller may have changed them since) —
 * and, given the trip's length, whole nights that add up to it.
 */
export function routeStops(preferences: Pick<TripPreferences, "stops" | "destination">, numDays?: number): TripStop[] | null {
  const stops = preferences.stops;
  if (!stops?.length) return null;
  const cities = preferences.destination?.cities?.filter(Boolean) ?? [];
  const planned = stopCities(stops);
  if (planned.length !== cities.length || planned.some((c, i) => !samePlace(c, cities[i]))) return null;
  if (numDays === undefined) return stops;
  const fits = stops.every((s) => Number.isInteger(s.nights) && s.nights > 0)
    && stops.reduce((sum, s) => sum + s.nights, 0) === numDays;
  return fits ? stops : null;
}

/** The stops' cities, once each, in the order first visited — what destination.cities holds. */
export function stopCities(stops: TripStop[]): string[] {
  const cities: string[] = [];
  for (const s of stops) if (!cities.some((c) => samePlace(c, s.city))) cities.push(s.city);
  return cities;
}

/**
 * Cities where the traveller already has somewhere to stay for every night
 * spent there — no hotel is searched, picked or budgeted for them.
 */
export function arrangedLodgingCities(preferences: Pick<TripPreferences, "stops" | "destination">): string[] {
  const stops = routeStops(preferences) ?? [];
  return stopCities(stops).filter((city) => stops.every((s) => !samePlace(s.city, city) || s.lodgingArranged));
}

/** Whether a place (a city, or a hotel's location) is where the traveller's lodging is already arranged. */
export function hasArrangedLodging(place: string | undefined, preferences: Pick<TripPreferences, "stops" | "destination">): boolean {
  const arranged = arrangedLodgingCities(preferences);
  return arranged.length > 0 && resolveCity(place, arranged) !== undefined;
}

/** Fixed stays that are well-formed and inside the trip. */
export function validFixedStays(destination: Destination | undefined, startDate: string, numDays: number): FixedStay[] {
  const tripEnd = addDays(startDate, numDays);
  return (destination?.fixedStays ?? []).filter(
    (f) => f.place.trim() && f.startDate < f.endDate && f.startDate >= startDate && f.endDate <= tripEnd
  );
}

/**
 * The fewest nights a stop needs. The traveller's minimum, except for the
 * last stop and a return visit (Rome again) — a night or two near the
 * airport before the flight home is fine.
 */
function minNightsFor(stops: TripStop[], i: number, rules: RouteRules): number {
  const returnVisit = stops.slice(0, i).some((p) => samePlace(p.city, stops[i].city));
  return i === stops.length - 1 || returnVisit ? 1 : rules.minNights ?? 1;
}

export interface RouteRules {
  startDate: string;
  numDays: number;
  fixedStays: FixedStay[];
  minNights?: number;
  maxNights?: number;
}

/** What's wrong with a route, in words Claude can fix — empty when it keeps every rule. */
export function routeProblems(stops: TripStop[], rules: RouteRules): string[] {
  const problems: string[] = [];
  if (!stops.length) return ["The route has no stops."];
  const total = stops.reduce((sum, s) => sum + s.nights, 0);
  if (total !== rules.numDays) problems.push(`The nights add up to ${total}, but the trip is ${rules.numDays} nights.`);
  if (stops.some((s) => !Number.isInteger(s.nights) || s.nights < 1)) problems.push("Every stop needs at least one whole night.");

  const dated = stopDates(rules.startDate, stops);
  for (const f of rules.fixedStays) {
    const match = dated.find((s) => samePlace(s.city, f.place));
    if (!match) problems.push(`There's no stop named exactly "${f.place}" for ${f.startDate} to ${f.endDate}.`);
    else if (match.startDate !== f.startDate || match.endDate !== f.endDate) {
      problems.push(`"${f.place}" must run ${f.startDate} to ${f.endDate} (${nightsBetween(f.startDate, f.endDate)} nights), but it runs ${match.startDate} to ${match.endDate}.`);
    }
  }

  // Night limits don't apply to fixed stays.
  const isFixed = (s: TripStop) => rules.fixedStays.some((f) => samePlace(f.place, s.city));
  stops.forEach((s, i) => {
    if (isFixed(s)) return;
    if (s.nights < minNightsFor(stops, i, rules)) {
      problems.push(`"${s.city}" has ${s.nights} night${s.nights === 1 ? "" : "s"}; each stop needs at least ${rules.minNights}.`);
    }
    if (rules.maxNights && s.nights > rules.maxNights) {
      problems.push(`"${s.city}" has ${s.nights} nights; no stop should have more than ${rules.maxNights}.`);
    }
  });
  return problems;
}

/**
 * The trip split around its fixed stays, in date order: the free stretches
 * between them and the fixed stays themselves. A route's stops fill each
 * free stretch, so this is what the prompt tells Claude and what fitRoute
 * holds a route to.
 */
export type RouteSegment =
  | { kind: "free"; startDate: string; endDate: string; nights: number }
  | { kind: "fixed"; stay: FixedStay; nights: number };

export function routeSegments(rules: Pick<RouteRules, "startDate" | "numDays" | "fixedStays">): RouteSegment[] {
  const segments: RouteSegment[] = [];
  let cursor = rules.startDate;
  const free = (endDate: string) => {
    const nights = nightsBetween(cursor, endDate);
    if (nights > 0) segments.push({ kind: "free", startDate: cursor, endDate, nights });
  };
  for (const stay of [...rules.fixedStays].sort((x, y) => x.startDate.localeCompare(y.startDate))) {
    if (stay.startDate < cursor) continue; // overlaps the previous one
    free(stay.startDate);
    segments.push({ kind: "fixed", stay, nights: nightsBetween(stay.startDate, stay.endDate) });
    cursor = stay.endDate;
  }
  free(addDays(rules.startDate, rules.numDays));
  return segments;
}

/**
 * Claude chooses good stops but miscounts nights over a long trip, so the
 * nights are made to fit here: each fixed stay gets exactly its dates, and
 * the stops in each free stretch are brought within the per-stop limits
 * and then rebalanced — a night at a time, from the longest stop or to the
 * shortest — until they fill it. The places and their order stay Claude's. A route whose
 * stops can't fill a stretch (none there, or the limits don't allow it) is
 * left for routeProblems to report.
 */
export function fitRoute(stops: TripStop[], rules: RouteRules): TripStop[] {
  const out = stops.map((s) => ({ ...s }));
  const segments = routeSegments(rules);
  const fixedIdx = segments
    .filter((seg): seg is Extract<RouteSegment, { kind: "fixed" }> => seg.kind === "fixed")
    .map((seg) => out.findIndex((s) => samePlace(s.city, seg.stay.place)));
  // Fixed stays must appear once each, in date order, for the stretches to line up.
  if (fixedIdx.some((i, k) => i < 0 || (k > 0 && i <= fixedIdx[k - 1]))) return out;

  let stopPos = 0;
  let fixedSeen = 0;
  for (const seg of segments) {
    if (seg.kind === "fixed") {
      out[fixedIdx[fixedSeen]].nights = seg.nights;
      stopPos = fixedIdx[fixedSeen] + 1;
      fixedSeen++;
      continue;
    }
    const end = fixedSeen < fixedIdx.length ? fixedIdx[fixedSeen] : out.length;
    const group = out.slice(stopPos, end);
    if (!group.length) continue;
    const minFor = (s: TripStop) => minNightsFor(out, out.indexOf(s), rules);
    const max = rules.maxNights ?? Infinity;
    for (const s of group) s.nights = Math.min(Math.max(s.nights, minFor(s)), Math.max(max, minFor(s)));
    let total = group.reduce((sum, s) => sum + s.nights, 0);
    for (let guard = 0; total !== seg.nights && guard < 500; guard++) {
      if (total < seg.nights) {
        const room = group.filter((s) => s.nights < max);
        const target = (room.length ? room : group).reduce((lo, s) => (s.nights < lo.nights ? s : lo));
        target.nights++;
        total++;
      } else {
        const spare = group.filter((s) => s.nights > minFor(s));
        if (!spare.length) break;
        spare.reduce((hi, s) => (s.nights > hi.nights ? s : hi)).nights--;
        total--;
      }
    }
    stopPos = end;
  }
  return out;
}

/** A suggested route made consistent with the traveller's fixed stays: their arranged lodging is marked. */
export function withFixedStays(option: RouteOption, fixedStays: FixedStay[]): RouteOption {
  return {
    ...option,
    stops: option.stops.map((s) => {
      const fixed = fixedStays.find((f) => samePlace(f.place, s.city));
      return fixed ? { ...s, city: fixed.place, lodgingArranged: !!fixed.lodgingArranged } : { ...s, lodgingArranged: false };
    }),
  };
}
