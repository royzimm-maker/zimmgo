// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  findJobByKey: vi.fn(),
  createJob: vi.fn(),
  executeJob: vi.fn(),
  getJob: vi.fn(),
  rateLimit: vi.fn(),
  waitUntil: vi.fn(),
  runGeneration: vi.fn(),
}));
vi.mock("@/lib/itinerary/runGeneration", () => ({ runGeneration: m.runGeneration }));
vi.mock("@/lib/itinerary/generationJobs", () => ({
  findJobByKey: m.findJobByKey, createJob: m.createJob, executeJob: m.executeJob, getJob: m.getJob,
}));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@vercel/functions", () => ({ waitUntil: m.waitUntil }));

import { POST, GET } from "@/app/api/itinerary/generate/route";

const prefs = { activities: [], activityRankings: {}, vibes: [], transportation: [], destination: { cities: ["Lisbon"], displayName: "Lisbon" } };
function post(body: unknown) {
  return new NextRequest("http://localhost/api/itinerary/generate", {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });
}
const running = { jobId: "job-1", status: "running", stage: "Starting…", result: null, error: null };

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockResolvedValue(null);
  m.executeJob.mockResolvedValue(undefined);
});

describe("POST /api/itinerary/generate", () => {
  it("starts a new background job and returns its id immediately", async () => {
    m.findJobByKey.mockResolvedValue(null);
    m.createJob.mockResolvedValue({ job: running, created: true });

    const res = await POST(post({ requestId: "req-12345678", tripId: "t1", preferences: prefs }));

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ jobId: "job-1", status: "running" });
    expect(m.executeJob).toHaveBeenCalledWith("job-1", expect.any(Function));
    expect(m.waitUntil).toHaveBeenCalledTimes(1);
    // The job's work is this trip's generation, reporting stages as it goes.
    const onStage = vi.fn();
    await m.executeJob.mock.calls[0][1](onStage, 12345);
    // …budgeted against the job's deadline.
    expect(m.runGeneration).toHaveBeenCalledWith("t1", prefs, onStage, 12345);
  });

  it("returns the existing job for a repeated requestId without starting, billing, or rate-limiting a new run", async () => {
    m.findJobByKey.mockResolvedValue({ ...running, status: "done" });

    const res = await POST(post({ requestId: "req-12345678", tripId: "t1", preferences: prefs }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ jobId: "job-1", status: "done" });
    expect(m.createJob).not.toHaveBeenCalled();
    expect(m.executeJob).not.toHaveBeenCalled();
    expect(m.rateLimit).not.toHaveBeenCalled();
  });

  it("doesn't run the job twice when a concurrent request created it first", async () => {
    m.findJobByKey.mockResolvedValue(null);
    m.createJob.mockResolvedValue({ job: running, created: false });

    const res = await POST(post({ requestId: "req-12345678", tripId: "t1", preferences: prefs }));

    expect(res.status).toBe(200);
    expect(m.executeJob).not.toHaveBeenCalled();
  });

  it("applies the rate limit to new runs", async () => {
    m.findJobByKey.mockResolvedValue(null);
    m.rateLimit.mockResolvedValue(new Response("{}", { status: 429 }));

    const res = await POST(post({ requestId: "req-12345678", tripId: "t1", preferences: prefs }));

    expect(res.status).toBe(429);
    expect(m.createJob).not.toHaveBeenCalled();
  });

  it("rejects a missing or malformed requestId", async () => {
    for (const requestId of [undefined, "short", "has spaces in it!", "x".repeat(101)]) {
      const res = await POST(post({ requestId, tripId: "t1", preferences: prefs }));
      expect(res.status).toBe(400);
    }
    expect(m.createJob).not.toHaveBeenCalled();
  });

  it("requires a destination", async () => {
    const res = await POST(post({ requestId: "req-12345678", tripId: "t1", preferences: { ...prefs, destination: undefined } }));
    expect(res.status).toBe(400);
  });

  it("rejects an oversized request before touching anything", async () => {
    const res = await POST(post({ requestId: "req-12345678", tripId: "t1", preferences: { ...prefs, pad: "x".repeat(150_000) } }));
    expect(res.status).toBe(413);
    expect(m.findJobByKey).not.toHaveBeenCalled();
  });
});

describe("GET /api/itinerary/generate", () => {
  it("returns the job's current state", async () => {
    m.getJob.mockResolvedValue(running);
    const res = await GET(new NextRequest("http://localhost/api/itinerary/generate?jobId=job-1"));
    expect(await res.json()).toEqual(running);
    expect(m.getJob).toHaveBeenCalledWith("job-1");
  });

  it("returns 404 for an unknown job", async () => {
    m.getJob.mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/itinerary/generate?jobId=nope"));
    expect(res.status).toBe(404);
  });

  it("requires a jobId", async () => {
    const res = await GET(new NextRequest("http://localhost/api/itinerary/generate"));
    expect(res.status).toBe(400);
  });
});
