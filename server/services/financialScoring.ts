import type { ScopeAnalysisResult } from "./serviceTaxonomy";
import type { ClientResearchResult } from "./clientResearch";
import type { AgencyCalibrationContext } from "./workspaceCalibration";
import type {
  AnalysisEvidenceIndex,
  AnalysisEvidenceItem,
  ShadowScoreFactor,
  ShadowScorecard,
  ShadowValidationIssue,
} from "@shared/models/analysis";

export interface ScoringFactor {
  name: string;
  maxWeight: number;
  actualScore: number;
  status: "scored" | "insufficient_evidence" | "not_applicable";
  evidence: string;
}

export interface RedFlagImpact {
  title: string;
  severity: string;
  impactCategory: "critical" | "standard";  // critical = timeline/revisions, standard = industry-normal
  penaltyApplied: number;
}

export interface FinancialScoreResult {
  totalScore: number;
  maxPossibleScore: number;
  factors: ScoringFactor[];
  redFlagPenalty: number;
  redFlagBreakdown: RedFlagImpact[];
  incompletePenalty: number;
  qualityGateTriggered: boolean;
  qualityGateReason: string | null;
  recommendation: "Excellent" | "Good" | "Moderate" | "Low";
  rationale: string;
  budgetAdequacy: {
    status: "under_scoped" | "likely_viable" | "unclear";
    disclosedBudget: string | null;
    summary: string;
  };
  pitchCostEstimate: {
    effortLevel: "low" | "moderate" | "high" | "intensive";
    estimatedHoursRange: string;
    summary: string;
  };
  agencyRiskFlags: Array<{
    title: string;
    severity: "low" | "medium" | "high";
    category: "commercial" | "contractual" | "delivery" | "qualification";
    summary: string;
  }>;
  submissionComplexity: {
    level: "low" | "moderate" | "high";
    requirementsCount: number;
    summary: string;
  };
  credentialsMatch: {
    status: "strong" | "partial" | "weak";
    summary: string;
  };
  clientQualityNotes: {
    signal: "high_potential" | "mixed" | "watch";
    summary: string;
    notes: string[];
  };
  saudiComplianceReadiness: {
    status: "ready" | "watch" | "not_applicable";
    summary: string;
    signals: string[];
  };
  calibrationState: "default" | "partial" | "full";
  calibrationDrivers: string[];
}

interface ShadowScoreContext {
  evidenceIndex: AnalysisEvidenceIndex;
  validationIssues: ShadowValidationIssue[];
}

function parseTimelineMonths(timeline: any): number {
  if (!timeline) return 0;

  // Direct durationMonths from new hierarchical schema
  if (typeof timeline === "object" && timeline) {
    if (timeline.durationMonths && typeof timeline.durationMonths === "number") {
      return timeline.durationMonths;
    }
    // Try parsing from start/end dates
    if (timeline.startDate && timeline.endDate) {
      try {
        const start = new Date(timeline.startDate);
        const end = new Date(timeline.endDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
          if (months > 0) return months;
        }
      } catch {}
    }
    // Try from overallDuration string
    if (typeof timeline.overallDuration === "string") {
      return parseTimelineString(timeline.overallDuration);
    }
  }

  if (typeof timeline === "string") {
    return parseTimelineString(timeline);
  }

  return 0;
}

function parseTimelineString(str: string): number {
  const yearMatch = str.match(/(\d+)\s*year/i);
  const monthMatch = str.match(/(\d+)\s*month/i);
  const weekMatch = str.match(/(\d+)\s*week/i);
  const dayMatch = str.match(/(\d+)\s*day/i);

  let months = 0;
  if (yearMatch) months += parseInt(yearMatch[1]) * 12;
  if (monthMatch) months += parseInt(monthMatch[1]);
  if (weekMatch) months += Math.ceil(parseInt(weekMatch[1]) / 4);
  if (dayMatch) months += Math.ceil(parseInt(dayMatch[1]) / 30);

  // Try date range: "January 2026 to December 2026" or "Jan-Dec 2026"
  if (months === 0) {
    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const shortMonths = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const dateRangeMatch = str.match(/(\w+)\s*(\d{4})?\s*(?:to|through|[-–])\s*(\w+)\s*(\d{4})?/i);
    if (dateRangeMatch) {
      const startMonthStr = dateRangeMatch[1].toLowerCase();
      const endMonthStr = dateRangeMatch[3].toLowerCase();
      const startYear = dateRangeMatch[2] ? parseInt(dateRangeMatch[2]) : 2025;
      const endYear = dateRangeMatch[4] ? parseInt(dateRangeMatch[4]) : startYear;

      let startIdx = monthNames.indexOf(startMonthStr);
      if (startIdx === -1) startIdx = shortMonths.indexOf(startMonthStr);
      let endIdx = monthNames.indexOf(endMonthStr);
      if (endIdx === -1) endIdx = shortMonths.indexOf(endMonthStr);

      if (startIdx >= 0 && endIdx >= 0) {
        months = (endYear - startYear) * 12 + (endIdx - startIdx) + 1;
      }
    }
  }

  return Math.max(0, months);
}

function countDeliverables(extractedData: any): number {
  // Count from hierarchical phases (respecting quantities)
  const phases = extractedData?.scopeOfWork?.phases;
  if (Array.isArray(phases) && phases.length > 0) {
    let count = 0;
    for (const phase of phases) {
      if (Array.isArray(phase.deliverables)) {
        for (const d of phase.deliverables) {
          if (typeof d === "string") {
            count++;
          } else if (d && typeof d === "object") {
            count += Math.max(1, d.quantity || 1);
          }
        }
      }
    }
    if (count > 0) return count;
  }

  // Fallback: flat deliverables array
  const deliverables = extractedData?.deliverables || extractedData?.coreExtraction?.deliverables || [];
  return Array.isArray(deliverables) ? deliverables.length : 0;
}

function scoreScopeMagnitude(extractedData: any): ScoringFactor {
  const maxWeight = 18;
  const deliverableCount = countDeliverables(extractedData);
  const timeline = extractedData?.timeline || extractedData?.coreExtraction?.timeline || "";
  const timelineMonths = parseTimelineMonths(timeline);

  let score = 0;
  if (deliverableCount >= 20) score += 10;
  else if (deliverableCount >= 10) score += 7;
  else if (deliverableCount >= 5) score += 4;
  else if (deliverableCount >= 2) score += 2;

  if (timelineMonths >= 12) score += 8;
  else if (timelineMonths >= 6) score += 6;
  else if (timelineMonths >= 3) score += 4;
  else if (timelineMonths >= 1) score += 2;

  score = Math.min(score, maxWeight);
  const hasEvidence = deliverableCount > 0 || timelineMonths > 0;

  return {
    name: "Project Scope Magnitude",
    maxWeight,
    actualScore: score,
    status: hasEvidence ? "scored" : "insufficient_evidence",
    evidence: `${deliverableCount} deliverables, ${timelineMonths > 0 ? timelineMonths + " month timeline" : "timeline not specified"}`,
  };
}

function scoreServiceMatch(scopeAnalysis: ScopeAnalysisResult): ScoringFactor {
  const maxWeight = 15;
  const pct = scopeAnalysis.agencyServicePercentage;
  let score = 0;
  if (pct >= 80) score = 15;
  else if (pct >= 60) score = 12;
  else if (pct >= 40) score = 9;
  else if (pct >= 20) score = 6;
  else if (pct >= 10) score = 3;

  return {
    name: "Agency Service Match",
    maxWeight,
    actualScore: score,
    status: "scored",
    evidence: `${pct}% agency service match (${scopeAnalysis.fullMatches} full, ${scopeAnalysis.partialMatches} partial, ${scopeAnalysis.gaps} gaps)`,
  };
}

function scoreOutputQuantities(scopeAnalysis: ScopeAnalysisResult): ScoringFactor {
  const maxWeight = 10;
  const total = scopeAnalysis.outputCounts.total;
  let score = 0;
  if (total >= 20) score = 10;
  else if (total >= 15) score = 8;
  else if (total >= 10) score = 6;
  else if (total >= 5) score = 4;
  else if (total >= 2) score = 2;

  return {
    name: "Output Quantities",
    maxWeight,
    actualScore: score,
    status: total > 0 ? "scored" : "insufficient_evidence",
    evidence: `${total} total outputs (${scopeAnalysis.outputCounts.videos} videos, ${scopeAnalysis.outputCounts.motionGraphics} motion, ${scopeAnalysis.outputCounts.designAssets} design, ${scopeAnalysis.outputCounts.contentPieces} content)`,
  };
}

function scoreOutputTypes(scopeAnalysis: ScopeAnalysisResult): ScoringFactor {
  const maxWeight = 11;
  const categories = Object.entries(scopeAnalysis.categoryBreakdown).filter(
    ([_, v]) => v.full > 0 || v.partial > 0
  ).length;

  let score = 0;
  if (categories >= 6) score = 11;
  else if (categories >= 5) score = 10;
  else if (categories >= 4) score = 8;
  else if (categories >= 3) score = 6;
  else if (categories >= 2) score = 4;
  else if (categories >= 1) score = 2;

  return {
    name: "Output Types Diversity",
    maxWeight,
    actualScore: score,
    status: categories > 0 ? "scored" : "insufficient_evidence",
    evidence: `${categories} production categories covered`,
  };
}

function scoreCompanySize(clientResearch: ClientResearchResult): ScoringFactor {
  const maxWeight = 12;
  const sizeScores: Record<string, number> = {
    enterprise: 12,
    large: 10,
    medium: 7,
    small: 4,
    startup: 2,
  };
  const score = sizeScores[clientResearch.estimatedSize] || 0;
  const confidence = clientResearch.confidenceScores?.estimatedSize || 0.5;

  return {
    name: "Company/Brand Size",
    maxWeight,
    actualScore: Math.round(score * confidence),
    status: confidence >= 0.3 ? "scored" : "insufficient_evidence",
    evidence: `Estimated size: ${clientResearch.estimatedSize} (confidence: ${Math.round(confidence * 100)}%)`,
  };
}

function scoreBrandReach(clientResearch: ClientResearchResult): ScoringFactor {
  const maxWeight = 8;
  const reachScores: Record<string, number> = {
    international: 8,
    national: 6,
    regional: 4,
    local: 2,
  };
  const score = reachScores[clientResearch.geographicReach] || 0;

  return {
    name: "Brand Reach",
    maxWeight,
    actualScore: score,
    status: "scored",
    evidence: `Geographic reach: ${clientResearch.geographicReach}`,
  };
}

// Holding Group removed from scoring — not a meaningful differentiator for agency bid evaluation

function scoreEntityType(clientResearch: ClientResearchResult): ScoringFactor {
  const maxWeight = 6;
  const typeScores: Record<string, number> = {
    government: 6,
    semi_government: 5,
    public: 4,
    private: 3,
    ngo: 2,
  };
  const score = typeScores[clientResearch.entityType] || 0;

  return {
    name: "Entity Type",
    maxWeight,
    actualScore: score,
    status: "scored",
    evidence: `Entity type: ${clientResearch.entityType}`,
  };
}

function scoreMediaSpend(clientResearch: ClientResearchResult): ScoringFactor {
  const maxWeight = 10;
  const spendScores: Record<string, number> = {
    very_high: 10,
    high: 8,
    significant: 7,
    moderate: 5,
    low: 3,
    minimal: 1,
  };
  const score = spendScores[clientResearch.mediaSpendsSignal] || 0;

  // Build evidence string — include the digital presence notes if available
  const dpSummary = typeof clientResearch.digitalPresence === "string" && clientResearch.digitalPresence.length > 10
    ? clientResearch.digitalPresence.substring(0, 120)
    : null;
  const evidenceParts = [`Media spend signal: ${clientResearch.mediaSpendsSignal}`];
  if (dpSummary) evidenceParts.push(dpSummary);

  return {
    name: "Media/Ad Spend Signal",
    maxWeight,
    actualScore: score,
    status: "scored",
    evidence: evidenceParts.join(". "),
  };
}

// Merged Social Activity + Content Publishing into one factor
function scoreDigitalPresence(clientResearch: ClientResearchResult): ScoringFactor {
  const maxWeight = 10;

  const socialScores: Record<string, number> = {
    very_active: 5,
    active: 4,
    moderate: 3,
    low: 1,
    inactive: 0,
  };
  const contentScores: Record<string, number> = {
    very_active: 5,
    active: 4,
    moderate: 3,
    low: 1,
    minimal: 0,
  };
  const socialScore = socialScores[clientResearch.socialActivityLevel] || 0;
  const contentScore = contentScores[clientResearch.contentPublishingLevel] || 0;
  const score = Math.min(socialScore + contentScore, maxWeight);

  return {
    name: "Digital Presence",
    maxWeight,
    actualScore: score,
    status: "scored",
    evidence: `Social activity: ${clientResearch.socialActivityLevel}, content publishing: ${clientResearch.contentPublishingLevel}`,
  };
}

// Red flag categories that meaningfully impact financial viability.
// Most RFP risks in the MENA creative/marketing industry are "status quo" —
// they should be NOTED but not heavily penalize the score.
// Only timeline risk and unlimited/undefined revisions are true deal-impacting flags.
// We match on TITLE only (not description) to avoid false positives from
// incidental mentions of keywords in the risk explanation text.
const CRITICAL_FLAG_TITLE_PATTERNS = [
  /timeline/i,
  /compressed/i,
  /tight.?schedule/i,
  /rush/i,
  /unlimited.?revision/i,
  /revision.*not.*defin/i,
  /approval.?cycle.*not/i,
  /undefined.?revision/i,
];

function isCriticalFlag(flag: any): boolean {
  const title = ((flag.title || flag.flag || "") as string);
  return CRITICAL_FLAG_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function calculateRedFlagPenalty(redFlags: any[]): { total: number; breakdown: RedFlagImpact[] } {
  if (!Array.isArray(redFlags) || redFlags.length === 0) return { total: 0, breakdown: [] };

  let criticalPenalty = 0;   // For timeline + revisions type flags
  let standardPenalty = 0;   // For everything else (industry-normal risks)
  const breakdown: RedFlagImpact[] = [];

  for (const flag of redFlags) {
    const severity = (flag.severity || flag.level || "").toLowerCase();
    const title = flag.title || flag.flag || "Unknown risk";
    const critical = isCriticalFlag(flag);

    let penalty = 0;
    if (critical) {
      if (severity === "high" || severity === "critical") {
        penalty = 6;
        criticalPenalty += penalty;
      } else {
        penalty = 3;
        criticalPenalty += penalty;
      }
    } else {
      if (severity === "high" || severity === "critical") {
        penalty = 1;
        standardPenalty += penalty;
      }
      // MEDIUM and LOW non-critical flags: 0 penalty (just noted)
    }

    breakdown.push({
      title,
      severity,
      impactCategory: critical ? "critical" : "standard",
      penaltyApplied: penalty,
    });
  }

  criticalPenalty = Math.min(criticalPenalty, 15);
  standardPenalty = Math.min(standardPenalty, 5);

  return { total: criticalPenalty + standardPenalty, breakdown };
}

function calculateIncompletePenalty(factors: ScoringFactor[]): number {
  const insufficientCount = factors.filter((f) => f.status === "insufficient_evidence").length;
  const totalFactors = factors.length;
  const completeness = totalFactors > 0 ? (totalFactors - insufficientCount) / totalFactors : 1;
  return Math.round((1 - completeness) * 10);
}

function normalizeTerm(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countSubmissionRequirements(submission: any): number {
  if (!submission) return 0;
  if (typeof submission === "string") return submission.trim() ? 1 : 0;
  if (Array.isArray(submission)) {
    return submission.reduce<number>(
      (total, item) => total + countSubmissionRequirements(item),
      0,
    );
  }
  if (typeof submission === "object") {
    return Object.values(submission).reduce<number>(
      (total, value) => total + countSubmissionRequirements(value),
      0,
    );
  }
  return 0;
}

function estimateProjectComplexityUnits(
  deliverableCount: number,
  timelineMonths: number,
  scopeMatchCount: number,
  submissionRequirementsCount: number,
  highRiskCount: number,
): number {
  return (
    deliverableCount * 1.5 +
    timelineMonths * 2 +
    scopeMatchCount * 1.2 +
    submissionRequirementsCount * 0.8 +
    highRiskCount * 3
  );
}

function buildBudgetAdequacy(
  extractedData: any,
  scopeAnalysis: ScopeAnalysisResult,
  redFlags: any[],
  calibrationContext?: AgencyCalibrationContext,
): FinancialScoreResult["budgetAdequacy"] {
  const core = extractedData?.coreExtraction ?? extractedData ?? {};
  const deliverableCount = countDeliverables(core);
  const timelineMonths = parseTimelineMonths(core?.timeline || core?.submissionRequirements?.timeline || "");
  const submissionRequirementsCount = countSubmissionRequirements(core?.submissionRequirements);
  const scopeMatchCount = Array.isArray(scopeAnalysis.matches) ? scopeAnalysis.matches.length : 0;
  const budgetRaw =
    typeof core?.budget?.totalBudget === "string" && core.budget.totalBudget.trim()
      ? core.budget.totalBudget.trim()
      : null;
  const budgetAmount = parseBudgetAmount(budgetRaw);
  const calibratedBudgetFloor = parseBudgetAmount(calibrationContext?.calibration?.minimumBudget || "");
  const complexityUnits = estimateProjectComplexityUnits(
    deliverableCount,
    timelineMonths,
    scopeMatchCount,
    submissionRequirementsCount,
    countHighSeverityRisks(redFlags),
  );
  const estimatedFloor = Math.max(
    25_000 + complexityUnits * 4_000,
    calibratedBudgetFloor || 0,
  );

  if (!budgetAmount) {
    return {
      status: "unclear",
      disclosedBudget: budgetRaw,
      summary:
        "No reliable budget is disclosed. Treat pricing viability as unclear until the team confirms commercial range.",
    };
  }

  if (budgetAmount < estimatedFloor * 0.8) {
    return {
      status: "under_scoped",
      disclosedBudget: budgetRaw,
      summary:
        "The disclosed budget looks light relative to scope, timeline, and submission load. Commercial fit needs review before committing pitch effort.",
    };
  }

  if (budgetAmount >= estimatedFloor * 1.05) {
    return {
      status: "likely_viable",
      disclosedBudget: budgetRaw,
      summary:
        "The disclosed budget looks broadly workable for the current scope. Validate exclusions and change-control terms before treating it as healthy.",
    };
  }

  return {
    status: "unclear",
    disclosedBudget: budgetRaw,
    summary:
      "The budget is present, but it sits close to the likely delivery floor. This needs commercial judgment rather than an automatic green light.",
  };
}

function buildPitchCostEstimate(
  extractedData: any,
  scopeAnalysis: ScopeAnalysisResult,
  redFlags: any[],
  calibrationContext?: AgencyCalibrationContext,
): FinancialScoreResult["pitchCostEstimate"] {
  const core = extractedData?.coreExtraction ?? extractedData ?? {};
  const deliverableCount = countDeliverables(core);
  const timelineMonths = parseTimelineMonths(core?.timeline || "");
  const submissionRequirementsCount = countSubmissionRequirements(core?.submissionRequirements);
  const scopeMatchCount = Array.isArray(scopeAnalysis.matches) ? scopeAnalysis.matches.length : 0;
  const highRiskCount = countHighSeverityRisks(redFlags);
  const estimatedHours =
    20 +
    deliverableCount * 4 +
    timelineMonths * 8 +
    submissionRequirementsCount * 2 +
    scopeMatchCount * 2 +
    highRiskCount * 10;
  const tolerance = calibrationContext?.calibration?.pitchEffortTolerance || "moderate";
  const toleranceMultiplier = tolerance === "low" ? 1.15 : tolerance === "high" ? 0.9 : 1;
  const adjustedHours = estimatedHours * toleranceMultiplier;
  const lower = Math.max(24, Math.round(adjustedHours * 0.85));
  const upper = Math.round(adjustedHours * 1.2);

  let effortLevel: FinancialScoreResult["pitchCostEstimate"]["effortLevel"];
  if (adjustedHours < 70) effortLevel = "low";
  else if (adjustedHours < 130) effortLevel = "moderate";
  else if (adjustedHours < 220) effortLevel = "high";
  else effortLevel = "intensive";

  return {
    effortLevel,
    estimatedHoursRange: `${lower}-${upper} hrs`,
    summary:
      effortLevel === "intensive"
        ? "This pursuit looks expensive before delivery even begins. Leadership should make the bid/no-bid call deliberately."
        : effortLevel === "high"
          ? "This will take meaningful pitch effort across strategy, creative, and commercial review."
          : effortLevel === "moderate"
            ? "This looks like a manageable pursuit, but still needs coordinated review before committing."
            : "This looks relatively light to qualify, assuming no hidden compliance or procurement attachments appear later.",
  };
}

function buildAgencyRiskFlags(
  extractedData: any,
  redFlags: any[],
  calibrationContext?: AgencyCalibrationContext,
): FinancialScoreResult["agencyRiskFlags"] {
  const core = extractedData?.coreExtraction ?? extractedData ?? {};
  const signals = new Map<string, FinancialScoreResult["agencyRiskFlags"][number]>();
  const contractText = JSON.stringify(core?.contractTerms || {}).toLowerCase();
  const combinedText = JSON.stringify(core).toLowerCase();
  const redLines = (calibrationContext?.calibration?.riskRedLines || []).map((item) =>
    item.toLowerCase(),
  );

  const addSignal = (
    key: string,
    value: FinancialScoreResult["agencyRiskFlags"][number],
  ) => {
    if (!signals.has(key)) signals.set(key, value);
  };

  for (const flag of redFlags || []) {
    const title = String(flag?.title || flag?.flag || "Agency risk");
    const severityRaw = String(flag?.severity || flag?.level || "").toLowerCase();
    const severity =
      severityRaw === "critical" || severityRaw === "high"
        ? "high"
        : severityRaw === "medium"
          ? "medium"
          : "low";
    const normalized = title.toLowerCase();

    let category: FinancialScoreResult["agencyRiskFlags"][number]["category"] = "qualification";
    if (/timeline|schedule|deadline|rush|compressed/.test(normalized)) category = "delivery";
    else if (/budget|fee|pricing|payment|cost/.test(normalized)) category = "commercial";
    else if (/contract|ip|revision|rights|exclusiv|liability/.test(normalized)) category = "contractual";

    addSignal(title, {
      title,
      severity,
      category,
      summary:
        typeof flag?.description === "string" && flag.description.trim()
          ? flag.description.trim()
          : `Agency-relevant ${category} risk identified during qualification.`,
    });
  }

  if (!parseBudgetAmount(core?.budget?.totalBudget)) {
    addSignal("Budget not disclosed", {
      title: "Budget not disclosed",
      severity: "high",
      category: "commercial",
      summary:
        "No clear budget is stated. That raises the risk of wasting pitch effort on an underfunded opportunity.",
    });
  }

  if (/unlimited revision|revision.*undefined|revisions?.*unlimited/.test(contractText)) {
    addSignal("Unlimited revisions exposure", {
      title: "Unlimited revisions exposure",
      severity: "high",
      category: "contractual",
      summary:
        "The contract language suggests revision cycles may be open-ended, which can damage delivery economics quickly.",
    });
  }

  if (/intellectual property|ip ownership|work product.*owned by client|all rights/.test(contractText)) {
    addSignal("IP ownership overreach", {
      title: "IP ownership overreach",
      severity: "medium",
      category: "contractual",
      summary:
        "Rights and ownership language should be reviewed carefully to avoid broad transfer beyond the practical scope of work.",
    });
  }

  if (/exclusive|exclusivity|conflict/.test(contractText)) {
    addSignal("Exclusivity conflict", {
      title: "Exclusivity conflict",
      severity: "medium",
      category: "contractual",
      summary:
        "There are signals of exclusivity or conflict restrictions that may limit other client work.",
    });
  }

  if (/spec work|sample campaign|creative concepts|pitch deck|required before award/.test(combinedText)) {
    addSignal("Spec work demand", {
      title: "Spec work demand",
      severity: "medium",
      category: "qualification",
      summary:
        "The submission appears to require unpaid creative effort before award, which increases pursuit cost materially.",
    });
  }

  for (const redLine of redLines) {
    if (!redLine) continue;
    if (combinedText.includes(redLine)) {
      addSignal(`Agency red line: ${redLine}`, {
        title: `Agency red line: ${redLine}`,
        severity: "high",
        category: "qualification",
        summary:
          "This RFP touches an agency-specific red line from workspace calibration and should be reviewed before resources are committed.",
      });
    }
  }

  return Array.from(signals.values()).slice(0, 6);
}

function buildSubmissionComplexity(extractedData: any): FinancialScoreResult["submissionComplexity"] {
  const core = extractedData?.coreExtraction ?? extractedData ?? {};
  const requirementsCount = countSubmissionRequirements(core?.submissionRequirements);
  let level: FinancialScoreResult["submissionComplexity"]["level"];
  if (requirementsCount >= 12) level = "high";
  else if (requirementsCount >= 5) level = "moderate";
  else level = "low";

  return {
    level,
    requirementsCount,
    summary:
      level === "high"
        ? "Submission requirements look heavy. Expect more internal coordination, approvals, and packaging work than a normal pitch."
        : level === "moderate"
          ? "Submission complexity is manageable, but not lightweight. Plan for checklist discipline and internal review."
          : "Submission requirements look relatively simple, which lowers pursuit overhead.",
  };
}

function buildCredentialsMatch(
  scopeAnalysis: ScopeAnalysisResult,
  calibrationContext?: AgencyCalibrationContext,
): FinancialScoreResult["credentialsMatch"] {
  const pct = scopeAnalysis.agencyServicePercentage || 0;
  const matches = Array.isArray(scopeAnalysis.matches) ? scopeAnalysis.matches.length : 0;
  const categories = Object.values(scopeAnalysis.categoryBreakdown || {}).filter(
    (value) => value.full > 0 || value.partial > 0,
  ).length;
  const approvedCredentials = (calibrationContext?.credentials || []).filter(
    (credential) => credential.status === "approved",
  );
  const matchedServices = new Set(
    (scopeAnalysis.matches || [])
      .map((match) => normalizeTerm(String(match?.matchedService || "")))
      .filter(Boolean),
  );
  const matchingCredentials = approvedCredentials.filter((credential) => {
    const services = Array.isArray(credential.services) ? credential.services : [];
    const tags = Array.isArray(credential.tags) ? credential.tags : [];
    const terms = [...services, ...tags].map((term) => normalizeTerm(String(term)));
    return terms.some((term) => matchedServices.has(term));
  });

  if (pct >= 70 && matches >= 3 && matchingCredentials.length > 0) {
    return {
      status: "strong",
      summary: `The scope maps well to your core services across ${categories} delivery categories, and ${matchingCredentials.length} approved credential${matchingCredentials.length === 1 ? "" : "s"} look reusable here.`,
    };
  }

  if (pct >= 40 && matches >= 2) {
    return {
      status: "partial",
      summary:
        matchingCredentials.length > 0
          ? `There is enough overlap to pitch credibly, but the team will need to be selective about how it packages ${matchingCredentials.length} relevant credential${matchingCredentials.length === 1 ? "" : "s"}.`
          : "There is enough service overlap to pitch credibly, but the workspace still needs a stronger approved credentials library for this type of opportunity.",
    };
  }

  return {
    status: "weak",
    summary:
      "The current scope does not map strongly to the agency service profile. This looks harder to support with convincing credentials.",
  };
}

function buildClientQualityNotes(
  clientResearch: ClientResearchResult,
  calibrationContext?: AgencyCalibrationContext,
): FinancialScoreResult["clientQualityNotes"] {
  const notes: string[] = [];
  const normalizedClient = normalizeTerm(clientResearch.companyName);
  const clientMemoryEntry = (calibrationContext?.clientMemory || []).find(
    (entry) => normalizeTerm(entry.normalizedClientKey) === normalizedClient,
  );

  if (clientResearch.entityType === "government" || clientResearch.entityType === "semi_government") {
    notes.push("Buyer likely has layered approvals and tighter procurement discipline.");
  }

  if (clientResearch.estimatedSize === "large" || clientResearch.estimatedSize === "enterprise") {
    notes.push("Client scale suggests meaningful upside if the opportunity is commercially sound.");
  }

  if (
    clientResearch.socialActivityLevel === "active" ||
    clientResearch.socialActivityLevel === "very_active" ||
    clientResearch.contentPublishingLevel === "active" ||
    clientResearch.contentPublishingLevel === "very_active"
  ) {
    notes.push("Digital activity implies the client is likely to value ongoing output cadence and reporting discipline.");
  }

  if (clientResearch.sourceType === "document_only_inference") {
    notes.push("Client profile is still mostly inferred from the RFP itself, so leadership should treat it as directional.");
  }

  if (clientMemoryEntry?.badFitFlag) {
    notes.push("Workspace memory marks this client as a historical bad-fit or cautionary account.");
  } else if (clientMemoryEntry?.qualityRating && clientMemoryEntry.qualityRating !== "unknown") {
    notes.push(`Workspace memory rates this client as ${clientMemoryEntry.qualityRating}.`);
  }

  let signal: FinancialScoreResult["clientQualityNotes"]["signal"];
  if (clientMemoryEntry?.badFitFlag) {
    signal = "watch";
  } else if (
    (clientResearch.estimatedSize === "large" || clientResearch.estimatedSize === "enterprise") &&
    clientResearch.sourceType !== "document_only_inference"
  ) {
    signal = "high_potential";
  } else if (clientResearch.sourceType === "document_only_inference") {
    signal = "watch";
  } else {
    signal = "mixed";
  }

  const summary =
    signal === "high_potential"
      ? "Client signals look commercially attractive, but the team should still validate procurement behavior and decision speed."
      : signal === "watch"
        ? "Client quality is still too inferred. Use the recommendation as a qualification input, not a substitute for judgment."
        : "Client signals are mixed. There is potential here, but not enough to ignore commercial discipline.";

  return { signal, summary, notes: notes.slice(0, 4) };
}

function buildSaudiComplianceReadiness(
  extractedData: any,
  clientResearch: ClientResearchResult,
): FinancialScoreResult["saudiComplianceReadiness"] {
  const serialized = JSON.stringify(extractedData).toLowerCase();
  const signals: string[] = [];

  if (/etimad|اعتماد/.test(serialized)) signals.push("Etimad procurement signal detected.");
  if (/saudization|saudi national|نطاقات/.test(serialized)) signals.push("Saudization or local staffing requirement detected.");
  if (/local content|lcgpa|المحتوى المحلي/.test(serialized)) signals.push("Local-content scoring language detected.");
  if (/arabic|bilingual|arabic version|العربية/.test(serialized)) signals.push("Arabic or bilingual submission requirement detected.");
  if (clientResearch.geographicReach === "national" || clientResearch.geographicReach === "regional") {
    signals.push("Regional market context suggests GCC procurement expectations may matter.");
  }

  if (signals.length >= 3) {
    return {
      status: "ready",
      summary:
        "Saudi-specific procurement signals are present and identifiable, which means the team can review compliance readiness early instead of late in the bid cycle.",
      signals,
    };
  }

  if (signals.length > 0) {
    return {
      status: "watch",
      summary:
        "There are some Saudi or GCC procurement cues, but not enough to treat this as a full compliance-heavy pursuit yet.",
      signals,
    };
  }

  return {
    status: "not_applicable",
    summary:
      "No strong Saudi-specific procurement requirements were detected in the current extraction.",
    signals,
  };
}

export function calculateFinancialScore(
  extractedData: any,
  scopeAnalysis: ScopeAnalysisResult,
  clientResearch: ClientResearchResult,
  redFlags: any[],
  calibrationContext?: AgencyCalibrationContext,
): FinancialScoreResult {
  const factors: ScoringFactor[] = [
    scoreScopeMagnitude(extractedData),
    scoreServiceMatch(scopeAnalysis),
    scoreOutputQuantities(scopeAnalysis),
    scoreOutputTypes(scopeAnalysis),
    scoreCompanySize(clientResearch),
    scoreBrandReach(clientResearch),
    scoreEntityType(clientResearch),
    scoreMediaSpend(clientResearch),
    scoreDigitalPresence(clientResearch),
  ];

  const maxPossibleScore = factors.reduce((sum, f) => sum + f.maxWeight, 0);
  let rawScore = factors.reduce((sum, f) => sum + f.actualScore, 0);

  const redFlagResult = calculateRedFlagPenalty(redFlags);
  const redFlagPenalty = redFlagResult.total;
  const incompletePenalty = calculateIncompletePenalty(factors);

  rawScore = Math.max(0, rawScore - redFlagPenalty - incompletePenalty);

  let qualityGateTriggered = false;
  let qualityGateReason: string | null = null;

  const deliverables = extractedData?.deliverables || extractedData?.coreExtraction?.deliverables || [];
  const deliverableCount = Array.isArray(deliverables) ? deliverables.length : 0;

  if (scopeAnalysis.matches.length < 2) {
    qualityGateTriggered = true;
    qualityGateReason = "Insufficient scope items (fewer than 2 identifiable deliverables)";
  } else if (scopeAnalysis.agencyServicePercentage < 10) {
    qualityGateTriggered = true;
    qualityGateReason = "Agency service match below 10% threshold";
  }

  let totalScore = qualityGateTriggered ? Math.min(rawScore, 49) : rawScore;
  totalScore = Math.max(0, Math.min(100, totalScore));

  let recommendation: "Excellent" | "Good" | "Moderate" | "Low";
  if (totalScore >= 85) recommendation = "Excellent";
  else if (totalScore >= 70) recommendation = "Good";
  else if (totalScore >= 50) recommendation = "Moderate";
  else recommendation = "Low";

  const sortedFactors = [...factors].sort((a, b) => b.actualScore - a.actualScore);
  const topDrivers = sortedFactors.slice(0, 2).map((f) => f.name);
  let rationale = `Top scoring drivers: ${topDrivers.join(" and ")}.`;
  const budgetAdequacy = buildBudgetAdequacy(extractedData, scopeAnalysis, redFlags, calibrationContext);
  const pitchCostEstimate = buildPitchCostEstimate(extractedData, scopeAnalysis, redFlags, calibrationContext);
  const agencyRiskFlags = buildAgencyRiskFlags(extractedData, redFlags, calibrationContext);
  const submissionComplexity = buildSubmissionComplexity(extractedData);
  const credentialsMatch = buildCredentialsMatch(scopeAnalysis, calibrationContext);
  const clientQualityNotes = buildClientQualityNotes(clientResearch, calibrationContext);
  const saudiComplianceReadiness = buildSaudiComplianceReadiness(extractedData, clientResearch);
  const calibrationDrivers = [
    calibrationContext?.calibrationState && calibrationContext.calibrationState !== "default"
      ? `Agency profile is ${calibrationContext.calibrationState}.`
      : null,
    calibrationContext?.calibration?.minimumBudget
      ? `Minimum budget floor set at ${calibrationContext.calibration.minimumBudget}.`
      : null,
    calibrationContext?.calibration?.riskRedLines?.length
      ? `${calibrationContext.calibration.riskRedLines.length} agency red line${calibrationContext.calibration.riskRedLines.length === 1 ? "" : "s"} applied.`
      : null,
    calibrationContext?.credentials?.filter((item) => item.status === "approved").length
      ? `${calibrationContext.credentials.filter((item) => item.status === "approved").length} approved credential${calibrationContext.credentials.filter((item) => item.status === "approved").length === 1 ? "" : "s"} available.`
      : null,
    calibrationContext?.clientMemory?.length
      ? `Workspace client memory contains ${calibrationContext.clientMemory.length} account note${calibrationContext.clientMemory.length === 1 ? "" : "s"}.`
      : null,
  ].filter((item): item is string => Boolean(item));

  if (redFlagPenalty > 0) {
    rationale += ` Red flag penalties applied: -${redFlagPenalty} points.`;
  }
  if (incompletePenalty > 0) {
    rationale += ` Incomplete data penalty: -${incompletePenalty} points.`;
  }
  if (qualityGateTriggered) {
    rationale += ` Quality gate triggered: ${qualityGateReason}. Score capped at 49.`;
  }

  return {
    totalScore,
    maxPossibleScore,
    factors,
    redFlagPenalty,
    redFlagBreakdown: redFlagResult.breakdown,
    incompletePenalty,
    qualityGateTriggered,
    qualityGateReason,
    recommendation,
    rationale,
    budgetAdequacy,
    pitchCostEstimate,
    agencyRiskFlags,
    submissionComplexity,
    credentialsMatch,
    clientQualityNotes,
    saudiComplianceReadiness,
    calibrationState: calibrationContext?.calibrationState || "default",
    calibrationDrivers,
  };
}

function clampScore(value: number, max = 100): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getEvidenceForPaths(
  evidenceIndex: AnalysisEvidenceIndex,
  paths: string[],
): AnalysisEvidenceItem[] {
  const seen = new Set<string>();
  const items: AnalysisEvidenceItem[] = [];

  for (const path of paths) {
    for (const item of evidenceIndex[path] || []) {
      const key = [
        path,
        item.snippet,
        item.charStart ?? "",
        item.charEnd ?? "",
        item.sourceUrl ?? "",
      ].join("|");
      if (!seen.has(key)) {
        seen.add(key);
        items.push(item);
      }
    }
  }

  return items;
}

function makeShadowFactor(
  name: string,
  weight: number,
  score: number,
  confidence: number,
  rationale: string,
  evidence: AnalysisEvidenceItem[],
): ShadowScoreFactor {
  return {
    name,
    weight,
    score: clampScore(score, weight),
    confidence: Math.max(0, Math.min(1, confidence)),
    status:
      confidence < 0.35 || evidence.length === 0
        ? "insufficient_evidence"
        : "scored",
    rationale,
    evidence,
  };
}

function parseBudgetAmount(rawBudget: string | null | undefined): number | null {
  if (!rawBudget) return null;
  const normalized = rawBudget.replace(/[, ]+/g, "");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  if (/million|mn/i.test(rawBudget)) return value * 1_000_000;
  if (/billion|bn/i.test(rawBudget)) return value * 1_000_000_000;
  return value;
}

function countHighSeverityRisks(redFlags: any[]): number {
  return redFlags.filter((flag) => {
    const severity = String(flag?.severity || flag?.level || "").toUpperCase();
    return severity === "HIGH" || severity === "CRITICAL";
  }).length;
}

function calculateEvidenceCoverage(
  evidenceIndex: AnalysisEvidenceIndex,
  fieldPaths: string[],
): number {
  const populated = fieldPaths.filter((path) => (evidenceIndex[path] || []).length > 0);
  return fieldPaths.length > 0 ? populated.length / fieldPaths.length : 0;
}

export function calculateShadowScorecard(
  extractedData: any,
  scopeAnalysis: ScopeAnalysisResult,
  clientResearch: ClientResearchResult,
  redFlags: any[],
  context: ShadowScoreContext,
): ShadowScorecard {
  const core = extractedData?.coreExtraction ?? extractedData ?? {};
  const deliverableCount = countDeliverables(core);
  const timelineMonths = parseTimelineMonths(core?.timeline || "");
  const totalOutputs = scopeAnalysis.outputCounts?.total || 0;
  const outputCategories = Object.values(scopeAnalysis.categoryBreakdown || {}).filter(
    (value) => value.full > 0 || value.partial > 0,
  ).length;
  const budgetAmount = parseBudgetAmount(core?.budget?.totalBudget);
  const clientConfidence = average(
    Object.values(clientResearch.confidenceScores || {}).filter(
      (value): value is number => typeof value === "number",
    ),
  );
  const highRiskCount = countHighSeverityRisks(redFlags);
  const scopeMatchCount = Array.isArray(scopeAnalysis.matches)
    ? scopeAnalysis.matches.length
    : 0;
  const criticalValidationCount = context.validationIssues.filter(
    (issue) => issue.severity === "critical",
  ).length;
  const warningCount = context.validationIssues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  const serviceFitEvidence = getEvidenceForPaths(context.evidenceIndex, [
    "deliverables",
    "scopeOfWork.overview",
  ]);
  const serviceFit = makeShadowFactor(
    "Service Fit",
    20,
    scopeAnalysis.agencyServicePercentage / 5,
    serviceFitEvidence.length > 0 ? 0.9 : 0.4,
    `${scopeAnalysis.agencyServicePercentage}% of mapped deliverables align to in-house services.`,
    serviceFitEvidence,
  );

  const budgetEvidence = getEvidenceForPaths(context.evidenceIndex, [
    "budget.totalBudget",
    "budget.currency",
    "budget.pricingStructure",
  ]);
  let budgetScore = 0;
  if (budgetAmount !== null) {
    budgetScore += 7;
    if (budgetAmount >= 1_000_000) budgetScore += 6;
    else if (budgetAmount >= 500_000) budgetScore += 4;
    else if (budgetAmount >= 100_000) budgetScore += 2;
  }
  if (core?.budget?.pricingStructure) budgetScore += 2;
  if (core?.budget?.currency) budgetScore += 1;
  const budgetClarity = makeShadowFactor(
    "Budget Attractiveness & Clarity",
    15,
    budgetScore,
    budgetAmount !== null ? 0.9 : 0.25,
    budgetAmount !== null
      ? `Budget is specified${core?.budget?.pricingStructure ? ` with ${core.budget.pricingStructure} pricing` : ""}.`
      : "No explicit budget was found, which limits commercial confidence.",
    budgetEvidence,
  );

  const timelineEvidence = getEvidenceForPaths(context.evidenceIndex, [
    "timeline.overallDuration",
    "timeline.startDate",
    "timeline.endDate",
    "submissionRequirements.deadline",
  ]);
  let timelineScore = 6;
  if (timelineMonths > 0 && deliverableCount > 0) {
    const density = deliverableCount / Math.max(timelineMonths, 1);
    if (density <= 2) timelineScore = 15;
    else if (density <= 4) timelineScore = 12;
    else if (density <= 7) timelineScore = 9;
    else if (density <= 10) timelineScore = 6;
    else timelineScore = 3;
  } else if (timelineMonths > 0) {
    timelineScore = 10;
  }
  timelineScore -= Math.min(6, highRiskCount * 2);
  const timelineFeasibility = makeShadowFactor(
    "Timeline Feasibility",
    15,
    timelineScore,
    timelineEvidence.length > 0 ? 0.8 : 0.35,
    timelineMonths > 0
      ? `${timelineMonths} month timeline assessed against ${deliverableCount} deliverables and ${highRiskCount} high-severity risks.`
      : "Timeline evidence is incomplete, so feasibility remains uncertain.",
    timelineEvidence,
  );

  const scopeMagnitudeEvidence = getEvidenceForPaths(context.evidenceIndex, [
    "deliverables",
    "scopeOfWork.overview",
    "timeline.overallDuration",
  ]);
  let scopeMagnitudeScore = 0;
  if (deliverableCount >= 20) scopeMagnitudeScore = 10;
  else if (deliverableCount >= 12) scopeMagnitudeScore = 8;
  else if (deliverableCount >= 6) scopeMagnitudeScore = 6;
  else if (deliverableCount >= 3) scopeMagnitudeScore = 4;
  else if (deliverableCount > 0) scopeMagnitudeScore = 2;
  const scopeMagnitude = makeShadowFactor(
    "Scope Magnitude",
    10,
    scopeMagnitudeScore,
    scopeMagnitudeEvidence.length > 0 ? 0.85 : 0.3,
    `${deliverableCount} deliverables identified across ${timelineMonths || "unknown"} months.`,
    scopeMagnitudeEvidence,
  );

  const outputComplexityEvidence = getEvidenceForPaths(context.evidenceIndex, [
    "deliverables",
  ]);
  let outputComplexityScore = 0;
  if (outputCategories >= 5 || totalOutputs >= 20) outputComplexityScore = 10;
  else if (outputCategories >= 4 || totalOutputs >= 12) outputComplexityScore = 8;
  else if (outputCategories >= 3 || totalOutputs >= 8) outputComplexityScore = 6;
  else if (outputCategories >= 2 || totalOutputs >= 4) outputComplexityScore = 4;
  else if (totalOutputs > 0) outputComplexityScore = 2;
  const outputComplexity = makeShadowFactor(
    "Output Complexity",
    10,
    outputComplexityScore,
    outputComplexityEvidence.length > 0 ? 0.8 : 0.3,
    `${totalOutputs} counted outputs across ${outputCategories} service categories.`,
    outputComplexityEvidence,
  );

  const clientUpsideEvidence = getEvidenceForPaths(context.evidenceIndex, [
    "clientName",
    "industry",
  ]);
  const sizeScores: Record<string, number> = {
    enterprise: 5,
    large: 4,
    medium: 3,
    small: 2,
    startup: 1,
  };
  const reachScores: Record<string, number> = {
    international: 3,
    national: 2,
    regional: 1,
    local: 0,
  };
  const spendScores: Record<string, number> = {
    very_high: 2,
    high: 2,
    significant: 2,
    moderate: 1,
    low: 1,
    minimal: 0,
  };
  const clientCommercialUpside = makeShadowFactor(
    "Client Commercial Upside",
    10,
    (sizeScores[clientResearch.estimatedSize] || 0) +
      (reachScores[clientResearch.geographicReach] || 0) +
      (spendScores[clientResearch.mediaSpendsSignal] || 0),
    clientConfidence || 0.3,
    `Client signals point to a ${clientResearch.estimatedSize} ${clientResearch.entityType} organization with ${clientResearch.geographicReach} reach.`,
    clientUpsideEvidence,
  );

  const procurementEvidence = getEvidenceForPaths(context.evidenceIndex, [
    "submissionRequirements.requiredDocuments",
    "teamRequirements.localContentRequirements",
  ]);
  const baseProcurementScore: Record<string, number> = {
    private: 9,
    ngo: 8,
    public: 6,
    semi_government: 4,
    government: 3,
  };
  const requiredDocsCount = Array.isArray(core?.submissionRequirements?.requiredDocuments)
    ? core.submissionRequirements.requiredDocuments.length
    : 0;
  const hasLocalContentRequirement = Boolean(
    core?.teamRequirements?.localContentRequirements,
  );
  const procurementComplexity = makeShadowFactor(
    "Procurement Complexity",
    10,
    (baseProcurementScore[clientResearch.entityType] || 5) -
      Math.min(3, Math.floor(requiredDocsCount / 4)) -
      (hasLocalContentRequirement ? 1 : 0),
    procurementEvidence.length > 0 ? 0.7 : 0.35,
    `${requiredDocsCount} required submission documents${hasLocalContentRequirement ? " with local content constraints" : ""}.`,
    procurementEvidence,
  );

  const contractEvidence = getEvidenceForPaths(context.evidenceIndex, [
    "contractTerms.paymentTerms",
    "contractTerms.delayPenalties",
    "contractTerms.ipOwnership",
    "contractTerms.terminationClause",
    "redFlags",
  ]);
  const mediumRiskCount = redFlags.filter((flag) => {
    const severity = String(flag?.severity || flag?.level || "").toUpperCase();
    return severity === "MEDIUM";
  }).length;
  const contractBurden = makeShadowFactor(
    "Contract Burden",
    10,
    10 - Math.min(8, highRiskCount * 2 + mediumRiskCount),
    contractEvidence.length > 0 ? 0.8 : 0.35,
    `${highRiskCount} high-severity and ${mediumRiskCount} medium-severity contract risks were identified.`,
    contractEvidence,
  );

  const factorBreakdown = [
    serviceFit,
    budgetClarity,
    timelineFeasibility,
    scopeMagnitude,
    outputComplexity,
    clientCommercialUpside,
    procurementComplexity,
    contractBurden,
  ];

  let fitScore = factorBreakdown.reduce((sum, factor) => sum + factor.score, 0);
  fitScore = clampScore(fitScore);

  const evidenceCoverage = calculateEvidenceCoverage(context.evidenceIndex, [
    "clientName",
    "projectTitle",
    "deliverables",
    "budget.totalBudget",
    "submissionRequirements.deadline",
    "contractTerms.paymentTerms",
    "timeline.overallDuration",
  ]);
  const riskEvidenceCoverage =
    redFlags.length === 0
      ? 1
      : redFlags.filter((flag) => flag?.evidence || flag?.clauseReference).length /
        redFlags.length;
  let confidenceScore =
    evidenceCoverage * 40 +
    average(factorBreakdown.map((factor) => factor.confidence)) * 30 +
    Math.max(0, 1 - criticalValidationCount * 0.4 - warningCount * 0.1) * 20 +
    riskEvidenceCoverage * 10;
  confidenceScore = clampScore(confidenceScore);

  const blockers: string[] = [];
  if (budgetAmount === null) blockers.push("Budget missing");
  if (criticalValidationCount > 0) blockers.push("Critical validation issues");
  if (highRiskCount > 0) blockers.push("High-severity risks present");
  if (scopeMatchCount < 2) blockers.push("Fewer than two scope matches");
  if (confidenceScore < 60) blockers.push("Evidence confidence below promotion threshold");
  if (contractEvidence.length < 2) blockers.push("Contract evidence too thin");

  const drivers = [...factorBreakdown]
    .toSorted((a, b) => b.score / b.weight - a.score / a.weight)
    .slice(0, 3)
    .map((factor) => factor.name);

  let recommendation: ShadowScorecard["recommendation"];
  if (
    confidenceScore < 60 ||
    criticalValidationCount > 0 ||
    deliverableCount < 3 ||
    scopeMatchCount < 2 ||
    contractEvidence.length < 2
  ) {
    recommendation = "Manual review";
  } else if (fitScore >= 80) {
    recommendation = "Pursue";
  } else if (fitScore >= 60) {
    recommendation = "Pursue with conditions";
  } else if (fitScore >= 40) {
    recommendation = "Borderline";
  } else {
    recommendation = "Pass";
  }

  return {
    fitScore,
    confidenceScore,
    recommendation,
    drivers,
    blockers,
    factorBreakdown,
  };
}
