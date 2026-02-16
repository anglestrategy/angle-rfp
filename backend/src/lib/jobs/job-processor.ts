import {
  advanceJob,
  appendWarnings,
  completeJob,
  failJob,
  getJob,
  setStageResults
} from "@/lib/jobs/job-store";
import { parseDocumentInput } from "@/lib/parsing/parse-document";
import { analyzeRfpInput } from "@/lib/extraction/analyze-rfp";
import { analyzeScopeInput } from "@/lib/scope/analyze-scope";
import { researchClientInput } from "@/lib/research/research-client";
import { calculateScoreInput } from "@/lib/scoring/calculate-score";
import { registerAnalysisUsage, reserveUserDailyAnalysis } from "@/lib/ops/cost-budget";

/**
 * Runs the full analysis pipeline for a job, updating the job store
 * after each stage so the polling endpoint can report progress.
 *
 * This function is fire-and-forget — the caller (POST /api/jobs) does
 * not await it. Errors are caught and stored on the job rather than
 * propagated.
 *
 * Pipeline:
 *   parsing → extracting → analyzing_scope → researching → scoring → completed
 */
export async function processJob(jobId: string, principal: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;

  try {
    reserveUserDailyAnalysis(principal, job.analysisId);

    // ── Stage 1: Parse Document ────────────────────────────────────
    advanceJob(jobId, "parsing");

    if (!job.file) {
      throw new StageError("parsing", "validation_error", "File data missing from job", false);
    }

    const parsedDocument = await parseDocumentInput({
      analysisId: job.analysisId,
      fileName: job.file.name,
      mimeType: job.file.mimeType,
      fileBytes: job.file.bytes
    });

    setStageResults(jobId, { parsedDocument });
    appendWarnings(jobId, parsedDocument.warnings);

    registerAnalysisUsage({
      analysisId: job.analysisId,
      ocrPages: parsedDocument.ocrStats?.pagesOcred ?? 0
    });

    // ── Stage 2: Extract RFP Data ──────────────────────────────────
    advanceJob(jobId, "extracting");

    const extractedRfp = await analyzeRfpInput({
      analysisId: job.analysisId,
      parsedDocument
    });

    setStageResults(jobId, { extractedRfp });
    appendWarnings(jobId, extractedRfp.warnings);

    const estimatedTokens = Math.ceil(parsedDocument.rawText.length * 0.35);
    registerAnalysisUsage({
      analysisId: job.analysisId,
      tokens: estimatedTokens
    });

    // ── Stage 3: Analyze Scope ─────────────────────────────────────
    advanceJob(jobId, "analyzing_scope");

    const scopeAnalysis = await analyzeScopeInput({
      analysisId: job.analysisId,
      scopeOfWork: extractedRfp.scopeOfWork,
      language: parsedDocument.primaryLanguage
    });

    setStageResults(jobId, { scopeAnalysis });
    appendWarnings(jobId, scopeAnalysis.warnings);

    // ── Stage 4: Research Client ───────────────────────────────────
    advanceJob(jobId, "researching");

    const clientResearch = await researchClientInput({
      analysisId: job.analysisId,
      clientName: extractedRfp.clientName,
      clientNameArabic: extractedRfp.clientNameArabic ?? undefined,
      country: "SA",
      rfpContext: {
        projectName: extractedRfp.projectName,
        projectDescription: extractedRfp.projectDescription,
        scopeOfWork: extractedRfp.scopeOfWork
      }
    });

    setStageResults(jobId, { clientResearch });
    appendWarnings(jobId, clientResearch.warnings);

    registerAnalysisUsage({
      analysisId: job.analysisId,
      queries: 5
    });

    // ── Stage 5: Calculate Score ───────────────────────────────────
    advanceJob(jobId, "scoring");

    const scoreResult = await calculateScoreInput({
      analysisId: job.analysisId,
      extractedRfp,
      scopeAnalysis,
      clientResearch
    });

    setStageResults(jobId, { financialScore: scoreResult.score });
    appendWarnings(jobId, scoreResult.warnings);

    // ── Done ───────────────────────────────────────────────────────
    completeJob(jobId);
  } catch (error: unknown) {
    const { code, message, stage, retryable } = normalizeProcessorError(error);
    failJob(jobId, { code, message, stage, retryable });
  }
}

// ── Error helpers ────────────────────────────────────────────────────

class StageError extends Error {
  constructor(
    public readonly stage: string,
    public readonly code: string,
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
  }
}

function normalizeProcessorError(error: unknown): {
  code: string;
  message: string;
  stage: string;
  retryable: boolean;
} {
  if (error instanceof StageError) {
    return {
      code: error.code,
      message: error.message,
      stage: error.stage,
      retryable: error.retryable
    };
  }

  // ApiError from existing lib code
  if (error && typeof error === "object" && "shape" in error) {
    const shaped = error as { shape: { code: string; message: string; stage: string }; statusCode: number };
    return {
      code: shaped.shape.code,
      message: shaped.shape.message,
      stage: shaped.shape.stage,
      retryable: shaped.statusCode >= 500
    };
  }

  if (error instanceof Error) {
    return {
      code: "internal_error",
      message: error.message,
      stage: "unknown",
      retryable: true
    };
  }

  return {
    code: "internal_error",
    message: String(error),
    stage: "unknown",
    retryable: true
  };
}
