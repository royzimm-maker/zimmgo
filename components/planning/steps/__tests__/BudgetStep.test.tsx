import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BudgetStep } from "@/components/planning/steps/BudgetStep";
import { useTripStore } from "@/lib/store/tripStore";
import type { Trip } from "@/types/trip";

function freshTrip(): Trip {
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
    currentStep: "budget",
    completedSteps: [],
    itineraries: [],
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(() => {
  useTripStore.setState({ trip: freshTrip() });
});

describe("BudgetStep — lodging tiers", () => {
  it("keeps Continue disabled until a lodging tier is picked or a custom range is enabled", async () => {
    const user = userEvent.setup();
    render(<BudgetStep />);

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();

    await user.click(screen.getByText("$200 – $400 / room / night"));
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });

  it("saves the selected tier and group defaults to the store on Continue", async () => {
    const user = userEvent.setup();
    render(<BudgetStep />);

    await user.click(screen.getByText("$200 – $400 / room / night"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    const prefs = useTripStore.getState().trip.preferences;
    expect(prefs.budgetRanges).toEqual(["500_750"]);
    expect(prefs.travelers).toBe(2);
    expect(prefs.rooms).toBe(1);
  });

  it("rejects an invalid custom nightly range and doesn't write anything to the store", async () => {
    const user = userEvent.setup();
    render(<BudgetStep />);

    await user.click(screen.getByText("Custom nightly range"));
    // Min below the $30 floor.
    fireEvent.change(screen.getByPlaceholderText("e.g. 250"), { target: { value: "10" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 450"), { target: { value: "450" } });
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      screen.getByText("Please enter a valid range (min $30, and a max greater than the min).")
    ).toBeInTheDocument();
    expect(useTripStore.getState().trip.preferences.budgetRanges).toBeUndefined();
  });

  it("accepts a valid custom nightly range", async () => {
    const user = userEvent.setup();
    render(<BudgetStep />);

    await user.click(screen.getByText("Custom nightly range"));
    fireEvent.change(screen.getByPlaceholderText("e.g. 250"), { target: { value: "250" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 450"), { target: { value: "450" } });
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(useTripStore.getState().trip.preferences.customBudgetRange).toEqual({ min: 250, max: 450 });
  });
});

describe("BudgetStep — food budget", () => {
  it("saves the selected food preset on Continue", async () => {
    const user = userEvent.setup();
    render(<BudgetStep />);

    await user.click(screen.getByText("$200 – $400 / room / night"));
    await user.click(screen.getByText("$70–150 / person / day"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(useTripStore.getState().trip.preferences.dailyFoodBudgetPerPerson).toBe(100);
  });

  it("rejects a custom food budget below the $10 floor", async () => {
    const user = userEvent.setup();
    render(<BudgetStep />);

    await user.click(screen.getByText("$200 – $400 / room / night"));
    await user.click(screen.getByRole("button", { name: /enter a custom amount/i, exact: false }));
    fireEvent.change(screen.getByPlaceholderText("e.g. 120"), { target: { value: "5" } });
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      screen.getByText("Please enter a valid food budget (min $10/person/day).")
    ).toBeInTheDocument();
    expect(useTripStore.getState().trip.preferences.dailyFoodBudgetPerPerson).toBeUndefined();
  });
});

describe("BudgetStep — splurge meals", () => {
  it("saves the default splurge preset when enabled without customizing it", async () => {
    const user = userEvent.setup();
    render(<BudgetStep />);

    await user.click(screen.getByText("$200 – $400 / room / night"));
    await user.click(screen.getByText("Room for a few splurge meals?"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(useTripStore.getState().trip.preferences.splurge).toEqual({
      count: 2,
      budgetPerPerson: 200,
      budgetPerPersonMax: 300,
      notes: undefined,
    });
  });

  it("rejects a custom splurge amount where max isn't greater than min", async () => {
    const user = userEvent.setup();
    render(<BudgetStep />);

    await user.click(screen.getByText("$200 – $400 / room / night"));
    await user.click(screen.getByText("Room for a few splurge meals?"));
    // The food-budget section above has its own "Enter a custom amount"
    // button — the splurge one is the second occurrence in DOM order.
    const customButtons = screen.getAllByRole("button", { name: /enter a custom amount/i, exact: false });
    await user.click(customButtons[customButtons.length - 1]);
    fireEvent.change(screen.getByPlaceholderText("e.g. 150"), { target: { value: "200" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 250"), { target: { value: "150" } });
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      screen.getByText("Please enter a valid amount (min $10, and a max greater than the min if you set one).")
    ).toBeInTheDocument();
    expect(useTripStore.getState().trip.preferences.splurge).toBeUndefined();
  });

  it("doesn't include a splurge preference at all when the toggle is left off", async () => {
    const user = userEvent.setup();
    render(<BudgetStep />);

    await user.click(screen.getByText("$200 – $400 / room / night"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(useTripStore.getState().trip.preferences.splurge).toBeUndefined();
  });
});

describe("BudgetStep — currency and dietary", () => {
  it("saves the display currency, using undefined for USD (the default)", async () => {
    const user = userEvent.setup();
    render(<BudgetStep />);

    await user.click(screen.getByText("$200 – $400 / room / night"));
    await user.selectOptions(screen.getByRole("combobox"), "EUR");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(useTripStore.getState().trip.preferences.preferredCurrency).toBe("EUR");
  });

  it("doesn't write a dietary toggle to the store until Continue is clicked", async () => {
    // Unlike Vibe/Activities, this step batches everything and only commits
    // on Continue — no chat-visible live sync here.
    const user = userEvent.setup();
    render(<BudgetStep />);

    await user.click(screen.getByText("$200 – $400 / room / night"));
    await user.click(screen.getByText("Vegetarian"));
    expect(useTripStore.getState().trip.preferences.dietaryRestrictions).toBeUndefined();

    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(useTripStore.getState().trip.preferences.dietaryRestrictions).toEqual(["Vegetarian"]);
  });
});
