import type { Express } from "express";
import { type Server } from "http";
import path from "node:path";
import type { RfpAnalysis } from "@shared/schema";
import {
  analysisDocumentQualitySchema,
  analysisMetaSchema,
} from "@shared/models/analysis";
import { storage } from "./storage";
import { getAnalysisFeatureFlags } from "./services/analysisFlags";
import { requireAuth } from "./auth";
import type { ClientResearchResult } from "./services/clientResearch";

let uploadMiddlewarePromise: Promise<any> | null = null;

async function getUploadMiddleware() {
  if (!uploadMiddlewarePromise) {
    uploadMiddlewarePromise = import("multer").then(({ default: multer }) =>
      multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 20 * 1024 * 1024 },
      }),
    );
  }

  return uploadMiddlewarePromise;
}

async function loadAnalysisPipelineServices() {
  return import("./services/analysisPipeline");
}

async function loadAnalysisRunStoreServices() {
  return import("./services/analysisRunStore");
}

async function loadServiceTaxonomyServices() {
  return import("./services/serviceTaxonomy");
}

async function loadClientResearchServices() {
  return import("./services/clientResearch");
}

async function loadFinancialScoringServices() {
  return import("./services/financialScoring");
}

async function loadPdfServices() {
  return import("./lib/generate-pdf");
}

function extractCoreExtraction(analysis: RfpAnalysis): any {
  const extracted = analysis.extractedData as any;
  return extracted?.coreExtraction ?? {};
}

function extractRedFlags(analysis: RfpAnalysis): any[] {
  if (Array.isArray(analysis.redFlags)) return analysis.redFlags as any[];

  const extracted = analysis.extractedData as any;
  const fallback = extracted?.redFlagAnalysis;
  if (Array.isArray(fallback?.redFlags)) return fallback.redFlags;
  if (Array.isArray(fallback?.flags)) return fallback.flags;
  return [];
}

function flattenDeliverables(coreExtraction: any): string[] {
  const deliverables: string[] = [];

  if (Array.isArray(coreExtraction?.deliverables)) {
    for (const deliverable of coreExtraction.deliverables) {
      if (typeof deliverable === "string") deliverables.push(deliverable);
      else if (deliverable?.name) deliverables.push(String(deliverable.name));
      else if (deliverable?.description) {
        deliverables.push(String(deliverable.description));
      }
    }
  }

  const phases = coreExtraction?.scopeOfWork?.phases;
  if (Array.isArray(phases)) {
    for (const phase of phases) {
      if (!Array.isArray(phase?.deliverables)) continue;
      for (const deliverable of phase.deliverables) {
        if (typeof deliverable === "string") deliverables.push(deliverable);
        else if (deliverable?.name) deliverables.push(String(deliverable.name));
        else if (deliverable?.description) {
          deliverables.push(String(deliverable.description));
        }
      }
    }
  }

  return Array.from(new Set(deliverables.map((item) => item.trim()).filter(Boolean)));
}

function sanitizeUploadedFileName(fileName: string) {
  return path.basename(fileName).replace(/[^\w.\-()\s]/g, "_");
}

function buildFallbackClientProfile(
  documentText: string,
  coreExtraction: any,
): ClientResearchResult {
  const docLower = documentText.toLowerCase();
  const isGovt =
    docLower.includes("government") ||
    docLower.includes("ministry") ||
    docLower.includes("حكوم") ||
    docLower.includes("وزارة");
  const isSemiGovt =
    docLower.includes("semi-government") ||
    docLower.includes("هيئة") ||
    docLower.includes("مؤسسة") ||
    docLower.includes("authority");
  const entityType = isGovt
    ? "government"
    : isSemiGovt
      ? "semi_government"
      : "private";
  const deliverableCount = flattenDeliverables(coreExtraction).length;
  const estimatedSize =
    deliverableCount >= 15
      ? "enterprise"
      : deliverableCount >= 8
        ? "large"
        : "medium";

  return {
    companyName: coreExtraction?.clientName || "Unknown",
    industry: coreExtraction?.industry || "Unknown",
    entityType,
    estimatedSize,
    employeeRange: "Unknown",
    holdingGroup: { name: null, tier: "independent" as const },
    geographicReach: "national" as const,
    marketingBudgetTier: "moderate" as const,
    mediaSpendsSignal: "moderate" as const,
    socialActivityLevel: "moderate" as const,
    contentPublishingLevel: "moderate" as const,
    digitalPresence: "Unknown — client research was not available",
    confidenceScores: {
      estimatedSize: 0.3,
      companyName: coreExtraction?.clientName ? 0.7 : 0.2,
      entityType: isGovt || isSemiGovt ? 0.6 : 0.3,
    },
    researchNotes: ["Client research AI call failed — using inferred defaults"],
    sourceType: "document_only_inference" as const,
    externalResearchAvailable: false,
    sources: [],
  };
}

function makeHeuristicDocumentQuality(analysis: RfpAnalysis) {
  const text = analysis.documentText || "";
  return analysisDocumentQualitySchema.parse(
    analysis.documentQuality ?? {
      extractedTextLength: text.length,
      estimatedPageCount: 1,
      averageCharsPerPage: text.length,
      parseMethod: "heuristic",
      ocrUsed: false,
      ocrConfidence: null,
      parseWarnings: [],
      languageHints: [],
    },
  );
}

function normalizeAnalysisMeta(analysis: RfpAnalysis) {
  const flags = getAnalysisFeatureFlags();
  const parsed = analysisMetaSchema.safeParse(analysis.analysisMeta);
  if (parsed.success) return parsed.data;

  return analysisMetaSchema.parse({
    liveVersion: analysis.analysisVersion || "live-v1",
    shadowVersion: "shadow-v2",
    activeRunId: null,
    latestLiveRunId: null,
    latestShadowRunId: null,
    runStatus: null,
    stageKey: null,
    retryCount: 0,
    workerMode: flags.analysisWorker ? "postgres_worker" : "inline",
    workerEnabled: flags.analysisWorker,
    shadowEnabled: flags.shadowV2,
    evidenceUiEnabled: flags.evidenceUi,
    webResearchEnabled: flags.webResearch,
    liveCutoverEnabled: flags.liveV2Cutover,
    updatedAt: analysis.createdAt
      ? new Date(analysis.createdAt).toISOString()
      : new Date().toISOString(),
  });
}

function getShadowStatusView(analysis: RfpAnalysis, meta: ReturnType<typeof normalizeAnalysisMeta>) {
  const liveRunActive =
    meta.runStatus === "running" &&
    meta.activeRunId != null &&
    meta.latestLiveRunId != null &&
    Number(meta.activeRunId) === Number(meta.latestLiveRunId);

  if (!liveRunActive) {
    const reviewReasons =
      Array.isArray(analysis.reviewReasons) && analysis.reviewReasons.length > 0
        ? analysis.reviewReasons
        : Array.isArray((analysis.comparisonSummary as any)?.notes)
          ? (analysis.comparisonSummary as any).notes
          : [];

    return {
      shadowRunStatus: analysis.shadowRunStatus,
      manualReviewRequired: analysis.manualReviewRequired,
      reviewReasons,
      comparisonSummary: analysis.comparisonSummary,
    };
  }

  return {
    shadowRunStatus: "not_started" as const,
    manualReviewRequired: false,
    reviewReasons: [] as string[],
    comparisonSummary: null,
  };
}

async function runLegacyRescore(analysis: RfpAnalysis) {
  const flags = getAnalysisFeatureFlags();
  const coreExtraction = extractCoreExtraction(analysis);
  const documentText = analysis.documentText || "";
  const redFlags = extractRedFlags(analysis);
  const { aiScopeMatching, matchScopeToServices } = await loadServiceTaxonomyServices();
  const { performClientResearch } = await loadClientResearchServices();
  const { calculateFinancialScore } = await loadFinancialScoringServices();

  await storage.updateAnalysis(analysis.id, {
    status: "scoring",
  });

  const flatDeliverables = flattenDeliverables(coreExtraction);
  const scopeOfWork = coreExtraction?.scopeOfWork;
  const scopeText =
    typeof scopeOfWork === "string" ? scopeOfWork : scopeOfWork?.overview || "";

  let scopeResult = null;
  try {
    scopeResult = await aiScopeMatching(flatDeliverables, scopeText);
  } catch {
    scopeResult = matchScopeToServices(flatDeliverables, scopeText);
  }

  let clientResult = null;
  try {
    clientResult = await performClientResearch(documentText, coreExtraction);
  } catch {
    clientResult = buildFallbackClientProfile(documentText, coreExtraction);
  }

  const scoreResult =
    scopeResult && clientResult
      ? calculateFinancialScore(coreExtraction, scopeResult, clientResult, redFlags)
      : null;

  await storage.updateAnalysis(analysis.id, {
    scopeAnalysis: scopeResult || analysis.scopeAnalysis,
    clientResearch: clientResult || analysis.clientResearch,
    financialScore: scoreResult,
    overallScore: scoreResult?.totalScore ?? analysis.overallScore,
    recommendation: scoreResult?.recommendation ?? analysis.recommendation,
    status: "complete",
  });

  if (!flags.shadowV2) return;

  const { createAnalysisRun } = await loadAnalysisRunStoreServices();
  const { runShadowAnalysis } = await loadAnalysisPipelineServices();
  const shadowRun = await createAnalysisRun({
    analysisId: analysis.id,
    pipelineVersion: "shadow-v2",
    trigger: "legacy_rescore",
    meta: { legacyRescore: true },
  });

  await runShadowAnalysis({
    analysisId: analysis.id,
    runId: shadowRun.id,
    fileName: analysis.fileName,
    documentText,
    documentQuality: makeHeuristicDocumentQuality(analysis),
    extractedData: analysis.extractedData,
    scopeAnalysis: scopeResult || analysis.scopeAnalysis,
    clientResearch: clientResult || analysis.clientResearch,
    financialScore: scoreResult,
    redFlags,
    overallScore: scoreResult?.totalScore ?? analysis.overallScore,
    recommendation: scoreResult?.recommendation ?? analysis.recommendation,
  });
}

async function enqueueOrRunAnalysis(input: {
  analysisId: number;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  trigger: string;
}) {
  const flags = getAnalysisFeatureFlags();
  const { createAnalysisRun, persistAnalysisPayload } =
    await loadAnalysisRunStoreServices();
  const run = await createAnalysisRun({
    analysisId: input.analysisId,
    pipelineVersion: "live-v1",
    trigger: input.trigger,
  });

  await persistAnalysisPayload({
    analysisId: input.analysisId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileBuffer: input.fileBuffer,
  });

  if (flags.analysisWorker) {
    return run;
  }

  const { runLiveAnalysis } = await loadAnalysisPipelineServices();
  void runLiveAnalysis({
    analysisId: input.analysisId,
    runId: run.id,
    fileBuffer: input.fileBuffer,
    mimeType: input.mimeType,
    fileName: input.fileName,
  });

  return run;
}

async function loadAnalysisWithStages(id: number) {
  const analysis = await storage.getAnalysis(id);
  if (!analysis) return null;

  const meta = normalizeAnalysisMeta(analysis);
  const documentQuality =
    analysis.documentText && analysis.documentText.length > 0
      ? makeHeuristicDocumentQuality(analysis)
      : null;
  const shadowStatusView = getShadowStatusView(analysis, meta);
  const liveRunId = meta.latestLiveRunId;
  const shadowRunId = meta.latestShadowRunId;
  const { listRunStages } = await loadAnalysisRunStoreServices();

  const [liveStages, shadowStages] = await Promise.all([
    liveRunId ? listRunStages(Number(liveRunId)) : Promise.resolve([]),
    shadowRunId ? listRunStages(Number(shadowRunId)) : Promise.resolve([]),
  ]);

  return {
    ...analysis,
    analysisMeta: meta,
    documentQuality,
    shadowRunStatus: shadowStatusView.shadowRunStatus,
    manualReviewRequired: shadowStatusView.manualReviewRequired,
    reviewReasons: shadowStatusView.reviewReasons,
    comparisonSummary: shadowStatusView.comparisonSummary,
    liveStages,
    shadowStages,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.post("/api/analyses/upload", requireAuth, async (req, res) => {
    try {
      const upload = await getUploadMiddleware();
      await new Promise<void>((resolve, reject) => {
        upload.single("file")(req, res, (error: any) => {
          if (error) reject(error);
          else resolve();
        });
      });

      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowedTypes.includes(file.mimetype)) {
        return res
          .status(400)
          .json({ message: "Only PDF and DOCX files are accepted" });
      }

      const analysis = await storage.createAnalysis({
        userId: req.authUser!.id,
        fileName: sanitizeUploadedFileName(file.originalname || "uploaded-document"),
        fileSize: file.size,
        analysisVersion: "live-v1",
        status: "uploading",
      });

      await enqueueOrRunAnalysis({
        analysisId: analysis.id,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileBuffer: file.buffer,
        trigger: "upload",
      });

      return res.status(202).json(analysis);
    } catch (error: any) {
      console.error("Upload error:", error);
      if (error?.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File too large. Maximum file size is 20MB." });
      }
      return res
        .status(error?.statusCode || 500)
        .json({ message: error.message || "Failed to upload file" });
    }
  });

  app.get("/api/analyses", requireAuth, async (req, res) => {
    try {
      const analyses = await storage.getAllAnalysesForUser(req.authUser!.id);
      const result = analyses.map(({ documentText, ...rest }) => rest);
      return res.json(result);
    } catch (error: any) {
      console.error("Error fetching analyses:", error);
      return res
        .status(500)
        .json({ message: error.message || "Failed to fetch analyses" });
    }
  });

  app.get("/api/analyses/:id", requireAuth, async (req, res) => {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const id = Number.parseInt(rawId, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid analysis ID" });
      }

      const owned = await storage.getAnalysisForUser(id, req.authUser!.id);
      if (!owned) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      const analysis = await loadAnalysisWithStages(id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      return res.json(analysis);
    } catch (error: any) {
      console.error("Error fetching analysis:", error);
      return res
        .status(500)
        .json({ message: error.message || "Failed to fetch analysis" });
    }
  });

  app.get("/api/analyses/:id/status", requireAuth, async (req, res) => {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const id = Number.parseInt(rawId, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid analysis ID" });
      }

      const analysis = await storage.getAnalysisForUser(id, req.authUser!.id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      const meta = normalizeAnalysisMeta(analysis);
      const documentQuality =
        analysis.documentText && analysis.documentText.length > 0
          ? makeHeuristicDocumentQuality(analysis)
          : null;
      const shadowStatusView = getShadowStatusView(analysis, meta);

      return res.json({
        status: analysis.status,
        currentPass: analysis.currentPass,
        overallScore: analysis.overallScore,
        recommendation: analysis.recommendation,
        shadowRunStatus: shadowStatusView.shadowRunStatus,
        manualReviewRequired: shadowStatusView.manualReviewRequired,
        runStatus: meta.runStatus ?? null,
        stageKey: meta.stageKey ?? null,
        retryCount: meta.retryCount ?? 0,
        analysisMeta: meta,
        documentQuality,
        reviewReasons: shadowStatusView.reviewReasons,
        comparisonSummary: shadowStatusView.comparisonSummary,
      });
    } catch (error: any) {
      console.error("Error fetching analysis status:", error);
      return res.status(500).json({
        message: error.message || "Failed to fetch analysis status",
      });
    }
  });

  app.delete("/api/analyses/:id", requireAuth, async (req, res) => {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const id = Number.parseInt(rawId, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid analysis ID" });
      }

      const analysis = await storage.getAnalysisForUser(id, req.authUser!.id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      await storage.deleteAnalysisForUser(id, req.authUser!.id);
      return res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting analysis:", error);
      return res
        .status(500)
        .json({ message: error.message || "Failed to delete analysis" });
    }
  });

  app.post("/api/analyses/:id/rescore", requireAuth, async (req, res) => {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const id = Number.parseInt(rawId, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid analysis ID" });
      }

      const analysis = await storage.getAnalysisForUser(id, req.authUser!.id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      if (!analysis.extractedData) {
        return res.status(400).json({ message: "No extracted data to rescore" });
      }

      res.status(202).json({ message: "Re-scoring started" });

      void (async () => {
        const { loadAnalysisPayload } = await loadAnalysisRunStoreServices();
        const payload = await loadAnalysisPayload(id);
        if (payload) {
          await enqueueOrRunAnalysis({
            analysisId: id,
            fileName: analysis.fileName,
            mimeType: payload.mime_type,
            fileBuffer: payload.fileBuffer,
            trigger: "rescore",
          });
          return;
        }

        await runLegacyRescore(analysis);
      })().catch((error) => {
        console.error(`[Rescore ${id}] Failed:`, error);
      });
    } catch (error: any) {
      console.error("Error re-scoring analysis:", error);
      return res
        .status(500)
        .json({ message: error.message || "Failed to re-score analysis" });
    }
  });

  app.get("/api/analyses/:id/pdf", requireAuth, async (req, res) => {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const id = Number.parseInt(rawId, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid analysis ID" });
      }

      const analysis = await storage.getAnalysisForUser(id, req.authUser!.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      if (analysis.status !== "complete") {
        return res.status(400).json({ error: "Analysis is not yet complete" });
      }

      const { generatePdf } = await loadPdfServices();
      const pdfBuffer = await generatePdf(analysis);
      const safeName = (analysis.fileName || "rfp-brief")
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}_executive_brief.pdf"`,
      );
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      return res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  return httpServer;
}
