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
  autoPlanTrip: vi.fn(),
  runSmartPick: vi.fn(),
}));
vi.mock("@/lib/jobs/backgroundJobs", () => ({
  findJobByKey: m.findJobByKey, createJob: m.createJob, executeJob: m.executeJob, getJob: m.getJob,
}));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@vercel/functions", () => ({ waitUntil: m.waitUntil }));
vi.mock("@/lib/planning/autoPlanTrip", () => ({ autoPlanTrip: m.autoPlanTrip }));
vi.mock("@/lib/ai/smartPick", () => ({ runSmartPick: m.runSmartPick }));

import { POST, GET } from "@/app/api/itinerary/auto-plan/route";

const prefs = { activities: [], activityRankings: {}, vibes: [], transportation: [] };
const itinerary = { id: "itin-1", days: [{ dayNumber: 1, location: "Rome" }], hotels: [], activities: [], restaurants: [] };
function post(body: unknown) {
  return new NextRequest("http://localhost/api/itinerary/auto-plan", {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });
}
const running = { jobId: "job-1", status: "running", stage: null, result: null, error: null };

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockResolvedValue(null);
});

describe("POST /api/itinerary/auto-plan", () => {
  it("starts a background auto-plan job that calls the AI directly", async () => {
    m.findJobByKey.mockResolvedValue(null);
    m.createJob.mockResolvedValue({ job: running, created: true });

    const res = await POST(post({ requestId: "req-12345678", itinerary, preferences: prefs }));

    expect(res.status).toBe(202);
    expect(m.createJob).toHaveBeenCalledWith("autoplan:req-12345678");
    expect(m.waitUntil).toHaveBeenCalledTimes(1);
    const onStage = vi.fn();
    await m.executeJob.mock.calls[0][1](onStage, 12345);
    expect(m.autoPlanTrip).toHaveBeenCalledWith(expect.objectContaining({ id: "itin-1" }), prefs, expect.any(Function), onStage);
    // Each pick is budgeted against the job's deadline.
    const pick = m.autoPlanTrip.mock.calls[0][2];
    await pick({ kind: "hotel" });
    expect(m.runSmartPick).toHaveBeenCalledWith({ kind: "hotel" }, 12345);
  });

  it("resumes an existing job without rate-limiting or re-running it", async () => {
    m.findJobByKey.mockResolvedValue({ ...running, status: "done" });

    const res = await POST(post({ requestId: "req-12345678", itinerary, preferences: prefs }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ jobId: "job-1", status: "done" });
    expect(m.rateLimit).not.toHaveBeenCalled();
    expect(m.executeJob).not.toHaveBeenCalled();
  });

  it("applies its own rate limit to new runs", async () => {
    m.findJobByKey.mockResolvedValue(null);
    m.rateLimit.mockResolvedValue(new Response("{}", { status: 429 }));

    const res = await POST(post({ requestId: "req-12345678", itinerary, preferences: prefs }));

    expect(res.status).toBe(429);
    expect(m.rateLimit.mock.calls[0][1]).toMatchObject({ bucket: "auto-plan" });
    expect(m.createJob).not.toHaveBeenCalled();
  });

  it("rejects a bad requestId, a missing itinerary, or oversized lists", async () => {
    for (const body of [
      { requestId: "short", itinerary, preferences: prefs },
      { requestId: "req-12345678", preferences: prefs },
      { requestId: "req-12345678", itinerary: { ...itinerary, activities: Array.from({ length: 151 }, () => ({})) }, preferences: prefs },
    ]) {
      expect((await POST(post(body))).status).toBe(400);
    }
    expect(m.createJob).not.toHaveBeenCalled();
  });
});

describe("GET /api/itinerary/auto-plan", () => {
  it("returns the job, or 404 when unknown", async () => {
    m.getJob.mockResolvedValueOnce(running).mockResolvedValueOnce(null);
    expect(await (await GET(new NextRequest("http://localhost/api/itinerary/auto-plan?jobId=job-1"))).json()).toEqual(running);
    expect((await GET(new NextRequest("http://localhost/api/itinerary/auto-plan?jobId=nope"))).status).toBe(404);
  });
});
