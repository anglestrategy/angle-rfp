import { storage } from "../storage";
import { analysisDocumentQualitySchema } from "@shared/models/analysis";
import { getAnalysisFeatureFlags } from "./analysisFlags";
import { runLiveAnalysis, runShadowAnalysis } from "./analysisPipeline";
import {
  claimNextQueuedRun,
  heartbeatRun,
  incrementRunRetry,
  loadAnalysisPayload,
  markRunFinished,
  requeueRun,
  updateAnalysisMeta,
} from "./analysisRunStore";

const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 30000;

let workerTimer: NodeJS.Timeout | null = null;
let workerStarted = false;
let inFlight = false;

function scheduleNextTick() {
  if (!workerStarted) return;
  workerTimer = setTimeout(() => {
    void workerTick();
  }, POLL_INTERVAL_MS);
}

async function processClaimedRun(run: any) {
  const analysisId = Number(run.analysis_id);
  const pipelineVersion = String(run.pipeline_version || "");
  const retryCount = Number(run.retry_count || 0);
  const maxRetries = Number(run.max_retries || 0);

  await updateAnalysisMeta(analysisId, {
    activeRunId: Number(run.id),
    runStatus: "running",
    stageKey: run.current_stage_key ?? null,
    retryCount,
  });

  const heartbeatTimer = setInterval(() => {
    void heartbeatRun(Number(run.id));
  }, HEARTBEAT_INTERVAL_MS);

  try {
    if (pipelineVersion === "live-v1") {
      const payload = await loadAnalysisPayload(analysisId);
      if (!payload) {
        throw new Error("No stored payload found for live-v1 worker run.");
      }

      await runLiveAnalysis({
        analysisId,
        runId: Number(run.id),
        fileBuffer: payload.fileBuffer,
        mimeType: payload.mime_type,
        fileName: payload.file_name,
        skipRunStart: true,
      });
      return;
    }

    if (pipelineVersion === "shadow-v2") {
      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis || !analysis.documentText || !analysis.extractedData) {
        throw new Error("Analysis is missing live outputs required for shadow-v2.");
      }

      const redFlags = Array.isArray(analysis.redFlags)
        ? analysis.redFlags
        : Array.isArray((analysis.extractedData as any)?.redFlagAnalysis?.redFlags)
          ? (analysis.extractedData as any).redFlagAnalysis.redFlags
          : [];

      await runShadowAnalysis({
        analysisId,
        runId: Number(run.id),
        fileName: analysis.fileName,
        documentText: analysis.documentText,
        documentQuality: analysisDocumentQualitySchema.parse(
          analysis.documentQuality ?? {
            extractedTextLength: analysis.documentText.length,
            estimatedPageCount: 1,
            averageCharsPerPage: analysis.documentText.length,
            parseMethod: "heuristic",
            ocrUsed: false,
            ocrConfidence: null,
            parseWarnings: [],
            languageHints: [],
          },
        ),
        extractedData: analysis.extractedData,
        scopeAnalysis: analysis.scopeAnalysis,
        clientResearch: analysis.clientResearch,
        financialScore: analysis.financialScore,
        redFlags,
        overallScore: analysis.overallScore,
        recommendation: analysis.recommendation,
        skipRunStart: true,
      });
      return;
    }

    await markRunFinished({
      runId: Number(run.id),
      analysisId,
      status: "failed",
      errorCode: "unknown_pipeline_version",
      errorMessage: `Unsupported pipeline version: ${pipelineVersion}`,
      degraded: true,
      reviewReasons: [`Unsupported pipeline version: ${pipelineVersion}`],
    });
  } catch (error: any) {
    const errorMessage = error?.message || "Worker execution failed";

    if (retryCount < maxRetries) {
      await incrementRunRetry(Number(run.id));
      await requeueRun({
        runId: Number(run.id),
        analysisId,
        errorCode: "worker_retry_scheduled",
        errorMessage,
      });
      return;
    }

    const reviewReasons = [errorMessage, "Worker retries exhausted."];
    const analysisPatch: Record<string, unknown> = {
      manualReviewRequired: true,
      reviewReasons,
    };
    if (pipelineVersion === "shadow-v2") {
      analysisPatch.shadowRunStatus = "failed";
    }
    if (pipelineVersion === "live-v1") {
      analysisPatch.errorMessage = errorMessage;
      analysisPatch.status = "error";
    }
    await storage.updateAnalysis(analysisId, {
      ...(analysisPatch as any),
    });
    await markRunFinished({
      runId: Number(run.id),
      analysisId,
      status: "failed",
      errorCode: "worker_retries_exhausted",
      errorMessage,
      degraded: true,
      reviewReasons,
    });
  } finally {
    clearInterval(heartbeatTimer);
  }
}

async function workerTick() {
  if (!workerStarted || inFlight) {
    scheduleNextTick();
    return;
  }

  inFlight = true;
  try {
    const flags = getAnalysisFeatureFlags();
    if (!flags.analysisWorker) return;

    const run = await claimNextQueuedRun();
    if (!run) return;

    await processClaimedRun(run);
  } catch (error) {
    console.error("[AnalysisWorker] Tick failed:", error);
  } finally {
    inFlight = false;
    scheduleNextTick();
  }
}

export function startAnalysisWorker() {
  const flags = getAnalysisFeatureFlags();
  if (!flags.analysisWorker || workerStarted) return;

  workerStarted = true;
  scheduleNextTick();
  console.log("[AnalysisWorker] Started postgres-backed analysis worker.");
}

export function stopAnalysisWorker() {
  workerStarted = false;
  if (workerTimer) {
    clearTimeout(workerTimer);
    workerTimer = null;
  }
}
