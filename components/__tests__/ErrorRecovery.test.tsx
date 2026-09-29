import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorRecovery } from "@/components/ErrorRecovery";
import AppError from "@/app/error";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useTripStore } from "@/lib/store/tripStore";
import type { Trip } from "@/types/trip";

const now = new Date().toISOString();
const brokenTrip: Trip = {
  id: "trip-broken", name: "Lisbon",
  preferences: { activities: [], activityRankings: {}, vibes: [], transportation: [] },
  currentStep: "itinerary", completedSteps: ["destination", "dates"], itineraries: [], createdAt: now, updatedAt: now,
};

beforeEach(() => {
  useTripStore.setState({ trip: brokenTrip, savedTrips: [], chatMessages: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ErrorRecovery", () => {
  it("offers a retry that re-renders the page", async () => {
    const reset = vi.fn();
    render(<ErrorRecovery error={new Error("boom")} reset={reset} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh trip without losing the one that crashed", async () => {
    render(<ErrorRecovery error={new Error("boom")} reset={vi.fn()} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Start a fresh trip" }));

    const state = useTripStore.getState();
    expect(state.trip.id).not.toBe("trip-broken");
    expect(state.savedTrips.map((t) => t.id)).toEqual(["trip-broken"]);
  });

  it("logs the error and shows its reference for support", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<ErrorRecovery error={error} reset={vi.fn()} />);

    expect(screen.getByText("Error reference: abc123")).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith("[app error]", error);
  });
});

describe("ErrorBoundary (per planning step)", () => {
  function Boom(): JSX.Element {
    throw new Error("Cannot read properties of null (reading 'length')");
  }

  it("offers the full recovery options instead of only a retry", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);

    expect(screen.getByRole("alert")).toHaveTextContent("this step");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a fresh trip" })).toBeInTheDocument();
    // Raw exception text isn't shown to the traveller.
    expect(screen.queryByText(/Cannot read properties/)).not.toBeInTheDocument();
  });
});

describe("app/error.tsx", () => {
  it("renders the recovery screen instead of a blank page", () => {
    render(<AppError error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Start a fresh trip" })).toBeInTheDocument();
  });
});
