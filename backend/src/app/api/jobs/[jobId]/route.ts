import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope } from "@/lib/api/envelope";
import { makeError, normalizeUnknownError } from "@/lib/api/errors";
import { getJob } from "@/lib/jobs/job-store";
import type { JobStatusResponse } from "@/lib/jobs/types";

/**
 * GET /api/jobs/:jobId
 *
 * Polling endpoint. Returns the current stage, progress (0–1),
 * human-readable stageLabel, warnings, and — once completed —
 * the full stage results.
 *
 * Recommended polling interval: 2 seconds.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const context = buildRequestContext(request);

  try {
    const { jobId } = await params;

    if (!jobId) {
      throw makeError(400, "validation_error", "jobId is required", "jobs", {
        retryable: false
      });
    }

    const job = getJob(jobId);
    if (!job) {
      throw makeError(404, "validation_error", `Job not found: ${jobId}`, "jobs", {
        retryable: false
      });
    }

    const isTerminal = job.stage === "completed" || job.stage === "failed";

    const response: JobStatusResponse = {
      jobId: job.jobId,
      analysisId: job.analysisId,
      stage: job.stage,
      stageLabel: job.stageLabel,
      progress: job.progress,
      createdAt: new Date(job.createdAt).toISOString(),
      updatedAt: new Date(job.updatedAt).toISOString(),
      warnings: job.warnings,
      error: job.error,
      // Only include full results once the job reaches a terminal state.
      // In-progress jobs return null to keep poll responses small.
      results: isTerminal ? job.results : null
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    const normalized = normalizeUnknownError(error, "jobs");
    return errorEnvelope(context, normalized);
  }
}
