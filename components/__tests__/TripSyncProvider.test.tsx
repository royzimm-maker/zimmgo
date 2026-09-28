import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { TripSyncProvider } from "@/components/TripSyncProvider";
import { useTripStore } from "@/lib/store/tripStore";
import type { Trip } from "@/types/trip";

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
    const serverBlob = { trip: saved, savedTrips: [], chatMessages: [], progress: 20 };
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
