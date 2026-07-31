import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FlightOption } from "@/types/trip";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
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

/** Pair outbound and return flights so callers can display a roundtrip price. */
export function pairFlights(
  flights: FlightOption[],
  depAirport: string
): { outbound: FlightOption; ret: FlightOption | null }[] {
  const depCode = extractIataCode(depAirport);
  const isOutbound = (f: FlightOption) =>
    depAirport ? (f.origin ?? "").toUpperCase().includes(depCode) : true;
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
