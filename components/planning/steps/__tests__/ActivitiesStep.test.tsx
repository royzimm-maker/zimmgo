import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivitiesStep } from "@/components/planning/steps/ActivitiesStep";
import { useTripStore } from "@/lib/store/tripStore";
import type { Trip } from "@/types/trip";

function freshTrip(overrides: Partial<Trip["preferences"]> = {}): Trip {
  const now = new Date().toISOString();
  return {
    id: "trip-1",
    name: "Test Trip",
    preferences: {
      activities: [],
      activityRankings: {},
      vibes: [],
      transportation: [],
      ...overrides,
    },
    currentStep: "activities",
    completedSteps: [],
    itineraries: [],
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(() => {
  useTripStore.setState({ trip: freshTrip() });
});

describe("ActivitiesStep — manual picking", () => {
  it("writes a selection straight to the store as soon as it's picked, not just on Continue", async () => {
    const user = userEvent.setup();
    render(<ActivitiesStep />);

    await user.click(screen.getByText("Cultural"));

    expect(useTripStore.getState().trip.preferences.activities).toEqual(["cultural"]);
  });

  it("keeps Continue disabled until something is selected", async () => {
    const user = userEvent.setup();
    render(<ActivitiesStep />);

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    await user.click(screen.getByText("Hiking"));
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });

  it("supports a free-text 'Other' activity", async () => {
    const user = userEvent.setup();
    render(<ActivitiesStep />);

    await user.click(screen.getByText("Other…"));
    const input = screen.getByPlaceholderText("e.g. Surfing, Bird watching…");
    fireEvent.change(input, { target: { value: "Bird watching" } });

    expect(useTripStore.getState().trip.preferences.activities).toEqual(["Bird watching"]);
  });

  it("toggles skip-the-line and day-trip preferences straight to the store", async () => {
    const user = userEvent.setup();
    render(<ActivitiesStep />);

    await user.click(screen.getByText("Skip-the-line access"));
    expect(useTripStore.getState().trip.preferences.avoidLongQueues).toBe(true);

    await user.click(screen.getByText("Day trip outside city"));
    expect(useTripStore.getState().trip.preferences.dayTripRequested).toBe(true);
  });

  it("hides categories that don't fit the destination (e.g. diving/sailing/skiing for Madrid)", () => {
    useTripStore.setState({
      trip: freshTrip({ destination: { cities: ["Madrid"], displayName: "Madrid" } }),
    });
    render(<ActivitiesStep />);

    expect(screen.queryByText("Diving & Snorkel")).not.toBeInTheDocument();
    expect(screen.queryByText("Sailing & Boating")).not.toBeInTheDocument();
    expect(screen.queryByText("Skiing")).not.toBeInTheDocument();
    // Unaffected categories still show.
    expect(screen.getByText("Cultural")).toBeInTheDocument();
  });

  it("re-syncs from the store when preferences change externally (e.g. a chat-driven edit)", async () => {
    render(<ActivitiesStep />);
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();

    useTripStore.setState((s) => ({
      trip: { ...s.trip, preferences: { ...s.trip.preferences, activities: ["hiking", "food"] } },
    }));

    expect(await screen.findByRole("button", { name: /continue/i })).not.toBeDisabled();
    expect(screen.getByText("Hiking").closest("button")!.className).toMatch(/border-brand-500/);
    expect(screen.getByText("Food Experiences").closest("button")!.className).toMatch(/border-brand-500/);
  });
});

describe("ActivitiesStep — ZiGy pick", () => {
  it("lets ZiGy pick activities and writes the picks to the store", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/itinerary/smart-pick") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        expect(body.kind).toBe("activities");
        return new Response(
          JSON.stringify({
            summary: "ZiGy picked cultural and food-forward activities.",
            picks: [
              { id: "cultural", reason: "Fits the history-focused vibe." },
              { id: "food", reason: "Great local food scene." },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ActivitiesStep />);

    await user.click(screen.getByText("Let ZiGy pick for me"));

    await waitFor(() => {
      expect(useTripStore.getState().trip.preferences.activities).toEqual(["cultural", "food"]);
    });
    expect(await screen.findByText(/ZiGy picked cultural and food-forward activities\./)).toBeInTheDocument();
    // The banner becomes a closed status once a pick has actually happened.
    expect(screen.getByText("Here’s what ZiGy recommends")).toBeInTheDocument();
  });

  it("ignores a picked id that isn't one of the offered categories", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          summary: "Picked some things.",
          picks: [{ id: "cultural", reason: "Good fit." }, { id: "not_a_real_category", reason: "??" }],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ActivitiesStep />);
    await user.click(screen.getByText("Let ZiGy pick for me"));

    await waitFor(() => {
      expect(useTripStore.getState().trip.preferences.activities).toEqual(["cultural"]);
    });
  });
});
