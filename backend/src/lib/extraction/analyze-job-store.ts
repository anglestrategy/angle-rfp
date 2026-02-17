import { analyzeRfpInput, type AnalyzeRfpInput, type ExtractedRfpDataV1 } from "@/lib/extraction/analyze-rfp";

export type AnalyzeJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface AnalyzeJobStateV1 {
  analysisId: string;
  status: AnalyzeJobStatus;
  stage: "queued" | "extracting" | "completed" | "failed";
  progress: number;
  warnings: string[];
  errorMessage: string | null;
  startedAt: string;
  updatedAt: string;
}

interface AnalyzeJobRecord {
  analysisId: string;
  status: AnalyzeJobStatus;
  stage: AnalyzeJobStateV1["stage"];
  progress: number;
  warnings: string[];
  errorMessage: string | null;
  result: ExtractedRfpDataV1 | null;
  startedAtMs: number;
  updatedAtMs: number;
}

function positiveMsFromEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

const jobs = new Map<string, AnalyzeJobRecord>();
const MAX_JOBS = 400;
const TTL_MS = 4 * 60 * 60 * 1000;
const STALE_INFLIGHT_MS = positiveMsFromEnv(process.env.ANALYZE_JOB_STALE_MS, 90 * 1000);
const MAX_RUNTIME_MS = positiveMsFromEnv(process.env.ANALYZE_JOB_MAX_RUNTIME_MS, 25 * 60 * 1000);
const ANALYZE_JOB_TIMEOUT_MS = positiveMsFromEnv(process.env.ANALYZE_JOB_TIMEOUT_MS, 12 * 60 * 1000);

function nowIso(): string {
  return new Date().toISOString();
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(value, 1));
}

function pruneExpired(nowMs = Date.now()): void {
  for (const [analysisId, job] of jobs.entries()) {
    if (nowMs - job.updatedAtMs > TTL_MS) {
      jobs.delete(analysisId);
    }
  }
}

function markStaleInflightJobs(nowMs = Date.now()): void {
  for (const [analysisId, job] of jobs.entries()) {
    const inflight = job.status === "queued" || job.status === "running";
    if (!inflight) {
      continue;
    }

    const staleHeartbeat = nowMs - job.updatedAtMs > STALE_INFLIGHT_MS;
    const exceededRuntime = nowMs - job.startedAtMs > MAX_RUNTIME_MS;
    if (!staleHeartbeat && !exceededRuntime) {
      continue;
    }

    jobs.set(analysisId, {
      ...job,
      status: "failed",
      stage: "failed",
      progress: 1,
      errorMessage: exceededRuntime
        ? "Analysis timed out on backend runtime budget."
        : "Analysis job stalled and was aborted.",
      updatedAtMs: nowMs
    });
  }
}

function pruneOverflow(): void {
  if (jobs.size <= MAX_JOBS) {
    return;
  }

  const ordered = Array.from(jobs.entries()).sort((a, b) => a[1].updatedAtMs - b[1].updatedAtMs);
  const overflow = jobs.size - MAX_JOBS;
  for (let i = 0; i < overflow; i += 1) {
    jobs.delete(ordered[i][0]);
  }
}

function toPublicState(job: AnalyzeJobRecord): AnalyzeJobStateV1 {
  const nowMs = Date.now();
  const syntheticProgress = (() => {
    if (job.status !== "running") {
      return clampProgress(job.progress);
    }
    // Keep frontend progress moving even if a long upstream call temporarily blocks heartbeat ticks.
    const elapsedMs = Math.max(0, nowMs - job.startedAtMs);
    const expected = Math.min(0.92, (elapsedMs / Math.max(ANALYZE_JOB_TIMEOUT_MS, 1)) * 0.92);
    return clampProgress(Math.max(job.progress, expected));
  })();

  return {
    analysisId: job.analysisId,
    status: job.status,
    stage: job.stage,
    progress: syntheticProgress,
    warnings: job.warnings,
    errorMessage: job.errorMessage,
    startedAt: new Date(job.startedAtMs).toISOString(),
    updatedAt: new Date(job.updatedAtMs).toISOString()
  };
}

function updateJob(
  analysisId: string,
  patch: Partial<Pick<AnalyzeJobRecord, "status" | "stage" | "progress" | "warnings" | "errorMessage" | "result">>
): AnalyzeJobRecord | null {
  const existing = jobs.get(analysisId);
  if (!existing) {
    return null;
  }

  const updated: AnalyzeJobRecord = {
    ...existing,
    ...patch,
    progress: patch.progress !== undefined ? clampProgress(patch.progress) : existing.progress,
    updatedAtMs: Date.now()
  };
  jobs.set(analysisId, updated);
  return updated;
}

async function withJobTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  const safeTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : 20 * 60 * 1000;

  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Analysis job timed out after ${Math.round(safeTimeout / 1000)}s`));
    }, safeTimeout);

    operation
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function runAnalyzeJob(analysisId: string, parsedDocument: AnalyzeRfpInput["parsedDocument"]): Promise<void> {
  updateJob(analysisId, {
    status: "running",
    stage: "extracting",
    progress: 0,
    errorMessage: null
  });

  const heartbeat = setInterval(() => {
    const state = jobs.get(analysisId);
    if (!state || state.status !== "running") {
      return;
    }
    const nextProgress = Math.min(0.92, state.progress + 0.015);
    updateJob(analysisId, { progress: nextProgress });
  }, 2000);

  try {
    const extracted = await withJobTimeout(
      analyzeRfpInput({
        analysisId,
        parsedDocument
      }),
      ANALYZE_JOB_TIMEOUT_MS
    );

    clearInterval(heartbeat);
    updateJob(analysisId, {
      status: "succeeded",
      stage: "completed",
      progress: 1,
      warnings: extracted.warnings,
      errorMessage: null,
      result: extracted
    });
  } catch (error: unknown) {
    clearInterval(heartbeat);
    const message = error instanceof Error ? error.message : String(error);
    updateJob(analysisId, {
      status: "failed",
      stage: "failed",
      progress: 1,
      errorMessage: message
    });
  }
}

export function startAnalyzeJob(params: {
  analysisId: string;
  parsedDocument: AnalyzeRfpInput["parsedDocument"];
}): AnalyzeJobStateV1 {
  const nowMs = Date.now();
  pruneExpired(nowMs);
  markStaleInflightJobs(nowMs);

  const existing = jobs.get(params.analysisId);
  if (existing) {
    if (existing.status === "queued" || existing.status === "running") {
      return toPublicState(existing);
    }
  }

  const created: AnalyzeJobRecord = {
    analysisId: params.analysisId,
    status: "queued",
    stage: "queued",
    progress: 0,
    warnings: [],
    errorMessage: null,
    result: null,
    startedAtMs: nowMs,
    updatedAtMs: nowMs
  };
  jobs.set(params.analysisId, created);
  pruneOverflow();

  void runAnalyzeJob(params.analysisId, params.parsedDocument);
  return toPublicState(created);
}

export function getAnalyzeJobState(analysisId: string): AnalyzeJobStateV1 | null {
  pruneExpired();
  markStaleInflightJobs();
  const job = jobs.get(analysisId);
  return job ? toPublicState(job) : null;
}

export function getAnalyzeJobResult(analysisId: string): ExtractedRfpDataV1 | null {
  pruneExpired();
  markStaleInflightJobs();
  const job = jobs.get(analysisId);
  if (!job || job.status !== "succeeded") {
    return null;
  }
  return job.result;
}
