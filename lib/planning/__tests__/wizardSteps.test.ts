import { describe, it, expect } from "vitest";
import { buildWizardSteps, cityOptions, cityRecap, groupStepsByCity, nextStepLabel } from "@/lib/planning/wizardSteps";
import type { GeneratedItinerary } from "@/types/trip";

const stages = (steps: ReturnType<typeof buildWizardSteps>) => steps.map((s) => `${s.stage}:${s.city ?? "-"}`);

describe("buildWizardSteps", () => {
  it("reviews flights, then each city's hotel, restaurants and activities in turn", () => {
    expect(stages(buildWizardSteps(["Rome", "Florence"], { airbnbOnly: false, noFlights: false }))).toEqual([
      "flights:-", "hotels:Rome", "restaurants:Rome", "activities:Rome", "hotels:Florence", "restaurants:Florence", "activities:Florence",
    ]);
  });

  it("skips hotels for Airbnb-only trips and flights when none are needed", () => {
    expect(stages(buildWizardSteps(["Rome"], { airbnbOnly: true, noFlights: true }))).toEqual(["restaurants:Rome", "activities:Rome"]);
  });

  it("adds a getting-there stage for a leg a regional operator covers", () => {
    const steps = stages(buildWizardSteps(["Athens", "Santorini"], { airbnbOnly: true, noFlights: true }));
    expect(steps).toContain("transport:Santorini");
    expect(steps.indexOf("transport:Santorini")).toBe(steps.indexOf("restaurants:Santorini") - 1);
  });
});

describe("wizard helpers", () => {
  const steps = buildWizardSteps(["Rome", "Florence"], { airbnbOnly: true, noFlights: false });

  it("groups steps by city for the progress bar", () => {
    expect(groupStepsByCity(steps)).toEqual([
      { key: "__flights__", idxs: [0] }, { key: "Rome", idxs: [1, 2] }, { key: "Florence", idxs: [3, 4] },
    ]);
  });

  it("names where Continue goes", () => {
    expect(nextStepLabel(steps[0], steps[1])).toBe("Plan the Rome leg");
    expect(nextStepLabel(steps[1], steps[2])).toBe("Continue to Activities in Rome");
    expect(nextStepLabel(steps[2], steps[3])).toBe("Continue to Florence");
    expect(nextStepLabel(steps[4], undefined)).toBe("Finish review");
  });

  it("gives a city its own options, best-rated first, and recaps what's chosen", () => {
    const itinerary = {
      days: [{ dayNumber: 1, location: "Rome" }, { dayNumber: 2, location: "Florence" }],
      hotels: [{ id: "h1", city: "Rome", location: "Rome", name: "Hotel Roma" }, { id: "h2", city: "Florence", location: "Florence" }],
      restaurants: [{ id: "r1", location: "Rome", rating: 4 }, { id: "r2", location: "Rome", rating: 9 }, { id: "r3", location: "Florence", rating: 5 }],
      activities: [{ id: "a1", location: "Florence", rating: 8 }],
    } as unknown as GeneratedItinerary;
    const rome = cityOptions(itinerary, ["Rome", "Florence"], "Rome");
    expect(rome.hotels.map((h) => h.id)).toEqual(["h1"]);
    expect(rome.restaurants.map((r) => r.id)).toEqual(["r2", "r1"]);
    expect(rome.activities).toEqual([]);
    expect(cityRecap(itinerary, ["Rome", "Florence"], "Rome", { hotelsByCity: { Rome: itinerary.hotels[0] }, restaurantIds: ["r1", "r3"] }))
      .toEqual({ hotel: "Hotel Roma", restaurantCount: 1, activityCount: 0 });
  });
});
