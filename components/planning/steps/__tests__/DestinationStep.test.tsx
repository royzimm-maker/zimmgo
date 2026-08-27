import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DestinationStep } from "@/components/planning/steps/DestinationStep";
import { useTripStore } from "@/lib/store/tripStore";
import type { Trip } from "@/types/trip";

function freshTrip(overrides: Partial<Trip> = {}): Trip {
  const now = new Date().toISOString();
  return {
    id: "trip-1",
    name: "Test Trip",
    preferences: {
      activities: [],
      activityRankings: {},
      vibes: [],
      transportation: [],
    },
    currentStep: "destination",
    completedSteps: [],
    itineraries: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  useTripStore.setState({ trip: freshTrip() });
  localStorage.clear();
});

describe("DestinationStep — curated quick picks (fast path)", () => {
  it("skips the AI parse call entirely for a curated quick pick", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<DestinationStep />);

    await user.click(screen.getByText("Spain — Barcelona & Andalusia"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sets flightsObviouslyRequired for a curated quick pick without needing the AI", async () => {
    // Regression test: this used to default to false and only got set by
    // the AI response, but quick picks skip that AI call entirely — so it
    // silently stayed false, and the Flights step wrongly asked "are you
    // driving?" for an obviously-overseas curated destination.
    vi.stubGlobal("fetch", vi.fn());

    const user = userEvent.setup();
    render(<DestinationStep />);

    await user.click(screen.getByText("Spain — Barcelona & Andalusia"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(useTripStore.getState().trip.preferences.destination?.flightsObviouslyRequired).toBe(true);
    });
  });

  it("picks Barcelona over Madrid as the arrival airport when Madrid isn't in the text", async () => {
    // Regression test for the other fix this session: the routing DB's
    // static default gateway for any Spain trip is Madrid, but "Barcelona &
    // Andalusia" never mentions Madrid at all — the traveller-named city
    // should win over the DB's blanket default.
    vi.stubGlobal("fetch", vi.fn());

    const user = userEvent.setup();
    render(<DestinationStep />);

    await user.click(screen.getByText("Spain — Barcelona & Andalusia"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(useTripStore.getState().trip.preferences.destination?.arrivalAirport).toBe("BCN");
    });
  });

  it("parses the curated 'Country — City, City & City' shape into individual cities", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();
    render(<DestinationStep />);

    await user.click(screen.getByText("Japan — Tokyo, Kyoto & Osaka"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(useTripStore.getState().trip.preferences.destination?.cities).toEqual([
        "Tokyo",
        "Kyoto",
        "Osaka",
      ]);
    });
  });
});

describe("DestinationStep — free-typed text (AI path)", () => {
  it("sends free-typed text to the AI parser and uses its response", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("/api/destination/parse");
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body.text).toBe("somewhere warm with good diving, maybe Thailand");
      return new Response(
        JSON.stringify({
          cities: ["Phuket", "Koh Tao"],
          displayName: "Thailand — Phuket & Koh Tao",
          flightsObviouslyRequired: true,
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<DestinationStep />);

    const textarea = screen.getByPlaceholderText(/Italy, especially Tuscany/);
    fireEvent.change(textarea, { target: { value: "somewhere warm with good diving, maybe Thailand" } });
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      const dest = useTripStore.getState().trip.preferences.destination;
      expect(dest?.cities).toEqual(["Phuket", "Koh Tao"]);
      expect(dest?.displayName).toBe("Thailand — Phuket & Koh Tao");
      expect(dest?.flightsObviouslyRequired).toBe(true);
    });
  });

  it("falls back to the regex heuristic if the AI call fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("server error", { status: 500 })));

    const user = userEvent.setup();
    render(<DestinationStep />);

    const textarea = screen.getByPlaceholderText(/Italy, especially Tuscany/);
    fireEvent.change(textarea, { target: { value: "Norway — Oslo, Bergen & the Fjords" } });
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      const dest = useTripStore.getState().trip.preferences.destination;
      expect(dest?.cities).toEqual(["Oslo", "Bergen", "the Fjords"]);
    });
  });

  it("asks the road-trip question when the AI detects driving language, and doesn't ask again once answered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            cities: ["Big Sur", "San Francisco"],
            displayName: "California road trip",
            likelyRoadTrip: true,
          }),
          { status: 200 }
        )
      )
    );

    const user = userEvent.setup();
    render(<DestinationStep />);

    const textarea = screen.getByPlaceholderText(/Italy, especially Tuscany/);
    fireEvent.change(textarea, { target: { value: "a California road trip down Highway 1" } });
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText(/Sounds like a road trip/)).toBeInTheDocument();
    // Continue shouldn't have advanced the wizard yet — it's holding for an answer.
    expect(useTripStore.getState().trip.currentStep).toBe("destination");

    await user.click(screen.getByText("Yes, no flights"));

    const state = useTripStore.getState().trip;
    expect(state.preferences.noFlightsNeeded).toBe(true);
    expect(state.completedSteps).toContain("destination");
    expect(state.currentStep).toBe("dates");
  });
});

describe("DestinationStep — recent searches", () => {
  it("saves a submitted destination to recent-searches history for the next visit", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();
    const { unmount } = render(<DestinationStep />);

    await user.click(screen.getByText("Iceland — Reykjavik & the Ring Road"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(useTripStore.getState().trip.preferences.destination?.cities?.length).toBeGreaterThan(0);
    });
    unmount();

    // A fresh mount (e.g. navigating back to this step later) with no
    // in-progress free text should surface it under "Recent searches".
    useTripStore.setState({ trip: freshTrip() });
    render(<DestinationStep />);
    // With real history present, the inspiration section starts collapsed.
    await user.click(screen.getByText("Need inspiration?"));
    const recentSearches = await screen.findByText("Recent searches");
    const recentSection = recentSearches.closest("div") as HTMLElement;
    expect(within(recentSection).getByText("Iceland — Reykjavik & the Ring Road")).toBeInTheDocument();
  });
});

describe("DestinationStep — basic interactions", () => {
  it("persists the draft to the store as the user types, before Continue", () => {
    render(<DestinationStep />);
    const textarea = screen.getByPlaceholderText(/Italy, especially Tuscany/);
    fireEvent.change(textarea, { target: { value: "Vietnam" } });

    expect(useTripStore.getState().trip.preferences.destination?.freeText).toBe("Vietnam");
  });

  it("clears the free-text field via the clear button", () => {
    render(<DestinationStep />);
    const textarea = screen.getByPlaceholderText(/Italy, especially Tuscany/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Vietnam" } });
    expect(textarea.value).toBe("Vietnam");

    fireEvent.click(screen.getByLabelText("Clear destination"));
    expect(textarea.value).toBe("");
  });

  it("switches to the one-shot TripIntake flow for a fresh trip", async () => {
    const user = userEvent.setup();
    render(<DestinationStep />);

    await user.click(
      screen.getByText(/describe your whole trip in one go/)
    );
    expect(screen.getByText("Tell ZiGy everything at once")).toBeInTheDocument();
  });

  it("doesn't offer the one-shot intake once the trip already has progress", () => {
    useTripStore.setState({
      trip: freshTrip({ completedSteps: ["destination"] }),
    });
    render(<DestinationStep />);
    expect(screen.queryByText(/describe your whole trip in one go/)).not.toBeInTheDocument();
  });
});
