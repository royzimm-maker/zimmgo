import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/http/errors";
import { waitUntil } from "@vercel/functions";
import { rateLimit } from "@/lib/rateLimit";
import { checkListLimits, readJsonBody } from "@/lib/http/readJsonBody";
import { createJob, executeJob, findJobByKey, getJob } from "@/lib/jobs/backgroundJobs";
import { runSmartPick } from "@/lib/ai/smartPick";
import { autoPlanTrip } from "@/lib/planning/autoPlanTrip";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

// "Let ZiGy plan my whole trip" runs as a background job, like generation:
// several smart-picks per city (cities in parallel) are too long and too
// costly to hold in one request or to lose to a refresh. POST starts it and
// returns at once; the client polls GET.
export const maxDuration = 150;

interface StartBody {
  requestId: string;
  itinerary: GeneratedItinerary;
  preferences: TripPreferences;
}

// Namespaced so auto-plan and generation request ids can never collide in
// the shared job table.
const jobKey = (requestId: string) => `autoplan:${requestId}`;

export async function POST(request: NextRequest) {
  try {
    const parsed = await readJsonBody<StartBody>(request, 500_000);
    if (!parsed.ok) return parsed.response;
    const { requestId, itinerary, preferences } = parsed.body;

    if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) {
      return NextResponse.json({ error: "A valid requestId is required" }, { status: 400 });
    }
    if (!itinerary || !Array.isArray(itinerary.days) || !preferences) {
      return NextResponse.json({ error: "An itinerary and preferences are required" }, { status: 400 });
    }
    // Every item ends up in a smart-pick prompt.
    const oversized = checkListLimits(itinerary, ["days", "hotels", "activities", "restaurants"]);
    if (oversized) return oversized;

    const existing = await findJobByKey(jobKey(requestId));
    if (existing) return NextResponse.json({ jobId: existing.jobId, status: existing.status });

    // Only new runs count against the limit — resuming an existing job is free.
    const limited = await rateLimit(request, { bucket: "auto-plan", limit: 8, windowMs: 10 * 60_000 });
    if (limited) return limited;

    const { job, created } = await createJob(jobKey(requestId));
    if (created) {
      const normalized = { ...itinerary, hotels: itinerary.hotels ?? [], activities: itinerary.activities ?? [] };
      waitUntil(executeJob(job.jobId, (onStage, deadline) =>
        autoPlanTrip(normalized, preferences, (body) => runSmartPick(body, deadline), onStage)));
    }
    return NextResponse.json({ jobId: job.jobId, status: job.status }, { status: created ? 202 : 200 });
  } catch (error: unknown) {
    return serverError("itinerary/auto-plan POST", error);
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
    return serverError("itinerary/auto-plan GET", error);
  }
}
