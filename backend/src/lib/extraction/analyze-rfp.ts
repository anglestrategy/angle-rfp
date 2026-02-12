import { makeError } from "@/lib/api/errors";
import { runPass1Extraction } from "@/lib/extraction/passes/pass1-extract";
import { runPass2Verification } from "@/lib/extraction/passes/pass2-verify";
import { runPass3RedFlags } from "@/lib/extraction/passes/pass3-redflags";
import { runPass4Completeness } from "@/lib/extraction/passes/pass4-completeness";
import { runPass5Conflicts } from "@/lib/extraction/passes/pass5-conflicts";
import { beautifyExtractedFields, type BeautifiedText } from "@/lib/extraction/text-beautifier";

export interface AnalyzeRfpInput {
  analysisId: string;
  parsedDocument: {
    schemaVersion: string;
    analysisId: string;
    rawText: string;
    sections: Array<{ name: string; startOffset: number; endOffset: number }>;
    tables: Array<{
      title: string;
      headers: string[];
      rows: string[][];
      pages: number[];
      confidence: number;
    }>;
    evidenceMap: Array<{ page: number; charStart: number; charEnd: number; excerpt: string; sourceType: string }>;
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
  const pass3 = runPass3RedFlags(input, pass1);
  const pass4 = runPass4Completeness(input, pass1);
  const pass5 = runPass5Conflicts(input, pass1);

  // Run text beautification in parallel for key content fields
  let beautifiedText: ExtractedRfpDataV1["beautifiedText"];
  try {
    beautifiedText = await beautifyExtractedFields({
      projectDescription: pass1.projectDescription,
      scopeOfWork: pass1.scopeOfWork,
      evaluationCriteria: pass1.evaluationCriteria
    });
  } catch (error) {
    console.error("Text beautification failed:", error);
    // Continue without beautified text - it's enhancement, not critical
  }

  const mergedConfidence: Record<string, number> & { overall: number } = {
    ...pass1.confidenceScores,
    overall: clampScore(
      0.55 * pass1.confidenceScores.overall +
        0.25 * pass2.verificationScore +
        0.2 * pass4.completenessScore
    )
  };

  const qualityFlags = new Set<string>();
  if (!beautifiedText) {
    qualityFlags.add("quality_degraded");
  }
  if (pass4.completenessScore < 0.75) {
    qualityFlags.add("incomplete_extraction");
  }
  if ((pass5.conflicts?.length ?? 0) > 0) {
    qualityFlags.add("conflicts_detected");
  }
  if ((pass1.evidence?.length ?? 0) < 4) {
    qualityFlags.add("low_evidence_density");
  }
  const criticalMissing = pass4.missingInformation.some((item) =>
    /scope|evaluation|deliverable|deadline|submission|client|project/i.test(item.field)
  );
  if (criticalMissing) {
    qualityFlags.add("critical_info_missing");
  }

  const evidenceDensity = clampScore((pass1.evidence?.length ?? 0) / 7);
  const sectionScores = {
    extraction: round2(mergedConfidence.overall),
    scope: round2(clampScore(pass1.confidenceScores.scopeOfWork ?? 0)),
    evaluation: round2(clampScore(pass1.confidenceScores.evaluationCriteria ?? 0))
  };
  const blockReasons: string[] = [];
  if (criticalMissing) {
    blockReasons.push("Critical fields are missing or incomplete.");
  }
  if (evidenceDensity < 0.4) {
    blockReasons.push("Evidence density is below minimum threshold.");
  }
  if (qualityFlags.has("conflicts_detected")) {
    blockReasons.push("Conflicting extracted values require manual review.");
  }
  const blocked = blockReasons.length > 0;
  const status: "pass" | "review_required" | "blocked" = blocked
    ? "blocked"
    : (qualityFlags.has("quality_degraded") || qualityFlags.has("low_evidence_density") || qualityFlags.has("incomplete_extraction"))
      ? "review_required"
      : "pass";

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
    requiredDeliverables: pass1.requiredDeliverables,
    deliverableRequirements: pass1.deliverableRequirements,
    importantDates: pass1.importantDates,
    submissionRequirements: pass1.submissionRequirements,
    redFlags: pass3.redFlags,
    missingInformation: pass4.missingInformation,
    confidenceScores: mergedConfidence,
    completenessScore: pass4.completenessScore,
    warnings: [...pass1.warnings, ...pass2.warnings, ...pass3.warnings, ...pass4.warnings, ...pass5.warnings],
    qualityFlags: Array.from(qualityFlags),
    quality: {
      status,
      blocked,
      blockReasons,
      evidenceDensity: round2(evidenceDensity),
      sectionScores
    },
    conflicts: pass5.conflicts,
    evidence: pass1.evidence,
    beautifiedText
  };

  ensureRequired(output);
  return output;
}
