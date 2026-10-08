import { describe, it, expect, vi } from "vitest";
import { arrangeDays, chooseActivities, chooseHotel, chooseRestaurants, isAirbnbOnly, type PickFn } from "@/lib/planning/cityPicks";
import type { ActivityOption, HotelOption, ItineraryDay, RestaurantOption, TripPreferences } from "@/types/trip";

const prefs = {} as TripPreferences;
const hotels = [{ id: "h1" }, { id: "h2" }] as HotelOption[];
const acts = [{ id: "a1" }, { id: "a2" }] as ActivityOption[];
const rests = [{ id: "r1" }] as RestaurantOption[];
const days = [{ dayNumber: 1 }, { dayNumber: 2 }] as ItineraryDay[];
const answers = (picks: { id: string; dayNumber?: number }[], summary = "why"): PickFn =>
  vi.fn(async () => ({ picks: picks.map((p) => ({ reason: `because ${p.id}`, ...p })), summary }));

describe("the shared 'let ZimmGo choose' steps check answers the same way everywhere", () => {
  it("chooseHotel takes the first hotel that was actually offered", async () => {
    expect(await chooseHotel(answers([{ id: "made-up" }, { id: "h2" }]), "Rome", prefs, hotels))
      .toEqual({ hotel: { id: "h2" }, reason: "because h2" });
    expect(await chooseHotel(answers([{ id: "made-up" }]), "Rome", prefs, hotels)).toBeNull();
  });

  it("doesn't ask at all when there's nothing to choose from", async () => {
    const pick = answers([]);
    expect(await chooseHotel(pick, "Rome", prefs, [])).toBeNull();
    expect(await chooseActivities(pick, "Rome", prefs, [])).toEqual({ ids: [], summary: "" });
    expect(await arrangeDays(pick, "Rome", prefs, days, [], [])).toEqual({ dayCards: {}, summary: "" });
    expect(pick).not.toHaveBeenCalled();
  });

  it("chooseActivities / chooseRestaurants keep only offered ids, once each", async () => {
    expect(await chooseActivities(answers([{ id: "a2" }, { id: "zz" }, { id: "a2" }]), "Rome", prefs, acts))
      .toEqual({ ids: ["a2"], summary: "why" });
    expect((await chooseRestaurants(answers([{ id: "r1" }, { id: "r9" }]), "Rome", prefs, rests)).ids).toEqual(["r1"]);
  });

  it("arrangeDays places only offered cards on real days, never twice", async () => {
    const { dayCards } = await arrangeDays(
      answers([
        { id: "act-a1", dayNumber: 1 },
        { id: "act-a1", dayNumber: 2 }, // duplicate — the Refine step used to place this twice
        { id: "rest-r1", dayNumber: 7 }, // no such day
        { id: "act-zz", dayNumber: 2 }, // never offered
        { id: "rest-r1", dayNumber: 2 },
      ]),
      "Rome", prefs, days, acts, rests
    );
    expect(dayCards).toEqual({ 1: ["act-a1"], 2: ["rest-r1"] });
  });

  it("isAirbnbOnly", () => {
    expect(isAirbnbOnly(["airbnb"])).toBe(true);
    expect(isAirbnbOnly(["airbnb", "hotel"])).toBe(false);
    expect(isAirbnbOnly([])).toBe(false);
    expect(isAirbnbOnly(undefined)).toBe(false);
  });
});
