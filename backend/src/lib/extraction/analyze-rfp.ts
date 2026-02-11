import { makeError } from "@/lib/api/errors";
import { runPass1Extraction } from "@/lib/extraction/passes/pass1-extract";
import { runPass2Verification } from "@/lib/extraction/passes/pass2-verify";
import { runPass3RedFlags } from "@/lib/extraction/passes/pass3-redflags";
import { runPass4Completeness } from "@/lib/extraction/passes/pass4-completeness";
import { runPass5Conflicts } from "@/lib/extraction/passes/pass5-conflicts";

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
  requiredDeliverables: string[];
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
  conflicts?: Array<{ field: string; candidates: string[]; resolution: string }>;
  evidence: Array<{ field: string; page: number; excerpt: string }>;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, score));
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

  const mergedConfidence: Record<string, number> & { overall: number } = {
    ...pass1.confidenceScores,
    overall: clampScore(
      0.55 * pass1.confidenceScores.overall +
        0.25 * pass2.verificationScore +
        0.2 * pass4.completenessScore
    )
  };

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
    importantDates: pass1.importantDates,
    submissionRequirements: pass1.submissionRequirements,
    redFlags: pass3.redFlags,
    missingInformation: pass4.missingInformation,
    confidenceScores: mergedConfidence,
    completenessScore: pass4.completenessScore,
    warnings: [...pass1.warnings, ...pass2.warnings, ...pass3.warnings, ...pass4.warnings, ...pass5.warnings],
    conflicts: pass5.conflicts,
    evidence: pass1.evidence
  };

  ensureRequired(output);
  return output;
}
