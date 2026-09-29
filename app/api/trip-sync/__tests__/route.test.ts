// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const { mockCookieStore, mockDevice } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
  mockDevice: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("next/headers", () => ({
  cookies: async () => mockCookieStore,
}));
vi.mock("@/lib/db", () => ({ prisma: { device: mockDevice } }));

import { GET, PUT, DELETE } from "@/app/api/trip-sync/route";
import { SCHEMA_VERSION } from "@/lib/sync/schema";
import { DEVICE_COOKIE_MAX_AGE_S } from "@/lib/sync/retention";

const now = "2026-09-28T12:00:00.000Z";
function trip(id: string) {
  return {
    id, name: "T", preferences: { activities: [], activityRankings: {}, vibes: [], transportation: [] },
    currentStep: "destination", completedSteps: [], itineraries: [], createdAt: now, updatedAt: now,
  };
}
// Already in the current schema, so it's stored exactly as sent.
const blob = { schemaVersion: SCHEMA_VERSION, trip: trip("t1"), savedTrips: [], chatMessages: [], progress: 0 };

beforeEach(() => {
  vi.clearAllMocks();
});

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/trip-sync", {
    method: "PUT",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("GET /api/trip-sync", () => {
  it("returns null data, version 0, and sets a fresh cookie when no device exists yet", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    mockDevice.findUnique.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({ data: null, version: 0 });
    expect(res.cookies.get("zimmgo-device")?.value).toBeTruthy();
  });

  it("hides database errors from the client", async () => {
    mockCookieStore.get.mockReturnValue({ value: "device-1" });
    mockDevice.findUnique.mockRejectedValue(new Error("Can't reach database server at ep-secret-host.neon.tech:5432"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Something went wrong on our side — please try again.");
    expect(JSON.stringify(body)).not.toContain("neon.tech");
  });

  it("returns the stored blob and its version, and renews the same device cookie so an active traveller's never lapses", async () => {
    mockCookieStore.get.mockReturnValue({ value: "device-1" });
    mockDevice.findUnique.mockResolvedValue({ id: "device-1", data: blob, version: 7 });

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({ data: blob, version: 7 });
    const cookie = res.cookies.get("zimmgo-device");
    expect(cookie?.value).toBe("device-1");
    expect(cookie?.maxAge).toBe(DEVICE_COOKIE_MAX_AGE_S);
  });
});

describe("DELETE /api/trip-sync", () => {
  it("deletes this device's synced trips and forgets its cookie", async () => {
    mockCookieStore.get.mockReturnValue({ value: "device-1" });
    mockDevice.deleteMany.mockResolvedValue({ count: 1 });

    const res = await DELETE(new NextRequest("http://localhost/api/trip-sync", { method: "DELETE" }));

    expect(await res.json()).toEqual({ ok: true, deleted: true });
    expect(mockDevice.deleteMany).toHaveBeenCalledWith({ where: { id: "device-1" } });
    expect(res.cookies.get("zimmgo-device")?.maxAge).toBe(0);
  });

  it("succeeds with nothing to delete when the device never synced", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const res = await DELETE(new NextRequest("http://localhost/api/trip-sync", { method: "DELETE" }));

    expect(await res.json()).toEqual({ ok: true, deleted: false });
    expect(mockDevice.deleteMany).not.toHaveBeenCalled();
  });
});

describe("PUT /api/trip-sync", () => {
  beforeEach(() => {
    mockCookieStore.get.mockReturnValue({ value: "device-1" });
  });

  it("applies the write when baseVersion matches, and returns the incremented version", async () => {
    mockDevice.updateMany.mockResolvedValue({ count: 1 });

    const res = await PUT(putRequest({ baseVersion: 3, data: blob }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: 4 });
    expect(mockDevice.updateMany).toHaveBeenCalledWith({
      where: { id: "device-1", version: 3 },
      data: { data: blob, version: { increment: 1 } },
    });
  });

  it("rejects a stale write with 409 and the current server copy, without overwriting it", async () => {
    const newer = { ...blob, trip: { ...trip("t1"), name: "Newer" } };
    mockDevice.updateMany.mockResolvedValue({ count: 0 });
    mockDevice.findUnique.mockResolvedValue({ id: "device-1", data: newer, version: 5 });

    const res = await PUT(putRequest({ baseVersion: 3, data: blob }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "conflict", data: newer, version: 5 });
    expect(mockDevice.create).not.toHaveBeenCalled();
  });

  it("creates the row at version 1 when the device has never saved before", async () => {
    mockDevice.updateMany.mockResolvedValue({ count: 0 });
    mockDevice.findUnique.mockResolvedValue(null);
    mockDevice.create.mockResolvedValue({});

    const res = await PUT(putRequest({ baseVersion: 0, data: blob }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: 1 });
    expect(mockDevice.create).toHaveBeenCalledWith({ data: { id: "device-1", data: blob, version: 1 } });
  });

  it("treats losing a create race to another tab as a conflict", async () => {
    const winner = { ...blob, trip: { ...trip("t1"), name: "Other tab" } };
    mockDevice.updateMany.mockResolvedValue({ count: 0 });
    mockDevice.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "device-1", data: winner, version: 1 });
    mockDevice.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "5.22.0" })
    );

    const res = await PUT(putRequest({ baseVersion: 0, data: blob }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "conflict", data: winner, version: 1 });
  });

  it("rejects a payload that isn't a valid sync blob, without touching the database", async () => {
    const res = await PUT(putRequest({ baseVersion: 0, data: { trip: "nope" } }));

    expect(res.status).toBe(400);
    expect(mockDevice.updateMany).not.toHaveBeenCalled();
  });

  it("upgrades a payload from a tab still running older code before storing it", async () => {
    mockDevice.updateMany.mockResolvedValue({ count: 1 });
    // Pre-versioning shape: no schemaVersion, missing preference arrays, a
    // step id that no longer exists, and a stale progress figure.
    const old = {
      trip: { ...trip("t1"), preferences: {}, completedSteps: ["destination", "retiredStep"] },
      savedTrips: [], chatMessages: [], progress: 99,
    };

    const res = await PUT(putRequest({ baseVersion: 3, data: old }));

    expect(res.status).toBe(200);
    const stored = mockDevice.updateMany.mock.calls[0][0].data.data;
    expect(stored.schemaVersion).toBe(SCHEMA_VERSION);
    expect(stored.trip.preferences).toEqual({ activities: [], activityRankings: {}, vibes: [], transportation: [] });
    expect(stored.trip.completedSteps).toEqual(["destination"]);
    expect(stored.progress).not.toBe(99);
  });

  it("refuses a payload from a newer schema than this server understands, without touching the database", async () => {
    const res = await PUT(putRequest({ baseVersion: 3, data: { ...blob, schemaVersion: SCHEMA_VERSION + 1 } }));

    expect(res.status).toBe(422);
    expect(mockDevice.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a missing or malformed baseVersion", async () => {
    for (const baseVersion of [undefined, -1, 1.5, "3"]) {
      const res = await PUT(putRequest({ baseVersion, data: blob }));
      expect(res.status).toBe(400);
    }
    expect(mockDevice.updateMany).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON", async () => {
    const res = await PUT(putRequest("{not json"));
    expect(res.status).toBe(400);
  });

  it("rejects an oversized payload with 413", async () => {
    const huge = { ...blob, chatMessages: [{ content: "x".repeat(2_100_000) }] };
    const res = await PUT(putRequest({ baseVersion: 0, data: huge }));

    expect(res.status).toBe(413);
    expect(mockDevice.updateMany).not.toHaveBeenCalled();
  });

  it("returns 400 with no device cookie, without touching the database", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const res = await PUT(putRequest({ baseVersion: 0, data: blob }));

    expect(res.status).toBe(400);
    expect(mockDevice.updateMany).not.toHaveBeenCalled();
  });
});
