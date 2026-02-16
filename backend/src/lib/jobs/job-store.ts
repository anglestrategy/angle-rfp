import type { Job, JobStage, JobStageResults } from "@/lib/jobs/types";
import { STAGE_LABELS, progressForStage } from "@/lib/jobs/types";

/**
 * In-memory job store backed by a Map.
 *
 * Design notes:
 * - Suitable for single-process deployments and local dev.
 * - Interface is intentionally minimal so it can be swapped for
 *   Redis/KV (Vercel KV, Upstash) or a database without touching callers.
 * - Completed/failed jobs auto-expire after JOB_TTL_MS to prevent
 *   unbounded memory growth.
 */

/** How long completed/failed jobs stay in memory before cleanup. */
const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

/** How often the cleanup sweep runs. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const store = new Map<string, Job>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer(): void {
  if (cleanupTimer !== null) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, job] of store) {
      const isTerminal = job.stage === "completed" || job.stage === "failed";
      if (isTerminal && now - job.updatedAt > JOB_TTL_MS) {
        store.delete(id);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow Node.js to exit even if the timer is still running.
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

/** Generate a short random job ID. */
export function generateJobId(): string {
  return `job_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/** Create a new job and add it to the store. */
export function createJob(params: {
  jobId: string;
  analysisId: string;
  fileName: string;
  mimeType: string;
  fileBytes: Buffer;
}): Job {
  ensureCleanupTimer();

  const now = Date.now();
  const job: Job = {
    jobId: params.jobId,
    analysisId: params.analysisId,
    stage: "queued",
    stageLabel: STAGE_LABELS.queued,
    progress: 0,
    createdAt: now,
    updatedAt: now,
    file: {
      name: params.fileName,
      mimeType: params.mimeType,
      bytes: params.fileBytes
    },
    warnings: [],
    results: {},
    error: null
  };

  store.set(params.jobId, job);
  return job;
}

/** Retrieve a job by ID (returns null if expired or not found). */
export function getJob(jobId: string): Job | null {
  return store.get(jobId) ?? null;
}

/** Advance a job to the next pipeline stage. */
export function advanceJob(jobId: string, stage: JobStage): void {
  const job = store.get(jobId);
  if (!job) return;

  job.stage = stage;
  job.stageLabel = STAGE_LABELS[stage];
  job.progress = progressForStage(stage);
  job.updatedAt = Date.now();
}

/** Append stage results after a stage completes successfully. */
export function setStageResults(jobId: string, results: Partial<JobStageResults>): void {
  const job = store.get(jobId);
  if (!job) return;

  Object.assign(job.results, results);
  job.updatedAt = Date.now();
}

/** Append warnings to the job. */
export function appendWarnings(jobId: string, warnings: string[]): void {
  const job = store.get(jobId);
  if (!job || warnings.length === 0) return;

  job.warnings.push(...warnings);
  job.updatedAt = Date.now();
}

/** Mark the job as completed and release the file bytes from memory. */
export function completeJob(jobId: string): void {
  const job = store.get(jobId);
  if (!job) return;

  job.stage = "completed";
  job.stageLabel = STAGE_LABELS.completed;
  job.progress = 1;
  job.file = null; // Release memory
  job.updatedAt = Date.now();
}

/** Mark the job as failed with error details. */
export function failJob(
  jobId: string,
  error: { code: string; message: string; stage: string; retryable: boolean }
): void {
  const job = store.get(jobId);
  if (!job) return;

  job.stage = "failed";
  job.stageLabel = STAGE_LABELS.failed;
  job.error = error;
  job.file = null; // Release memory
  job.updatedAt = Date.now();
}

/** Number of jobs currently in the store (useful for health/metrics). */
export function jobCount(): number {
  return store.size;
}

/**
 * Reset the store (for testing only).
 * @internal
 */
export function _resetForTesting(): void {
  store.clear();
  if (cleanupTimer !== null) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
