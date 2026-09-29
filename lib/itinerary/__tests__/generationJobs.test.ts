// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: { generationJob: { create: m.create, findUnique: m.findUnique, update: m.update, deleteMany: m.deleteMany } },
}));

import { createJob, executeJob, getJob, STALE_AFTER_MS } from "@/lib/itinerary/generationJobs";

function row(over: Record<string, unknown> = {}) {
  return { id: "job-1", requestKey: "req-1", status: "running", stage: "Starting…", result: null, error: null,
    createdAt: new Date(), updatedAt: new Date(), ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.deleteMany.mockResolvedValue({ count: 0 });
  m.update.mockResolvedValue({});
});

describe("createJob", () => {
  it("creates a running job the caller owns", async () => {
    m.create.mockResolvedValue(row());
    const { job, created } = await createJob("req-1");
    expect(created).toBe(true);
    expect(job.status).toBe("running");
  });

  it("returns the existing job, not owned, when the same key was created concurrently", async () => {
    m.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "5.22.0" }));
    m.findUnique.mockResolvedValue(row({ status: "done" }));
    const { job, created } = await createJob("req-1");
    expect(created).toBe(false);
    expect(job.status).toBe("done");
  });
});

describe("executeJob", () => {
  it("records each progress stage, then the result", async () => {
    await executeJob("job-1", async (onStage) => {
      await onStage("Finding hotels that fit your trip…");
      return { id: "itin-1" };
    });

    expect(m.update).toHaveBeenCalledWith({ where: { id: "job-1" }, data: { stage: "Finding hotels that fit your trip…" } });
    expect(m.update).toHaveBeenLastCalledWith({ where: { id: "job-1" }, data: { status: "done", stage: null, result: { id: "itin-1" } } });
  });

  it("records a failure instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(executeJob("job-1", () => Promise.reject(new Error("API key is invalid")))).resolves.toBeUndefined();
    expect(m.update).toHaveBeenLastCalledWith({ where: { id: "job-1" }, data: { status: "error", error: "API key is invalid" } });
  });
});

describe("getJob", () => {
  it("reports a running job that stopped updating past maxDuration as failed", async () => {
    m.findUnique.mockResolvedValue(row({ updatedAt: new Date(Date.now() - STALE_AFTER_MS - 1_000) }));

    const job = await getJob("job-1");

    expect(job?.status).toBe("error");
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "error" }) }));
  });

  it("leaves a recently-updated running job alone", async () => {
    m.findUnique.mockResolvedValue(row());
    expect((await getJob("job-1"))?.status).toBe("running");
    expect(m.update).not.toHaveBeenCalled();
  });

  it("returns null for an unknown job", async () => {
    m.findUnique.mockResolvedValue(null);
    expect(await getJob("nope")).toBeNull();
  });
});
