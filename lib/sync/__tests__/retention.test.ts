// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { deleteMany } = vi.hoisted(() => ({ deleteMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { device: { deleteMany } } }));

import { sweepInactiveDevices, DEVICE_RETENTION_DAYS, DEVICE_COOKIE_MAX_AGE_S } from "@/lib/sync/retention";

beforeEach(() => {
  vi.clearAllMocks();
  deleteMany.mockResolvedValue({ count: 0 });
});

describe("device retention", () => {
  it("deletes only devices unchanged for longer than the retention period", async () => {
    const before = Date.now();
    await sweepInactiveDevices(1);

    const cutoff: Date = deleteMany.mock.calls[0][0].where.updatedAt.lt;
    const ageMs = before - cutoff.getTime();
    expect(ageMs).toBeGreaterThanOrEqual(DEVICE_RETENTION_DAYS * 86_400_000 - 1_000);
    expect(ageMs).toBeLessThanOrEqual(DEVICE_RETENTION_DAYS * 86_400_000 + 1_000);
  });

  it("runs on only a sample of requests", () => {
    expect(sweepInactiveDevices(0)).toBeUndefined();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("never throws into the request that triggered it", async () => {
    deleteMany.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sweepInactiveDevices(1)).resolves.toBeUndefined();
  });

  it("keeps the device cookie exactly as long as the data", () => {
    expect(DEVICE_COOKIE_MAX_AGE_S).toBe(DEVICE_RETENTION_DAYS * 86_400);
  });
});
