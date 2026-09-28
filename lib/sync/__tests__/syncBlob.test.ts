import { describe, it, expect } from "vitest";
import { isSyncBlob, mergeSyncBlobs, stableStringify, type SyncBlob } from "@/lib/sync/syncBlob";
import type { Trip } from "@/types/trip";

function trip(id: string, updatedAt: string, name = id, completedSteps: Trip["completedSteps"] = []): Trip {
  return {
    id, name, preferences: { activities: [], activityRankings: {}, vibes: [], transportation: [] },
    currentStep: "destination", completedSteps, itineraries: [], createdAt: updatedAt, updatedAt,
  };
}
function blob(active: Trip, saved: Trip[] = [], extra: Partial<SyncBlob> = {}): SyncBlob {
  return { trip: active, savedTrips: saved, chatMessages: [], progress: 0, ...extra };
}

const T1 = "2026-09-01T00:00:00.000Z";
const T2 = "2026-09-02T00:00:00.000Z";

describe("mergeSyncBlobs", () => {
  it("keeps the newer copy of each trip, so edits to different trips in two tabs both survive", () => {
    const local = blob(trip("a", T2, "A edited here"), [trip("b", T1, "B old")]);
    const server = blob(trip("b", T2, "B edited elsewhere"), [trip("a", T1, "A old")]);

    const merged = mergeSyncBlobs(local, server);

    expect(merged.trip.name).toBe("A edited here");
    expect(merged.savedTrips.map((t) => t.name)).toEqual(["B edited elsewhere"]);
  });

  it("keeps this tab's active trip even when the server copy of it is newer", () => {
    const local = blob(trip("a", T1, "A stale"));
    const server = blob(trip("a", T2, "A newer"));

    const merged = mergeSyncBlobs(local, server);

    expect(merged.trip.id).toBe("a");
    expect(merged.trip.name).toBe("A newer");
    expect(merged.savedTrips).toEqual([]);
  });

  it("brings in trips only the server knows about", () => {
    const local = blob(trip("a", T1));
    const server = blob(trip("c", T1), [trip("d", T1)]);

    const merged = mergeSyncBlobs(local, server);

    expect(merged.trip.id).toBe("a");
    expect(merged.savedTrips.map((t) => t.id).sort()).toEqual(["c", "d"]);
  });

  it("keeps the local copy on a timestamp tie", () => {
    const merged = mergeSyncBlobs(blob(trip("a", T1, "local")), blob(trip("a", T1, "server")));
    expect(merged.trip.name).toBe("local");
  });

  it("recomputes progress from the resolved active trip", () => {
    const local = blob(trip("a", T1), [], { progress: 0 });
    const server = blob(trip("a", T2, "a", ["destination", "dates"]));

    expect(mergeSyncBlobs(local, server).progress).toBeGreaterThan(0);
  });

  it("keeps local chat and device defaults, falling back to the server's when unset locally", () => {
    const local = blob(trip("a", T1), [], { defaultCurrency: "EUR" });
    const server = blob(trip("a", T1), [], { defaultCurrency: "USD", defaultDepartureAirport: "BOS" });

    const merged = mergeSyncBlobs(local, server);

    expect(merged.defaultCurrency).toBe("EUR");
    expect(merged.defaultDepartureAirport).toBe("BOS");
  });
});

describe("isSyncBlob", () => {
  it("accepts a well-formed blob", () => {
    expect(isSyncBlob(blob(trip("a", T1), [trip("b", T1)]))).toBe(true);
  });

  it("rejects malformed blobs", () => {
    expect(isSyncBlob(null)).toBe(false);
    expect(isSyncBlob({})).toBe(false);
    expect(isSyncBlob({ ...blob(trip("a", T1)), trip: { id: "a" } })).toBe(false);
    expect(isSyncBlob({ ...blob(trip("a", T1)), savedTrips: [{}] })).toBe(false);
    expect(isSyncBlob({ ...blob(trip("a", T1)), progress: "0" })).toBe(false);
  });
});

describe("stableStringify", () => {
  it("is independent of key order, like Postgres jsonb round-trips", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } }))
      .toBe(stableStringify({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }));
  });

  it("ignores undefined properties, matching JSON.stringify", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });
});
