import { z } from "zod";
import {
  analysisSourceSchema,
  shadowOutputsSchema,
  shadowPromotionCriteria,
  type AnalysisDocumentChunk,
  type AnalysisDocumentQuality,
  type AnalysisEvidenceIndex,
  type AnalysisEvidenceItem,
  type AnalysisSource,
  type ShadowComparisonSummary,
  type ShadowLiveSnapshot,
  type ShadowOutputs,
  type ShadowRunStatus,
  type ShadowValidationIssue,
} from "@shared/models/analysis";
import type { ClientResearchResult } from "./clientResearch";
import type { FinancialScoreResult } from "./financialScoring";
import { calculateShadowScorecard } from "./financialScoring";
import type { ScopeAnalysisResult } from "./serviceTaxonomy";

const minimalCoreExtractionSchema = z
  .object({
    clientName: z.string().optional().nullable(),
    projectTitle: z.string().optional().nullable(),
    industry: z.string().optional().nullable(),
    deliverables: z.array(z.any()).optional(),
    keyDates: z.array(z.any()).optional(),
    submissionRequirements: z.record(z.any()).optional(),
    contractTerms: z.record(z.any()).optional(),
    timeline: z.record(z.any()).optional(),
    completenessAssessment: z.record(z.any()).optional(),
  })
  .passthrough();

export interface ShadowAnalysisInput {
  analysisId: number;
  fileName: string;
  createdAt?: string | Date | null;
  documentText: string;
  documentQuality?: AnalysisDocumentQuality | null;
  documentChunks?: AnalysisDocumentChunk[] | null;
  extractedData: any;
  scopeAnalysis: ScopeAnalysisResult | null;
  clientResearch: ClientResearchResult | null;
  financialScore: FinancialScoreResult | null;
  redFlags: any[];
  overallScore: number | null;
  recommendation: string | null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractDeliverableTexts(core: any): string[] {
  const texts: string[] = [];

  if (Array.isArray(core?.deliverables)) {
    for (const deliverable of core.deliverables) {
      if (typeof deliverable === "string") texts.push(deliverable);
      else if (deliverable?.name) texts.push(String(deliverable.name));
    }
  }

  const phases = core?.scopeOfWork?.phases;
  if (Array.isArray(phases)) {
    for (const phase of phases) {
      if (!Array.isArray(phase?.deliverables)) continue;
      for (const deliverable of phase.deliverables) {
        if (typeof deliverable === "string") texts.push(deliverable);
        else if (deliverable?.name) texts.push(String(deliverable.name));
      }
    }
  }

  return Array.from(new Set(texts.map((text) => text.trim()).filter(Boolean)));
}

function extractDateEntries(core: any): Array<{ date: string; description: string }> {
  const dates: Array<{ date: string; description: string }> = [];
  const addDate = (value: any) => {
    if (!value) return;
    const date = normalizeString(value.date || value.deadline || value.label || value.name);
    const description = normalizeString(value.description || value.name || value.milestone || value.label);
    if (!date && !description) return;
    dates.push({ date: date || "", description: description || "" });
  };

  if (Array.isArray(core?.keyDates)) {
    core.keyDates.forEach(addDate);
  }
  if (Array.isArray(core?.timeline?.keyMilestones)) {
    core.timeline.keyMilestones.forEach(addDate);
  }

  return dates;
}

function countClarificationQuestions(extractedData: any): number {
  const completeness = extractedData?.completenessAssessment ?? {};
  return Array.isArray(completeness?.clarificationQuestions)
    ? completeness.clarificationQuestions.length
    : 0;
}

function countHighSeverityRisks(redFlags: any[]): number {
  return redFlags.filter((flag) => {
    const severity = String(flag?.severity || flag?.level || "").toUpperCase();
    return severity === "HIGH" || severity === "CRITICAL";
  }).length;
}

function hasSubmissionRequirements(core: any): boolean {
  const submission = core?.submissionRequirements;
  if (!submission || typeof submission !== "object") return false;
  return Object.values(submission).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(normalizeString(typeof value === "string" ? value : null));
  });
}

function hasContractTerms(core: any): boolean {
  const contractTerms = core?.contractTerms;
  if (!contractTerms || typeof contractTerms !== "object") return false;
  return Object.values(contractTerms).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(normalizeString(typeof value === "string" ? value : null));
  });
}

function makeLiveSnapshot(input: ShadowAnalysisInput): ShadowLiveSnapshot {
  const core = input.extractedData?.coreExtraction ?? {};
  const deliverables = extractDeliverableTexts(core);
  const dates = extractDateEntries(core);

  return {
    analysisId: input.analysisId,
    fileName: input.fileName,
    createdAt: new Date(input.createdAt || Date.now()).toISOString(),
    overallScore: input.overallScore,
    recommendation: input.recommendation,
    fieldPresence: {
      clientName: Boolean(normalizeString(core?.clientName)),
      projectTitle: Boolean(normalizeString(core?.projectTitle)),
      deliverables: deliverables.length > 0,
      dates: dates.length > 0,
      submissionRequirements: hasSubmissionRequirements(core),
      contractTerms: hasContractTerms(core),
    },
    counts: {
      deliverables: deliverables.length,
      dates: dates.length,
      highSeverityRisks: countHighSeverityRisks(input.redFlags),
      clarificationQuestions: countClarificationQuestions(input.extractedData),
      scopeMatchPct: input.scopeAnalysis?.agencyServicePercentage ?? 0,
    },
  };
}

function findTextRange(
  documentText: string,
  value: string,
): Pick<AnalysisEvidenceItem, "snippet" | "charStart" | "charEnd"> {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return { snippet: value, charStart: null, charEnd: null };
  }

  const directIndex = documentText.toLowerCase().indexOf(normalizedValue.toLowerCase());
  if (directIndex >= 0) {
    const start = Math.max(0, directIndex - 90);
    const end = Math.min(documentText.length, directIndex + normalizedValue.length + 90);
    return {
      snippet: documentText.slice(start, end).trim(),
      charStart: directIndex,
      charEnd: directIndex + normalizedValue.length,
    };
  }

  return {
    snippet: normalizedValue,
    charStart: null,
    charEnd: null,
  };
}

function findChunkRange(
  chunks: AnalysisDocumentChunk[] | null | undefined,
  value: string,
): Pick<AnalysisEvidenceItem, "snippet" | "charStart" | "charEnd" | "page"> | null {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue || !Array.isArray(chunks)) return null;

  for (const chunk of chunks) {
    const chunkText = chunk.text || "";
    const directIndex = chunkText.toLowerCase().indexOf(normalizedValue);
    if (directIndex < 0) continue;

    const start = Math.max(0, directIndex - 90);
    const end = Math.min(chunkText.length, directIndex + normalizedValue.length + 90);
    const absoluteStart =
      typeof chunk.charStart === "number" ? chunk.charStart + directIndex : null;

    return {
      snippet: chunkText.slice(start, end).trim(),
      charStart: absoluteStart,
      charEnd: absoluteStart === null ? null : absoluteStart + normalizedValue.length,
      page: chunk.pageNumber ?? null,
    };
  }

  return null;
}

function pushEvidence(
  index: AnalysisEvidenceIndex,
  path: string,
  evidence: AnalysisEvidenceItem,
) {
  if (!index[path]) index[path] = [];
  index[path].push(evidence);
}

function addHeuristicEvidence(
  index: AnalysisEvidenceIndex,
  documentText: string,
  documentChunks: AnalysisDocumentChunk[] | null | undefined,
  path: string,
  label: string,
  value: unknown,
  confidence = 0.58,
) {
  const normalized = normalizeString(value);
  if (!normalized) return;
  const chunkRange = findChunkRange(documentChunks, normalized);
  const range = chunkRange ?? findTextRange(documentText, normalized);
  pushEvidence(index, path, {
    label,
    sourceKind: chunkRange ? "document" : "document_heuristic",
    snippet: range.snippet,
    matchedText: normalized,
    charStart: range.charStart,
    charEnd: range.charEnd,
    page: chunkRange?.page ?? null,
    confidence,
  });
}

function buildEvidenceIndex(input: ShadowAnalysisInput): AnalysisEvidenceIndex {
  const evidenceIndex: AnalysisEvidenceIndex = {};
  const core = input.extractedData?.coreExtraction ?? {};
  const documentText = input.documentText || "";
  const documentChunks = input.documentChunks;

  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "clientName",
    "Client",
    core?.clientName,
    0.72,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "projectTitle",
    "Project Title",
    core?.projectTitle,
    0.72,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "industry",
    "Industry",
    core?.industry,
    0.55,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "budget.totalBudget",
    "Budget",
    core?.budget?.totalBudget,
    0.82,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "budget.currency",
    "Budget Currency",
    core?.budget?.currency,
    0.7,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "budget.pricingStructure",
    "Pricing Structure",
    core?.budget?.pricingStructure,
    0.7,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "timeline.overallDuration",
    "Timeline",
    core?.timeline?.overallDuration,
    0.72,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "timeline.startDate",
    "Start Date",
    core?.timeline?.startDate,
    0.74,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "timeline.endDate",
    "End Date",
    core?.timeline?.endDate,
    0.74,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "submissionRequirements.deadline",
    "Submission Deadline",
    core?.submissionRequirements?.deadline || core?.submissionDeadline,
    0.85,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "submissionRequirements.submissionMethod",
    "Submission Method",
    core?.submissionRequirements?.submissionMethod,
    0.72,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "submissionRequirements.contactInfo",
    "Submission Contact",
    core?.submissionRequirements?.contactInfo,
    0.72,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "contractTerms.paymentTerms",
    "Payment Terms",
    core?.contractTerms?.paymentTerms,
    0.82,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "contractTerms.delayPenalties",
    "Delay Penalties",
    core?.contractTerms?.delayPenalties,
    0.82,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "contractTerms.ipOwnership",
    "IP Ownership",
    core?.contractTerms?.ipOwnership,
    0.82,
  );
  addHeuristicEvidence(
    evidenceIndex,
    documentText,
    documentChunks,
    "contractTerms.terminationClause",
    "Termination Clause",
    core?.contractTerms?.terminationClause,
    0.82,
  );

  for (const deliverable of extractDeliverableTexts(core).slice(0, 10)) {
    addHeuristicEvidence(
      evidenceIndex,
      documentText,
      documentChunks,
      "deliverables",
      "Deliverable",
      deliverable,
      0.68,
    );
  }

  for (const dateEntry of extractDateEntries(core).slice(0, 10)) {
    addHeuristicEvidence(
      evidenceIndex,
      documentText,
      documentChunks,
      "keyDates",
      "Key Date",
      `${dateEntry.date} ${dateEntry.description}`.trim(),
      0.66,
    );
  }

  for (const requiredDocument of core?.submissionRequirements?.requiredDocuments || []) {
    addHeuristicEvidence(
      evidenceIndex,
      documentText,
      documentChunks,
      "submissionRequirements.requiredDocuments",
      "Required Document",
      requiredDocument,
      0.66,
    );
  }

  if (normalizeString(core?.teamRequirements?.localContentRequirements)) {
    addHeuristicEvidence(
      evidenceIndex,
      documentText,
      documentChunks,
      "teamRequirements.localContentRequirements",
      "Local Content Requirement",
      core.teamRequirements.localContentRequirements,
      0.68,
    );
  }

  input.redFlags.forEach((flag, indexValue) => {
    const evidenceText = normalizeString(flag?.evidence);
    if (!evidenceText) return;
    const chunkRange = findChunkRange(documentChunks, evidenceText);
    const range = chunkRange ?? findTextRange(documentText, evidenceText);
    pushEvidence(evidenceIndex, "redFlags", {
      label: flag?.title || `Risk ${indexValue + 1}`,
      sourceKind: chunkRange ? "document" : "document_inference",
      snippet: range.snippet,
      matchedText: evidenceText,
      clauseReference: normalizeString(flag?.clauseReference),
      charStart: range.charStart,
      charEnd: range.charEnd,
      page: chunkRange?.page ?? null,
      confidence: 0.8,
    });
  });

  return evidenceIndex;
}

function buildValidationIssues(
  input: ShadowAnalysisInput,
  snapshot: ShadowLiveSnapshot,
): ShadowValidationIssue[] {
  const issues: ShadowValidationIssue[] = [];
  const core = input.extractedData?.coreExtraction ?? {};
  const scopeMatchCount = Array.isArray(input.scopeAnalysis?.matches)
    ? input.scopeAnalysis.matches.length
    : 0;

  const parsed = minimalCoreExtractionSchema.safeParse(core);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        path: issue.path.join(".") || "coreExtraction",
        severity: "critical",
        message: issue.message,
      });
    }
  }

  if (input.documentQuality?.parseWarnings?.length) {
    for (const warning of input.documentQuality.parseWarnings) {
      issues.push({
        path: "documentQuality",
        severity: "warning",
        message: warning,
      });
    }
  }
  if (
    input.documentQuality?.ocrUsed &&
    (input.documentQuality.ocrConfidence ?? 1) < 0.6
  ) {
    issues.push({
      path: "documentQuality.ocrConfidence",
      severity: "critical",
      message: "OCR confidence is below 60%, so the extracted text may be unreliable.",
    });
  }

  if (!snapshot.fieldPresence.clientName) {
    issues.push({
      path: "clientName",
      severity: "warning",
      message: "Client name is missing from the live extraction.",
    });
  }
  if (!snapshot.fieldPresence.projectTitle) {
    issues.push({
      path: "projectTitle",
      severity: "warning",
      message: "Project title is missing from the live extraction.",
    });
  }
  if (!snapshot.fieldPresence.deliverables) {
    issues.push({
      path: "deliverables",
      severity: "critical",
      message: "No deliverables were captured, which makes fit assessment unreliable.",
    });
  }
  if (!snapshot.fieldPresence.dates) {
    issues.push({
      path: "keyDates",
      severity: "warning",
      message: "No key dates were captured from the document.",
    });
  }
  if (!snapshot.fieldPresence.submissionRequirements) {
    issues.push({
      path: "submissionRequirements",
      severity: "warning",
      message: "Submission instructions are incomplete or missing.",
    });
  }
  if (!snapshot.fieldPresence.contractTerms) {
    issues.push({
      path: "contractTerms",
      severity: "warning",
      message: "Contract term extraction is thin and may need manual review.",
    });
  }
  if (scopeMatchCount < 2) {
    issues.push({
      path: "scopeAnalysis.matches",
      severity: "critical",
      message: "Fewer than two scope matches were available for the shadow scorecard.",
    });
  }
  if (!input.clientResearch) {
    issues.push({
      path: "clientResearch",
      severity: "warning",
      message: "Client research fell back to defaults or is missing entirely.",
    });
  }
  if (!input.financialScore) {
    issues.push({
      path: "financialScore",
      severity: "info",
      message: "Live financial score is missing, so comparison is limited.",
    });
  }

  return issues;
}

function normalizeLiveRecommendationBand(recommendation: string | null): string {
  const normalized = String(recommendation || "").toLowerCase();
  if (normalized === "excellent" || normalized === "good") return "positive";
  if (normalized === "moderate") return "borderline";
  if (normalized === "low") return "negative";
  return "unknown";
}

function normalizeShadowRecommendationBand(recommendation: string): string {
  const normalized = recommendation.toLowerCase();
  if (normalized === "pursue" || normalized === "pursue with conditions") {
    return "positive";
  }
  if (normalized === "borderline") return "borderline";
  if (normalized === "pass") return "negative";
  return "manual_review";
}

function buildComparisonSummary(
  input: ShadowAnalysisInput,
  snapshot: ShadowLiveSnapshot,
  evidenceIndex: AnalysisEvidenceIndex,
  validationIssues: ShadowValidationIssue[],
  shadowRecommendation: string,
  shadowFitScore: number,
): ShadowComparisonSummary {
  const scoreDelta = shadowFitScore - (input.overallScore || 0);
  const recommendationChanged = shadowRecommendation !== (input.recommendation || "");
  const criticalIssues = validationIssues.filter((issue) => issue.severity === "critical");

  const criteriaResults = shadowPromotionCriteria.map((criterion) => {
    if (criterion.id === "high_value_fields") {
      const requiredPaths = [
        "clientName",
        "projectTitle",
        "deliverables",
        "keyDates",
        "submissionRequirements.deadline",
        "contractTerms.paymentTerms",
      ];
      const missingEvidence = requiredPaths.filter((path) => {
        const hasField =
          path === "keyDates"
            ? snapshot.fieldPresence.dates
            : path.startsWith("submissionRequirements")
              ? snapshot.fieldPresence.submissionRequirements
              : path.startsWith("contractTerms")
                ? snapshot.fieldPresence.contractTerms
                : snapshot.fieldPresence[
                    path as "clientName" | "projectTitle" | "deliverables"
                  ];
        return hasField && (evidenceIndex[path] || []).length === 0;
      });
      return {
        id: criterion.id,
        label: criterion.label,
        passed: missingEvidence.length === 0,
        detail:
          missingEvidence.length === 0
            ? "High-value fields retained evidence coverage."
            : `Evidence is still thin for: ${missingEvidence.join(", ")}.`,
      };
    }

    if (criterion.id === "high_severity_risks") {
      const highRiskCount = snapshot.counts.highSeverityRisks;
      const riskEvidenceCount = (evidenceIndex.redFlags || []).length;
      return {
        id: criterion.id,
        label: criterion.label,
        passed: highRiskCount === 0 || riskEvidenceCount >= highRiskCount,
        detail:
          highRiskCount === 0
            ? "No high-severity live risks to preserve."
            : `${riskEvidenceCount}/${highRiskCount} high-severity risks have explicit shadow evidence.`,
      };
    }

    if (criterion.id === "score_delta") {
      return {
        id: criterion.id,
        label: criterion.label,
        passed: Math.abs(scoreDelta) <= 10,
        detail: `Live vs shadow score delta is ${scoreDelta >= 0 ? "+" : ""}${scoreDelta} points.`,
      };
    }

    const liveBand = normalizeLiveRecommendationBand(input.recommendation);
    const shadowBand = normalizeShadowRecommendationBand(shadowRecommendation);
    const aligned =
      liveBand === shadowBand ||
      (liveBand === "positive" && shadowBand === "positive");
    return {
      id: criterion.id,
      label: criterion.label,
      passed: aligned || shadowBand === "manual_review",
      detail: `Live band: ${liveBand}; shadow band: ${shadowBand}.`,
    };
  });

  let parityStatus: ShadowComparisonSummary["parityStatus"] = "pass";
  if (criticalIssues.length > 0 || criteriaResults.some((item) => !item.passed && item.id !== "score_delta")) {
    parityStatus = "fail";
  } else if (criteriaResults.some((item) => !item.passed)) {
    parityStatus = "review";
  }

  const notes: string[] = [];
  if (Math.abs(scoreDelta) > 10) {
    notes.push(
      `Shadow fit score moved ${scoreDelta >= 0 ? "up" : "down"} by ${Math.abs(scoreDelta)} points. Review before any promotion.`,
    );
  }
  if (recommendationChanged) {
    notes.push(
      `Live recommendation "${input.recommendation || "N/A"}" differs from shadow recommendation "${shadowRecommendation}".`,
    );
  }
  if (criticalIssues.length > 0) {
    notes.push(`${criticalIssues.length} critical validation issues triggered manual review.`);
  }

  return {
    generatedAt: new Date().toISOString(),
    parityStatus,
    scoreDelta,
    recommendationChanged,
    liveRecommendation: input.recommendation,
    shadowRecommendation,
    fieldPresence: snapshot.fieldPresence,
    liveCounts: snapshot.counts,
    criteriaResults,
    notes,
  };
}

function makeClientResearchMeta(
  clientResearch: ClientResearchResult | null,
): ShadowOutputs["clientResearchMeta"] {
  const confidenceValues = Object.values(clientResearch?.confidenceScores || {}).filter(
    (value): value is number => typeof value === "number",
  );
  const averageConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + value, 0) /
        confidenceValues.length
      : null;

  return {
    sourceType: clientResearch?.sourceType || "document_only_inference",
    externalResearchAvailable: Boolean(clientResearch?.externalResearchAvailable),
    sourceCount: Array.isArray(clientResearch?.sources)
      ? clientResearch.sources.length
      : 0,
    averageConfidence,
    notes: clientResearch?.researchNotes || [],
  };
}

function makeResearchSources(
  clientResearch: ClientResearchResult | null,
): AnalysisSource[] {
  const sources = (clientResearch?.sources || []).map((source) =>
    analysisSourceSchema.parse({
      title: source.title,
      url: source.url ?? null,
      domain: source.url ? new URL(source.url).hostname : null,
      sourceType:
        source.evidenceTier === "external"
          ? "web_research"
          : clientResearch?.sourceType || "document_only_inference",
      reliabilityTier: source.evidenceTier === "external" ? "medium" : "low",
      publishedAt: null,
      retrievedAt: source.retrievedAt,
      snippet: null,
      note: source.evidenceTier === "external"
        ? "External research source persisted for shadow review."
        : "Source derived from uploaded document context.",
    }),
  );

  if (sources.length > 0) return sources;

  return [
    analysisSourceSchema.parse({
      title: "Document inference only",
      url: null,
      domain: null,
      sourceType: "document_only_inference",
      reliabilityTier: "low",
      publishedAt: null,
      retrievedAt: new Date().toISOString(),
      snippet: null,
      note: "Client research was derived from the uploaded RFP only. No external sources were used.",
    }),
  ];
}

export function buildShadowOutputs(input: ShadowAnalysisInput): {
  shadowRunStatus: ShadowRunStatus;
  manualReviewRequired: boolean;
  comparisonSummary: ShadowComparisonSummary;
  shadowOutputs: ShadowOutputs;
} {
  const snapshot = makeLiveSnapshot(input);
  const evidenceIndex = buildEvidenceIndex(input);
  const validationIssues = buildValidationIssues(input, snapshot);
  const clientResearchMeta = makeClientResearchMeta(input.clientResearch);
  const sources = makeResearchSources(input.clientResearch);
  const shadowScorecard = calculateShadowScorecard(
    input.extractedData,
    input.scopeAnalysis || {
      matches: [],
      agencyServicePercentage: 0,
      fullMatches: 0,
      partialMatches: 0,
      gaps: 0,
      categoryBreakdown: {},
      outputCounts: {
        videos: 0,
        motionGraphics: 0,
        designAssets: 0,
        contentPieces: 0,
        total: 0,
      },
    },
    input.clientResearch || {
      companyName: "Unknown",
      industry: "Unknown",
      entityType: "private",
      estimatedSize: "medium",
      employeeRange: "Unknown",
      holdingGroup: { name: null, tier: "independent" },
      geographicReach: "regional",
      marketingBudgetTier: "moderate",
      mediaSpendsSignal: "moderate",
      socialActivityLevel: "moderate",
      contentPublishingLevel: "moderate",
      digitalPresence: "Unknown",
      confidenceScores: {},
      researchNotes: [],
      sourceType: "document_only_inference",
      externalResearchAvailable: false,
      sources: [],
    },
    input.redFlags,
    {
      evidenceIndex,
      validationIssues,
    },
  );

  const comparisonSummary = buildComparisonSummary(
    input,
    snapshot,
    evidenceIndex,
    validationIssues,
    shadowScorecard.recommendation,
    shadowScorecard.fitScore,
  );

  const manualReviewRequired =
    shadowScorecard.recommendation === "Manual review" ||
    comparisonSummary.parityStatus === "fail" ||
    Boolean(input.documentQuality?.parseWarnings?.length) ||
    Boolean(
      input.documentQuality?.ocrUsed &&
        (input.documentQuality.ocrConfidence ?? 1) < 0.6,
    );

  const shadowOutputs = shadowOutputsSchema.parse({
    version: "shadow-v2",
    createdAt: new Date().toISOString(),
    liveSnapshot: snapshot,
    documentQuality: input.documentQuality ?? null,
    stages: [
      {
        key: "validate",
        label: "Validate live outputs",
        status: "complete",
        detail: `${validationIssues.length} issues recorded`,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      },
      {
        key: "evidence",
        label: "Build evidence index",
        status: "complete",
        detail: `${Object.keys(evidenceIndex).length} evidence buckets`,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      },
      {
        key: "score",
        label: "Compute shadow scorecard",
        status: "complete",
        detail: `${shadowScorecard.fitScore}/100 fit, ${shadowScorecard.confidenceScore}/100 confidence`,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      },
      {
        key: "compare",
        label: "Compare against live result",
        status: "complete",
        detail: comparisonSummary.parityStatus,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      },
    ],
    validation: {
      valid: !validationIssues.some((issue) => issue.severity === "critical"),
      issues: validationIssues,
    },
    evidenceIndex,
    sources,
    clientResearchMeta,
    scorecard: shadowScorecard,
    comparisonSummary,
  });

  return {
    shadowRunStatus: manualReviewRequired ? "manual_review" : "complete",
    manualReviewRequired,
    comparisonSummary,
    shadowOutputs,
  };
}

export function createBaselineSnapshotRecord(input: ShadowAnalysisInput) {
  return makeLiveSnapshot(input);
}
