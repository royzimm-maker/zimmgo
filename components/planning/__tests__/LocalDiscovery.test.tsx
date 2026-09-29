import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalDiscovery } from "@/components/planning/LocalDiscovery";
import type { TripPreferences } from "@/types/trip";

const prefs = {
  activities: [], activityRankings: {}, vibes: [], transportation: [],
  destination: { cities: ["Rome", "Florence"], displayName: "Italy — Rome & Florence" },
} as TripPreferences;

const guide = {
  destination: "Italy — Rome & Florence",
  sceneIntro: "Aperitivo is a way of life.",
  events: [], hiddenGems: [], apps: [], airportTransfers: [],
  music: { intro: "", artists: [], venues: [], playlistSearchUrl: "" },
};

afterEach(() => vi.unstubAllGlobals());

describe("LocalDiscovery", () => {
  it("fetches only this trip's guide and renders it", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(guide), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<LocalDiscovery preferences={prefs} />);

    expect(screen.getByLabelText("Loading local tips")).toBeInTheDocument();
    expect(await screen.findByText("Aperitivo is a way of life.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/local-discovery?destination=Italy+%E2%80%94+Rome+%26+Florence&city=Rome&city=Florence"
    );
  });

  it("offers a retry when the guide can't be loaded", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify(guide), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<LocalDiscovery preferences={prefs} />);

    await userEvent.setup().click(await screen.findByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("Aperitivo is a way of life.")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
