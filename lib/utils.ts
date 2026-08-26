import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FlightOption } from "@/types/trip";
import { convertFromUsd } from "@/lib/currency";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// PlanningFlow uses overflow-y-auto on <main>, so scrolling the window alone
// doesn't reset the visible position — both need it. Steps that mount fresh
// per stepId get this via StepShell already; multi-stage screens (the
// itinerary review wizard, Refine's city tabs) change internally without
// remounting, so they call this directly whenever their internal stage/city
// advances.
export function scrollStepToTop() {
  window.scrollTo({ top: 0 });
  document.querySelector("main")?.scrollTo({ top: 0 });
}

// `amount` is always the USD source value stored on the option/estimate
// (see lib/currency.ts) — pass a `currency` code to convert-and-format into
// a traveller's preferred display currency. Omitting it keeps the existing
// USD-in, USD-out behavior every pre-existing call site relies on.
export function formatCurrency(amount: number, currency = "USD"): string {
  const converted = convertFromUsd(amount, currency);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(converted);
}

// `new Date("2026-08-12")` parses as UTC midnight, but reading it back with
// local-time methods (.getDate(), .toLocaleDateString(), .toISOString()) in
// a timezone behind UTC silently shows the previous day. Parsing the
// components directly into a local Date sidesteps that mismatch entirely.
export function parseLocalDate(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Extract a 3-letter IATA code from strings like "Seattle-Tacoma International (SEA)" or bare "SEA". */
export function extractIataCode(airport: string): string {
  return airport.match(/\(([A-Z]{3})\)/)?.[1] ?? airport.trim().toUpperCase().slice(-3);
}

/** Integer in [min, max] inclusive. */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pair outbound and return flights so callers can display a roundtrip price.
 * Groups flights by their exact route (origin -> destination) — a roundtrip
 * search produces at most two such routes.
 *
 * `arrivalAirport` (destination.arrivalAirport) is a curated-routing-table
 * lookup that's frequently unset for destinations outside that table, so
 * it's only used as a hint when present, not required. The fallback trusts
 * generation order instead — the backend (both the AI's own tool calls and
 * the deterministic backfill) always fetches the outbound leg before the
 * return leg, so the first-seen route is the outbound one. This is more
 * reliable than inferring it from the routes' own airport codes: for a
 * multi-city trip where the inter-city hop isn't flown (e.g. Copenhagen ->
 * Stockholm by train), the only two flown routes are home->city1 and
 * city2->home, which don't chain into each other the way a simple
 * two-airport roundtrip's legs do.
 */
export function pairFlights(
  flights: FlightOption[],
  arrivalAirport: string
): { outbound: FlightOption; ret: FlightOption | null }[] {
  const routeKey = (f: FlightOption) => `${(f.origin ?? "").toUpperCase()}::${(f.destination ?? "").toUpperCase()}`;
  const routes = new Map<string, FlightOption[]>();
  for (const f of flights) {
    const k = routeKey(f);
    if (!routes.has(k)) routes.set(k, []);
    routes.get(k)!.push(f);
  }

  if (routes.size <= 1) {
    return flights.map((f) => ({ outbound: f, ret: null }));
  }

  const routeEntries = Array.from(routes.entries());
  const arrivalCode = arrivalAirport ? extractIataCode(arrivalAirport) : "";
  const outboundKey =
    (arrivalCode ? routeEntries.find(([k]) => k.split("::")[1].includes(arrivalCode))?.[0] : undefined) ??
    routeEntries[0][0];

  const outbound = routes.get(outboundKey) ?? [];
  const returns  = routeEntries.filter(([k]) => k !== outboundKey).flatMap(([, v]) => v);

  return outbound.map((o) => ({
    outbound: o,
    ret: returns.find((r) => r.airline === o.airline) ?? returns[0] ?? null,
  }));
}

/** Loose city-name comparison — handles "Amalfi Coast" vs "the Amalfi Coast" style variance. */
export function fuzzyCityMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  return x === y || x.includes(y) || y.includes(x);
}

// API routes return `{ error: message }` on failure, but `message` itself is
// sometimes the Anthropic SDK's own error object serialized to a string
// (e.g. `401 {"type":"error","error":{"type":"authentication_error",...}}`).
// Pull out something a user can actually read instead of dumping raw JSON.
export function extractApiErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const inner = typeof parsed?.error === "string" ? parsed.error : JSON.stringify(parsed?.error ?? parsed);
    if (/"type"\s*:\s*"authentication_error"/.test(inner)) {
      return "The AI service rejected the configured API key — check ANTHROPIC_API_KEY and try again.";
    }
    const msgMatch = inner.match(/"message"\s*:\s*"([^"]+)"/);
    if (msgMatch) return msgMatch[1];
    return inner;
  } catch {
    return raw;
  }
}

export interface ItineraryLeg {
  location: string;
  dates: string[];
  dayCount: number;
}

// Groups consecutive itinerary days by location — unlike groupByLocation
// below, a repeated location that isn't consecutive (rare, but possible)
// stays as separate legs, since that's what an actual day-by-day trip looks
// like (visiting the same city twice on non-adjacent days is two legs, not one).
export function groupItineraryDaysByLocation(
  days: { date: string; location?: string }[],
  fallbackLocation: string
): ItineraryLeg[] {
  const legs: ItineraryLeg[] = [];
  for (const day of days) {
    const loc = day.location ?? fallbackLocation;
    const last = legs[legs.length - 1];
    if (last && last.location === loc) {
      last.dates.push(day.date);
      last.dayCount++;
    } else {
      legs.push({ location: loc, dates: [day.date], dayCount: 1 });
    }
  }
  return legs;
}

/** Group an array of items by location, preserving first-seen order. */
export function groupByLocation<T>(
  items: T[],
  getLocation: (item: T) => string | undefined
): { location: string; items: T[] }[] {
  const groups: { location: string; items: T[] }[] = [];
  const index: Record<string, number> = {};
  for (const item of items) {
    const loc = getLocation(item) ?? "Other";
    if (index[loc] === undefined) {
      index[loc] = groups.length;
      groups.push({ location: loc, items: [] });
    }
    groups[index[loc]].items.push(item);
  }
  return groups;
}
