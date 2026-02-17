import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope } from "@/lib/api/envelope";
import { makeError, normalizeUnknownError } from "@/lib/api/errors";
import { parseBearerToken } from "@/lib/security/auth";
import { createJob, generateJobId } from "@/lib/jobs/job-store";
import { processJob } from "@/lib/jobs/job-processor";

/**
 * POST /api/jobs
 *
 * Accepts a multipart form with:
 *   - file: The RFP document (PDF, DOCX, or TXT)
 *   - analysisId: Unique ID for this analysis run
 *
 * Returns { jobId, status: "queued" } immediately.
 * The client should poll GET /api/jobs/:jobId for progress.
 */
export async function POST(request: NextRequest) {
  const context = buildRequestContext(request);

  try {
    const form = await request.formData();
    const analysisId = String(form.get("analysisId") ?? "").trim();
    const maybeFile = form.get("file");

    if (!analysisId) {
      throw makeError(400, "validation_error", "analysisId is required", "jobs", {
        retryable: false,
        details: { field: "analysisId" }
      });
    }

    if (!(maybeFile instanceof File)) {
      throw makeError(400, "validation_error", "file is required", "jobs", {
        retryable: false,
        details: { field: "file" }
      });
    }

    const principal = parseBearerToken(request.headers.get("authorization")) ?? "anonymous";
    const fileBytes = Buffer.from(await maybeFile.arrayBuffer());
    const jobId = generateJobId();

    createJob({
      jobId,
      analysisId,
      fileName: maybeFile.name,
      mimeType: maybeFile.type,
      fileBytes
    });

    // Fire-and-forget: start processing without blocking the response.
    // In Node.js / long-running servers this runs to completion.
    // On Vercel serverless, pair with waitUntil() or migrate to Inngest
    // for guaranteed completion beyond the function timeout.
    processJob(jobId, principal).catch((err) => {
      console.error(`[jobs] Unhandled error in processJob(${jobId}):`, err);
    });

    return NextResponse.json(
      {
        requestId: context.requestId,
        jobId,
        analysisId,
        stage: "queued",
        stageLabel: "Queued",
        progress: 0
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    const normalized = normalizeUnknownError(error, "jobs");
    return errorEnvelope(context, normalized);
  }
}
