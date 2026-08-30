import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LodgingStep } from "@/components/planning/steps/LodgingStep";
import { useTripStore } from "@/lib/store/tripStore";
import type { HotelOption, Trip } from "@/types/trip";

function makeHotel(overrides: Partial<HotelOption> & { id: string; name: string }): HotelOption {
  return {
    stars: 4,
    location: "City Centre",
    pricePerNight: 200,
    currency: "USD",
    rating: 9,
    reviewCount: 500,
    highlights: [],
    ...overrides,
  };
}

function freshTrip(): Trip {
  const now = new Date().toISOString();
  return {
    id: "trip-1",
    name: "Test Trip",
    preferences: {
      destination: { cities: ["Barcelona"], displayName: "Barcelona" },
      activities: [],
      activityRankings: {},
      vibes: [],
      transportation: [],
    },
    currentStep: "lodging",
    completedSteps: [],
    itineraries: [],
    createdAt: now,
    updatedAt: now,
  };
}

// The mock hotel search hands out a fresh id to every hotel on every call in
// the real API — mirror that here so a test can tell "the same fetch's
// result" apart from "a second, redundant fetch's result".
let hotelSearchCallCount = 0;

function mockFetchImplementation(hotelsByCall: () => HotelOption[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/hotels/search") {
      hotelSearchCallCount++;
      const list = hotelsByCall();
      return new Response(JSON.stringify(list), { status: 200 });
    }
    if (url === "/api/itinerary/smart-pick") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.kind === "lodging") {
        return new Response(
          JSON.stringify({
            summary: "ZiGy picked boutique 4-star stays for your trip.",
            picks: [
              { id: "type:boutique", reason: "Fits the romantic vibe." },
              { id: "stars:4", reason: "Great value at this tier." },
            ],
          }),
          { status: 200 }
        );
      }
      if (body.kind === "hotel") {
        const hotels: HotelOption[] = body.hotels ?? [];
        const pick = hotels[0];
        return new Response(
          JSON.stringify({
            summary: null,
            picks: pick ? [{ id: pick.id, reason: `${pick.name} is the best fit.` }] : [],
          }),
          { status: 200 }
        );
      }
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });
}

beforeEach(() => {
  hotelSearchCallCount = 0;
  useTripStore.setState({ trip: freshTrip() });
});

describe("LodgingStep — ZiGy hotel pick", () => {
  it("does not let the auto-fetch effect clobber ZiGy's pick with a duplicate hotel search", async () => {
    // Regression test for the race condition fixed this session: ZiGy's own
    // fetchHotels() call inside handleZigyPick used to race against a
    // separate useEffect that also called fetchHotels() whenever
    // effectiveTypes changed — which handleZigyPick's own setTypes() call
    // triggers in the same render. Since the mock search generates a fresh
    // random id per hotel per call, whichever fetch resolved last silently
    // orphaned ZiGy's selection. The `pickingHotel` guard should mean there
    // is exactly one hotel search in flight for a ZiGy-driven pick.
    let callN = 0;
    const fetchMock = mockFetchImplementation(() => {
      callN++;
      // A different id set each call, like the real mock API's uuid()s.
      return [
        makeHotel({ id: `hotel-a-${callN}`, name: "Hotel Neri" }),
        makeHotel({ id: `hotel-b-${callN}`, name: "Casa Bonay" }),
      ];
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<LodgingStep />);

    await user.click(screen.getByText("Let ZiGy choose for me"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText("Hotel Neri")).toBeInTheDocument();
    });

    // Only one /api/hotels/search call should have happened for this pick —
    // a second, redundant one is exactly the bug that orphaned the selection.
    expect(hotelSearchCallCount).toBe(1);

    // And the hotel actually shown as "Your pick" must be the one that came
    // back from that same single fetch (hotel-a-1), not a leftover id from
    // some other call.
    const pickedCard = screen.getByText("Hotel Neri").closest("div[role='button']");
    expect(pickedCard).not.toBeNull();
    expect(within(pickedCard as HTMLElement).getByText("Your pick")).toBeInTheDocument();
  });

  it("marks autoPickHotels on the trip so other cities can auto-pick too", async () => {
    const fetchMock = mockFetchImplementation(() => [
      makeHotel({ id: "hotel-1", name: "Hotel Neri" }),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<LodgingStep />);

    expect(useTripStore.getState().trip.preferences.autoPickHotels).toBeUndefined();

    await user.click(screen.getByText("Let ZiGy choose for me"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(useTripStore.getState().trip.preferences.autoPickHotels).toBe(true);
    });
  });

  it("shows the picked hotel on the zigy_review screen with reasoning", async () => {
    const fetchMock = mockFetchImplementation(() => [
      makeHotel({ id: "hotel-1", name: "Hotel Neri" }),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<LodgingStep />);

    await user.click(screen.getByText("Let ZiGy choose for me"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText("Here's what ZiGy picked for your stay.")).toBeInTheDocument();
    });
    expect(screen.getByText("Hotel Neri is the best fit.", { exact: false })).toBeInTheDocument();
  });
});

describe("LodgingStep — manual picking", () => {
  it("saves the manually selected hotel to the store on Continue", async () => {
    const fetchMock = mockFetchImplementation(() => [
      makeHotel({ id: "hotel-1", name: "Casa Bonay" }),
      makeHotel({ id: "hotel-2", name: "Hotel Neri" }),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<LodgingStep />);

    await user.click(screen.getByText("I'll pick myself"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    // Picking an accommodation type triggers the hotel search.
    await user.click(screen.getByText("Boutique"));

    await waitFor(() => {
      expect(screen.getByText("Hotel Neri")).toBeInTheDocument();
    });

    const card = screen.getByText("Hotel Neri").closest("div[role='button']") as HTMLElement;
    await user.click(card);

    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(useTripStore.getState().trip.preferences.selectedHotel?.name).toBe("Hotel Neri");
    });
  });
});
