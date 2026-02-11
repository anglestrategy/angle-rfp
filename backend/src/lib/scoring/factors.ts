const TOTAL_SCORE_POINTS = 100;

const FACTOR_MAX_POINTS = {
  projectScopeMagnitude: 18,
  agencyServicesPercentage: 15,
  outputQuantities: 8,
  outputTypes: 10,
  companyBrandSize: 12,
  brandPopularityReach: 8,
  holdingGroupAffiliation: 5,
  entityType: 5,
  mediaAdSpendIndicators: 10,
  socialActivityLevel: 5,
  contentTypesPublished: 4
} as const;

type FactorKey = keyof typeof FACTOR_MAX_POINTS;

export interface FactorBreakdownItem {
  factor: string;
  weight: number;
  score: number;
  contribution: number;
  evidence: string[];
  identified: boolean; // false when data unavailable, factor excluded from weighted average
}

interface ScopeAnalysisLike {
  agencyServicePercentage?: number;
  outputQuantities?: {
    videoProduction?: number | null;
    motionGraphics?: number | null;
    visualDesign?: number | null;
    contentOnly?: number | null;
  };
  outputTypes?: string[];
}

interface ExtractedRfpLike {
  requiredDeliverables?: string[];
  importantDates?: Array<{ date?: string }>;
  redFlags?: Array<{ severity?: string }>;
}

interface ClientResearchLike {
  companyProfile?: Record<string, unknown> & { entityType?: string };
  financialIndicators?: Record<string, unknown> & { marketingBudgetIndicator?: string };
  digitalPresence?: Record<string, unknown> & { bilingual?: boolean; confidence?: number };
  advertisingActivity?: Record<string, unknown> & { confidence?: number };
  researchMetadata?: Record<string, unknown> & { sourcesUsed?: number };
}

export interface BuildFactorsInput {
  extractedRfp: ExtractedRfpLike;
  scopeAnalysis: ScopeAnalysisLike;
  clientResearch: ClientResearchLike;
}

export interface BuildFactorsResult {
  factors: FactorBreakdownItem[];
  warnings: string[];
  baseScore: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNormalizedScore(points: number, maxPoints: number): number {
  if (maxPoints <= 0) {
    return 0;
  }
  return roundToTwo((clamp(points, 0, maxPoints) / maxPoints) * 100);
}

function factorItem(
  key: FactorKey,
  label: string,
  points: number,
  evidence: string[],
  identified: boolean = true
): FactorBreakdownItem {
  const maxPoints = FACTOR_MAX_POINTS[key];
  const boundedPoints = roundToTwo(clamp(points, 0, maxPoints));
  return {
    factor: label,
    weight: roundToTwo(maxPoints / TOTAL_SCORE_POINTS),
    score: toNormalizedScore(boundedPoints, maxPoints),
    contribution: boundedPoints,
    evidence,
    identified
  };
}

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function inferTimelineMonths(importantDates: Array<{ date?: string }> | undefined): number | null {
  if (!importantDates || importantDates.length < 2) {
    return null;
  }

  const parsed = importantDates
    .map((item) => (item.date ? parseDate(item.date) : null))
    .filter((item): item is Date => item !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (parsed.length < 2) {
    return null;
  }

  const first = parsed[0].getTime();
  const last = parsed[parsed.length - 1].getTime();
  const diffDays = Math.max(0, (last - first) / (1000 * 60 * 60 * 24));
  return diffDays / 30;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const digits = value.replace(/[^\d.]/g, "");
    if (digits.length === 0) {
      return null;
    }
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseOutputTypes(outputTypes: string[] | undefined): Set<string> {
  return new Set((outputTypes ?? []).map((item) => item.trim().toLowerCase()));
}

function parseEmployeeCount(clientResearch: ClientResearchLike): number | null {
  const profile = clientResearch.companyProfile ?? {};
  const candidates = [
    profile.employeeCount,
    profile.employees,
    profile.estimatedEmployees,
    profile.staffSize
  ];
  for (const value of candidates) {
    const parsed = toNumber(value);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function buildFactorBreakdown(input: BuildFactorsInput): BuildFactorsResult {
  const warnings: string[] = [];
  const factors: FactorBreakdownItem[] = [];

  const deliverableCount = input.extractedRfp.requiredDeliverables?.length ?? 0;
  const timelineMonths = inferTimelineMonths(input.extractedRfp.importantDates);
  let scopePoints = 2;
  if (deliverableCount >= 20 || (timelineMonths ?? 0) >= 6) {
    scopePoints = 17;
  } else if (deliverableCount >= 10 || (timelineMonths ?? 0) >= 3) {
    scopePoints = 12;
  } else if (deliverableCount >= 5 || (timelineMonths ?? 0) >= 1) {
    scopePoints = 7;
  }
  factors.push(
    factorItem("projectScopeMagnitude", "Project Scope Magnitude", scopePoints, [
      `Deliverables counted: ${deliverableCount}`,
      timelineMonths === null
        ? "Timeline duration unavailable; using deliverable volume."
        : `Timeline estimate: ${roundToTwo(timelineMonths)} months`
    ])
  );

  const agencyRatio = clamp(input.scopeAnalysis.agencyServicePercentage ?? 0, 0, 1);
  factors.push(
    factorItem("agencyServicesPercentage", "Agency Services Percentage", agencyRatio * 15, [
      `Agency service percentage: ${roundToTwo(agencyRatio * 100)}%`
    ])
  );

  const quantities = input.scopeAnalysis.outputQuantities;
  const totalOutputs =
    (quantities?.videoProduction ?? 0) +
    (quantities?.motionGraphics ?? 0) +
    (quantities?.visualDesign ?? 0) +
    (quantities?.contentOnly ?? 0);
  const outputQuantitiesIdentified = quantities !== undefined && quantities !== null && totalOutputs > 0;
  let quantityPoints = 1;
  if (totalOutputs >= 50) {
    quantityPoints = 7.5;
  } else if (totalOutputs >= 25) {
    quantityPoints = 5.5;
  } else if (totalOutputs >= 10) {
    quantityPoints = 3.5;
  }
  factors.push(
    factorItem(
      "outputQuantities",
      "Output Quantities",
      outputQuantitiesIdentified ? quantityPoints : 0,
      [outputQuantitiesIdentified ? `Total identified outputs: ${totalOutputs}` : "Output quantities not identified in RFP"],
      outputQuantitiesIdentified
    )
  );

  const outputTypes = parseOutputTypes(input.scopeAnalysis.outputTypes);
  const outputTypesIdentified = outputTypes.size > 0;
  let outputTypePoints = 0;
  if (outputTypes.has("videoproduction")) {
    outputTypePoints += 4;
  }
  if (outputTypes.has("motiongraphics")) {
    outputTypePoints += 3;
  }
  if (outputTypes.has("visualdesign")) {
    outputTypePoints += 2;
  }
  if (outputTypes.has("contentonly")) {
    outputTypePoints += 1;
  }
  factors.push(
    factorItem(
      "outputTypes",
      "Output Types",
      outputTypesIdentified ? Math.min(outputTypePoints, 10) : 0,
      [outputTypesIdentified ? `Detected output types: ${Array.from(outputTypes).join(", ")}` : "Output types not identified in RFP"],
      outputTypesIdentified
    )
  );

  const employeeCount = parseEmployeeCount(input.clientResearch);
  let sizePoints: number;
  let sizeEvidence: string;
  if (employeeCount !== null) {
    if (employeeCount >= 5000) {
      sizePoints = 11;
    } else if (employeeCount >= 1000) {
      sizePoints = 8;
    } else if (employeeCount >= 100) {
      sizePoints = 5;
    } else {
      sizePoints = 2;
    }
    sizeEvidence = `Employee estimate: ${Math.round(employeeCount)}`;
  } else {
    const budgetIndicator = normalizeText(input.clientResearch.financialIndicators?.marketingBudgetIndicator);
    if (budgetIndicator.includes("very_high") || budgetIndicator.includes("high")) {
      sizePoints = 8;
    } else if (budgetIndicator.includes("medium")) {
      sizePoints = 5;
    } else if (budgetIndicator.includes("low")) {
      sizePoints = 2;
    } else {
      sizePoints = 5;
    }
    sizeEvidence = "Employee count unavailable; inferred from budget indicators.";
    warnings.push("Company size inferred from secondary indicators due missing employee estimate.");
  }
  factors.push(
    factorItem("companyBrandSize", "Company/Brand Size", sizePoints, [sizeEvidence])
  );

  const reachHint = normalizeText(
    input.clientResearch.companyProfile?.brandReach ??
      input.clientResearch.companyProfile?.popularity
  );
  let reachPoints = 1.5;
  if (reachHint.includes("international") || reachHint.includes("global")) {
    reachPoints = 7.5;
  } else if (reachHint.includes("national")) {
    reachPoints = 5.5;
  } else if (reachHint.includes("regional")) {
    reachPoints = 3.5;
  } else if (reachHint.includes("local")) {
    reachPoints = 1.5;
  } else {
    const sourcesUsed = toNumber(input.clientResearch.researchMetadata?.sourcesUsed) ?? 0;
    if (sourcesUsed >= 12) {
      reachPoints = 5.5;
    } else if (sourcesUsed >= 6) {
      reachPoints = 3.5;
    }
  }
  if (input.clientResearch.digitalPresence?.bilingual) {
    reachPoints = Math.min(8, reachPoints + 0.5);
  }
  factors.push(
    factorItem("brandPopularityReach", "Brand Popularity/Reach", reachPoints, [
      reachHint.length > 0 ? `Reach hint: ${reachHint}` : "Reach inferred from source coverage."
    ])
  );

  const holdingGroupTier = normalizeText(input.clientResearch.companyProfile?.holdingGroupTier);
  const holdingGroupName = normalizeText(input.clientResearch.companyProfile?.holdingGroup);
  let holdingPoints = 0;
  const holdingGroupIdentified = holdingGroupTier.length > 0 || holdingGroupName.length > 0;
  if (holdingGroupTier.includes("major") || holdingGroupTier.includes("large")) {
    holdingPoints = 5;
  } else if (holdingGroupTier.includes("small") || holdingGroupTier.includes("medium")) {
    holdingPoints = 3;
  } else if (holdingGroupName.length > 0) {
    holdingPoints = 3;
  }
  factors.push(
    factorItem(
      "holdingGroupAffiliation",
      "Holding Group Affiliation",
      holdingGroupIdentified ? holdingPoints : 0,
      [holdingGroupIdentified ? "Holding group signal detected." : "Holding-group data not available."],
      holdingGroupIdentified
    )
  );

  const entityType = normalizeText(input.clientResearch.companyProfile?.entityType);
  let entityPoints = 2;
  if (entityType.includes("private")) {
    entityPoints = 5;
  } else if (entityType.includes("public")) {
    entityPoints = 4;
  } else if (entityType.includes("semi") || entityType.includes("quasi")) {
    entityPoints = 3;
  } else if (entityType.includes("government")) {
    entityPoints = 2;
  }
  factors.push(
    factorItem("entityType", "Entity Type", entityPoints, [
      entityType.length > 0 ? `Entity type: ${entityType}` : "Entity type unavailable; conservative default applied."
    ])
  );

  const spendIndicator = normalizeText(input.clientResearch.financialIndicators?.marketingBudgetIndicator);
  let spendPoints = 1.5;
  if (spendIndicator.includes("very_high") || spendIndicator.includes("high")) {
    spendPoints = 9.5;
  } else if (spendIndicator.includes("medium")) {
    spendPoints = 7;
  } else if (spendIndicator.includes("low")) {
    spendPoints = 4;
  } else if (spendIndicator.includes("minimal") || spendIndicator.includes("none")) {
    spendPoints = 1.5;
  }
  factors.push(
    factorItem("mediaAdSpendIndicators", "Media/Ad Spend Indicators", spendPoints, [
      spendIndicator.length > 0 ? `Budget indicator: ${spendIndicator}` : "Budget indicator unavailable."
    ])
  );

  const activityLevel = normalizeText(
    input.clientResearch.advertisingActivity?.activityLevel ??
      input.clientResearch.digitalPresence?.activityLevel
  );
  const activityConfidence = clamp(input.clientResearch.advertisingActivity?.confidence ?? 0, 0, 1);
  let socialPoints = 0;
  if (activityLevel.includes("very_high")) {
    socialPoints = 5;
  } else if (activityLevel.includes("high")) {
    socialPoints = 4;
  } else if (activityLevel.includes("moderate")) {
    socialPoints = 3;
  } else if (activityLevel.includes("low")) {
    socialPoints = 1.5;
  } else if (activityLevel.includes("inactive") || activityLevel.includes("none")) {
    socialPoints = 0;
  } else {
    if (activityConfidence >= 0.85) {
      socialPoints = 4;
    } else if (activityConfidence >= 0.65) {
      socialPoints = 3;
    } else if (activityConfidence >= 0.35) {
      socialPoints = 1.5;
    }
  }
  factors.push(
    factorItem("socialActivityLevel", "Social Activity Level", socialPoints, [
      activityLevel.length > 0
        ? `Activity level signal: ${activityLevel}`
        : `Activity confidence fallback: ${activityConfidence}`
    ])
  );

  const hasVideo = outputTypes.has("videoproduction");
  const hasMotion = outputTypes.has("motiongraphics");
  const hasVisual = outputTypes.has("visualdesign");
  const hasContentOnly = outputTypes.has("contentonly");
  let contentTypePoints = 1;
  if (hasVideo && (hasMotion || hasVisual)) {
    contentTypePoints = 4;
  } else if (hasVideo && hasContentOnly) {
    contentTypePoints = 3;
  } else if (hasVisual || hasMotion) {
    contentTypePoints = 2;
  }
  factors.push(
    factorItem("contentTypesPublished", "Content Types Published", contentTypePoints, [
      outputTypes.size > 0 ? `Output types considered: ${Array.from(outputTypes).join(", ")}` : "No output types available."
    ])
  );

  // Calculate base score only from identified factors
  // Unidentified factors are excluded from the weighted average
  const identifiedFactors = factors.filter((f) => f.identified);
  const totalIdentifiedWeight = identifiedFactors.reduce((sum, f) => sum + f.weight, 0);

  let baseScore: number;
  if (totalIdentifiedWeight > 0) {
    // Normalize the score based on identified factors only
    const rawContribution = identifiedFactors.reduce((sum, f) => sum + f.contribution, 0);
    // Scale up the score to account for excluded factors
    baseScore = roundToTwo((rawContribution / totalIdentifiedWeight) * (TOTAL_SCORE_POINTS / 100));
  } else {
    // Fallback if no factors are identified (shouldn't happen)
    baseScore = roundToTwo(factors.reduce((sum, f) => sum + f.contribution, 0));
  }

  return {
    factors,
    warnings,
    baseScore
  };
}
