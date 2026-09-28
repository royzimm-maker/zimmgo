// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const { mockCookieStore, mockDevice } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
  mockDevice: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
}));
vi.mock("next/headers", () => ({
  cookies: () => mockCookieStore,
}));
vi.mock("@/lib/db", () => ({ prisma: { device: mockDevice } }));

import { GET, PUT } from "@/app/api/trip-sync/route";

const now = "2026-09-28T12:00:00.000Z";
function trip(id: string) {
  return { id, name: "T", preferences: {}, currentStep: "destination", completedSteps: [], itineraries: [], createdAt: now, updatedAt: now };
}
const blob = { trip: trip("t1"), savedTrips: [], chatMessages: [], progress: 0 };

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

  it("returns the stored blob and its version for an existing device, without re-setting its cookie", async () => {
    mockCookieStore.get.mockReturnValue({ value: "device-1" });
    mockDevice.findUnique.mockResolvedValue({ id: "device-1", data: blob, version: 7 });

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({ data: blob, version: 7 });
    expect(res.cookies.get("zimmgo-device")).toBeUndefined();
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
