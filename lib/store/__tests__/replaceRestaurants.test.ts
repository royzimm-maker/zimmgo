import { describe, it, expect, beforeEach } from "vitest";
import { useTripStore } from "@/lib/store/tripStore";
import type { GeneratedItinerary, HotelOption, RestaurantOption } from "@/types/trip";

const rest = (id: string, rating: number) => ({ id, name: id, rating, location: "Lisbon" }) as RestaurantOption;
const itin = { id: "i1", tripId: "t", version: 1, createdAt: "", days: [], flights: [], hotels: [], activities: [], restaurants: [rest("a", 9), rest("b", 8)] } as unknown as GeneratedItinerary;

beforeEach(() => {
  useTripStore.getState().resetTrip();
  useTripStore.getState().addItinerary(itin);
});

describe("replaceRestaurants", () => {
  it("swaps in updated copies by id, keeping the order and the traveller's picks", () => {
    useTripStore.getState().setSelectedRestaurantIds(["b"]);
    const before = useTripStore.getState().trip.updatedAt;
    useTripStore.getState().replaceRestaurants("i1", [rest("b", 8.8)]);
    const latest = useTripStore.getState().trip.itineraries[0];
    expect(latest.restaurants?.map((r) => [r.id, r.rating])).toEqual([["a", 9], ["b", 8.8]]);
    expect(latest.selections?.restaurantIds).toEqual(["b"]);
    expect(useTripStore.getState().trip.updatedAt >= before).toBe(true);
  });

  it("ignores ids the itinerary doesn't have", () => {
    useTripStore.getState().replaceRestaurants("i1", [rest("zzz", 1)]);
    expect(useTripStore.getState().trip.itineraries[0].restaurants?.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("replaceActivities", () => {
  it("swaps in updated activity copies by id, keeping the traveller's picks", () => {
    const act = (id: string, rating: number) => ({ id, name: id, rating, location: "Lisbon" });
    useTripStore.getState().replaceActivities("i1", []);
    useTripStore.setState((s) => ({ trip: { ...s.trip, itineraries: [{ ...s.trip.itineraries[0], activities: [act("m", 9), act("n", 8)] } as GeneratedItinerary] } }));
    useTripStore.getState().setSelectedActivityIds(["n"]);
    useTripStore.getState().replaceActivities("i1", [act("n", 9.2) as never]);
    const latest = useTripStore.getState().trip.itineraries[0];
    expect(latest.activities.map((a) => [a.id, a.rating])).toEqual([["m", 9], ["n", 9.2]]);
    expect(latest.selections?.activityIds).toEqual(["n"]);
  });
});

describe("replaceHotels", () => {
  const hotel = (id: string, rating: number) => ({ id, name: id, rating, location: "Lisbon", city: "Lisbon" }) as unknown as HotelOption;

  it("updates a hotel wherever it's kept — the list, the city's chosen hotel, and the Lodging pick", () => {
    useTripStore.setState((s) => ({ trip: { ...s.trip, itineraries: [{ ...s.trip.itineraries[0], hotels: [hotel("h", 8), hotel("x", 7)] } as GeneratedItinerary] } }));
    useTripStore.getState().setSelectedHotelForCity("Lisbon", hotel("h", 8));
    useTripStore.setState((s) => ({ trip: { ...s.trip, preferences: { ...s.trip.preferences, lodgingPick: hotel("h", 8) } } }));

    useTripStore.getState().replaceHotels("i1", [hotel("h", 9.2)]);

    const { trip } = useTripStore.getState();
    expect(trip.itineraries[0].hotels.map((h) => [h.id, h.rating])).toEqual([["h", 9.2], ["x", 7]]);
    expect(trip.itineraries[0].selections?.hotelsByCity?.Lisbon.rating).toBe(9.2);
    expect(trip.preferences.lodgingPick?.rating).toBe(9.2);
  });

  it("updates just the Lodging pick when there's no itinerary yet", () => {
    useTripStore.getState().resetTrip();
    useTripStore.setState((s) => ({ trip: { ...s.trip, preferences: { ...s.trip.preferences, lodgingPick: hotel("p", 8) } } }));
    useTripStore.getState().replaceHotels(null, [hotel("p", 8.6)]);
    expect(useTripStore.getState().trip.preferences.lodgingPick?.rating).toBe(8.6);
  });
});
