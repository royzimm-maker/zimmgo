import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RefineStep } from "@/components/planning/steps/RefineStep";
import { useTripStore } from "@/lib/store/tripStore";
import type { GeneratedItinerary, Trip, ActivityOption, RestaurantOption, HotelOption } from "@/types/trip";

const act1: ActivityOption = {
  id: "a1", name: "Gaudi Tour", category: "guided_walking_tour", duration: "3h",
  price: 50, currency: "USD", rating: 9, reviewCount: 500, isLocalFavorite: true,
  description: "Guided tour", location: "Barcelona",
};
const act2: ActivityOption = {
  id: "a2", name: "Flamenco Show", category: "cultural", duration: "2h",
  price: 40, currency: "USD", rating: 8.5, reviewCount: 300, isLocalFavorite: false,
  description: "Live show", location: "Andalusia",
};
const rest1: RestaurantOption = {
  id: "r1", name: "Tapas Bar", cuisine: "Spanish", tier: "casual", playfulCategory: "Casual",
  priceRange: "$$", rating: 9, reviewCount: 400, location: "Barcelona", description: "Tapas",
};
const rest2: RestaurantOption = {
  id: "r2", name: "Andalusian Feast", cuisine: "Spanish", tier: "midrange", playfulCategory: "Midrange",
  priceRange: "$$$", rating: 8.8, reviewCount: 200, location: "Andalusia", description: "Feast",
};
const hotelBarcelona: HotelOption = {
  id: "h1", name: "Hotel Neri", stars: 4, location: "Barcelona", city: "Barcelona",
  pricePerNight: 250, currency: "USD", rating: 9, reviewCount: 700, highlights: [],
};
const hotelAndalusia: HotelOption = {
  id: "h2", name: "Four Seasons", stars: 5, location: "Andalusia", city: "Andalusia",
  pricePerNight: 400, currency: "USD", rating: 9.4, reviewCount: 900, highlights: [],
};

function freshTrip(overrides: Partial<Trip> = {}): Trip {
  const now = new Date().toISOString();
  return {
    id: "trip-1",
    name: "Test Trip",
    preferences: {
      activities: [], activityRankings: {}, vibes: [], transportation: [],
      destination: { cities: ["Barcelona", "Andalusia"], displayName: "Spain" },
      // RefineStep's board only shows activities/restaurants the traveller
      // actually picked in the review wizard — both fixtures are "picked"
      // by default so these tests exercise scheduling, not selection.
      selectedActivityIds: ["a1", "a2"],
      selectedRestaurantIds: ["r1", "r2"],
    },
    currentStep: "refine",
    completedSteps: [],
    itineraries: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeItinerary(overrides: Partial<GeneratedItinerary> = {}): GeneratedItinerary {
  return {
    id: "itin-1",
    tripId: "trip-1",
    version: 1,
    createdAt: new Date().toISOString(),
    days: [
      { date: "2026-09-08", dayNumber: 1, theme: "Arrival", location: "Barcelona", morning: [], afternoon: [], evening: [], meals: [] },
      { date: "2026-09-09", dayNumber: 2, theme: "Explore", location: "Barcelona", morning: [], afternoon: [], evening: [], meals: [] },
      { date: "2026-09-10", dayNumber: 3, theme: "Andalusia arrival", location: "Andalusia", morning: [], afternoon: [], evening: [], meals: [] },
      { date: "2026-09-11", dayNumber: 4, theme: "Andalusia explore", location: "Andalusia", morning: [], afternoon: [], evening: [], meals: [] },
    ],
    flights: [],
    hotels: [hotelBarcelona, hotelAndalusia],
    activities: [act1, act2],
    restaurants: [rest1, rest2],
    totalEstimatedCost: 1000,
    currency: "USD",
    aiSummary: "",
    whyThisWorks: "",
    ...overrides,
  };
}

// Scopes to the "Where things stand" summary panel, where each city name
// appears exactly once — elsewhere on the page (tabs, bank groups, day
// subtitles) the same city name repeats many times.
function statusPanel(): HTMLElement {
  return screen.getByText("Where things stand").closest("div")!.parentElement as HTMLElement;
}

function cityTab(city: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${city}`) });
}

beforeEach(() => {
  useTripStore.setState({ trip: freshTrip() });
});

describe("RefineStep — empty state", () => {
  it("shows a fallback and returns to Itinerary when nothing's been generated yet", async () => {
    const user = userEvent.setup();
    render(<RefineStep />);

    expect(screen.getByText("No itinerary generated yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /done — view my plan/i }));
    expect(useTripStore.getState().trip.currentStep).toBe("itinerary");
  });
});

describe("RefineStep — initial board state", () => {
  it("starts with every activity/restaurant unplaced when there's no finalized plan yet", () => {
    useTripStore.setState({ trip: freshTrip({ itineraries: [makeItinerary()] }) });
    render(<RefineStep />);
    expect(screen.getByText("4 unplaced")).toBeInTheDocument();
    expect(screen.getByText("0 of 4 items placed")).toBeInTheDocument();
  });

  it("restores a previously finalized plan's placements", () => {
    const itinerary = makeItinerary({
      finalizedPlan: {
        dayCards: { 1: ["act-a1"], 2: [], 3: [], 4: [] },
        bankCards: ["act-a2", "rest-r1", "rest-r2"],
      },
    });
    useTripStore.setState({ trip: freshTrip({ itineraries: [itinerary] }) });
    render(<RefineStep />);
    expect(screen.getByText("1 of 4 items placed")).toBeInTheDocument();
    expect(screen.getByText("Gaudi Tour")).toBeInTheDocument();
  });
});

describe("RefineStep — status panel", () => {
  it("shows hotel/restaurant/activity/day-scheduling status per city", () => {
    const itinerary = makeItinerary({
      finalizedPlan: {
        dayCards: { 1: ["act-a1"], 2: [], 3: [], 4: [] },
        bankCards: ["act-a2", "rest-r1", "rest-r2"],
      },
    });
    useTripStore.setState({
      trip: freshTrip({
        itineraries: [itinerary],
        preferences: {
          ...freshTrip().preferences,
          selectedHotelsByCity: { Barcelona: hotelBarcelona },
          selectedRestaurantIds: ["r1"],
          selectedActivityIds: ["a1", "a2"],
        },
      }),
    });
    render(<RefineStep />);

    const panel = statusPanel();
    const barcelonaRow = within(panel).getByText("Barcelona").closest("div")!;
    expect(within(barcelonaRow).getByText("Hotel Neri")).toBeInTheDocument();
    expect(within(barcelonaRow).getByText("1 of 2 days scheduled", { exact: false })).toBeInTheDocument();

    const andalusiaRow = within(panel).getByText("Andalusia").closest("div")!;
    expect(within(andalusiaRow).getByText("No hotel picked yet")).toBeInTheDocument();
    expect(within(andalusiaRow).getByText("0 of 2 days scheduled", { exact: false })).toBeInTheDocument();
  });
});

describe("RefineStep — city tabs", () => {
  it("switches the visible bank/days when a different city tab is selected", async () => {
    useTripStore.setState({ trip: freshTrip({ itineraries: [makeItinerary()] }) });
    const user = userEvent.setup();
    render(<RefineStep />);

    expect(screen.getByText("Gaudi Tour")).toBeInTheDocument();
    expect(screen.queryByText("Flamenco Show")).not.toBeInTheDocument();

    await user.click(cityTab("Andalusia"));

    expect(screen.queryByText("Gaudi Tour")).not.toBeInTheDocument();
    expect(screen.getByText("Flamenco Show")).toBeInTheDocument();
  });
});

describe("RefineStep — card actions", () => {
  it("returns a placed card to the bank via its remove button", async () => {
    const itinerary = makeItinerary({
      finalizedPlan: {
        dayCards: { 1: ["act-a1"], 2: [], 3: [], 4: [] },
        bankCards: ["act-a2", "rest-r1", "rest-r2"],
      },
    });
    useTripStore.setState({ trip: freshTrip({ itineraries: [itinerary] }) });
    const user = userEvent.setup();
    render(<RefineStep />);

    expect(screen.getByText("1 of 4 items placed")).toBeInTheDocument();

    const card = screen.getByText("Gaudi Tour").closest("div")!.parentElement!.parentElement!;
    await user.click(within(card).getByTitle("Return to bank"));

    expect(screen.getByText("0 of 4 items placed")).toBeInTheDocument();
  });

  it("saves a card to Wanderlog and removes it from the bank", async () => {
    const itinerary = makeItinerary();
    useTripStore.setState({ trip: freshTrip({ itineraries: [itinerary] }) });
    const user = userEvent.setup();
    render(<RefineStep />);

    const card = screen.getByText("Gaudi Tour").closest("div")!.parentElement!.parentElement!;
    await user.click(within(card).getByTitle("Save to Wanderlog instead"));

    expect(screen.queryByText("Gaudi Tour")).not.toBeInTheDocument();
    const state = useTripStore.getState().trip;
    expect(state.itineraries[0].wanderlog?.some((w) => w.label === "Gaudi Tour")).toBe(true);
  });
});

describe("RefineStep — ZiGy smart-arrange", () => {
  function mockScheduleAndHotelFetch() {
    return vi.fn(async (url: string, init?: RequestInit) => {
      if (url !== "/api/itinerary/smart-pick") throw new Error(`Unexpected fetch to ${url}`);
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.kind === "schedule") {
        return new Response(
          JSON.stringify({
            summary: `Arranged ${body.city}.`,
            picks: [{ id: "act-a1", dayNumber: 1, reason: "Great for day 1" }],
          }),
          { status: 200 }
        );
      }
      if (body.kind === "hotel") {
        const hotels: HotelOption[] = body.hotels ?? [];
        const pick = hotels[0];
        return new Response(
          JSON.stringify({ summary: null, picks: pick ? [{ id: pick.id, reason: "Best fit" }] : [] }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected kind ${body.kind}`);
    });
  }

  it("arranges the active city's cards into days and fills in a missing hotel", async () => {
    const itinerary = makeItinerary();
    useTripStore.setState({ trip: freshTrip({ itineraries: [itinerary] }) });
    vi.stubGlobal("fetch", mockScheduleAndHotelFetch());

    const user = userEvent.setup();
    render(<RefineStep />);

    await user.click(screen.getByText("Let ZiGy arrange Barcelona"));

    await waitFor(() => {
      expect(screen.getByText("1 of 4 items placed")).toBeInTheDocument();
    });
    expect(screen.getByText(/Arranged Barcelona\./)).toBeInTheDocument();
    expect(useTripStore.getState().trip.preferences.selectedHotelsByCity?.Barcelona?.name).toBe("Hotel Neri");
  });

  it("doesn't overwrite an already-selected hotel for that city", async () => {
    const itinerary = makeItinerary();
    useTripStore.setState({
      trip: freshTrip({
        itineraries: [itinerary],
        preferences: {
          ...freshTrip().preferences,
          selectedHotelsByCity: { Barcelona: hotelAndalusia }, // deliberately "wrong" pick, to prove it's untouched
        },
      }),
    });
    const fetchMock = mockScheduleAndHotelFetch();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<RefineStep />);
    await user.click(screen.getByText("Let ZiGy arrange Barcelona"));

    await waitFor(() => {
      expect(screen.getByText("1 of 4 items placed")).toBeInTheDocument();
    });
    expect(useTripStore.getState().trip.preferences.selectedHotelsByCity?.Barcelona?.name).toBe("Four Seasons");
  });

  it("schedules every city at once and shows a trip-wide message instead of the next-city nudge", async () => {
    const itinerary = makeItinerary();
    useTripStore.setState({ trip: freshTrip({ itineraries: [itinerary] }) });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}"));
        if (body.kind === "hotel") return new Response(JSON.stringify({ summary: null, picks: [] }), { status: 200 });
        return new Response(JSON.stringify({ summary: `Arranged ${body.city}.`, picks: [] }), { status: 200 });
      })
    );

    const user = userEvent.setup();
    render(<RefineStep />);

    await user.click(screen.getByText("Let ZiGy schedule every city"));

    expect(await screen.findByText(/ZiGy has arranged every city\./)).toBeInTheDocument();
    expect(screen.queryByText(/move on to Andalusia/)).not.toBeInTheDocument();
  });

  it("surfaces an error if smart-arrange fails, without crashing", async () => {
    const itinerary = makeItinerary();
    useTripStore.setState({ trip: freshTrip({ itineraries: [itinerary] }) });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "boom" }), { status: 500 })));

    const user = userEvent.setup();
    render(<RefineStep />);
    await user.click(screen.getByText("Let ZiGy arrange Barcelona"));

    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(screen.getByText("Gaudi Tour")).toBeInTheDocument(); // still sitting in the bank, untouched
  });
});

describe("RefineStep — finishing", () => {
  it("shows a nudge to move to the next city once something's been placed", async () => {
    const itinerary = makeItinerary({
      finalizedPlan: {
        dayCards: { 1: ["act-a1"], 2: [], 3: [], 4: [] },
        bankCards: ["act-a2", "rest-r1", "rest-r2"],
      },
    });
    useTripStore.setState({ trip: freshTrip({ itineraries: [itinerary] }) });
    const user = userEvent.setup();
    render(<RefineStep />);

    expect(screen.getByText(/move on to Andalusia/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Next: Andalusia/ }));
    expect(screen.getByText("Flamenco Show")).toBeInTheDocument();
  });

  it("saves the finalized plan and returns to the Itinerary step on Done", async () => {
    const itinerary = makeItinerary({
      finalizedPlan: {
        dayCards: { 1: ["act-a1"], 2: [], 3: [], 4: [] },
        bankCards: ["act-a2", "rest-r1", "rest-r2"],
      },
    });
    useTripStore.setState({ trip: freshTrip({ itineraries: [itinerary] }) });
    const user = userEvent.setup();
    render(<RefineStep />);

    await user.click(screen.getByRole("button", { name: /done — view my plan/i }));

    const state = useTripStore.getState().trip;
    expect(state.itineraries[0].finalizedPlan).toEqual({
      dayCards: { 1: ["act-a1"], 2: [], 3: [], 4: [] },
      bankCards: ["act-a2", "rest-r1", "rest-r2"],
    });
    expect(state.currentStep).toBe("itinerary");
  });
});
