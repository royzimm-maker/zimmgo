import { describe, it, expect } from "vitest";
import { assembleItineraryDocxModel } from "@/lib/docx/assembleItineraryDocxModel";
import type {
  GeneratedItinerary, TripPreferences, ActivityOption, RestaurantOption, HotelOption, FlightOption, TransportOption,
} from "@/types/trip";

const act1: ActivityOption = {
  id: "a1", name: "Gaudi Tour", category: "guided_walking_tour", duration: "3h",
  price: 50, currency: "USD", rating: 9, reviewCount: 500, isLocalFavorite: true,
  description: "A deep dive into Gaudi's most iconic Barcelona buildings.", location: "Barcelona",
};
const act2: ActivityOption = {
  id: "a2", name: "Tapas Crawl", category: "food", duration: "2h",
  price: 40, currency: "USD", rating: 8.5, reviewCount: 300, isLocalFavorite: false,
  description: "A guided crawl through three neighborhood tapas bars.", location: "Barcelona",
};
const rest1: RestaurantOption = {
  id: "r1", name: "Tapas Bar", cuisine: "Spanish", tier: "casual", playfulCategory: "Casual",
  priceRange: "$$", rating: 9, reviewCount: 400, location: "Barcelona", description: "Tapas",
};
const rest2: RestaurantOption = {
  id: "r2", name: "Unpicked Place", cuisine: "Spanish", tier: "casual", playfulCategory: "Casual",
  priceRange: "$", rating: 8, reviewCount: 100, location: "Barcelona", description: "Also tapas",
};
const hotelBarcelona: HotelOption = {
  id: "h1", name: "Hotel Neri", stars: 4, location: "Gothic Quarter, Barcelona", city: "Barcelona",
  pricePerNight: 250, currency: "USD", rating: 9, reviewCount: 700, highlights: ["Historic building", "Central location"],
};
const hotelAndalusia: HotelOption = {
  id: "h2", name: "Four Seasons", stars: 5, location: "Andalusia", city: "Andalusia",
  pricePerNight: 400, currency: "USD", rating: 9.4, reviewCount: 900, highlights: [],
};
const flight1: FlightOption = {
  id: "f1", airline: "Delta", flightNumber: "DL1", origin: "JFK", destination: "BCN",
  departureTime: "2026-09-08T08:00:00", arrivalTime: "2026-09-08T20:00:00", duration: "8h",
  stops: 0, price: 800, currency: "USD", cabinClass: "economy",
};
const transportPick: TransportOption = {
  id: "gt-1", mode: "train", provider: "Renfe", fromCity: "Barcelona", toCity: "Andalusia",
  departureTime: "2026-09-10T08:00:00", arrivalTime: "2026-09-10T10:00:00", duration: "2h",
  price: 45, currency: "USD",
};

function makeItinerary(overrides: Partial<GeneratedItinerary> = {}): GeneratedItinerary {
  return {
    id: "itin-1", tripId: "trip-1", version: 1, createdAt: new Date().toISOString(),
    days: [
      { date: "2026-09-08", dayNumber: 1, theme: "Arrival", location: "Barcelona", morning: ["Check in"], afternoon: ["Walk the Gothic Quarter"], evening: ["Dinner near the hotel"], meals: [] },
      { date: "2026-09-09", dayNumber: 2, theme: "Explore", location: "Barcelona", morning: [], afternoon: [], evening: [], meals: [] },
      { date: "2026-09-10", dayNumber: 3, theme: "Andalusia arrival", location: "Andalusia", morning: [], afternoon: [], evening: [], meals: [], notes: "Take the AVE high-speed train to Andalusia." },
    ],
    flights: [flight1], hotels: [hotelBarcelona, hotelAndalusia], activities: [act1, act2], restaurants: [rest1, rest2],
    totalEstimatedCost: 1000, currency: "USD", aiSummary: "", whyThisWorks: "",
    ...overrides,
  };
}

function makePreferences(overrides: Partial<TripPreferences> = {}): TripPreferences {
  return {
    activities: [], activityRankings: {}, vibes: [], transportation: [],
    destination: { cities: ["Barcelona", "Andalusia"], displayName: "Spain — Barcelona & Andalusia" },
    ...overrides,
  };
}

describe("assembleItineraryDocxModel — sections", () => {
  it("groups days into one section per leg, with the right date range and night count", () => {
    const model = assembleItineraryDocxModel(makeItinerary(), makePreferences());
    expect(model.sections.map((s) => s.location)).toEqual(["Barcelona", "Andalusia"]);
    expect(model.sections[0].nightCount).toBe(1); // 2-day Barcelona leg = 1 night
    expect(model.sections[1].nightCount).toBe(1); // single-day leg treated as 1 night, not 0
  });

  it("includes travel dates and the region line derived from the legs", () => {
    const model = assembleItineraryDocxModel(makeItinerary(), makePreferences());
    expect(model.regionsLine).toBe("Barcelona  ·  Andalusia");
    expect(model.dateRangeLabel).toContain("Sep 8");
    expect(model.dateRangeLabel).toContain("Sep 10");
  });
});

describe("assembleItineraryDocxModel — day resolution", () => {
  it("resolves day bullets from finalizedPlan when the traveller scheduled it", () => {
    const itinerary = makeItinerary({
      finalizedPlan: { dayCards: { 1: ["act-a1", "rest-r1"], 2: ["act-a2"], 3: [] }, bankCards: [] },
    });
    const model = assembleItineraryDocxModel(itinerary, makePreferences());
    const day1 = model.sections[0].days[0];
    expect(day1.bullets).toEqual(["Gaudi Tour", "Dinner: Tapas Bar"]);
  });

  it("falls back to the AI's morning/afternoon/evening blurbs when nothing was scheduled day-by-day", () => {
    const model = assembleItineraryDocxModel(makeItinerary(), makePreferences());
    const day1 = model.sections[0].days[0];
    expect(day1.bullets).toEqual(["Check in", "Walk the Gothic Quarter", "Dinner near the hotel"]);
  });

  it("treats an isLocalFavorite activity as a plain bullet — no per-item box or callout", () => {
    // v2 of the skill dropped OPTIONAL/TIP boxes entirely in favor of
    // restraint; isLocalFavorite still produces an ordinary bullet like any
    // other item, it just also feeds the day-level highlight (below).
    const itinerary = makeItinerary({
      finalizedPlan: { dayCards: { 1: ["act-a1", "act-a2"], 2: [], 3: [] }, bankCards: [] },
    });
    const model = assembleItineraryDocxModel(itinerary, makePreferences());
    const day1 = model.sections[0].days[0];
    expect(day1.bullets).toEqual(["Gaudi Tour", "Tapas Crawl"]);
  });
});

describe("assembleItineraryDocxModel — day highlight", () => {
  it("surfaces a real isLocalFavorite pick scheduled that day as the highlight", () => {
    const itinerary = makeItinerary({
      finalizedPlan: { dayCards: { 1: ["act-a2", "act-a1"], 2: [], 3: [] }, bankCards: [] },
    });
    const model = assembleItineraryDocxModel(itinerary, makePreferences());
    expect(model.sections[0].days[0].highlight).toEqual({
      name: "Gaudi Tour",
      reason: "A deep dive into Gaudi's most iconic Barcelona buildings.",
    });
  });

  it("has no highlight when nothing scheduled that day is a local favorite", () => {
    const itinerary = makeItinerary({
      finalizedPlan: { dayCards: { 1: ["act-a2"], 2: [], 3: [] }, bankCards: [] },
    });
    const model = assembleItineraryDocxModel(itinerary, makePreferences());
    expect(model.sections[0].days[0].highlight).toBeNull();
  });

  it("never fabricates a highlight when nothing was scheduled day-by-day yet", () => {
    // No finalizedPlan — the day's bullets come from the AI's own free-text
    // blurbs with no structured link back to a specific ActivityOption, so
    // there's no real pick to point to.
    const model = assembleItineraryDocxModel(makeItinerary(), makePreferences());
    expect(model.sections[0].days[0].highlight).toBeNull();
  });
});

describe("assembleItineraryDocxModel — hotel writeup", () => {
  it("builds a prose writeup from the hotel's own location and highlights, not invented text", () => {
    const model = assembleItineraryDocxModel(
      makeItinerary(),
      makePreferences({ selectedHotelsByCity: { Barcelona: hotelBarcelona } })
    );
    expect(model.sections[0].hotel).toEqual({
      name: "Hotel Neri",
      writeup: "Gothic Quarter, Barcelona. Historic building · Central location.",
      isTravellerPick: true,
    });
  });

  it("still writes up a hotel with no highlights, just from its location", () => {
    const itinerary = makeItinerary({ days: [{ date: "2026-09-08", dayNumber: 1, theme: "Arrival", location: "Andalusia", morning: [], afternoon: [], evening: [], meals: [] }] });
    const model = assembleItineraryDocxModel(itinerary, makePreferences());
    expect(model.sections[0].hotel?.writeup).toBe("Andalusia.");
  });

  it("is null when no hotel exists at all for that leg", () => {
    const itinerary = makeItinerary({ hotels: [hotelAndalusia] });
    const model = assembleItineraryDocxModel(itinerary, makePreferences());
    expect(model.sections[0].hotel).toBeNull();
  });

  it("falls back to the raw pool and marks it not a traveller pick when nothing is selected", () => {
    const model = assembleItineraryDocxModel(makeItinerary(), makePreferences());
    expect(model.sections[0].hotel?.name).toBe("Hotel Neri");
    expect(model.sections[0].hotel?.isTravellerPick).toBe(false);
  });
});

describe("assembleItineraryDocxModel — restaurants split into booked vs. options", () => {
  it("puts a traveller-picked restaurant in restaurantsBooked and everything else in restaurantsOptions", () => {
    const model = assembleItineraryDocxModel(
      makeItinerary(),
      makePreferences({ selectedRestaurantIds: ["r1"] })
    );
    expect(model.sections[0].restaurantsBooked.map((r) => r.name)).toEqual(["Tapas Bar"]);
    expect(model.sections[0].restaurantsOptions.map((r) => r.name)).toEqual(["Unpicked Place"]);
  });

  it("puts everything in restaurantsOptions when nothing is confirmed", () => {
    const model = assembleItineraryDocxModel(makeItinerary(), makePreferences());
    expect(model.sections[0].restaurantsBooked).toEqual([]);
    expect(model.sections[0].restaurantsOptions.map((r) => r.name)).toEqual(["Tapas Bar", "Unpicked Place"]);
  });

  it("caps restaurantsOptions at 5", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ ...rest2, id: `r${i + 10}`, name: `Place ${i}` }));
    const itinerary = makeItinerary({ restaurants: many });
    const model = assembleItineraryDocxModel(itinerary, makePreferences());
    expect(model.sections[0].restaurantsOptions).toHaveLength(5);
  });
});

describe("assembleItineraryDocxModel — getting there", () => {
  it("describes the flight for the first section", () => {
    const model = assembleItineraryDocxModel(makeItinerary(), makePreferences());
    expect(model.sections[0].gettingThere).toEqual(["✈ Delta — JFK → BCN"]);
  });

  it("describes the ground-transport pick for a later section when one exists", () => {
    const model = assembleItineraryDocxModel(
      makeItinerary(),
      makePreferences({ selectedTransportByLeg: { Andalusia: transportPick } })
    );
    expect(model.sections[1].gettingThere).toEqual(["🚆 Renfe to Andalusia, 2h"]);
  });

  it("falls back to the AI's own inter-city travel note when there's no transport pick", () => {
    const model = assembleItineraryDocxModel(makeItinerary(), makePreferences());
    expect(model.sections[1].gettingThere).toEqual(["Take the AVE high-speed train to Andalusia."]);
  });

  it("is empty (not fabricated) when there's no flight for the first section", () => {
    const itinerary = makeItinerary({ flights: [] });
    const model = assembleItineraryDocxModel(itinerary, makePreferences());
    expect(model.sections[0].gettingThere).toEqual([]);
  });

  it("is empty for a later section with no transport pick and no travel note", () => {
    const itinerary = makeItinerary();
    itinerary.days[2].notes = undefined;
    const model = assembleItineraryDocxModel(itinerary, makePreferences());
    expect(model.sections[1].gettingThere).toEqual([]);
  });
});

describe("assembleItineraryDocxModel — glance table transition days", () => {
  it("flags the first day of every leg after the first as a transition day", () => {
    const model = assembleItineraryDocxModel(makeItinerary(), makePreferences());
    expect(model.glanceRows.map((r) => r.isTransitionDay)).toEqual([false, false, true]);
  });
});

describe("assembleItineraryDocxModel — no fabricated content", () => {
  it("only lists BOOK IN ADVANCE items the traveller actually picked, not the whole pool", () => {
    const model = assembleItineraryDocxModel(
      makeItinerary(),
      makePreferences({ selectedHotelsByCity: { Barcelona: hotelBarcelona }, selectedRestaurantIds: ["r1"] })
    );
    expect(model.bookInAdvance).toContain("Hotel Neri — Barcelona");
    expect(model.bookInAdvance).toContain("Tapas Bar — Barcelona");
    expect(model.bookInAdvance).not.toContain("Unpicked Place — Barcelona");
  });

  it("only surfaces visa entries where a visa is actually required", () => {
    const model = assembleItineraryDocxModel(
      makeItinerary(),
      makePreferences({ destination: { cities: ["Barcelona"], displayName: "Spain" } })
    );
    expect(model.visaEntries).toEqual([]); // Schengen — no visa required for US passport holders
  });

  it("omits the seasonal note entirely when none exists, rather than inventing one", () => {
    const model = assembleItineraryDocxModel(makeItinerary(), makePreferences());
    expect(model.seasonalNote).toBeNull();
  });
});
