// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockCookieStore, mockDevice } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
  mockDevice: { findUnique: vi.fn(), upsert: vi.fn() },
}));
vi.mock("next/headers", () => ({
  cookies: () => mockCookieStore,
}));
vi.mock("@/lib/db", () => ({ prisma: { device: mockDevice } }));

import { GET, PUT } from "@/app/api/trip-sync/route";

beforeEach(() => {
  vi.clearAllMocks();
});

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/trip-sync", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("GET /api/trip-sync", () => {
  it("returns null data and sets a fresh cookie when no device exists yet", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    mockDevice.findUnique.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({ data: null });
    expect(res.cookies.get("zimmgo-device")?.value).toBeTruthy();
  });

  it("returns the stored blob for an existing device, without re-setting its cookie", async () => {
    mockCookieStore.get.mockReturnValue({ value: "device-1" });
    mockDevice.findUnique.mockResolvedValue({ id: "device-1", data: { trip: { id: "t1" } } });

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({ data: { trip: { id: "t1" } } });
    expect(mockDevice.findUnique).toHaveBeenCalledWith({ where: { id: "device-1" } });
    expect(res.cookies.get("zimmgo-device")).toBeUndefined();
  });
});

describe("PUT /api/trip-sync", () => {
  it("upserts the blob keyed by the existing device cookie", async () => {
    mockCookieStore.get.mockReturnValue({ value: "device-1" });
    mockDevice.upsert.mockResolvedValue({});

    const res = await PUT(putRequest({ trip: { id: "t1" } }));
    const body = await res.json();

    expect(body).toEqual({ ok: true });
    expect(mockDevice.upsert).toHaveBeenCalledWith({
      where: { id: "device-1" },
      create: { id: "device-1", data: { trip: { id: "t1" } } },
      update: { data: { trip: { id: "t1" } } },
    });
  });

  it("returns 400 with no device cookie, without touching the database", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const res = await PUT(putRequest({ trip: {} }));

    expect(res.status).toBe(400);
    expect(mockDevice.upsert).not.toHaveBeenCalled();
  });
});
