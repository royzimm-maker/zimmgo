import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTripStore } from "@/lib/store/tripStore";
import { safeLocalStorage } from "@/lib/store/safeStorage";
import { MAX_CHAT_MESSAGES, SCHEMA_VERSION, migratePersistedState } from "@/lib/sync/schema";
import type { SyncBlob } from "@/lib/sync/syncBlob";
import type { GeneratedItinerary } from "@/types/trip";

const itin = (id: string) => ({ id, tripId: "t", version: 1, createdAt: "", days: [], flights: [], hotels: [], activities: [] }) as unknown as GeneratedItinerary;
const msg = (i: number) => ({ id: `m${i}`, role: "user", content: `message ${i}`, createdAt: "" });

beforeEach(() => {
  useTripStore.getState().resetTrip();
  useTripStore.setState({ chatMessages: [] });
});
afterEach(() => vi.restoreAllMocks());

describe("saved trip size stays bounded", () => {
  it("keeps only the latest itinerary when regenerating", () => {
    const { addItinerary } = useTripStore.getState();
    addItinerary(itin("v1"));
    addItinerary(itin("v2"));
    addItinerary(itin("v3"));
    expect(useTripStore.getState().trip.itineraries.map((i) => i.id)).toEqual(["v3"]);
  });

  it("keeps only the most recent chat messages", () => {
    const { addMessage } = useTripStore.getState();
    for (let i = 0; i < MAX_CHAT_MESSAGES + 5; i++) addMessage({ role: "user", content: `message ${i}` });
    const chat = useTripStore.getState().chatMessages;
    expect(chat).toHaveLength(MAX_CHAT_MESSAGES);
    expect(chat[chat.length - 1].content).toBe(`message ${MAX_CHAT_MESSAGES + 4}`);
    expect(chat[0].content).toBe("message 5");
  });

  it("trims data saved before the limit existed (schema v1 → v2)", () => {
    const trip = (id: string) => ({
      id, name: id, preferences: {}, currentStep: "itinerary", completedSteps: ["destination"],
      itineraries: [itin(`${id}-old`), itin(`${id}-older`), itin(`${id}-latest`)], createdAt: "", updatedAt: "",
    });
    const v1 = { trip: trip("a"), savedTrips: [trip("b")], chatMessages: Array.from({ length: 250 }, (_, i) => msg(i)), progress: 0 };

    const s = migratePersistedState(v1, 1) as unknown as SyncBlob;

    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(2);
    expect(s.trip.itineraries.map((i: { id: string }) => i.id)).toEqual(["a-latest"]);
    expect(s.savedTrips[0].itineraries.map((i: { id: string }) => i.id)).toEqual(["b-latest"]);
    expect(s.chatMessages).toHaveLength(MAX_CHAT_MESSAGES);
    expect(s.chatMessages[0].id).toBe("m150");
  });
});

describe("full browser storage", () => {
  it("doesn't make store actions throw when localStorage is full", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => useTripStore.getState().setTripName("Still works")).not.toThrow();
    expect(useTripStore.getState().trip.name).toBe("Still works"); // kept in memory, still syncs
  });

  it("reads as empty rather than throwing when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Access denied", "SecurityError");
    });
    expect(safeLocalStorage.getItem("zimmgo-trip")).toBeNull();
  });
});
