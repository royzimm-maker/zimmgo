import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Background jobs (itinerary generation, auto-plan) kept in the GenerationJob
// table so the client can poll them and resume after a refresh.

// A job still "running" this long after its last update can't still be alive
// — the functions' maxDuration (150s) has passed — so it's reported as failed
// instead of leaving the client polling forever.
export const STALE_AFTER_MS = 180_000;
const KEEP_JOBS_MS = 86_400_000;

export interface JobView {
  jobId: string;
  status: "running" | "done" | "error";
  stage: string | null;
  result: unknown;
  error: string | null;
}

type JobRow = NonNullable<Awaited<ReturnType<typeof prisma.generationJob.findUnique>>>;

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
  const job = await prisma.generationJob.findUnique({ where: { requestKey } });
  return job ? view(job) : null;
}

// Creates the job row, or returns the existing one if another request with
// the same key got there first. `created` tells the caller whether it owns
// running the job.
export async function createJob(requestKey: string): Promise<{ job: JobView; created: boolean }> {
  prisma.generationJob
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_JOBS_MS) } } })
    .catch(() => {});
  try {
    const job = await prisma.generationJob.create({
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

export type JobWork = (onStage: (stage: string) => Promise<void>) => Promise<unknown>;

// Runs `work` to completion, recording each progress stage and then the
// result (or the failure) on the job row. Never throws.
export async function executeJob(jobId: string, work: JobWork): Promise<void> {
  try {
    const result = await work(async (stage) => {
      await prisma.generationJob.update({ where: { id: jobId }, data: { stage } }).catch(() => {});
    });
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "done", stage: null, result: result as Prisma.InputJsonValue },
    });
  } catch (error: unknown) {
    console.error("[job]", jobId, error);
    const message = error instanceof Error ? error.message : "Something went wrong";
    await prisma.generationJob
      .update({ where: { id: jobId }, data: { status: "error", error: message } })
      .catch(() => {});
  }
}

export async function getJob(jobId: string): Promise<JobView | null> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) return null;
  if (job.status === "running" && Date.now() - job.updatedAt.getTime() > STALE_AFTER_MS) {
    const message = "This stopped before finishing — please try again.";
    await prisma.generationJob
      .update({ where: { id: jobId }, data: { status: "error", error: message } })
      .catch(() => {});
    return { ...view(job), status: "error", error: message };
  }
  return view(job);
}
