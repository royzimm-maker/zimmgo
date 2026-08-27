import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AirlinesStep } from "@/components/planning/steps/AirlinesStep";
import { useTripStore } from "@/lib/store/tripStore";
import type { Trip, Destination } from "@/types/trip";

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
    currentStep: "airlines",
    completedSteps: [],
    itineraries: [],
    createdAt: now,
    updatedAt: now,
  };
}

function barcelonaDestination(overrides: Partial<Destination> = {}): Destination {
  return {
    cities: ["Barcelona", "Andalusia"],
    displayName: "Spain — Barcelona & Andalusia",
    freeText: "Spain — Barcelona & Andalusia",
    ...overrides,
  };
}

beforeEach(() => {
  useTripStore.setState({ trip: freshTrip(), defaultDepartureAirport: undefined });
});

describe("AirlinesStep — driving toggle", () => {
  it("hides the driving toggle entirely when flights are obviously required", () => {
    useTripStore.setState({
      trip: freshTrip({ destination: barcelonaDestination({ flightsObviouslyRequired: true }) }),
    });
    render(<AirlinesStep />);
    expect(screen.queryByText("I’m driving — no flights needed")).not.toBeInTheDocument();
  });

  it("shows the driving toggle when flights aren't obviously required, and hides the flight-search fields once enabled", async () => {
    useTripStore.setState({
      trip: freshTrip({ destination: barcelonaDestination({ flightsObviouslyRequired: false }) }),
    });
    const user = userEvent.setup();
    render(<AirlinesStep />);

    expect(screen.getByText("I’m driving — no flights needed")).toBeInTheDocument();
    expect(screen.getByText(/Where are you flying from/)).toBeInTheDocument();

    await user.click(screen.getByText("I’m driving — no flights needed"));

    expect(screen.queryByText(/Where are you flying from/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });

  it("resets a stale 'no flights needed' preference if the destination becomes one that obviously needs flights", () => {
    useTripStore.setState({
      trip: freshTrip({
        destination: barcelonaDestination({ flightsObviouslyRequired: false }),
        noFlightsNeeded: true,
      }),
    });
    const { rerender } = render(<AirlinesStep />);
    // Starts respecting the stale true value since flights weren't obviously required yet.
    expect(screen.queryByText(/Where are you flying from/)).not.toBeInTheDocument();

    useTripStore.setState((s) => ({
      trip: {
        ...s.trip,
        preferences: {
          ...s.trip.preferences,
          destination: barcelonaDestination({ flightsObviouslyRequired: true }),
        },
      },
    }));
    rerender(<AirlinesStep />);

    // The toggle is gone (flights obviously required) and the search fields
    // are back, rather than staying silently stuck on "no flights needed".
    expect(screen.queryByText("I’m driving — no flights needed")).not.toBeInTheDocument();
    expect(screen.getByText(/Where are you flying from/)).toBeInTheDocument();
  });
});

describe("AirlinesStep — departure airport", () => {
  it("keeps Continue disabled until a departure airport is entered", async () => {
    useTripStore.setState({ trip: freshTrip({ destination: barcelonaDestination() }) });
    render(<AirlinesStep />);

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();

    const input = screen.getByPlaceholderText(/City or airport code/);
    fireEvent.change(input, { target: { value: "New York" } });

    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });

  it("shows matching airports and fills the field on selection", async () => {
    useTripStore.setState({ trip: freshTrip({ destination: barcelonaDestination() }) });
    const user = userEvent.setup();
    render(<AirlinesStep />);

    const input = screen.getByPlaceholderText(/City or airport code/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New York" } });

    const jfkOption = await screen.findByText("JFK");
    await user.click(jfkOption);

    expect(input.value).toBe("New York (JFK)");
  });

  it("offers to remember the departure airport as the default, and saves it on Yes", async () => {
    useTripStore.setState({ trip: freshTrip({ destination: barcelonaDestination() }) });
    const user = userEvent.setup();
    render(<AirlinesStep />);

    const input = screen.getByPlaceholderText(/City or airport code/);
    fireEvent.change(input, { target: { value: "New York" } });
    await user.click(await screen.findByText("JFK"));

    expect(screen.getByText(/Set/)).toBeInTheDocument();
    await user.click(screen.getByText("Yes"));

    expect(useTripStore.getState().defaultDepartureAirport).toBe("New York (JFK)");
  });

  it("pre-fills the departure field from a remembered default airport", () => {
    useTripStore.setState({
      trip: freshTrip({ destination: barcelonaDestination() }),
      defaultDepartureAirport: "New York (JFK)",
    });
    render(<AirlinesStep />);
    expect(screen.getByPlaceholderText(/City or airport code/)).toHaveValue("New York (JFK)");
  });
});

describe("AirlinesStep — gateway airport (Barcelona routing regression)", () => {
  it("pre-selects Barcelona, not Madrid, as the best gateway when Madrid isn't mentioned", () => {
    // Same underlying fix as DestinationStep's regression test, exercised
    // here at the actual UI that renders the "Best gateway" badge.
    useTripStore.setState({ trip: freshTrip({ destination: barcelonaDestination() }) });
    render(<AirlinesStep />);

    const bcnRow = screen.getByText("Barcelona").closest("button")!;
    expect(within(bcnRow).getByText("Best gateway")).toBeInTheDocument();

    const madridRow = screen.queryByText("Madrid")?.closest("button");
    if (madridRow) {
      expect(within(madridRow).queryByText("Best gateway")).not.toBeInTheDocument();
    }
  });

  it("saves the selected gateway as the destination's arrival airport on Continue", async () => {
    useTripStore.setState({ trip: freshTrip({ destination: barcelonaDestination() }) });
    const user = userEvent.setup();
    render(<AirlinesStep />);

    const input = screen.getByPlaceholderText(/City or airport code/);
    fireEvent.change(input, { target: { value: "New York" } });
    await user.click(await screen.findByText("JFK"));

    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(useTripStore.getState().trip.preferences.destination?.arrivalAirport).toBe("BCN");
  });
});

describe("AirlinesStep — Continue behavior", () => {
  it("saves noFlightsNeeded and clears departure/arrival airports when driving", async () => {
    useTripStore.setState({
      trip: freshTrip({ destination: barcelonaDestination({ arrivalAirport: "BCN", departureAirport: "New York (JFK)" }) }),
    });
    const user = userEvent.setup();
    render(<AirlinesStep />);

    await user.click(screen.getByText("I’m driving — no flights needed"));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    const prefs = useTripStore.getState().trip.preferences;
    expect(prefs.noFlightsNeeded).toBe(true);
    expect(prefs.destination?.departureAirport).toBeUndefined();
    expect(prefs.destination?.arrivalAirport).toBeUndefined();
  });

  it("writes live airline preference changes to the store as they're picked", async () => {
    useTripStore.setState({ trip: freshTrip({ destination: barcelonaDestination() }) });
    const user = userEvent.setup();
    render(<AirlinesStep />);

    await user.click(screen.getByText("Delta Air Lines"));

    expect(useTripStore.getState().trip.preferences.airlinePrefs?.airlines).toEqual(["Delta Air Lines"]);
  });

  it("zeroes out airline/alliance/cabin picks when 'lowest fares' is active, but keeps the nonstop preference", async () => {
    useTripStore.setState({ trip: freshTrip({ destination: barcelonaDestination() }) });
    const user = userEvent.setup();
    render(<AirlinesStep />);

    await user.click(screen.getByText("Delta Air Lines"));
    await user.click(screen.getByText("Find me the lowest fares"));

    const prefs = useTripStore.getState().trip.preferences.airlinePrefs;
    expect(prefs?.prioritizeLowestFare).toBe(true);
    expect(prefs?.airlines).toEqual([]);
    expect(prefs?.preferNonstop).toBe(true);
  });
});
