import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatesStep } from "@/components/planning/steps/DatesStep";
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
    currentStep: "dates",
    completedSteps: [],
    itineraries: [],
    createdAt: now,
    updatedAt: now,
  };
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

// Mirrors DatesStep's own generateMonths() so tests can compute the same
// month labels without duplicating the component's internal MONTHS array.
function monthValueLabel(monthsForward: number): { value: string; label: string } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + monthsForward, 1);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { value, label: d.toLocaleString("default", { month: "long", year: "numeric" }) };
}

function pickerContainer(label: "Departure" | "Return"): HTMLElement {
  return screen.getByText(label).closest("div")!.parentElement as HTMLElement;
}

function firstEnabledDayButton(container: HTMLElement): HTMLElement {
  const dayButtons = within(container)
    .getAllByRole("button")
    .filter((b) => /^\d+$/.test(b.textContent ?? ""));
  const enabled = dayButtons.find((b) => !b.hasAttribute("disabled"));
  if (!enabled) throw new Error("No enabled day found");
  return enabled;
}

beforeEach(() => {
  useTripStore.setState({ trip: freshTrip() });
});

describe("DatesStep — exact dates", () => {
  it("keeps Continue disabled until both dates are picked", () => {
    render(<DatesStep />);
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("auto-sets the return date to the day after departure, and saves both on Continue", async () => {
    const user = userEvent.setup();
    render(<DatesStep />);

    const departureDay = firstEnabledDayButton(pickerContainer("Departure"));
    const expectedStart = departureDay.textContent!;
    await user.click(departureDay);

    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
    await user.click(screen.getByRole("button", { name: /continue/i }));

    const dates = useTripStore.getState().trip.preferences.dates;
    expect(dates?.type).toBe("exact");
    expect(dates?.startDate?.endsWith(`-${expectedStart.padStart(2, "0")}`)).toBe(true);
    // Return landed exactly one day after departure.
    const start = new Date(dates!.startDate! + "T00:00:00");
    const end = new Date(dates!.endDate! + "T00:00:00");
    expect(Math.round((end.getTime() - start.getTime()) / 86400000)).toBe(1);
  });

  it("flags a range too short to cover every city on a multi-city trip", () => {
    const today = new Date();
    useTripStore.setState({
      trip: freshTrip({
        destination: { cities: ["Tokyo", "Kyoto", "Osaka"], displayName: "Japan" },
        dates: { type: "exact", startDate: ymd(today), endDate: ymd(addDays(today, 1)) },
      }),
    });
    render(<DatesStep />);

    expect(
      screen.getByText(/isn't enough to cover all 3 destinations/)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("warns (but doesn't block) when dates fall beyond the usual flight-booking window", async () => {
    const today = new Date();
    const farStart = addDays(today, 400); // beyond ~11 months, within the 2-year hard cap
    useTripStore.setState({
      trip: freshTrip({
        dates: { type: "exact", startDate: ymd(farStart), endDate: ymd(addDays(farStart, 1)) },
      }),
    });
    const user = userEvent.setup();
    render(<DatesStep />);

    expect(screen.getByText(/Airlines typically don't open bookings this far ahead/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(useTripStore.getState().trip.preferences.dates?.skipFlightSearch).toBe(true);
  });
});

// A 3-month window starting right after `excludedMonth` (wrapping past
// December) — guaranteed to exclude it, independent of when tests run.
function windowExcluding(excludedMonth: number): { start: number; end: number } {
  const start = (excludedMonth % 12) + 1;
  const end = ((excludedMonth + 2) % 12) + 1;
  return { start, end };
}

describe("DatesStep — seasonal window", () => {
  it("requires an explicit 'continue anyway' before advancing past a seasonal warning", async () => {
    const outOfWindowMonth = monthValueLabel(6); // 6 months out
    const [y, m] = outOfWindowMonth.value.split("-").map(Number);
    const start = new Date(y, m - 1, 15);
    const { start: winStart, end: winEnd } = windowExcluding(m);

    useTripStore.setState({
      trip: freshTrip({
        destination: {
          cities: ["Reykjavik"],
          displayName: "Iceland",
          seasonalNote: "Best seen during aurora season.",
          seasonalWindowStartMonth: winStart,
          seasonalWindowEndMonth: winEnd,
        },
        dates: { type: "exact", startDate: ymd(start), endDate: ymd(addDays(start, 3)) },
      }),
    });

    const user = userEvent.setup();
    render(<DatesStep />);

    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText(/don't fall within the window ZiGy mentioned/)).toBeInTheDocument();
    // Nothing committed yet — still holding for an explicit answer.
    expect(useTripStore.getState().trip.currentStep).toBe("dates");

    await user.click(screen.getByText("Continue anyway"));

    const state = useTripStore.getState().trip;
    expect(state.preferences.dates?.startDate).toBe(ymd(start));
    expect(state.completedSteps).toContain("dates");
    expect(state.currentStep).toBe("airlines");
  });

  it("dismisses the warning via 'let me adjust the dates' without saving", async () => {
    const outOfWindowMonth = monthValueLabel(6);
    const [y, m] = outOfWindowMonth.value.split("-").map(Number);
    const start = new Date(y, m - 1, 15);
    const { start: winStart, end: winEnd } = windowExcluding(m);

    useTripStore.setState({
      trip: freshTrip({
        destination: {
          cities: ["Reykjavik"],
          displayName: "Iceland",
          seasonalWindowStartMonth: winStart,
          seasonalWindowEndMonth: winEnd,
        },
        dates: { type: "exact", startDate: ymd(start), endDate: ymd(addDays(start, 3)) },
      }),
    });

    const user = userEvent.setup();
    render(<DatesStep />);

    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText(/don't fall within the window ZiGy mentioned/)).toBeInTheDocument();

    await user.click(screen.getByText("Let me adjust the dates"));
    expect(screen.queryByText(/don't fall within the window ZiGy mentioned/)).not.toBeInTheDocument();
    // Dismissing doesn't call setDates at all — the store is untouched.
    expect(useTripStore.getState().trip.preferences.dates?.startDate).toBe(ymd(start));
    expect(useTripStore.getState().trip.currentStep).toBe("dates");
  });
});

describe("DatesStep — flexible window", () => {
  it("saves the selected month and duration preset", async () => {
    const user = userEvent.setup();
    render(<DatesStep />);

    await user.click(screen.getByText("Flexible window"));
    const nextMonth = monthValueLabel(1);
    await user.click(screen.getByText(nextMonth.label));
    await user.click(screen.getByText("14 days"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    const dates = useTripStore.getState().trip.preferences.dates;
    expect(dates).toEqual({ type: "flexible", flexibleMonth: nextMonth.value, flexibleDuration: 14 });
  });

  it("supports a custom trip duration outside the presets", async () => {
    const user = userEvent.setup();
    render(<DatesStep />);

    await user.click(screen.getByText("Flexible window"));
    await user.click(screen.getByText("Other…"));
    const input = screen.getByPlaceholderText("e.g. 21");
    await user.type(input, "30");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(useTripStore.getState().trip.preferences.dates?.flexibleDuration).toBe(30);
  });

  it("is always valid — flexible mode never blocks Continue, unlike exact", async () => {
    const user = userEvent.setup();
    render(<DatesStep />);
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();

    // Switching to flexible mode has usable defaults (this month, 10 days)
    // with nothing further required from the user.
    await user.click(screen.getByText("Flexible window"));
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });
});
