import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CALIBRATION,
  buildCalibrationContext,
  normalizeClientKey,
} from "../server/services/workspaceCalibration.ts";
import { calculateFinancialScore } from "../server/services/financialScoring.ts";
import type { ScopeAnalysisResult } from "../server/services/serviceTaxonomy.ts";
import type { ClientResearchResult } from "../server/services/clientResearch.ts";

function makeScopeAnalysis(overrides: Partial<ScopeAnalysisResult> = {}): ScopeAnalysisResult {
  return {
    matches: [
      {
        scopeItem: "Brand campaign strategy",
        matchedService: { name: "Branding" } as any,
        matchType: "full",
        confidence: 0.92,
        category: "Strategy",
      },
      {
        scopeItem: "Social content production",
        matchedService: { name: "Campaigns" } as any,
        matchType: "full",
        confidence: 0.88,
        category: "Content",
      },
      {
        scopeItem: "Always-on content",
        matchedService: { name: "Content" } as any,
        matchType: "partial",
        confidence: 0.64,
        category: "Content",
      },
    ],
    agencyServicePercentage: 78,
    fullMatches: 2,
    partialMatches: 1,
    gaps: 0,
    categoryBreakdown: {
      Strategy: { full: 1, partial: 0, gap: 0 },
      Content: { full: 1, partial: 1, gap: 0 },
      Design: { full: 0, partial: 0, gap: 0 },
    },
    outputCounts: {
      videos: 0,
      motionGraphics: 0,
      designAssets: 2,
      contentPieces: 6,
      total: 8,
    },
    ...overrides,
  };
}

function makeClientResearch(
  overrides: Partial<ClientResearchResult> = {},
): ClientResearchResult {
  return {
    companyName: "Saudi Sports Co",
    industry: "Sports",
    entityType: "private",
    estimatedSize: "large",
    employeeRange: "500-1000",
    holdingGroup: { name: null, tier: "independent" },
    geographicReach: "national",
    marketingBudgetTier: "significant",
    mediaSpendsSignal: "high",
    socialActivityLevel: "active",
    contentPublishingLevel: "active",
    digitalPresence: "Active multi-platform brand presence",
    confidenceScores: {
      companyName: 0.9,
      industry: 0.8,
      entityType: 0.7,
      estimatedSize: 0.7,
    },
    researchNotes: [],
    sourceType: "mixed",
    externalResearchAvailable: true,
    sources: [],
    ...overrides,
  };
}

test("buildCalibrationContext returns default, partial, and full states predictably", () => {
  const defaultState = buildCalibrationContext({});
  assert.equal(defaultState.calibrationState, "default");
  assert.deepEqual(defaultState.calibration, DEFAULT_CALIBRATION);

  const partialState = buildCalibrationContext({
    profile: {
      calibration: {
        coreServices: ["Branding"],
        preferredSectors: ["Sports"],
        minimumBudget: "250000 SAR",
      },
    } as any,
  });
  assert.equal(partialState.calibrationState, "partial");

  const fullState = buildCalibrationContext({
    profile: {
      calibration: {
        coreServices: ["Branding", "Campaigns"],
        preferredSectors: ["Sports", "Government"],
        minimumBudget: "250000 SAR",
        riskRedLines: ["Unlimited revisions", "No budget disclosed"],
        preferredClientTypes: ["Semi-government"],
        pitchEffortTolerance: "moderate",
      },
      status: "completed",
    } as any,
    credentials: [
      {
        id: 1,
        workspaceId: "w1",
        title: "Sports launch",
        sectors: ["Sports"],
        services: ["Branding", "Campaigns"],
        formats: [],
        caseStudyText: "Campaign case study",
        tags: ["sports", "launch"],
        status: "approved",
      } as any,
    ],
  });
  assert.equal(fullState.calibrationState, "full");
  assert.equal(fullState.credentials.length, 1);
});

test("calculateFinancialScore uses calibration context to shape qualification outputs", () => {
  const extractedData = {
    coreExtraction: {
      clientName: "Saudi Sports Co",
      budget: { totalBudget: "200000 SAR" },
      timeline: { durationMonths: 6 },
      deliverables: [
        { name: "Campaign strategy", quantity: 1 },
        { name: "Content calendar", quantity: 4 },
        { name: "Production assets", quantity: 3 },
      ],
      submissionRequirements: {
        requiredDocuments: ["Company profile", "Financials", "Team CVs"],
      },
      contractTerms: {
        notes: "Unlimited revisions and exclusivity apply.",
      },
    },
  };
  const scopeAnalysis = makeScopeAnalysis();
  const clientResearch = makeClientResearch();
  const calibrationContext = buildCalibrationContext({
    profile: {
      calibration: {
        coreServices: ["Branding", "Campaigns", "Content"],
        preferredSectors: ["Sports"],
        minimumBudget: "250000 SAR",
        riskRedLines: ["Unlimited revisions", "No budget disclosed"],
        preferredClientTypes: ["Semi-government"],
        pitchEffortTolerance: "low",
      },
      status: "completed",
    } as any,
    credentials: [
      {
        id: 1,
        workspaceId: "w1",
        title: "Sports launch",
        sectors: ["Sports"],
        services: ["Branding", "Campaigns"],
        formats: [],
        caseStudyText: "Campaign case study",
        tags: ["brand strategy", "campaigns"],
        status: "approved",
      } as any,
    ],
    clientMemory: [
      {
        id: 1,
        workspaceId: "w1",
        normalizedClientKey: normalizeClientKey("Saudi Sports Co"),
        qualityRating: "watch",
        badFitFlag: true,
        notes: "Budget discipline has been weak.",
        lastTouchedAt: new Date(),
        createdAt: new Date(),
      } as any,
    ],
  });

  const result = calculateFinancialScore(
    extractedData,
    scopeAnalysis,
    clientResearch,
    [{ title: "Timeline risk", severity: "medium" }],
    calibrationContext,
  );

  assert.equal(result.calibrationState, "full");
  assert.match(result.budgetAdequacy.summary, /(commercial judgment|delivery floor|fit needs review)/i);
  assert.ok(
    result.budgetAdequacy.status === "under_scoped" || result.budgetAdequacy.status === "unclear",
    `expected conservative budget adequacy status, received ${result.budgetAdequacy.status}`,
  );
  assert.ok(
    result.credentialsMatch.status === "strong" || result.credentialsMatch.status === "partial",
    `expected calibrated credentials match, received ${result.credentialsMatch.status}`,
  );
  assert.equal(result.clientQualityNotes.signal, "watch");
  assert.ok(
    result.agencyRiskFlags.some((flag) => /red line/i.test(flag.title)),
    "expected agency red line to be surfaced",
  );
  assert.ok(
    result.calibrationDrivers.some((driver) => /minimum budget floor/i.test(driver)),
    "expected calibration drivers to mention budget floor",
  );
  assert.match(result.pitchCostEstimate.estimatedHoursRange, /\d+-\d+ hrs/);
});
