type QualityStatus = "pass" | "review_required" | "blocked";

interface ExtractedRfpLike {
  qualityFlags?: string[];
  missingInformation?: Array<{ field?: string }>;
  evidence?: Array<{ field?: string }>;
  requiredDeliverables?: Array<unknown>;
  deliverableRequirements?: {
    technical?: Array<{ source?: string; evidenceRef?: string }>;
    commercial?: Array<{ source?: string; evidenceRef?: string }>;
    strategicCreative?: Array<{ source?: string; evidenceRef?: string }>;
  };
  evaluationCriteria?: string;
  importantDates?: Array<unknown>;
}

interface ScopeAnalysisLike {
  matches?: Array<{ class?: string }>;
  unclassifiedItems?: string[];
  uncertainItems?: string[];
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

function criteriaGroupingScore(extracted: ExtractedRfpLike): number {
  const text = (extracted.evaluationCriteria ?? "").trim();
  if (!text) {
    return 0;
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return 0;
  }

  const groupCount = lines.filter((line) => /^\d+\.\s+/.test(line)).length;
  const bulletCount = lines.filter((line) => /^•\s+/.test(line)).length;
  const markdownNoiseCount = lines.filter((line) => /^#{1,6}\s+|^```/.test(line)).length;

  const structureScore =
    clamp(Math.min(groupCount, 6) / 3, 0, 1) * 0.6 +
    clamp(Math.min(bulletCount, 24) / 12, 0, 1) * 0.4;
  const noisePenalty = markdownNoiseCount > 0 ? 0.15 : 0;
  return clamp(structureScore - noisePenalty, 0, 1);
}

function deliverableEvidenceScore(extracted: ExtractedRfpLike): number {
  const groups = extracted.deliverableRequirements;
  if (!groups) {
    const fallbackCount = extracted.requiredDeliverables?.length ?? 0;
    return clamp(fallbackCount / 8);
  }

  const technical = groups.technical ?? [];
  const commercial = groups.commercial ?? [];
  const strategicCreative = groups.strategicCreative ?? [];
  const all = [...technical, ...commercial, ...strategicCreative];

  const categoryCoverage =
    [technical.length > 0, commercial.length > 0, strategicCreative.length > 0].filter(Boolean).length / 3;
  const totalItems = all.length;
  const verbatimCount = all.filter((item) => item.source === "verbatim").length;
  const evidenceRefCount = all.filter((item) => typeof item.evidenceRef === "string" && item.evidenceRef.trim().length > 0).length;

  const itemDensity = clamp(totalItems / 10);
  const verbatimRatio = totalItems > 0 ? verbatimCount / totalItems : 0;
  const evidenceRatio = totalItems > 0 ? evidenceRefCount / totalItems : 0;

  return clamp(
    categoryCoverage * 0.35 +
      itemDensity * 0.2 +
      verbatimRatio * 0.2 +
      evidenceRatio * 0.25
  );
}

function scopeConfidenceScore(scope: ScopeAnalysisLike): number {
  const matches = scope.matches ?? [];
  if (matches.length === 0) {
    return 0.35;
  }

  const confident = matches.filter((item) => item.class !== "uncertain");
  const noneCount = confident.filter((item) => item.class === "none").length;
  const confidentRatio = confident.length / matches.length;
  const noneRatio = confident.length > 0 ? noneCount / confident.length : 0;
  const uncertainPenalty = (scope.uncertainItems?.length ?? scope.unclassifiedItems?.length ?? 0) > 0 ? 0.05 : 0;

  return clamp(confidentRatio * 0.6 + (1 - noneRatio) * 0.4 - uncertainPenalty);
}

export function evaluateQualityGate(input: EvaluateQualityGateInput): QualityAssessment {
  const blockReasons: string[] = [];
  const qualityFlags = new Set((input.extractedRfp.qualityFlags ?? []).map((item) => item.toLowerCase()));

  const evidenceDensity = evidenceDensityScore(input.extractedRfp);
  const criteriaScore = criteriaGroupingScore(input.extractedRfp);
  const deliverableScore = deliverableEvidenceScore(input.extractedRfp);
  const extractionScore = clamp(
    0.55 +
      (qualityFlags.has("incomplete_extraction") ? -0.2 : 0) +
      (qualityFlags.has("conflicts_detected") ? -0.1 : 0) +
      (qualityFlags.has("low_evidence_density") ? -0.2 : 0) +
      evidenceDensity * 0.25 +
      criteriaScore * 0.1 +
      deliverableScore * 0.1
  );

  const scopeScore = scopeConfidenceScore(input.scopeAnalysis);

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

  if (qualityFlags.has("incomplete_document_coverage")) {
    blockReasons.push("Document coverage is incomplete; critical sections were not fully analyzed.");
  }

  if (evidenceDensity < 0.35) {
    blockReasons.push("Evidence density is below minimum threshold for high-confidence recommendation.");
  }

  if (deliverableScore < 0.5) {
    blockReasons.push("Deliverables extraction confidence is low (grouping/evidence insufficient).");
  }

  if (criteriaScore < 0.5) {
    blockReasons.push("Evaluation criteria grouping confidence is low.");
  }
  if (qualityFlags.has("criteria_table_missing")) {
    blockReasons.push("Evaluation criteria table structure could not be confidently recovered.");
  }

  if ((input.extractedRfp.importantDates?.length ?? 0) === 0) {
    blockReasons.push("Important dates were not extracted with sufficient certainty.");
  }
  if (qualityFlags.has("dates_low_confidence")) {
    blockReasons.push("Important dates were extracted with low confidence.");
  }

  if (scopeScore < 0.5) {
    blockReasons.push("Scope confident coverage is too low to support automated recommendation.");
  }
  if (qualityFlags.has("scope_contamination_filtered")) {
    blockReasons.push("Scope text required contamination filtering; manual scope review recommended.");
  }

  if (researchScore < 0.25) {
    blockReasons.push("Research confidence is below minimum threshold.");
  }

  const blocked = blockReasons.length > 0;
  const reviewSignals =
    extractionScore < 0.75 ||
    scopeScore < 0.7 ||
    criteriaScore < 0.7 ||
    deliverableScore < 0.7 ||
    researchScore < 0.65;
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
