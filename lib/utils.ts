import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FlightOption } from "@/types/trip";

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

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
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
 * Keyed off the destination's arrival airport (a reliable IATA code set by the
 * AI during destination inference) rather than the user's departure input,
 * which is often free text like "Seattle" — extractIataCode's fallback would
 * mangle that into a 3-letter code that never matches a real airport, leaving
 * every flight (both directions) treated as its own unpaired "outbound" leg.
 */
export function pairFlights(
  flights: FlightOption[],
  arrivalAirport: string
): { outbound: FlightOption; ret: FlightOption | null }[] {
  const arrivalCode = extractIataCode(arrivalAirport);
  const isOutbound = (f: FlightOption) =>
    arrivalAirport ? (f.destination ?? "").toUpperCase().includes(arrivalCode) : true;
  const outbound = flights.filter(isOutbound);
  const returns  = flights.filter((f) => !isOutbound(f));

  if (outbound.length) {
    return outbound.map((o) => ({
      outbound: o,
      ret: returns.find((r) => r.airline === o.airline) ?? returns[0] ?? null,
    }));
  }
  return flights.map((f) => ({ outbound: f, ret: null }));
}

/** Loose city-name comparison — handles "Amalfi Coast" vs "the Amalfi Coast" style variance. */
export function fuzzyCityMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  return x === y || x.includes(y) || y.includes(x);
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
