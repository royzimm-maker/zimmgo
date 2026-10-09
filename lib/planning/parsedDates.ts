// Dates from the "describe your whole trip" intake (app/api/trip/parse-full).
import type { ParseFullTripResult } from "@/app/api/trip/parse-full/route";

const shiftYear = (iso: string, years: number) => `${Number(iso.slice(0, 4)) + years}${iso.slice(4)}`;

/**
 * Dates said without a year ("May 24") mean the next one, but Claude
 * sometimes resolves them to this year even once they've passed. A trip
 * can't start in the past, so move it — and its fixed stays — forward by
 * whole years until it doesn't. (Feb 29 isn't a concern for this app's
 * trips; a shifted Feb 29 would read as Mar 1.)
 */
export function rollPastDatesForward(result: ParseFullTripResult, todayISO: string): ParseFullTripResult {
  const start = result.dates?.type === "exact" ? result.dates.startDate : undefined;
  if (!start || start >= todayISO) return result;
  let years = 0;
  while (shiftYear(start, years) < todayISO) years++;
  return {
    ...result,
    dates: {
      ...result.dates!,
      startDate: shiftYear(start, years),
      endDate: result.dates!.endDate && shiftYear(result.dates!.endDate, years),
      arrivalDate: result.dates!.arrivalDate && shiftYear(result.dates!.arrivalDate, years),
    },
    fixedStays: result.fixedStays?.map((f) => ({ ...f, startDate: shiftYear(f.startDate, years), endDate: shiftYear(f.endDate, years) })),
  };
}
