import { describe, expect, it } from "vitest";
import {
  arrangedLodgingCities, fitRoute, hasArrangedLodging, routeProblems, routeStops, stopCities, stopDates, validFixedStays, withFixedStays,
} from "@/lib/planning/route";
import { planDays } from "@/lib/itinerary/dayPlan";
import { buildWizardSteps } from "@/lib/planning/wizardSteps";
import type { RouteOption, TripPreferences, TripStop } from "@/types/trip";

// The Italy trip: land May 25, fly home from Rome June 15, villa in Tuscany June 8-13.
const START = "2027-05-25";
const villa = { place: "Tuscany", startDate: "2027-06-08", endDate: "2027-06-13", lodgingArranged: true };
const puglia: TripStop[] = [
  { city: "Rome", nights: 3 },
  { city: "Ostuni", nights: 6, area: "Valle d'Itria" },
  { city: "Lecce", nights: 5 },
  { city: "Tuscany", nights: 5, lodgingArranged: true },
  { city: "Rome", nights: 2 },
];
const rules = { startDate: START, numDays: 21, fixedStays: [villa], minNights: 3 };

function prefs(stops: TripStop[], extra: Partial<TripPreferences> = {}): TripPreferences {
  return {
    destination: { displayName: "Italy", cities: stopCities(stops) },
    dates: { type: "exact", startDate: START, endDate: "2027-06-15" },
    stops,
    activities: [], activityRankings: {}, vibes: [], transportation: [],
    ...extra,
  };
}

describe("stopDates", () => {
  it("gives each stop its arrival and leaving dates", () => {
    const dated = stopDates(START, puglia);
    expect(dated.map((s) => [s.city, s.startDate, s.endDate])).toEqual([
      ["Rome", "2027-05-25", "2027-05-28"],
      ["Ostuni", "2027-05-28", "2027-06-03"],
      ["Lecce", "2027-06-03", "2027-06-08"],
      ["Tuscany", "2027-06-08", "2027-06-13"],
      ["Rome", "2027-06-13", "2027-06-15"],
    ]);
  });
});

describe("routeProblems", () => {
  it("accepts a route that keeps every rule, including a short return to Rome", () => {
    expect(routeProblems(puglia, rules)).toEqual([]);
  });

  it("catches nights that don't add up", () => {
    expect(routeProblems(puglia.slice(0, 4), rules)[0]).toMatch(/add up to 19, but the trip is 21/);
  });

  it("catches a fixed stay on the wrong dates", () => {
    const shifted = [{ city: "Rome", nights: 4 }, { city: "Ostuni", nights: 5 }, ...puglia.slice(2)];
    expect(routeProblems(shifted, rules)).toEqual([]); // still lands on June 8
    const late = [{ city: "Rome", nights: 4 }, { city: "Ostuni", nights: 6 }, { city: "Lecce", nights: 4 }, ...puglia.slice(3)];
    expect(routeProblems(late, rules)).toEqual([]); // 4+6+4 = 14 → June 8 too
    const wrong = [{ city: "Rome", nights: 2 }, { city: "Ostuni", nights: 6 }, { city: "Lecce", nights: 5 }, { city: "Tuscany", nights: 5 }, { city: "Rome", nights: 3 }];
    expect(routeProblems(wrong, rules).join(" ")).toMatch(/"Tuscany" must run 2027-06-08 to 2027-06-13/);
  });

  it("catches a missing fixed stay and a stop that's too short", () => {
    const noVilla = [{ city: "Rome", nights: 3 }, { city: "Ostuni", nights: 2 }, { city: "Lecce", nights: 16 }];
    const problems = routeProblems(noVilla, rules).join(" ");
    expect(problems).toMatch(/no stop named exactly "Tuscany"/);
    expect(problems).toMatch(/"Ostuni" has 2 nights; each stop needs at least 3/);
  });
});

describe("withFixedStays", () => {
  it("marks lodging as arranged only at the fixed stay", () => {
    const option: RouteOption = {
      id: "a", title: "Puglia", summary: "", recommended: true, leftOut: [],
      stops: puglia.map((s) => ({ ...s, lodgingArranged: s.city === "Rome" })),
    };
    expect(withFixedStays(option, [villa]).stops.map((s) => s.lodgingArranged)).toEqual([false, false, false, true, false]);
  });
});

describe("validFixedStays", () => {
  it("drops stays outside the trip or with no nights", () => {
    const destination = {
      displayName: "Italy", cities: [],
      fixedStays: [villa, { place: "Parma", startDate: "2027-07-01", endDate: "2027-07-03" }, { place: "X", startDate: "2027-06-01", endDate: "2027-06-01" }],
    };
    expect(validFixedStays(destination, START, 21)).toEqual([villa]);
  });
});

describe("routeStops", () => {
  it("is ignored once the destination's cities have changed", () => {
    const p = prefs(puglia);
    expect(routeStops(p, 21)).toBe(puglia);
    expect(routeStops({ ...p, destination: { displayName: "Italy", cities: ["Rome", "Naples"] } }, 21)).toBeNull();
    expect(routeStops(p, 20)).toBeNull(); // the dates changed
  });
});

describe("planDays with a route", () => {
  it("follows the stops, returning to Rome at the end", () => {
    const days = planDays(prefs(puglia));
    expect(days).toHaveLength(21);
    expect(days[0]).toMatchObject({ date: "2027-05-25", city: "Rome" });
    expect(days.find((d) => d.date === "2027-06-08")?.city).toBe("Tuscany");
    expect(days.find((d) => d.date === "2027-06-12")?.city).toBe("Tuscany");
    expect(days[20]).toMatchObject({ date: "2027-06-14", city: "Rome" });
  });
});

describe("arranged lodging", () => {
  it("covers the villa, not the hotels", () => {
    const p = prefs(puglia);
    expect(arrangedLodgingCities(p)).toEqual(["Tuscany"]);
    expect(hasArrangedLodging("Tuscany, Italy", p)).toBe(true);
    expect(hasArrangedLodging("Lecce", p)).toBe(false);
  });

  it("skips the Hotels stage of the review for that city", () => {
    const steps = buildWizardSteps(stopCities(puglia), { airbnbOnly: false, noFlights: true, arrangedLodging: ["Tuscany"] });
    expect(steps.filter((s) => s.stage === "hotels").map((s) => s.city)).toEqual(["Rome", "Ostuni", "Lecce"]);
  });
});

describe("fitRoute", () => {
  it("absorbs a miscounted day so the villa lands on its dates", () => {
    // Counted from landing day (May 26) instead of the trip's first night (May 25): one night short.
    const fromLanding = [
      { city: "Rome", nights: 3 }, { city: "Ostuni", nights: 6 }, { city: "Lecce", nights: 4 },
      { city: "Tuscany", nights: 5 }, { city: "Rome", nights: 2 },
    ];
    const fitted = fitRoute(fromLanding, rules);
    expect(fitted.map((s) => s.nights)).toEqual([4, 6, 4, 5, 2]); // the shortest stop gets the night
    expect(routeProblems(fitted, rules)).toEqual([]);
  });

  it("rebalances a route several days off, keeping Claude's places and order", () => {
    // Puts the villa June 3-8 — five days early — and gives the end too long.
    const early = [
      { city: "Rome", nights: 2 }, { city: "Lecce", nights: 4 }, { city: "Ostuni", nights: 2 },
      { city: "Tuscany", nights: 5 }, { city: "Rome", nights: 7 },
    ];
    const fitted = fitRoute(early, rules);
    expect(fitted.map((s) => s.city)).toEqual(early.map((s) => s.city));
    expect(routeProblems(fitted, rules)).toEqual([]);
    expect(fitted.map((s) => s.nights)).toEqual([5, 5, 4, 5, 2]);
  });

  it("leaves what it can't fix for routeProblems to report", () => {
    const noStopsBefore = [{ city: "Tuscany", nights: 5 }, { city: "Rome", nights: 16 }];
    expect(routeProblems(fitRoute(noStopsBefore, rules), rules).join(" ")).toMatch(/"Tuscany" must run/);
  });
});

describe("short stops", () => {
  it("lets the last stop be short, and lifts a short stop mid-route to the minimum", () => {
    const route = [
      { city: "Lecce", nights: 7 }, { city: "Matera", nights: 2 }, { city: "Ostuni", nights: 5 },
      { city: "Tuscany", nights: 5 }, { city: "Pisa", nights: 2 },
    ];
    const fitted = fitRoute(route, rules);
    expect(fitted.map((s) => s.nights)).toEqual([6, 3, 5, 5, 2]);
    expect(routeProblems(fitted, rules)).toEqual([]);
  });
});

describe("landing the day after flying", () => {
  it("starts the trip on the ground on the landing day", () => {
    const p = prefs(puglia, { dates: { type: "exact", startDate: "2027-05-24", endDate: "2027-06-15", arrivalDate: "2027-05-25" } });
    const days = planDays(p);
    expect(days).toHaveLength(21);
    expect(days[0]).toMatchObject({ date: "2027-05-25", city: "Rome" });
  });
});
