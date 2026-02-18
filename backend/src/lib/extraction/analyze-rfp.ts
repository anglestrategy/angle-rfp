import { makeError } from "@/lib/api/errors";
import { runPass1Extraction } from "@/lib/extraction/passes/pass1-extract";
import { runPass2Verification } from "@/lib/extraction/passes/pass2-verify";
import { runPass3RedFlags } from "@/lib/extraction/passes/pass3-redflags";
import { runPass4Completeness } from "@/lib/extraction/passes/pass4-completeness";
import { runPass5Conflicts } from "@/lib/extraction/passes/pass5-conflicts";
import { beautifyExtractedFields, type BeautifiedText } from "@/lib/extraction/text-beautifier";
import { runAiAdjudication } from "@/lib/extraction/ai-adjudicator";

export interface AnalyzeRfpInput {
  analysisId: string;
  parsedDocument: {
    schemaVersion: string;
    analysisId: string;
    detectedFormat?: "pdf" | "docx" | "txt";
    normalizedText?: string;
    rawText: string;
    sections: Array<{ name: string; startOffset: number; endOffset: number }>;
    chunkIndex?: Array<{
      index: number;
      startOffset: number;
      endOffset: number;
      sectionHints: string[];
    }>;
    tables: Array<{
      title: string;
      headers: string[];
      rows: string[][];
      pages: number[];
      confidence: number;
    }>;
    evidenceMap: Array<{ page: number; charStart: number; charEnd: number; excerpt: string; sourceType: string }>;
    parseConfidence?: number;
    ocrStats?: {
      used: boolean;
      pagesOcred: number;
    } | null;
    parserProvenance?: string[];
    warnings?: string[];
    primaryLanguage: "arabic" | "english" | "mixed";
  };
}

export interface DeliverableItemV1 {
  item: string;
  source: "verbatim" | "inferred";
}

export interface DeliverableRequirementItemV1 {
  title: string;
  description: string;
  source: "verbatim" | "inferred";
  evidenceRef?: string;
}

export interface DeliverableRequirementsV1 {
  technical: DeliverableRequirementItemV1[];
  commercial: DeliverableRequirementItemV1[];
  strategicCreative: DeliverableRequirementItemV1[];
}

export interface ExtractedRfpDataV1 {
  schemaVersion: "1.0.0";
  analysisId: string;
  extractionDate: string;
  clientName: string;
  clientNameArabic: string | null;
  projectName: string;
  projectNameOriginal: string | null;
  projectDescription: string;
  scopeOfWork: string;
  evaluationCriteria: string;
  evaluationCriteriaStructured?: Array<{
    title: string;
    weight: string | null;
    items: string[];
    evidenceRefs: string[];
  }>;
  requiredDeliverables: DeliverableItemV1[];
  deliverableRequirements?: DeliverableRequirementsV1;
  importantDates: Array<{ title: string; date: string; type: string; isCritical: boolean }>;
  submissionRequirements: {
    method: string;
    email: string | null;
    physicalAddress: string | null;
    format: string;
    copies: number | null;
    otherRequirements: string[];
  };
  redFlags: Array<{
    type: "contractual" | "feasibility" | "process";
    severity: "HIGH" | "MEDIUM" | "LOW";
    title: string;
    description: string;
    sourceText: string;
    recommendation: string;
  }>;
  missingInformation: Array<{ field: string; suggestedQuestion: string }>;
  confidenceScores: Record<string, number> & { overall: number };
  completenessScore: number;
  warnings: string[];
  qualityFlags: string[];
  quality: {
    status: "pass" | "review_required" | "blocked";
    blocked: boolean;
    blockReasons: string[];
    evidenceDensity: number;
    sectionScores: {
      extraction: number;
      scope: number;
      evaluation: number;
    };
  };
  conflicts?: Array<{ field: string; candidates: string[]; resolution: string }>;
  evidence: Array<{ field: string; page: number; excerpt: string }>;
  // Beautified text fields with structured sections for rich UI rendering
  beautifiedText?: {
    projectDescription: BeautifiedText;
    scopeOfWork: BeautifiedText;
    evaluationCriteria: BeautifiedText;
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, score));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isAiEndToEndModeEnabled(): boolean {
  if (process.env.RFP_AI_END_TO_END === "1") {
    return true;
  }
  if (process.env.RFP_AI_END_TO_END === "0") {
    return false;
  }
  return process.env.NODE_ENV !== "test";
}

function shouldUseAiAdjudication(): boolean {
  if (isAiEndToEndModeEnabled()) {
    return true;
  }
  if (process.env.RFP_AI_ADJUDICATION === "1") {
    return true;
  }
  if (process.env.RFP_AI_ADJUDICATION === "0") {
    return false;
  }
  return process.env.NODE_ENV !== "test";
}

function ensureRequired(output: ExtractedRfpDataV1): void {
  const requiredStringFields: Array<keyof ExtractedRfpDataV1> = [
    "clientName",
    "projectName",
    "projectDescription",
    "scopeOfWork",
    "evaluationCriteria"
  ];

  for (const field of requiredStringFields) {
    const value = output[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw makeError(422, "schema_validation_failed", `Missing required extracted field: ${field}`, "analyze-rfp", {
        retryable: true,
        details: { field }
      });
    }
  }
}

export async function analyzeRfpInput(input: AnalyzeRfpInput): Promise<ExtractedRfpDataV1> {
  if (!input.analysisId || !input.parsedDocument?.rawText) {
    throw makeError(400, "validation_error", "analysisId and parsedDocument.rawText are required", "analyze-rfp", {
      retryable: false
    });
  }

  const pass1 = await runPass1Extraction(input);
  const pass2 = runPass2Verification(input, pass1);
  const pass3 = await runPass3RedFlags(input, pass1);
  const pass4 = runPass4Completeness(input, pass1);
  const pass5 = runPass5Conflicts(input, pass1);

  let aiAdjudication: Awaited<ReturnType<typeof runAiAdjudication>> | null = null;
  let aiAdjudicationError: string | null = null;
  if (shouldUseAiAdjudication()) {
    try {
      aiAdjudication = await runAiAdjudication({
        analysisId: input.analysisId,
        parsedDocument: input.parsedDocument,
        extracted: pass1,
        deterministicHints: {
          verificationScore: pass2.verificationScore,
          completenessScore: pass4.completenessScore,
          warnings: [...pass2.warnings, ...pass3.warnings, ...pass4.warnings, ...pass5.warnings],
          redFlags: pass3.redFlags,
          missingInformation: pass4.missingInformation,
          conflicts: pass5.conflicts ?? []
        }
      });
    } catch (error) {
      aiAdjudicationError = error instanceof Error ? error.message : "Unknown AI adjudication error";
      if (isAiEndToEndModeEnabled()) {
        throw makeError(
          422,
          "upstream_unavailable",
          `AI end-to-end mode requires adjudication, but adjudication failed: ${aiAdjudicationError}`,
          "analyze-rfp",
          { retryable: true }
        );
      }
      console.error("AI adjudication failed. Falling back to deterministic QA passes:", error);
    }
  }

  // Run text beautification for structured rendering.
  // Default is enabled because deterministic formatting is fast and reliable.
  const ENABLE_BEAUTIFIER =
    process.env.ENABLE_BEAUTIFIER !== "0" &&
    process.env.ENABLE_TEXT_BEAUTIFIER !== "0";

  let beautifiedText: ExtractedRfpDataV1["beautifiedText"];
  let beautifierError: string | null = null;
  if (ENABLE_BEAUTIFIER) {
    try {
      beautifiedText = await beautifyExtractedFields({
        projectDescription: pass1.projectDescription,
        scopeOfWork: pass1.scopeOfWork,
        evaluationCriteria: pass1.evaluationCriteria
      });
    } catch (error) {
      console.error("Text beautification failed:", error);
      beautifiedText = undefined; // Explicit fallback (use undefined, not null)
      beautifierError = error instanceof Error ? error.message : "Unknown beautification error";
      // Continue without beautified text - it's enhancement, not critical
    }
  } else {
    console.log("[Beautifier] Disabled temporarily - will re-enable after timeout fixes are validated");
  }

  const verificationScore = aiAdjudication?.verificationScore ?? pass2.verificationScore;
  const resolvedCompletenessScore = aiAdjudication?.completenessScore ?? pass4.completenessScore;

  const mergedConfidence: Record<string, number> & { overall: number } = {
    ...pass1.confidenceScores,
    overall: clampScore(
      0.55 * pass1.confidenceScores.overall +
        0.25 * verificationScore +
        0.2 * resolvedCompletenessScore
    )
  };

  const qualityFlags = new Set<string>();
  if (!beautifiedText) {
    qualityFlags.add("quality_degraded");
  }
  let redFlags = pass3.redFlags;
  let missingInformation = pass4.missingInformation;
  let conflicts = pass5.conflicts;
  let adjudicationWarnings = [...pass2.warnings, ...pass3.warnings, ...pass4.warnings, ...pass5.warnings];

  let evidenceDensity = clampScore((pass1.evidence?.length ?? 0) / 7);
  let sectionScores = {
    extraction: round2(mergedConfidence.overall),
    scope: round2(clampScore(pass1.confidenceScores.scopeOfWork ?? 0)),
    evaluation: round2(clampScore(pass1.confidenceScores.evaluationCriteria ?? 0))
  };
  let blockReasons: string[] = [];
  let status: "pass" | "review_required" | "blocked";
  let blocked = false;

  if (aiAdjudication) {
    redFlags = aiAdjudication.redFlags;
    missingInformation = aiAdjudication.missingInformation;
    conflicts = aiAdjudication.conflicts;
    adjudicationWarnings = aiAdjudication.warnings;
    for (const flag of aiAdjudication.qualityFlags) {
      qualityFlags.add(flag);
    }
    blockReasons = [...aiAdjudication.quality.blockReasons];
    blocked = aiAdjudication.quality.status === "blocked" || blockReasons.length > 0;
    status = blocked ? "blocked" : aiAdjudication.quality.status;
    evidenceDensity = round2(clampScore(aiAdjudication.quality.evidenceDensity));
    sectionScores = {
      extraction: round2(clampScore(aiAdjudication.quality.sectionScores.extraction)),
      scope: round2(clampScore(aiAdjudication.quality.sectionScores.scope)),
      evaluation: round2(clampScore(aiAdjudication.quality.sectionScores.evaluation))
    };
  } else {
    if (resolvedCompletenessScore < 0.75) {
      qualityFlags.add("incomplete_extraction");
    }
    if ((pass5.conflicts?.length ?? 0) > 0) {
      qualityFlags.add("conflicts_detected");
    }
    if ((pass1.evidence?.length ?? 0) < 4) {
      qualityFlags.add("low_evidence_density");
    }
    if ((pass1.evaluationCriteriaStructured?.length ?? 0) < 2) {
      qualityFlags.add("low_criteria_confidence");
    }
    const groupedDeliverables = pass1.deliverableRequirements;
    const deliverableBucketCount = [
      groupedDeliverables.technical.length > 0,
      groupedDeliverables.commercial.length > 0,
      groupedDeliverables.strategicCreative.length > 0
    ].filter(Boolean).length;
    if (deliverableBucketCount < 2) {
      qualityFlags.add("low_deliverables_confidence");
    }
    const scopeLineCount = pass1.scopeOfWork
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("• "))
      .length;
    if (scopeLineCount < 2) {
      qualityFlags.add("low_scope_confidence");
    }
    const incompleteCoverage = pass1.warnings.some((warning) =>
      /coverage is incomplete|missing section hints/i.test(warning)
    );
    const parseTruncated = pass1.warnings.some((warning) =>
      /parsed text was truncated/i.test(warning)
    );
    if (incompleteCoverage) {
      qualityFlags.add("incomplete_document_coverage");
    }
    if (parseTruncated) {
      qualityFlags.add("incomplete_document_coverage");
    }
    const criticalMissing = pass4.missingInformation.some((item) =>
      /scope|evaluation|deliverable|deadline|submission|client|project/i.test(item.field)
    );
    if (criticalMissing) {
      qualityFlags.add("critical_info_missing");
    }
    if (pass1.warnings.some((warning) => /\[scope_contamination_filtered\]|scope contamination filtered/i.test(warning))) {
      qualityFlags.add("scope_contamination_filtered");
    }
    if (pass1.warnings.some((warning) => /\[criteria_table_missing\]|evaluation tables were detected but could not be reliably structured/i.test(warning))) {
      qualityFlags.add("criteria_table_missing");
    }
    if (pass1.warnings.some((warning) => /\[deliverables_contamination_filtered\]|deliverable-adjacent legal\/admin lines/i.test(warning))) {
      qualityFlags.add("deliverables_contamination_filtered");
    }
    if (pass1.warnings.some((warning) => /\[dates_low_confidence\]|important dates were inferred without strong timeline-section support/i.test(warning))) {
      qualityFlags.add("dates_low_confidence");
    }

    if (criticalMissing) {
      blockReasons.push("Critical fields are missing or incomplete.");
    }
    if (incompleteCoverage) {
      blockReasons.push("Document coverage is incomplete; critical sections were not fully analyzed.");
    }
    if (parseTruncated) {
      blockReasons.push("Parsed document was truncated by configured limits; full-document analysis is incomplete.");
    }
    if (qualityFlags.has("low_scope_confidence")) {
      blockReasons.push("Scope extraction confidence is low; review scope classification manually.");
    }
    if (qualityFlags.has("low_criteria_confidence")) {
      blockReasons.push("Evaluation criteria grouping quality is low.");
    }
    if (qualityFlags.has("low_deliverables_confidence")) {
      blockReasons.push("Deliverables grouping quality is low.");
    }
    if (qualityFlags.has("criteria_table_missing")) {
      blockReasons.push("Evaluation criteria tables could not be reliably structured.");
    }
    if (qualityFlags.has("dates_low_confidence")) {
      blockReasons.push("Important dates confidence is low and should be manually verified.");
    }
    if (qualityFlags.has("conflicts_detected")) {
      blockReasons.push("Conflicting extracted values require manual review.");
    }
    blocked = blockReasons.length > 0;
    status = blocked
      ? "blocked"
      : (qualityFlags.has("quality_degraded") || qualityFlags.has("low_evidence_density") || qualityFlags.has("incomplete_extraction"))
        ? "review_required"
        : "pass";
    if (aiAdjudicationError) {
      qualityFlags.add("ai_adjudication_unavailable");
      adjudicationWarnings.push(`AI adjudication unavailable. Deterministic QA used: ${aiAdjudicationError}`);
    }
  }

  const output: ExtractedRfpDataV1 = {
    schemaVersion: "1.0.0",
    analysisId: input.analysisId,
    extractionDate: new Date().toISOString(),
    clientName: pass1.clientName,
    clientNameArabic: pass1.clientNameArabic,
    projectName: pass1.projectName,
    projectNameOriginal: pass1.projectNameOriginal,
    projectDescription: pass1.projectDescription,
    scopeOfWork: pass1.scopeOfWork,
    evaluationCriteria: pass1.evaluationCriteria,
    evaluationCriteriaStructured: pass1.evaluationCriteriaStructured,
    requiredDeliverables: pass1.requiredDeliverables,
    deliverableRequirements: pass1.deliverableRequirements,
    importantDates: pass1.importantDates,
    submissionRequirements: pass1.submissionRequirements,
    redFlags,
    missingInformation,
    confidenceScores: mergedConfidence,
    completenessScore: resolvedCompletenessScore,
    warnings: [
      ...pass1.warnings,
      ...adjudicationWarnings,
      ...(beautifierError ? [`Text beautification timed out or failed: ${beautifierError}`] : [])
    ],
    qualityFlags: Array.from(qualityFlags),
    quality: {
      status,
      blocked,
      blockReasons,
      evidenceDensity,
      sectionScores
    },
    conflicts,
    evidence: pass1.evidence,
    beautifiedText
  };

  ensureRequired(output);
  return output;
}
