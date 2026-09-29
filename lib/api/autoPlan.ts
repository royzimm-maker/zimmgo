import { pendingJobStore, startJob, waitForJob, type PendingJob } from "@/lib/api/jobClient";
import type { AutoPlanResult } from "@/lib/planning/autoPlanTrip";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

const ENDPOINT = "/api/itinerary/auto-plan";
// On reload the Itinerary step resumes polling this job instead of starting
// (and paying for) a new auto-plan run.
const pending = pendingJobStore<PendingAutoPlan>("zimmgo-pending-autoplan");

export interface PendingAutoPlan extends PendingJob {
  itineraryId: string;
}

export const loadPendingAutoPlan = pending.load;
export const clearPendingAutoPlan = pending.clear;

export async function startAutoPlan(
  tripId: string,
  itinerary: GeneratedItinerary,
  preferences: TripPreferences
): Promise<PendingAutoPlan> {
  const { requestId, jobId } = await startJob(ENDPOINT, { itinerary, preferences });
  const p = { requestId, jobId, tripId, itineraryId: itinerary.id };
  pending.save(p);
  return p;
}

export function waitForAutoPlan(jobId: string, onStage: (stage: string | null) => void): Promise<AutoPlanResult> {
  return waitForJob<AutoPlanResult>(ENDPOINT, jobId, onStage, "planning your trip");
}
