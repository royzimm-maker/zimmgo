import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VibeStep } from "@/components/planning/steps/VibeStep";
import { useTripStore } from "@/lib/store/tripStore";
import type { Trip, VibeTag } from "@/types/trip";

function freshTrip(vibes: Trip["preferences"]["vibes"] = []): Trip {
  const now = new Date().toISOString();
  return {
    id: "trip-1",
    name: "Test Trip",
    preferences: {
      activities: [],
      activityRankings: {},
      vibes,
      transportation: [],
    },
    currentStep: "vibe",
    completedSteps: [],
    itineraries: [],
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(() => {
  useTripStore.setState({ trip: freshTrip() });
});

describe("VibeStep", () => {
  it("writes a selection straight to the store as soon as it's picked, not just on Continue", async () => {
    // Called out in the component's own comment: chat only reads the store,
    // so a pick that stays local until Continue would be invisible to a
    // chat-driven edit made while the user is still sitting on this step.
    const user = userEvent.setup();
    render(<VibeStep />);

    await user.click(screen.getByText("Romantic"));

    expect(useTripStore.getState().trip.preferences.vibes).toEqual(["romantic"]);
  });

  it("toggles a vibe off and removes it from the store", async () => {
    const user = userEvent.setup();
    render(<VibeStep />);

    await user.click(screen.getByText("Romantic"));
    await user.click(screen.getByText("Romantic"));

    expect(useTripStore.getState().trip.preferences.vibes).toEqual([]);
  });

  it("keeps Continue disabled until something is selected", async () => {
    const user = userEvent.setup();
    render(<VibeStep />);

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();

    await user.click(screen.getByText("Outdoors & Nature"));

    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });

  it("supports a free-text 'Other' vibe and only counts it once it has content", async () => {
    const user = userEvent.setup();
    render(<VibeStep />);

    await user.click(screen.getByText("Other…"));
    // Opening it with nothing typed yet shouldn't satisfy the selection
    // requirement.
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();

    const input = screen.getByPlaceholderText("e.g. Pet-friendly, Accessible travel…");
    await user.type(input, "Pet-friendly");

    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
    expect(useTripStore.getState().trip.preferences.vibes).toEqual(["Pet-friendly"]);
  });

  it("re-syncs from the store when preferences change externally (e.g. a chat-driven edit)", async () => {
    render(<VibeStep />);
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();

    useTripStore.setState((s) => ({
      trip: { ...s.trip, preferences: { ...s.trip.preferences, vibes: ["beaches", "shopping"] } },
    }));

    expect(await screen.findByRole("button", { name: /continue/i })).not.toBeDisabled();
    // Both chips reflect the externally-applied selection.
    const beachesChip = screen.getByText("Beaches").closest("button")!;
    const shoppingChip = screen.getByText("Shopping").closest("button")!;
    expect(beachesChip.className).toMatch(/border-brand-500/);
    expect(shoppingChip.className).toMatch(/border-brand-500/);
  });

  it("re-opens the 'Other' field and restores its value when the store holds a custom vibe", async () => {
    useTripStore.setState({ trip: freshTrip(["romantic", "Glamping" as VibeTag]) });
    render(<VibeStep />);

    expect(screen.getByDisplayValue("Glamping")).toBeInTheDocument();
    const romanticChip = screen.getByText("Romantic").closest("button")!;
    expect(romanticChip.className).toMatch(/border-brand-500/);
  });
});
