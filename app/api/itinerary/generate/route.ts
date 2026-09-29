import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { rateLimit } from "@/lib/rateLimit";
import { readJsonBody } from "@/lib/api/readJsonBody";
import { createJob, executeJob, findJobByKey, getJob } from "@/lib/itinerary/generationJobs";
import { runGeneration } from "@/lib/itinerary/runGeneration";
import type { TripPreferences } from "@/types/trip";

// Generation is an agentic loop of up to 8 Anthropic round trips — often
// 60–90s. Rather than holding one request open for all of it (a dropped
// connection or refresh used to throw the work away and bill a whole new
// run), POST starts a background job and returns at once; the client polls
// GET for progress and the result. waitUntil keeps the work running after
// the response, still bounded by this maxDuration (Fluid Compute allows up
// to 300s on Hobby).
export const maxDuration = 150;

interface StartBody {
  requestId: string;
  tripId: string;
  preferences: TripPreferences;
}

// POST is idempotent per requestId: the client mints one id per generation
// intent and reuses it to resume after a refresh, so repeating the call never
// starts (or bills) a second run.
export async function POST(request: NextRequest) {
  try {
    const parsed = await readJsonBody<StartBody>(request, 100_000);
    if (!parsed.ok) return parsed.response;
    const { requestId, tripId, preferences } = parsed.body;

    if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) {
      return NextResponse.json({ error: "A valid requestId is required" }, { status: 400 });
    }
    if (!preferences?.destination) {
      return NextResponse.json({ error: "Destination is required" }, { status: 400 });
    }

    const existing = await findJobByKey(requestId);
    if (existing) return NextResponse.json({ jobId: existing.jobId, status: existing.status });

    // Only new runs count against the limit — resuming an existing job is free.
    const limited = await rateLimit(request, { bucket: "itinerary-generate", limit: 8, windowMs: 10 * 60_000 });
    if (limited) return limited;

    const { job, created } = await createJob(requestId);
    if (created) {
      waitUntil(executeJob(job.jobId, (onStage) => runGeneration(String(tripId ?? ""), preferences, onStage)));
    }
    return NextResponse.json({ jobId: job.jobId, status: job.status }, { status: created ? 202 : 200 });
  } catch (error: unknown) {
    console.error("[itinerary/generate POST]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId");
    if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

    const job = await getJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json(job, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    console.error("[itinerary/generate GET]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
