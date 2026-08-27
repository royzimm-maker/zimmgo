import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransportationStep } from "@/components/planning/steps/TransportationStep";
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
    currentStep: "transportation",
    completedSteps: [],
    itineraries: [],
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(() => {
  useTripStore.setState({ trip: freshTrip() });
});

describe("TransportationStep — picking modes", () => {
  it("keeps Continue disabled until a mode is selected", async () => {
    const user = userEvent.setup();
    render(<TransportationStep />);

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    await user.click(screen.getByText("Public Transit"));
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });

  it("doesn't write to the store until Continue is clicked", async () => {
    // Unlike Vibe/Activities, this step has no live-sync-to-store effect —
    // selections only commit on Continue.
    const user = userEvent.setup();
    render(<TransportationStep />);

    await user.click(screen.getByText("Rental Car"));
    expect(useTripStore.getState().trip.preferences.transportation).toEqual([]);

    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(useTripStore.getState().trip.preferences.transportation).toEqual(["rental_car"]);
  });

  it("saves multiple selected modes on Continue", async () => {
    const user = userEvent.setup();
    render(<TransportationStep />);

    await user.click(screen.getByText("Rental Car"));
    await user.click(screen.getByText("Rideshare / Taxi"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(useTripStore.getState().trip.preferences.transportation).toEqual(["rental_car", "rideshare"]);
  });

  it("toggling a mode back off excludes it from what's saved", async () => {
    const user = userEvent.setup();
    render(<TransportationStep />);

    await user.click(screen.getByText("Rental Car"));
    await user.click(screen.getByText("Rental Car"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(useTripStore.getState().trip.preferences.transportation).toEqual([]);
  });

  it("includes a free-text 'Other' mode on Continue", async () => {
    const user = userEvent.setup();
    render(<TransportationStep />);

    await user.click(screen.getByText("Other…"));
    fireEvent.change(screen.getByPlaceholderText("e.g. Scooter rental, Bicycle…"), {
      target: { value: "Scooter rental" },
    });
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(useTripStore.getState().trip.preferences.transportation).toEqual(["Scooter rental"]);
  });
});

describe("TransportationStep — transit note", () => {
  it("shows the neutral default note when there's no destination set yet", () => {
    render(<TransportationStep />);
    expect(
      screen.getByText(/Every destination's transit quality is different/)
    ).toBeInTheDocument();
  });

  it("shows a destination-specific note for a recognized city", () => {
    useTripStore.setState({
      trip: freshTrip({ destination: { cities: ["Tokyo"], displayName: "Tokyo" } }),
    });
    render(<TransportationStep />);
    expect(screen.getByText(/Japan's public transit is excellent/)).toBeInTheDocument();
  });

  it("shows the neutral default note for an unrecognized destination", () => {
    useTripStore.setState({
      trip: freshTrip({ destination: { cities: ["Ulaanbaatar"], displayName: "Ulaanbaatar" } }),
    });
    render(<TransportationStep />);
    expect(
      screen.getByText(/Every destination's transit quality is different/)
    ).toBeInTheDocument();
  });
});
