import { describe, expect, it } from "vitest";
import { rollPastDatesForward } from "@/lib/planning/parsedDates";
import type { ParseFullTripResult } from "@/app/api/trip/parse-full/route";

const base: ParseFullTripResult = { cities: ["Rome"], displayName: "Italy", likelyRoadTrip: false, flightsObviouslyRequired: true, summary: "" };

describe("rollPastDatesForward", () => {
  it("moves a trip that has already passed this year to next year, fixed stays too", () => {
    const parsed = {
      ...base,
      dates: { type: "exact" as const, startDate: "2026-05-24", endDate: "2026-06-15" },
      fixedStays: [{ place: "Tuscany", startDate: "2026-06-08", endDate: "2026-06-13" }],
    };
    const rolled = rollPastDatesForward(parsed, "2026-10-08");
    expect(rolled.dates).toMatchObject({ startDate: "2027-05-24", endDate: "2027-06-15" });
    expect(rolled.fixedStays?.[0]).toMatchObject({ startDate: "2027-06-08", endDate: "2027-06-13" });
  });

  it("leaves future and flexible dates alone", () => {
    const future = { ...base, dates: { type: "exact" as const, startDate: "2026-12-01", endDate: "2026-12-05" } };
    expect(rollPastDatesForward(future, "2026-10-08")).toBe(future);
    const flexible = { ...base, dates: { type: "flexible" as const, flexibleMonth: "2027-05", flexibleDuration: 10 } };
    expect(rollPastDatesForward(flexible, "2026-10-08")).toBe(flexible);
  });
});
