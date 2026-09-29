import { extractApiErrorMessage } from "@/lib/utils";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

// The job this browser is currently waiting on, kept outside the synced trip
// store — it's device-local bookkeeping, not trip data. Surviving a refresh
// is the point: on reload the Itinerary step resumes polling this job
// instead of starting (and paying for) a new generation.
const PENDING_KEY = "zimmgo-pending-generation";

export interface PendingGeneration {
  requestId: string;
  jobId: string;
  tripId: string;
}

export function loadPendingGeneration(): PendingGeneration | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingGeneration) : null;
  } catch {
    return null;
  }
}

function savePendingGeneration(p: PendingGeneration) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    // storage unavailable — generation still works, just won't survive a refresh
  }
}

export function clearPendingGeneration() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

export const POLL_INTERVAL_MS = 2_500;
const MAX_WAIT_MS = 5 * 60_000;
const MAX_CONSECUTIVE_POLL_FAILURES = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function startGeneration(tripId: string, preferences: TripPreferences): Promise<PendingGeneration> {
  const requestId = crypto.randomUUID();
  const res = await fetch("/api/itinerary/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, tripId, preferences }),
  });
  if (!res.ok) throw new Error(extractApiErrorMessage(await res.text()));
  const { jobId } = (await res.json()) as { jobId: string };
  const pending = { requestId, jobId, tripId };
  savePendingGeneration(pending);
  return pending;
}

// Polls until the job finishes. Transient network failures are tolerated
// (the job keeps running server-side regardless); only a job error, an
// expired job, or a long run of failed polls ends the wait.
export async function waitForGeneration(
  jobId: string,
  onStage: (stage: string | null) => void
): Promise<GeneratedItinerary> {
  const deadline = Date.now() + MAX_WAIT_MS;
  let failures = 0;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`/api/itinerary/generate?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
      if (res.status === 404) throw new Error("That generation has expired — please try again.");
      if (res.ok) {
        failures = 0;
        const job = (await res.json()) as { status: string; stage: string | null; result: GeneratedItinerary | null; error: string | null };
        if (job.status === "done" && job.result) return job.result;
        if (job.status === "error") throw new Error(job.error ?? "Generation failed — please try again.");
        onStage(job.stage);
      } else if (++failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        throw new Error(extractApiErrorMessage(await res.text()));
      }
    } catch (error) {
      if (!(error instanceof TypeError)) throw error; // TypeError = network blip
      if (++failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        throw new Error("Lost connection while building your itinerary — please try again.");
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("Building your itinerary is taking longer than expected — please try again.");
}
