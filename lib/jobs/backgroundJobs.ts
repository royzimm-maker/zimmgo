import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logServerError, toPublicError } from "@/lib/http/errors";

// Background jobs — itinerary generation and auto-plan today — kept in the
// BackgroundJob table so the client can poll them and resume after a refresh.
// Each caller namespaces its own request keys (e.g. "autoplan:<id>").

// A job still "running" this long after its last update can't still be alive
// — the functions' maxDuration (150s) has passed — so it's reported as failed
// instead of leaving the client polling forever.
export const STALE_AFTER_MS = 180_000;

// How long a job's own work may run: the job routes' maxDuration (150s) less
// headroom to save the result. AI calls are budgeted against this deadline
// (lib/ai/client.ts withinDeadline), so running out of time fails the job
// with a clear message instead of the platform killing it mid-call.
export const JOB_TIME_BUDGET_MS = 130_000;
const KEEP_JOBS_MS = 86_400_000;

export interface JobView {
  jobId: string;
  status: "running" | "done" | "error";
  stage: string | null;
  result: unknown;
  error: string | null;
}

type JobRow = NonNullable<Awaited<ReturnType<typeof prisma.backgroundJob.findUnique>>>;

function view(job: JobRow): JobView {
  return {
    jobId: job.id,
    status: job.status as JobView["status"],
    stage: job.stage,
    result: job.result ?? null,
    error: job.error,
  };
}

export async function findJobByKey(requestKey: string): Promise<JobView | null> {
  const job = await prisma.backgroundJob.findUnique({ where: { requestKey } });
  return job ? view(job) : null;
}

// Creates the job row, or returns the existing one if another request with
// the same key got there first. `created` tells the caller whether it owns
// running the job.
export async function createJob(requestKey: string): Promise<{ job: JobView; created: boolean }> {
  prisma.backgroundJob
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_JOBS_MS) } } })
    .catch(() => {});
  try {
    const job = await prisma.backgroundJob.create({
      data: { requestKey, status: "running", stage: "Starting…" },
    });
    return { job: view(job), created: true };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await findJobByKey(requestKey);
      if (existing) return { job: existing, created: false };
    }
    throw error;
  }
}

export type JobWork = (onStage: (stage: string) => Promise<void>, deadline: number) => Promise<unknown>;

// Runs `work` to completion, recording each progress stage and then the
// result (or the failure) on the job row. Never throws. The traveller polls
// this row, so a failure is stored as a safe message — the full error is
// logged with a reference.
export async function executeJob(jobId: string, work: JobWork): Promise<void> {
  const deadline = Date.now() + JOB_TIME_BUDGET_MS;
  try {
    const result = await work(async (stage) => {
      await prisma.backgroundJob.update({ where: { id: jobId }, data: { stage } }).catch(() => {});
    }, deadline);
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: "done", stage: null, result: result as Prisma.InputJsonValue },
    });
  } catch (error: unknown) {
    logServerError(`job ${jobId}`, error);
    const { message } = toPublicError(error);
    await prisma.backgroundJob
      .update({ where: { id: jobId }, data: { status: "error", error: message } })
      .catch(() => {});
  }
}

export async function getJob(jobId: string): Promise<JobView | null> {
  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job) return null;
  if (job.status === "running" && Date.now() - job.updatedAt.getTime() > STALE_AFTER_MS) {
    const message = "This stopped before finishing — please try again.";
    await prisma.backgroundJob
      .update({ where: { id: jobId }, data: { status: "error", error: message } })
      .catch(() => {});
    return { ...view(job), status: "error", error: message };
  }
  return view(job);
}
