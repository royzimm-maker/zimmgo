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

beforeEach(() => {
  useTripStore.setState({ trip: freshTrip(), isGenerating: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ItineraryStep — generation", () => {
  it("auto-generates on mount when there's no itinerary yet", async () => {
    const itinerary = makeItinerary();
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("/api/itinerary/generate");
      return new Response(JSON.stringify(itinerary), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ItineraryStep />);

    await waitFor(() => {
      expect(screen.getByTestId("wizard")).toHaveAttribute("data-itinerary-id", "itin-1");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const state = useTripStore.getState().trip;
    expect(state.itineraries).toHaveLength(1);
    expect(state.completedSteps).toContain("itinerary");
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
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(itinerary), { status: 200 }));
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
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("validates the date range before saving and rebuilding", async () => {
    const itinerary = makeItinerary();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(itinerary), { status: 200 }));
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
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
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

  it("shows 'Update my schedule' instead of 'Review & fine-tune' once a plan is finalized", () => {
    const itinerary = makeItinerary({ finalizedPlan: { dayCards: {}, bankCards: [] } });
    useTripStore.setState({ trip: freshTrip({ itineraries: [itinerary] }) });
    render(<ItineraryStep />);

    expect(screen.getByRole("button", { name: /update my schedule/i })).toBeInTheDocument();
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
