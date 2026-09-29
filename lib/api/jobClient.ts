import { extractApiErrorMessage } from "@/lib/utils";

// Client side of the server's background jobs (generation, auto-plan): start a
// job, remember it in localStorage so a refresh resumes it instead of starting
// (and paying for) a new run, and poll it to completion.

export interface PendingJob {
  requestId: string;
  jobId: string;
  tripId: string;
}

// The job this browser is waiting on is kept outside the synced trip store —
// it's device-local bookkeeping, not trip data.
export function pendingJobStore<T extends PendingJob>(key: string) {
  return {
    load(): T | null {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    save(p: T) {
      try {
        localStorage.setItem(key, JSON.stringify(p));
      } catch {
        // storage unavailable — the job still works, just won't survive a refresh
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

export async function startJob(endpoint: string, body: Record<string, unknown>): Promise<{ requestId: string; jobId: string }> {
  const requestId = crypto.randomUUID();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, ...body }),
  });
  if (!res.ok) throw new Error(extractApiErrorMessage(await res.text()));
  const { jobId } = (await res.json()) as { jobId: string };
  return { requestId, jobId };
}

export const POLL_INTERVAL_MS = 2_500;
const MAX_WAIT_MS = 5 * 60_000;
const MAX_CONSECUTIVE_POLL_FAILURES = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Polls until the job finishes. Transient network failures are tolerated
// (the job keeps running server-side regardless); only a job error, an
// expired job, or a long run of failed polls ends the wait. `what` names the
// work in user-facing messages, e.g. "building your itinerary".
export async function waitForJob<T>(
  endpoint: string,
  jobId: string,
  onStage: (stage: string | null) => void,
  what: string
): Promise<T> {
  const deadline = Date.now() + MAX_WAIT_MS;
  let failures = 0;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${endpoint}?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
      if (res.status === 404) throw new Error("That request has expired — please try again.");
      if (res.ok) {
        failures = 0;
        const job = (await res.json()) as { status: string; stage: string | null; result: T | null; error: string | null };
        if (job.status === "done" && job.result) return job.result;
        if (job.status === "error") throw new Error(job.error ?? "Something went wrong — please try again.");
        onStage(job.stage);
      } else if (++failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        throw new Error(extractApiErrorMessage(await res.text()));
      }
    } catch (error) {
      if (!(error instanceof TypeError)) throw error; // TypeError = network blip
      if (++failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        throw new Error(`Lost connection while ${what} — please try again.`);
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`${what[0].toUpperCase()}${what.slice(1)} is taking longer than expected — please try again.`);
}
