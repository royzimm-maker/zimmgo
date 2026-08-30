import { describe, it, expect } from "vitest";
import { assembleItineraryDocxModel } from "@/lib/docx/assembleItineraryDocxModel";
import type {
  GeneratedItinerary, TripPreferences, ActivityOption, RestaurantOption, HotelOption,
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
const hotelBarcelona: HotelOption = {
  id: "h1", name: "Hotel Neri", stars: 4, location: "Barcelona", city: "Barcelona",
  pricePerNight: 250, currency: "USD", rating: 9, reviewCount: 700, highlights: [],
};
const hotelAndalusia: HotelOption = {
  id: "h2", name: "Four Seasons", stars: 5, location: "Andalusia", city: "Andalusia",
  pricePerNight: 400, currency: "USD", rating: 9.4, reviewCount: 900, highlights: [],
};

function makeItinerary(overrides: Partial<GeneratedItinerary> = {}): GeneratedItinerary {
  return {
    id: "itin-1", tripId: "trip-1", version: 1, createdAt: new Date().toISOString(),
    days: [
      { date: "2026-09-08", dayNumber: 1, theme: "Arrival", location: "Barcelona", morning: ["Check in"], afternoon: ["Walk the Gothic Quarter"], evening: ["Dinner near the hotel"], meals: [] },
      { date: "2026-09-09", dayNumber: 2, theme: "Explore", location: "Barcelona", morning: [], afternoon: [], evening: [], meals: [] },
      { date: "2026-09-10", dayNumber: 3, theme: "Andalusia arrival", location: "Andalusia", morning: [], afternoon: [], evening: [], meals: [] },
    ],
    flights: [], hotels: [hotelBarcelona, hotelAndalusia], activities: [act1, act2], restaurants: [rest1],
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

  it("only turns an isLocalFavorite activity into a HIGHLIGHT, using its own real description", () => {
    const itinerary = makeItinerary({
      finalizedPlan: { dayCards: { 1: ["act-a1", "act-a2"], 2: [], 3: [] }, bankCards: [] },
    });
    const model = assembleItineraryDocxModel(itinerary, makePreferences());
    const day1 = model.sections[0].days[0];
    expect(day1.highlights).toEqual([
      { title: "Gaudi Tour", text: "A deep dive into Gaudi's most iconic Barcelona buildings." },
    ]);
  });
});

describe("assembleItineraryDocxModel — hotel resolution", () => {
  it("prefers the per-city selected hotel over the raw search pool", () => {
    const model = assembleItineraryDocxModel(
      makeItinerary(),
      makePreferences({ selectedHotelsByCity: { Barcelona: hotelBarcelona } })
    );
    expect(model.sections[0].hotel?.name).toBe("Hotel Neri");
    expect(model.sections[0].hotel?.isTravellerPick).toBe(true);
  });

  it("falls back to the first matching hotel in the pool when nothing is selected, and marks it not a traveller pick", () => {
    const model = assembleItineraryDocxModel(makeItinerary(), makePreferences());
    expect(model.sections[0].hotel?.name).toBe("Hotel Neri");
    expect(model.sections[0].hotel?.isTravellerPick).toBe(false);
  });

  it("is null when no hotel exists at all for that leg", () => {
    const itinerary = makeItinerary({ hotels: [hotelAndalusia] });
    const model = assembleItineraryDocxModel(itinerary, makePreferences());
    expect(model.sections[0].hotel).toBeNull();
  });
});

describe("assembleItineraryDocxModel — ground transport", () => {
  it("adds a transport bullet only to the day a leg opens, only when a pick exists", () => {
    const model = assembleItineraryDocxModel(
      makeItinerary(),
      makePreferences({
        selectedTransportByLeg: {
          Andalusia: {
            id: "gt-1", mode: "train", provider: "Renfe", fromCity: "Barcelona", toCity: "Andalusia",
            departureTime: "2026-09-10T08:00:00", arrivalTime: "2026-09-10T10:00:00", duration: "2h",
            price: 45, currency: "USD",
          },
        },
      })
    );
    const andalusiaDay = model.sections[1].days[0];
    expect(andalusiaDay.bullets[0]).toBe("🚆 Renfe to Andalusia, 2h");
    // Barcelona never had a transport pick — no bullet fabricated for it.
    expect(model.sections[0].days[0].bullets.some((b) => b.includes("Renfe"))).toBe(false);
  });
});

describe("assembleItineraryDocxModel — no fabricated content", () => {
  it("only lists BOOK IN ADVANCE items the traveller actually picked, not the whole pool", () => {
    const itinerary = makeItinerary({ restaurants: [rest1, { ...rest1, id: "r2", name: "Unpicked Place" }] });
    const model = assembleItineraryDocxModel(
      itinerary,
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
