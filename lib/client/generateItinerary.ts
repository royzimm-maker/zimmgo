import { pendingJobStore, startJob, waitForJob, type PendingJob } from "@/lib/client/jobClient";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

export { POLL_INTERVAL_MS } from "@/lib/client/jobClient";

const ENDPOINT = "/api/itinerary/generate";
// On reload the Itinerary step resumes polling this job instead of starting
// (and paying for) a new generation.
const pending = pendingJobStore<PendingGeneration>("zimmgo-pending-generation");

export type PendingGeneration = PendingJob;

export const loadPendingGeneration = pending.load;
export const clearPendingGeneration = pending.clear;

export async function startGeneration(tripId: string, preferences: TripPreferences): Promise<PendingGeneration> {
  const { requestId, jobId } = await startJob(ENDPOINT, { tripId, preferences });
  const p = { requestId, jobId, tripId };
  pending.save(p);
  return p;
}

export function waitForGeneration(jobId: string, onStage: (stage: string | null) => void): Promise<GeneratedItinerary> {
  return waitForJob<GeneratedItinerary>(ENDPOINT, jobId, onStage, "building your itinerary");
}
