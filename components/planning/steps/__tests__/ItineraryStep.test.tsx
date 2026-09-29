import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItineraryStep } from "@/components/planning/steps/ItineraryStep";
import { useTripStore } from "@/lib/store/tripStore";
import type { GeneratedItinerary, Trip } from "@/types/trip";

vi.mock("@/components/planning/ItinerarySelectionWizard", () => ({
  ItinerarySelectionWizard: ({ itinerary, onComplete }: { itinerary: GeneratedItinerary; onComplete: () => void }) => (
    <div data-testid="wizard" data-itinerary-id={itinerary.id}>
      <button onClick={onComplete}>Complete wizard</button>
    </div>
  ),
}));
vi.mock("@/components/planning/ItineraryView", () => ({
  ItineraryView: ({ itinerary }: { itinerary: GeneratedItinerary }) => (
    <div data-testid="itinerary-view" data-itinerary-id={itinerary.id} />
  ),
}));

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
    currentStep: "itinerary",
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
      { date: "2026-09-10", dayNumber: 3, theme: "Andalusia", location: "Andalusia", morning: [], afternoon: [], evening: [], meals: [] },
      { date: "2026-09-11", dayNumber: 4, theme: "Andalusia", location: "Andalusia", morning: [], afternoon: [], evening: [], meals: [] },
    ],
    flights: [],
    hotels: [],
    activities: [],
    restaurants: [],
    totalEstimatedCost: 1000,
    currency: "USD",
    aiSummary: "",
    whyThisWorks: "",
    ...overrides,
  };
}

// Generation is a background job: POST starts it, GET polls it. This mock
// finishes the job on the first poll.
function jobFetchMock(itinerary: GeneratedItinerary) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    expect(url.startsWith("/api/itinerary/generate")).toBe(true);
    if (init?.method === "POST") return new Response(JSON.stringify({ jobId: "job-1", status: "running" }), { status: 202 });
    return new Response(JSON.stringify({ jobId: "job-1", status: "done", stage: null, result: itinerary, error: null }), { status: 200 });
  });
}
function posts(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST");
}

beforeEach(() => {
  useTripStore.setState({ trip: freshTrip(), isGenerating: false });
  localStorage.removeItem("zimmgo-pending-generation");
  localStorage.removeItem("zimmgo-pending-autoplan");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ItineraryStep — generation", () => {
  it("auto-generates on mount when there's no itinerary yet", async () => {
    const itinerary = makeItinerary();
    const fetchMock = jobFetchMock(itinerary);
    vi.stubGlobal("fetch", fetchMock);

    render(<ItineraryStep />);

    await waitFor(() => {
      expect(screen.getByTestId("wizard")).toHaveAttribute("data-itinerary-id", "itin-1");
    });
    expect(posts(fetchMock)).toHaveLength(1);
    expect(localStorage.getItem("zimmgo-pending-generation")).toBeNull();

    const state = useTripStore.getState().trip;
    expect(state.itineraries).toHaveLength(1);
    expect(state.completedSteps).toContain("itinerary");
  });

  it("resumes a job still pending from before a refresh instead of starting (and paying for) a new one", async () => {
    const itinerary = makeItinerary();
    localStorage.setItem(
      "zimmgo-pending-generation",
      JSON.stringify({ requestId: "req-abcdefgh", jobId: "job-1", tripId: "trip-1" })
    );
    const fetchMock = jobFetchMock(itinerary);
    vi.stubGlobal("fetch", fetchMock);

    render(<ItineraryStep />);

    await waitFor(() => {
      expect(screen.getByTestId("wizard")).toHaveAttribute("data-itinerary-id", "itin-1");
    });
    expect(posts(fetchMock)).toHaveLength(0);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/itinerary/generate?jobId=job-1");
  });

  it("doesn't resume another trip's pending job", async () => {
    localStorage.setItem(
      "zimmgo-pending-generation",
      JSON.stringify({ requestId: "req-abcdefgh", jobId: "job-other", tripId: "some-other-trip" })
    );
    const fetchMock = jobFetchMock(makeItinerary());
    vi.stubGlobal("fetch", fetchMock);

    render(<ItineraryStep />);

    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1));
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("job-other"))).toBe(false);
  });

  it("shows the job's real progress stage while it runs", async () => {
    let polls = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ jobId: "job-1", status: "running" }), { status: 202 });
      polls += 1;
      return new Response(
        JSON.stringify(polls === 1
          ? { jobId: "job-1", status: "running", stage: "Finding hotels that fit your trip…", result: null, error: null }
          : { jobId: "job-1", status: "done", stage: null, result: makeItinerary(), error: null }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ItineraryStep />);

    expect(await screen.findByText("Finding hotels that fit your trip…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("wizard")).toBeInTheDocument(), { timeout: 5_000 });
  });

  it("doesn't auto-generate again once an itinerary already exists", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    useTripStore.setState({ trip: freshTrip({ itineraries: [makeItinerary()] }) });

    render(<ItineraryStep />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an error with a retry option when generation fails", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "Server exploded" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ItineraryStep />);

    expect(await screen.findByText("Server exploded")).toBeInTheDocument();
    expect(useTripStore.getState().trip.itineraries).toHaveLength(0);

    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("shows a friendlier message for a raw network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));

    render(<ItineraryStep />);

    expect(
      await screen.findByText(/Lost connection while building your itinerary/)
    ).toBeInTheDocument();
  });
});

describe("ItineraryStep — plan my whole trip", () => {
  const autoPlanResult = {
    selectedHotelsByCity: {},
    selectedActivityIds: ["a1"],
    selectedRestaurantIds: [],
    dayCards: { 1: ["act-a1"], 2: [], 3: [], 4: [] },
    bankCards: [],
    failedCities: [],
  };
  function autoPlanTripState() {
    const itinerary = makeItinerary({
      activities: [{ id: "a1", name: "Sagrada Família", category: "culture", duration: "2h", price: 30, currency: "USD", rating: 9, reviewCount: 1, isLocalFavorite: false, description: "", location: "Barcelona", bookingUrl: "" }],
    });
    useTripStore.setState({
      trip: freshTrip({
        itineraries: [itinerary],
        preferences: { activities: [], activityRankings: {}, vibes: [], transportation: [], autoPlanEverything: true },
      }),
    });
    return itinerary;
  }
  function autoPlanFetchMock(finalJob: Record<string, unknown>) {
    return vi.fn(async (url: string, init?: RequestInit) => {
      expect(url.startsWith("/api/itinerary/auto-plan")).toBe(true);
      if (init?.method === "POST") return new Response(JSON.stringify({ jobId: "ap-1", status: "running" }), { status: 202 });
      return new Response(JSON.stringify({ jobId: "ap-1", stage: null, result: null, error: null, ...finalJob }), { status: 200 });
    });
  }

  it("runs auto-plan as a server job and lands on the finished plan", async () => {
    autoPlanTripState();
    const fetchMock = autoPlanFetchMock({ status: "done", result: autoPlanResult });
    vi.stubGlobal("fetch", fetchMock);

    render(<ItineraryStep />);

    await waitFor(() => expect(screen.getByTestId("itinerary-view")).toBeInTheDocument());
    expect(posts(fetchMock)).toHaveLength(1);
    const trip = useTripStore.getState().trip;
    expect(trip.preferences.selectedActivityIds).toEqual(["a1"]);
    expect(trip.itineraries[0].reviewCompleted).toBe(true);
    expect(trip.itineraries[0].finalizedPlan?.dayCards[1]).toEqual(["act-a1"]);
    expect(localStorage.getItem("zimmgo-pending-autoplan")).toBeNull();
  });

  it("resumes a pending auto-plan job after a refresh instead of starting another", async () => {
    autoPlanTripState();
    localStorage.setItem(
      "zimmgo-pending-autoplan",
      JSON.stringify({ requestId: "req-abcdefgh", jobId: "ap-1", tripId: "trip-1", itineraryId: "itin-1" })
    );
    const fetchMock = autoPlanFetchMock({ status: "done", result: autoPlanResult });
    vi.stubGlobal("fetch", fetchMock);

    render(<ItineraryStep />);

    await waitFor(() => expect(useTripStore.getState().trip.itineraries[0].reviewCompleted).toBe(true));
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it("on failure keeps the choice and offers a retry or the manual wizard", async () => {
    autoPlanTripState();
    const fetchMock = autoPlanFetchMock({ status: "error", error: "Rate limited" });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ItineraryStep />);

    expect(await screen.findByText("Rate limited")).toBeInTheDocument();
    expect(useTripStore.getState().trip.preferences.autoPlanEverything).toBe(true);
    expect(screen.queryByTestId("wizard")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(posts(fetchMock)).toHaveLength(2));

    await user.click(await screen.findByRole("button", { name: /i'll pick myself/i }));
    expect(useTripStore.getState().trip.preferences.autoPlanEverything).toBe(false);
    expect(screen.getByTestId("wizard")).toBeInTheDocument();
  });

  it("names cities it couldn't plan while keeping the rest", async () => {
    autoPlanTripState();
    vi.stubGlobal("fetch", autoPlanFetchMock({ status: "done", result: { ...autoPlanResult, failedCities: ["Andalusia"] } }));

    render(<ItineraryStep />);

    expect(await screen.findByText(/couldn't finish planning Andalusia/)).toBeInTheDocument();
    expect(useTripStore.getState().trip.itineraries[0].reviewCompleted).toBe(true);
  });
});

describe("ItineraryStep — visa gating", () => {
  it("disables Continue until a required visa is acknowledged", async () => {
    useTripStore.setState({
      trip: freshTrip({
        itineraries: [makeItinerary()],
        preferences: {
          activities: [], activityRankings: {}, vibes: [], transportation: [],
          destination: { cities: ["Istanbul"], displayName: "Turkey — Istanbul & Cappadocia" },
        },
      }),
    });
    const user = userEvent.setup();
    render(<ItineraryStep />);

    const continueBtn = screen.getByRole("button", { name: /review & fine-tune my plan/i });
    expect(continueBtn).toBeDisabled();

    await user.click(screen.getByText(/I understand Turkey requires a visa/));
    expect(continueBtn).not.toBeDisabled();

    await user.click(continueBtn);
    expect(useTripStore.getState().trip.currentStep).toBe("refine");
  });

  it("doesn't gate Continue for a destination with no visa requirement", () => {
    useTripStore.setState({
      trip: freshTrip({
        itineraries: [makeItinerary()],
        preferences: {
          activities: [], activityRankings: {}, vibes: [], transportation: [],
          destination: { cities: ["Barcelona", "Andalusia"], displayName: "Spain" },
        },
      }),
    });
    render(<ItineraryStep />);
    expect(screen.getByRole("button", { name: /review & fine-tune my plan/i })).not.toBeDisabled();
  });
});

describe("ItineraryStep — day split and dates editors", () => {
  it("rebuilds with a new day split once the counts add up to the total", async () => {
    const itinerary = makeItinerary();
    const fetchMock = jobFetchMock(itinerary);
    vi.stubGlobal("fetch", fetchMock);
    useTripStore.setState({
      trip: freshTrip({
        itineraries: [itinerary],
        preferences: {
          activities: [], activityRankings: {}, vibes: [], transportation: [],
          destination: { cities: ["Barcelona", "Andalusia"], displayName: "Spain" },
        },
      }),
    });

    const user = userEvent.setup();
    render(<ItineraryStep />);

    await user.click(screen.getByText("Adjust days per city"));
    expect(screen.getByText("4 of 4 days allocated")).toBeInTheDocument();

    // Barcelona starts at 2 — bump it to 3, putting the total out of balance.
    // "Barcelona" also appears in the leg-summary chips above the editor, so
    // scope to the editor row's <span>, then to its stepper sibling div
    // specifically (not the whole row, which is shared with other cities).
    const barcelonaStepper = screen.getByText("Barcelona", { selector: "span" }).nextElementSibling as HTMLElement;
    const [, barcelonaPlus] = within(barcelonaStepper).getAllByRole("button");
    await user.click(barcelonaPlus);

    expect(screen.getByText(/5 of 4 days allocated/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save & rebuild/i })).toBeDisabled();

    // Bring Andalusia down by one to rebalance to 4.
    const andalusiaStepper = screen.getByText("Andalusia", { selector: "span" }).nextElementSibling as HTMLElement;
    const [andalusiaMinus] = within(andalusiaStepper).getAllByRole("button");
    await user.click(andalusiaMinus);

    expect(screen.getByText("4 of 4 days allocated")).toBeInTheDocument();
    const saveBtn = screen.getByRole("button", { name: /save & rebuild/i });
    expect(saveBtn).not.toBeDisabled();
    await user.click(saveBtn);

    expect(useTripStore.getState().trip.preferences.cityNights).toEqual({ Barcelona: 3, Andalusia: 1 });
    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1));
  });

  it("validates the date range before saving and rebuilding", async () => {
    const itinerary = makeItinerary();
    const fetchMock = jobFetchMock(itinerary);
    vi.stubGlobal("fetch", fetchMock);
    useTripStore.setState({ trip: freshTrip({ itineraries: [itinerary] }) });

    const user = userEvent.setup();
    render(<ItineraryStep />);

    await user.click(screen.getByText("Adjust dates"));
    const [startInput, endInput] = screen.getAllByDisplayValue(/2026-09-/);
    fireEvent.change(endInput, { target: { value: "2026-09-01" } }); // before start

    await user.click(screen.getByRole("button", { name: /save & rebuild/i }));
    expect(
      screen.getByText(/Enter a valid range — the end date needs to be after the start date/)
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(endInput, { target: { value: "2026-09-15" } });
    await user.click(screen.getByRole("button", { name: /save & rebuild/i }));

    expect(useTripStore.getState().trip.preferences.dates).toMatchObject({
      type: "exact",
      startDate: "2026-09-08",
      endDate: "2026-09-15",
    });
    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1));
  });
});

describe("ItineraryStep — wizard vs. finalized view", () => {
  it("shows the selection wizard until review is completed, then switches to the plain view", async () => {
    const itinerary = makeItinerary();
    useTripStore.setState({ trip: freshTrip({ itineraries: [itinerary] }) });
    const user = userEvent.setup();
    render(<ItineraryStep />);

    expect(screen.getByTestId("wizard")).toBeInTheDocument();
    expect(screen.queryByTestId("itinerary-view")).not.toBeInTheDocument();

    await user.click(screen.getByText("Complete wizard"));

    expect(useTripStore.getState().trip.itineraries[0].reviewCompleted).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId("itinerary-view")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("wizard")).not.toBeInTheDocument();
  });

  it("shows 'Fine-tune my schedule' instead of 'Review & fine-tune' once a plan is finalized", () => {
    const itinerary = makeItinerary({ finalizedPlan: { dayCards: {}, bankCards: [] } });
    useTripStore.setState({ trip: freshTrip({ itineraries: [itinerary] }) });
    render(<ItineraryStep />);

    expect(screen.getByRole("button", { name: /fine-tune my schedule/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /review & fine-tune my plan/i })).not.toBeInTheDocument();
  });

  it("shows a 'schedule saved' banner when the itinerary becomes personalized, and auto-hides it", () => {
    // Fake timers don't mix with testing-library's async waitFor/findBy
    // (both poll on real timers) — drive every update through act() and
    // assert synchronously instead of awaiting anything in this test.
    vi.useFakeTimers();
    const itinerary = makeItinerary();
    useTripStore.setState({ trip: freshTrip({ itineraries: [itinerary] }) });
    render(<ItineraryStep />);

    expect(screen.queryByText("Schedule saved!")).not.toBeInTheDocument();

    // Simulate returning from Refine having just saved a finalized plan.
    act(() => {
      useTripStore.setState((s) => ({
        trip: {
          ...s.trip,
          itineraries: s.trip.itineraries.map((it) =>
            it.id === itinerary.id
              ? { ...it, finalizedPlan: { dayCards: {}, bankCards: [] } }
              : it
          ),
        },
      }));
    });

    expect(screen.getByText("Schedule saved!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4001);
    });
    expect(screen.queryByText("Schedule saved!")).not.toBeInTheDocument();
  });
});
