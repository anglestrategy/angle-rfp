type QualityStatus = "pass" | "review_required" | "blocked";

interface ExtractedRfpLike {
  qualityFlags?: string[];
  missingInformation?: Array<{ field?: string }>;
  evidence?: Array<{ field?: string }>;
  requiredDeliverables?: Array<unknown>;
  importantDates?: Array<unknown>;
}

interface ScopeAnalysisLike {
  matches?: Array<{ class?: string }>;
  unclassifiedItems?: string[];
  warnings?: string[];
}

interface ClientResearchLike {
  confidence?: number;
  researchMetadata?: {
    overallConfidence?: number;
    sourcesUsed?: number;
    providerStats?: Array<{ finalStatus?: string }>;
  };
  warnings?: string[];
}

export interface QualityAssessment {
  status: QualityStatus;
  blocked: boolean;
  blockReasons: string[];
  evidenceDensity: number;
  sectionScores: {
    extraction: number;
    scope: number;
    research: number;
  };
}

interface EvaluateQualityGateInput {
  extractedRfp: ExtractedRfpLike;
  scopeAnalysis: ScopeAnalysisLike;
  clientResearch: ClientResearchLike;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function hasCriticalFieldName(field: string): boolean {
  return /client|project|scope|evaluation|deliverable|deadline|submission/i.test(field);
}

function evidenceDensityScore(extracted: ExtractedRfpLike): number {
  const requiredFields = new Set([
    "clientname",
    "projectname",
    "scopeofwork",
    "evaluationcriteria",
    "requireddeliverables",
    "importantdates",
    "submissionrequirements"
  ]);

  const evidenced = new Set(
    (extracted.evidence ?? [])
      .map((item) => (item.field ?? "").toLowerCase().replace(/\s+/g, ""))
      .filter(Boolean)
  );

  if (evidenced.size === 0) {
    return 0;
  }

  let matched = 0;
  for (const required of requiredFields) {
    if (Array.from(evidenced).some((field) => field.includes(required))) {
      matched += 1;
    }
  }

  return clamp(matched / requiredFields.size);
}

export function evaluateQualityGate(input: EvaluateQualityGateInput): QualityAssessment {
  const blockReasons: string[] = [];
  const qualityFlags = new Set((input.extractedRfp.qualityFlags ?? []).map((item) => item.toLowerCase()));

  const evidenceDensity = evidenceDensityScore(input.extractedRfp);
  const extractionScore = clamp(
    0.55 +
      (qualityFlags.has("incomplete_extraction") ? -0.2 : 0) +
      (qualityFlags.has("conflicts_detected") ? -0.1 : 0) +
      (qualityFlags.has("low_evidence_density") ? -0.2 : 0) +
      evidenceDensity * 0.35
  );

  const scopeMatches = input.scopeAnalysis.matches ?? [];
  const uncertainCount = scopeMatches.filter((item) => item.class === "uncertain").length;
  const scopeBase = scopeMatches.length === 0 ? 0.4 : 1 - uncertainCount / scopeMatches.length;
  const scopeScore = clamp(scopeBase - ((input.scopeAnalysis.unclassifiedItems?.length ?? 0) > 0 ? 0.05 : 0));

  const researchConfidenceRaw =
    input.clientResearch.researchMetadata?.overallConfidence ??
    input.clientResearch.confidence ??
    0;
  const sourcesUsed = input.clientResearch.researchMetadata?.sourcesUsed ?? 0;
  const failedProviders =
    input.clientResearch.researchMetadata?.providerStats?.filter((item) => item.finalStatus === "failed").length ?? 0;
  const researchScore = clamp(
    researchConfidenceRaw * 0.75 +
      clamp(sourcesUsed / 8) * 0.2 -
      (failedProviders >= 3 ? 0.15 : 0)
  );

  if (qualityFlags.has("critical_info_missing")) {
    blockReasons.push("Critical RFP fields are missing or incomplete.");
  }

  const criticalMissing = (input.extractedRfp.missingInformation ?? []).some((item) =>
    hasCriticalFieldName(item.field ?? "")
  );
  if (criticalMissing) {
    blockReasons.push("Critical clarification gaps remain unresolved.");
  }

  if (evidenceDensity < 0.4) {
    blockReasons.push("Evidence density is below minimum threshold for high-confidence recommendation.");
  }

  if ((input.extractedRfp.requiredDeliverables?.length ?? 0) === 0) {
    blockReasons.push("Deliverable extraction is incomplete.");
  }

  if ((input.extractedRfp.importantDates?.length ?? 0) === 0) {
    blockReasons.push("Important dates were not extracted with sufficient certainty.");
  }

  if (scopeScore < 0.55) {
    blockReasons.push("Scope classification is too uncertain to support automated recommendation.");
  }

  if (researchScore < 0.5) {
    blockReasons.push("Research confidence is below minimum threshold.");
  }

  const blocked = blockReasons.length > 0;
  const reviewSignals = extractionScore < 0.75 || scopeScore < 0.7 || researchScore < 0.65;
  const status: QualityStatus = blocked ? "blocked" : reviewSignals ? "review_required" : "pass";

  return {
    status,
    blocked,
    blockReasons,
    evidenceDensity: Math.round(evidenceDensity * 100) / 100,
    sectionScores: {
      extraction: Math.round(extractionScore * 100) / 100,
      scope: Math.round(scopeScore * 100) / 100,
      research: Math.round(researchScore * 100) / 100
    }
  };
}
