import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItinerarySelectionWizard } from "@/components/planning/ItinerarySelectionWizard";
import { useTripStore } from "@/lib/store/tripStore";
import type { GeneratedItinerary, HotelOption, Trip } from "@/types/trip";

function makeHotel(overrides: Partial<HotelOption> & { id: string; name: string; city: string }): HotelOption {
  return {
    stars: 4,
    location: overrides.city,
    pricePerNight: 250,
    currency: "USD",
    rating: 9,
    reviewCount: 800,
    highlights: [],
    ...overrides,
  };
}

const barcelonaHotel = makeHotel({ id: "hotel-bcn", name: "Hotel Neri", city: "Barcelona" });
const andalusiaHotel = makeHotel({ id: "hotel-and", name: "Four Seasons", city: "Andalusia" });

function makeItinerary(): GeneratedItinerary {
  return {
    id: "itin-1",
    tripId: "trip-1",
    version: 1,
    createdAt: new Date().toISOString(),
    days: [{ date: "2026-09-08", city: "Barcelona", activities: [] } as unknown as GeneratedItinerary["days"][number]],
    flights: [],
    hotels: [barcelonaHotel, andalusiaHotel],
    activities: [],
    restaurants: [],
    totalEstimatedCost: 3000,
    currency: "USD",
    aiSummary: "",
    whyThisWorks: "",
  };
}

function freshTrip(): Trip {
  const now = new Date().toISOString();
  return {
    id: "trip-1",
    name: "Test Trip",
    preferences: {
      destination: { cities: ["Barcelona", "Andalusia"], displayName: "Barcelona & Andalusia" },
      activities: [],
      activityRankings: {},
      vibes: [],
      transportation: [],
      // Skip the flights stage entirely — this test is only about the
      // per-city hotel auto-pick, not flight search.
      noFlightsNeeded: true,
      // This is the signal set by LodgingStep's "Let ZiGy choose for me" —
      // the wizard should honor it for every city, not just the one
      // LodgingStep itself searched.
      autoPickHotels: true,
    },
    currentStep: "itinerary",
    completedSteps: [],
    itineraries: [],
    createdAt: now,
    updatedAt: now,
  };
}

function mockSmartPickFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/itinerary/smart-pick") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.kind === "hotel") {
        const hotels: HotelOption[] = body.hotels ?? [];
        const pick = hotels[0];
        return new Response(
          JSON.stringify({
            summary: null,
            picks: pick ? [{ id: pick.id, reason: `${pick.name} is the best fit for ${body.city}.` }] : [],
          }),
          { status: 200 }
        );
      }
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });
}

beforeEach(() => {
  useTripStore.setState({ trip: freshTrip() });
});

describe("ItinerarySelectionWizard — cross-city hotel auto-pick", () => {
  it("auto-picks a hotel for the first city with no user interaction", async () => {
    vi.stubGlobal("fetch", mockSmartPickFetch());

    render(
      <ItinerarySelectionWizard
        itinerary={makeItinerary()}
        onComplete={() => {}}
        onRegenerate={() => {}}
      />
    );

    await waitFor(() => {
      expect(useTripStore.getState().trip.preferences.selectedHotelsByCity?.["Barcelona"]?.name).toBe(
        "Hotel Neri"
      );
    });
  });

  it("also auto-picks for a second city the traveller never manually touched", async () => {
    // This is the actual bug reported this session: LodgingStep only ever
    // searches/picks for the trip's primary city, so a secondary city
    // landed on a blank hotel picker even when the traveller had asked
    // ZiGy to choose lodging. The fix makes this wizard re-run the same
    // auto-pick per city as the traveller reaches it.
    vi.stubGlobal("fetch", mockSmartPickFetch());

    const user = userEvent.setup();
    render(
      <ItinerarySelectionWizard
        itinerary={makeItinerary()}
        onComplete={() => {}}
        onRegenerate={() => {}}
      />
    );

    // Wait for Barcelona's auto-pick to land, then advance through
    // Barcelona's restaurants/activities stages into Andalusia's hotels.
    await waitFor(() => {
      expect(useTripStore.getState().trip.preferences.selectedHotelsByCity?.["Barcelona"]).toBeDefined();
    });

    await user.click(screen.getByRole("button", { name: /Continue to Restaurants in Barcelona/i }));
    await user.click(screen.getByRole("button", { name: /Continue to Activities in Barcelona/i }));
    await user.click(screen.getByRole("button", { name: /Continue to Andalusia/i }));

    await waitFor(() => {
      expect(useTripStore.getState().trip.preferences.selectedHotelsByCity?.["Andalusia"]?.name).toBe(
        "Four Seasons"
      );
    });
  });

  it("does not re-run the auto-pick for a city that already has a manual selection", async () => {
    const fetchMock = mockSmartPickFetch();
    vi.stubGlobal("fetch", fetchMock);

    useTripStore.setState((s) => ({
      trip: {
        ...s.trip,
        preferences: {
          ...s.trip.preferences,
          selectedHotelsByCity: { Barcelona: barcelonaHotel },
        },
      },
    }));

    render(
      <ItinerarySelectionWizard
        itinerary={makeItinerary()}
        onComplete={() => {}}
        onRegenerate={() => {}}
      />
    );

    // Give the effect a tick to (not) fire, then confirm no smart-pick
    // request went out for a city that was already decided.
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
