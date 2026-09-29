import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { TripSyncProvider } from "@/components/TripSyncProvider";
import { useTripStore } from "@/lib/store/tripStore";
import { SCHEMA_VERSION } from "@/lib/sync/schema";
import { calcProgress, type Trip } from "@/types/trip";

function trip(id: string, updatedAt: string, opts: Partial<Trip> = {}): Trip {
  return {
    id, name: id, preferences: { activities: [], activityRankings: {}, vibes: [], transportation: [] },
    currentStep: "destination", completedSteps: [], itineraries: [], createdAt: updatedAt, updatedAt, ...opts,
  };
}
const T1 = "2026-09-01T00:00:00.000Z";
const T2 = "2026-09-02T00:00:00.000Z";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

type Call = [string, RequestInit | undefined];
function puts(fetchMock: ReturnType<typeof vi.fn>) {
  return (fetchMock.mock.calls as Call[])
    .filter(([, init]) => init?.method === "PUT")
    .map(([, init]) => JSON.parse(String(init!.body)));
}
function gets(fetchMock: ReturnType<typeof vi.fn>) {
  return (fetchMock.mock.calls as Call[]).filter(([, init]) => !init?.method);
}

function setLocal(t: Trip, savedTrips: Trip[] = []) {
  useTripStore.setState({ trip: t, savedTrips, chatMessages: [], progress: 0 });
}

beforeEach(() => {
  vi.useFakeTimers();
  setLocal(trip("blank", T1));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("TripSyncProvider — hydration safety", () => {
  it("never writes to the server while the initial GET keeps failing", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return json({ ok: true, version: 1 });
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TripSyncProvider><div /></TripSyncProvider>);
    await act(async () => {
      setLocal(trip("blank", T2, { completedSteps: ["destination"] }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(gets(fetchMock)).toHaveLength(4); // every retry attempted
    expect(puts(fetchMock)).toHaveLength(0);
  });

  it("restores the server copy after a transient GET failure instead of overwriting it with an empty local trip", async () => {
    // The cleared-cache case: local is a blank new trip, the server holds
    // real work, and the first GET happens to fail.
    const saved = trip("real", T2, { name: "Lisbon", completedSteps: ["destination", "dates"] });
    const serverBlob = { schemaVersion: SCHEMA_VERSION, trip: saved, savedTrips: [], chatMessages: [], progress: calcProgress(["destination", "dates"]) };
    let attempts = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return json({ ok: true, version: 4 });
      attempts += 1;
      if (attempts === 1) throw new TypeError("Failed to fetch");
      return json({ data: serverBlob, version: 3 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TripSyncProvider><div /></TripSyncProvider>);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(useTripStore.getState().trip.name).toBe("Lisbon");
    expect(puts(fetchMock)).toHaveLength(0); // content already matches the server
  });

  it("keeps a freshly started trip active instead of reviving the one it shelved", async () => {
    // "Start a fresh trip" (the crash-recovery escape hatch) shelved `broken`
    // and reloaded before the debounced save reached the server, which still
    // has `broken` as the active trip.
    const broken = trip("broken", T2, { name: "Crashes", completedSteps: ["destination", "dates"] });
    setLocal(trip("fresh", T1), [broken]);
    const serverBlob = { schemaVersion: SCHEMA_VERSION, trip: broken, savedTrips: [], chatMessages: [], progress: calcProgress(broken.completedSteps) };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? json({ ok: true, version: 4 }) : json({ data: serverBlob, version: 3 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<TripSyncProvider><div /></TripSyncProvider>);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(useTripStore.getState().trip.id).toBe("fresh");
    expect(useTripStore.getState().savedTrips.map((t) => t.id)).toEqual(["broken"]);
    const [written] = puts(fetchMock);
    expect(written.data.trip.id).toBe("fresh"); // the server now has the fresh trip active too
  });

  it("retries hydration when the window regains focus after all attempts failed", async () => {
    let online = false;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return json({ ok: true, version: 1 });
      if (!online) throw new TypeError("Failed to fetch");
      return json({ data: null, version: 0 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TripSyncProvider><div /></TripSyncProvider>);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(gets(fetchMock)).toHaveLength(4);

    online = true;
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      setLocal(trip("blank", T2, { completedSteps: ["destination"] }));
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(gets(fetchMock)).toHaveLength(5);
    expect(puts(fetchMock)).toHaveLength(1);
  });
});

describe("TripSyncProvider — schema versions", () => {
  it("upgrades a server copy saved before versioning, and rewrites it once in the current schema", async () => {
    const saved = trip("real", T2, { name: "Lisbon", completedSteps: ["destination"] });
    const oldBlob = { trip: { ...saved, preferences: {} }, savedTrips: [], chatMessages: [], progress: 0 };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? json({ ok: true, version: 2 }) : json({ data: oldBlob, version: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<TripSyncProvider><div /></TripSyncProvider>);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(useTripStore.getState().trip.name).toBe("Lisbon");
    expect(useTripStore.getState().trip.preferences.vibes).toEqual([]); // repaired
    const written = puts(fetchMock);
    expect(written).toHaveLength(1);
    expect(written[0].data.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("never overwrites a server copy saved by newer code, even after local edits", async () => {
    setLocal(trip("mine", T1, { completedSteps: ["destination"] }));
    const newer = { schemaVersion: SCHEMA_VERSION + 1, trip: trip("theirs", T2), savedTrips: [], chatMessages: [], progress: 0 };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? json({ ok: true, version: 2 }) : json({ data: newer, version: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<TripSyncProvider><div /></TripSyncProvider>);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      setLocal(trip("mine", T2, { completedSteps: ["destination", "dates"] }));
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(puts(fetchMock)).toHaveLength(0);
    expect(gets(fetchMock)).toHaveLength(1); // no re-hydration either
    expect(useTripStore.getState().trip.id).toBe("mine"); // not hydrated from a shape it can't read
  });

  it("stops pushing when the server says this tab's schema is newer than it supports", async () => {
    setLocal(trip("mine", T1, { completedSteps: ["destination"] }));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? json({ error: "Unsupported schema version" }, 422) : json({ data: null, version: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<TripSyncProvider><div /></TripSyncProvider>);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      setLocal(trip("mine", T2, { completedSteps: ["destination", "dates"] }));
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(puts(fetchMock)).toHaveLength(1); // no retry loop
  });
});

describe("TripSyncProvider — failed saves", () => {
  it("doesn't keep resending content the server refused as too large", async () => {
    setLocal(trip("mine", T1, { completedSteps: ["destination"] }));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? json({ error: "Payload too large" }, 413) : json({ data: null, version: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<TripSyncProvider><div /></TripSyncProvider>);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });
    expect(puts(fetchMock)).toHaveLength(1); // no 10-second retry loop

    // A real change is tried again — it might fit now.
    await act(async () => {
      setLocal(trip("mine", T2, { completedSteps: ["destination", "dates"] }));
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(puts(fetchMock)).toHaveLength(2);
  });

  it("backs off exponentially on server errors instead of retrying every 10 seconds", async () => {
    setLocal(trip("mine", T1, { completedSteps: ["destination"] }));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? json({ error: "db down" }, 500) : json({ data: null, version: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<TripSyncProvider><div /></TripSyncProvider>);
    // First attempt at ~1.5s, then retries after 10s, 20s, 40s, 80s → 5 PUTs by ~152s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(155_000);
    });
    expect(puts(fetchMock)).toHaveLength(5);
    // A fixed 10-second retry would have made ~16 by now.
  });
});

describe("TripSyncProvider — write conflicts", () => {
  it("sends its base version, and on a 409 merges the other tab's trips and retries on the new version", async () => {
    setLocal(trip("a", T2, { completedSteps: ["destination"] }));
    const otherTab = { trip: trip("b", T2, { name: "Other tab's trip" }), savedTrips: [], chatMessages: [], progress: 0 };
    let putCount = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== "PUT") return json({ data: null, version: 0 });
      putCount += 1;
      if (putCount === 1) return json({ error: "conflict", data: otherTab, version: 4 }, 409);
      return json({ ok: true, version: 5 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TripSyncProvider><div /></TripSyncProvider>);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    const [first, second] = puts(fetchMock);
    expect(first.baseVersion).toBe(0);
    expect(second.baseVersion).toBe(4);
    expect(second.data.trip.id).toBe("a");
    expect(second.data.savedTrips.map((t: Trip) => t.id)).toEqual(["b"]);
    expect(useTripStore.getState().savedTrips.map((t) => t.id)).toEqual(["b"]);
  });
});
