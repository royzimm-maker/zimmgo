import { describe, it, expect } from "vitest";
import { sameLocation, resolveCity, locationWords, itineraryCities } from "@/lib/location";

describe("sameLocation", () => {
  it.each([
    ["Rome", "Rome"],
    ["Rome", "Trastevere, Rome"],
    ["the Amalfi Coast", "Amalfi Coast"],
    ["Reykjavík", "Reykjavik city center"], // accents ignored
    ["Dolomites, Italy", "Dolomites (Val Gardena)"], // same distinctive first word
    ["Saint-Germain, Paris", "PARIS"],
    ["Florence", "Florence (Firenze)"],
  ])("%s ≈ %s", (a, b) => {
    expect(sameLocation(a, b)).toBe(true);
    expect(sameLocation(b, a)).toBe(true);
  });

  it.each([
    ["Nice", "Venice"], // the old substring matcher said yes
    ["San Sebastián", "San Francisco"], // the old first-word matcher said yes
    ["New York", "New Orleans"],
    ["the Dolomites", "the Amalfi Coast"],
    ["Kyoto", "Tokyo"],
    ["Paris", "Parisian Suburbs"],
  ])("%s ≠ %s", (a, b) => {
    expect(sameLocation(a, b)).toBe(false);
    expect(sameLocation(b, a)).toBe(false);
  });

  it("never matches a missing name", () => {
    expect(sameLocation(undefined, "Rome")).toBe(false);
    expect(sameLocation("Rome", "")).toBe(false);
    expect(sameLocation("—", "Rome")).toBe(false);
  });
});

describe("locationWords", () => {
  it("normalizes case, accents, punctuation and a leading 'the'", () => {
    expect(locationWords("The Côte d'Azur, France")).toEqual(["cote", "d", "azur", "france"]);
  });
});

describe("resolveCity", () => {
  const cities = ["Rome", "Rome Outskirts", "Florence"];

  it("prefers an exact match over a looser one", () => {
    expect(resolveCity("Rome Outskirts", cities)).toBe("Rome Outskirts");
    expect(resolveCity("rome", cities)).toBe("Rome");
  });

  it("resolves a neighbourhood to its city", () => {
    expect(resolveCity("Oltrarno, Florence", cities)).toBe("Florence");
  });

  it("falls back to the last city only when asked", () => {
    const ringRoad = ["Reykjavik", "the Ring Road"];
    expect(resolveCity("Vik and South Coast Iceland", ringRoad)).toBeUndefined();
    expect(resolveCity("Vik and South Coast Iceland", ringRoad, { fallbackToLast: true })).toBe("the Ring Road");
  });

  it("returns nothing without a location or cities", () => {
    expect(resolveCity(undefined, cities, { fallbackToLast: true })).toBeUndefined();
    expect(resolveCity("Rome", [], { fallbackToLast: true })).toBeUndefined();
  });
});

describe("itineraryCities", () => {
  const days = (...locations: string[]) => ({ days: locations.map((location) => ({ location })) });
  const destination = { cities: ["Rome", "Florence"], displayName: "Italy" };

  it("is the itinerary's cities in visiting order", () => {
    expect(itineraryCities(days("Rome", "Rome", "Florence"), destination)).toEqual(["Rome", "Florence"]);
  });

  it("stays with what the itinerary was planned for after the traveller edits their destinations", () => {
    // The itinerary was generated for Rome + Florence; the traveller later typed Venice.
    expect(itineraryCities(days("Rome", "Florence"), { cities: ["Venice"] })).toEqual(["Rome", "Florence"]);
  });

  it("leaves out a city the itinerary gave no days", () => {
    // 3 days across 4 cities: Siena got none.
    expect(itineraryCities(days("Rome", "Florence", "Pisa"), { cities: ["Rome", "Florence", "Siena", "Pisa"] }))
      .toEqual(["Rome", "Florence", "Pisa"]);
  });

  it("falls back to the traveller's cities, then the destination name, before there's an itinerary", () => {
    expect(itineraryCities(null, destination)).toEqual(["Rome", "Florence"]);
    expect(itineraryCities(null, { cities: [], displayName: "Iceland" })).toEqual(["Iceland"]);
    expect(itineraryCities(undefined, undefined)).toEqual([]);
  });
});
