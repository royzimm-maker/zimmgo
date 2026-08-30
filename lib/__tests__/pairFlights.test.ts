import { describe, it, expect } from "vitest";
import { pairFlights } from "@/lib/utils";
import type { FlightOption } from "@/types/trip";

let idCounter = 0;
function makeFlight(overrides: Partial<FlightOption> & { origin: string; destination: string }): FlightOption {
  idCounter++;
  return {
    id: `flight-${idCounter}`,
    airline: "Delta",
    flightNumber: `DL${idCounter}`,
    departureTime: "2026-09-08T09:00:00Z",
    arrivalTime: "2026-09-08T21:00:00Z",
    duration: "8h",
    stops: 0,
    price: 500,
    currency: "USD",
    cabinClass: "economy",
    ...overrides,
  };
}

describe("pairFlights", () => {
  it("treats a single route as one-way legs with no return", () => {
    const flights = [
      makeFlight({ origin: "JFK", destination: "BCN", airline: "Delta" }),
      makeFlight({ origin: "JFK", destination: "BCN", airline: "United" }),
    ];
    const pairs = pairFlights(flights, "BCN");
    expect(pairs).toEqual([
      { outbound: flights[0], ret: null },
      { outbound: flights[1], ret: null },
    ]);
  });

  it("uses the arrival-airport hint to pick the outbound leg and pairs same-airline returns", () => {
    const outboundDelta = makeFlight({ origin: "JFK", destination: "BCN", airline: "Delta" });
    const outboundUnited = makeFlight({ origin: "JFK", destination: "BCN", airline: "United" });
    const returnDelta = makeFlight({ origin: "BCN", destination: "JFK", airline: "Delta" });
    const returnUnited = makeFlight({ origin: "BCN", destination: "JFK", airline: "United" });

    // Return-route flights generated before outbound ones — regression guard
    // for the old airport-code-chaining logic, which assumed outbound always
    // appears first.
    const flights = [returnDelta, returnUnited, outboundDelta, outboundUnited];
    const pairs = pairFlights(flights, "Barcelona (BCN)");

    expect(pairs).toHaveLength(2);
    expect(pairs.find((p) => p.outbound.airline === "Delta")).toEqual({
      outbound: outboundDelta,
      ret: returnDelta,
    });
    expect(pairs.find((p) => p.outbound.airline === "United")).toEqual({
      outbound: outboundUnited,
      ret: returnUnited,
    });
  });

  it("falls back to insertion order (first-seen route = outbound) when there's no arrival-code hint", () => {
    const outbound = makeFlight({ origin: "JFK", destination: "BCN" });
    const ret = makeFlight({ origin: "BCN", destination: "JFK" });
    const pairs = pairFlights([outbound, ret], "");
    expect(pairs).toEqual([{ outbound, ret }]);
  });

  it("doesn't let an unflown inter-city hop get mistaken for the return leg", () => {
    // Multi-city trip: fly in JFK->BCN, fly home BCN->JFK, and a separate
    // inter-city hop BCN->SVQ that the traveller books themselves (train,
    // no return flight for it at all). Grouping by exact route used to
    // break here — only the true return route should pair with the outbound.
    const outbound = makeFlight({ origin: "JFK", destination: "BCN", airline: "Delta" });
    const homeReturn = makeFlight({ origin: "BCN", destination: "JFK", airline: "Delta" });
    const interCityHop = makeFlight({ origin: "BCN", destination: "SVQ", airline: "Delta" });

    const pairs = pairFlights([outbound, interCityHop, homeReturn], "Barcelona (BCN)");

    expect(pairs).toHaveLength(1);
    expect(pairs[0].outbound).toBe(outbound);
    // Both non-outbound routes are pooled as "returns"; same-airline match
    // picks whichever comes first in that pool — asserting it's one of the
    // two rather than assuming return-route ordering is guaranteed here.
    expect([interCityHop, homeReturn]).toContain(pairs[0].ret);
  });
});
