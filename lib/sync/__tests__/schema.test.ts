import { describe, it, expect } from "vitest";
import { SCHEMA_VERSION, migratePersistedState, migrateSyncBlob } from "@/lib/sync/schema";
import type { SyncBlob } from "@/lib/sync/syncBlob";
import { useTripStore } from "@/lib/store/tripStore";

const now = "2026-09-28T12:00:00.000Z";
// What a browser saved before versioning existed: fields added since are
// missing, and one completed step no longer exists.
function v0State() {
  return {
    trip: {
      id: "t1", name: "Lisbon", preferences: { destination: { cities: ["Lisbon"], displayName: "Lisbon" } },
      currentStep: "retiredStep", completedSteps: ["destination", "retiredStep"],
      itineraries: [{ id: "i1", days: [{ dayNumber: 1 }] }],
      createdAt: now, updatedAt: now,
    },
    progress: 77,
  };
}

describe("migratePersistedState", () => {
  it("repairs pre-versioning state to the current shape without losing data", () => {
    const s = migratePersistedState(v0State(), 0) as unknown as SyncBlob;

    expect(s.trip.name).toBe("Lisbon");
    expect(s.trip.preferences.destination?.displayName).toBe("Lisbon");
    expect(s.trip.preferences).toMatchObject({ activities: [], activityRankings: {}, vibes: [], transportation: [] });
    expect(s.trip.completedSteps).toEqual(["destination"]);
    expect(s.trip.currentStep).toBe("destination");
    expect(s.trip.itineraries[0]).toMatchObject({ id: "i1", days: [{ dayNumber: 1 }], flights: [], hotels: [], activities: [] });
    expect(s.savedTrips).toEqual([]);
    expect(s.chatMessages).toEqual([]);
    expect(s.progress).not.toBe(77); // recomputed from completedSteps
  });

  it("gives trips missing timestamps the oldest possible time, so they never win a sync merge", () => {
    const state = v0State();
    delete (state.trip as Partial<typeof state.trip>).updatedAt;
    const s = migratePersistedState(state, 0) as unknown as SyncBlob;
    expect(Date.parse(s.trip.updatedAt)).toBe(0);
  });

  it("drops unreadable trips but keeps the readable ones", () => {
    const s = migratePersistedState({ trip: "garbage", savedTrips: [v0State().trip, { nope: true }] }, 0) as unknown as SyncBlob;
    expect(s.trip).toBeUndefined(); // the store falls back to a fresh trip
    expect(s.savedTrips.map((t: { id: string }) => t.id)).toEqual(["t1"]);
  });

  it("leaves state from a newer version untouched rather than guessing at it", () => {
    const future = { trip: { id: "t1", someNewShape: true } };
    expect(migratePersistedState(future, SCHEMA_VERSION + 1)).toBe(future);
  });

  it("is a no-op for data already in the current shape", () => {
    const once = migratePersistedState(v0State(), 0);
    expect(migratePersistedState(once, SCHEMA_VERSION)).toEqual(once);
  });
});

describe("migrateSyncBlob", () => {
  it("upgrades an unversioned blob and stamps the current version", () => {
    const r = migrateSyncBlob(v0State());
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.blob.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("reports a blob from newer code instead of migrating it", () => {
    expect(migrateSyncBlob({ ...v0State(), schemaVersion: SCHEMA_VERSION + 1 })).toEqual({
      status: "too-new", schemaVersion: SCHEMA_VERSION + 1,
    });
  });

  it("rejects things that aren't a trip blob at all", () => {
    for (const raw of [null, "x", [], { trip: "nope" }]) expect(migrateSyncBlob(raw).status).toBe("invalid");
  });
});

describe("tripStore persistence", () => {
  it("upgrades a pre-versioning localStorage entry on load", async () => {
    localStorage.setItem("zimmgo-trip", JSON.stringify({ state: v0State(), version: 0 }));

    await useTripStore.persist.rehydrate();

    const { trip } = useTripStore.getState();
    expect(trip.id).toBe("t1");
    expect(trip.preferences.vibes).toEqual([]);
    expect(trip.completedSteps).toEqual(["destination"]);
    expect(JSON.parse(localStorage.getItem("zimmgo-trip")!).version).toBe(SCHEMA_VERSION);
    localStorage.removeItem("zimmgo-trip");
  });
});
