import { z } from "zod";
import { storage } from "../storage";
import { buildShadowOutputs } from "./analysisShadow";
import { executeClaudeJsonStage } from "./analysisAi";
import {
  completenessAnalysisSchema,
  coreExtractionSchema,
  redFlagAnalysisSchema,
  verificationSchema,
} from "./analysisValidation";
import { performClientResearch } from "./clientResearch";
import { extractDocumentModel } from "./documentModel";
import { getAnalysisFeatureFlags, getWorkerMode } from "./analysisFlags";
import {
  createAnalysisRun,
  heartbeatRun,
  markRunFinished,
  markRunStage,
  markRunStarted,
  persistDocumentModel,
  persistEvidenceIndex,
  persistSources,
  updateAnalysisMeta,
} from "./analysisRunStore";
import { calculateFinancialScore } from "./financialScoring";
import { aiScopeMatching, matchScopeToServices } from "./serviceTaxonomy";
import type {
  AnalysisDocumentChunk,
  AnalysisDocumentQuality,
  AnalysisStageEnvelope,
} from "@shared/models/analysis";

function hasMeaningfulData(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

function applyVerificationCorrections(pass1Result: any, pass2Result: any): any {
  if (!pass2Result || !pass1Result) return pass1Result;
  const corrected = JSON.parse(JSON.stringify(pass1Result));

  if (Array.isArray(pass2Result.corrections)) {
    for (const correction of pass2Result.corrections) {
      if (correction.field && correction.correctedValue !== undefined) {
        const keys = correction.field.split(".");
        let target = corrected;
        for (let i = 0; i < keys.length - 1; i += 1) {
          if (target[keys[i]] !== undefined) {
            target = target[keys[i]];
          } else {
            target = null;
            break;
          }
        }
        if (target) target[keys[keys.length - 1]] = correction.correctedValue;
      }
    }
  }

  if (Array.isArray(pass2Result.additions)) {
    for (const addition of pass2Result.additions) {
      if (addition.field && addition.value !== undefined) {
        const keys = addition.field.split(".");
        let target = corrected;
        for (let i = 0; i < keys.length - 1; i += 1) {
          if (target[keys[i]] === undefined) target[keys[i]] = {};
          target = target[keys[i]];
        }
        target[keys[keys.length - 1]] = addition.value;
      }
    }
  }

  return corrected;
}

function flattenDeliverables(pass1Result: any): string[] {
  const result: string[] = [];
  const phases = pass1Result?.scopeOfWork?.phases;
  if (Array.isArray(phases)) {
    for (const phase of phases) {
      if (!Array.isArray(phase.deliverables)) continue;
      for (const deliverable of phase.deliverables) {
        if (typeof deliverable === "string") {
          result.push(deliverable);
        } else if (deliverable && typeof deliverable === "object") {
          const name = deliverable.name || deliverable.description || "";
          const qty = deliverable.quantity || 1;
          if (name) {
            for (let i = 0; i < Math.min(qty, 50); i += 1) result.push(name);
          }
        }
      }
    }
  }

  if (result.length === 0 && Array.isArray(pass1Result?.deliverables)) {
    result.push(
      ...pass1Result.deliverables.filter((item: unknown) => typeof item === "string"),
    );
  }

  if (result.length === 0) {
    const scope = pass1Result?.scopeOfWork;
    const scopeText =
      typeof scope === "string" ? scope : scope?.overview || "";
    if (scopeText) {
      result.push(
        ...scopeText
          .split(/[,;\n]/)
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 3 && item.length < 200),
      );
    }
  }

  return Array.from(new Set(result));
}

function buildFallbackClientProfile(
  documentText: string,
  pass1Result: any,
): Awaited<ReturnType<typeof performClientResearch>> {
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
  const entityType: Awaited<ReturnType<typeof performClientResearch>>["entityType"] =
    isGovt
      ? "government"
      : isSemiGovt
        ? "semi_government"
        : "private";
  const deliverableCount = Array.isArray(pass1Result?.deliverables)
    ? pass1Result.deliverables.length
    : 0;
  const estimatedSize: Awaited<
    ReturnType<typeof performClientResearch>
  >["estimatedSize"] =
    deliverableCount >= 15
      ? "enterprise"
      : deliverableCount >= 8
        ? "large"
        : "medium";

  return {
    companyName: pass1Result?.clientName || "Unknown",
    industry: pass1Result?.industry || "Unknown",
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
      companyName: pass1Result?.clientName ? 0.7 : 0.2,
      entityType: isGovt || isSemiGovt ? 0.6 : 0.3,
    },
    researchNotes: ["Client research AI call failed — using inferred defaults"],
    sourceType: "document_only_inference" as const,
    externalResearchAvailable: false,
    sources: [],
  };
}

function buildManualStageEnvelope(input: {
  stageKey: string;
  label: string;
  status?: AnalysisStageEnvelope["status"];
  usedFallback?: boolean;
  degraded?: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  elapsedMs: number;
  value?: unknown;
  startedAt: string;
}) {
  return {
    stageKey: input.stageKey,
    label: input.label,
    status: input.status ?? "complete",
    usedFallback: input.usedFallback ?? false,
    degraded: input.degraded ?? false,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    elapsedMs: input.elapsedMs,
    modelUsage: null,
    value: input.value ?? null,
    retryCount: 0,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
  } satisfies AnalysisStageEnvelope;
}

function collectReviewReasons(documentQuality: AnalysisDocumentQuality, shadowResult?: ReturnType<typeof buildShadowOutputs>) {
  const reasons = new Set<string>(documentQuality.parseWarnings);
  if (documentQuality.ocrUsed && (documentQuality.ocrConfidence ?? 1) < 0.6) {
    reasons.add("OCR confidence below 60%");
  }

  for (const issue of shadowResult?.shadowOutputs.validation.issues || []) {
    if (issue.severity === "critical" || issue.severity === "warning") {
      reasons.add(issue.message);
    }
  }

  for (const blocker of shadowResult?.shadowOutputs.scorecard.blockers || []) {
    reasons.add(blocker);
  }

  return Array.from(reasons);
}

const CORE_EXTRACTION_PROMPT = `You are an expert RFP analyst for creative and marketing agencies. Extract comprehensive structured data from this RFP document. Be thorough — capture every detail that would help an agency decide whether to bid.

You MUST respond with ONLY valid JSON matching this exact schema:
{
  "clientName": "string - organization issuing the RFP",
  "projectTitle": "string - title of the project or RFP",
  "industry": "string - industry sector",
  "executiveSummary": "string - 2-3 sentence AI-synthesized summary of what this RFP is asking for, its scale, and key requirements",
  "scopeOfWork": {
    "overview": "string - high-level description of all work being requested",
    "phases": [
      {
        "name": "string - phase name",
        "description": "string - what this phase covers",
        "timeline": "string or null - when this phase occurs (e.g., 'January 2026', '2 weeks', 'Month 1-3')",
        "deliverables": [
          {
            "name": "string - deliverable name",
            "description": "string - what exactly needs to be produced",
            "quantity": "number or null - how many units (e.g., 10 mockups = 10)",
            "format": "string or null - expected format or medium"
          }
        ]
      }
    ]
  },
  "deliverables": ["string array - flat list of ALL deliverables for backward compatibility"],
  "budget": {
    "totalBudget": "string or null - stated total budget amount",
    "currency": "string or null - currency code (SAR, USD, etc.)",
    "hasBOQ": "boolean - whether a Bill of Quantities is required",
    "pricingStructure": "string or null - how pricing should be structured (lump sum, per-phase, etc.)",
    "notes": "string or null - any budget-related notes or constraints"
  },
  "timeline": {
    "overallDuration": "string - total project duration in human-readable form",
    "startDate": "string or null - project start date if mentioned",
    "endDate": "string or null - project end date if mentioned",
    "durationMonths": "number or null - estimated duration in months",
    "phases": ["string array - phase timeline summaries"],
    "keyMilestones": [{"date": "string", "description": "string"}]
  },
  "keyDates": [{"date": "string - keep SHORT, e.g. 'Feb 6 2026' or 'Week 3' or '2 days post-signing'. NEVER repeat the full description here.", "description": "string - what happens on this date", "phase": "string - one of: 'submission' (RFP process dates like deadlines, Q&A periods, presentations) or 'project' (post-award milestones like kick-off, launches, deliverables)"}],
  "submissionDeadline": "string or null",
  "submissionRequirements": {
    "deadline": "string or null - exact submission deadline with date and time",
    "format": "string or null - FILE FORMAT only, keep to 5 words max (e.g., 'PDF', 'Hard copy + digital', 'Editable digital files', 'PDF and printed copies'). Do NOT include delivery platform or method here.",
    "submissionMethod": "string or null - DELIVERY METHOD only, keep to 5 words max (e.g., 'Email', 'Aconex portal', 'Physical delivery', 'SharePoint upload'). Do NOT repeat file format here.",
    "contactInfo": "string or null - contact person/email for submissions",
    "requiredDocuments": ["string array - list of required documents (e.g., company profile, financial statements, team CVs)"],
    "specialInstructions": ["string array - any special submission instructions. Include platform-specific details here if needed (e.g., 'Use Qiddiya Aconex data management system for all deliverables')"]
  },
  "evaluationCriteria": [
    {
      "criterion": "string - name of the evaluation criterion",
      "weight": "number or null - percentage weight if specified (e.g., 30 for 30%)",
      "description": "string or null - details about what is evaluated"
    }
  ],
  "contractTerms": {
    "paymentTerms": "string or null - payment schedule and terms",
    "delayPenalties": "string or null - penalties for late delivery",
    "performanceGuarantees": "string or null - performance bonds or guarantees required",
    "confidentiality": "string or null - confidentiality/NDA requirements",
    "ipOwnership": "string or null - intellectual property ownership terms",
    "governingLaw": "string or null - governing law and jurisdiction",
    "terminationClause": "string or null - termination conditions",
    "otherTerms": ["string array - any other notable contract terms"]
  },
  "teamRequirements": {
    "keyRoles": [
      {
        "role": "string - required role title",
        "qualifications": "string or null - required qualifications",
        "experienceYears": "number or null - minimum years of experience"
      }
    ],
    "certifications": ["string array - required certifications (e.g., PMP, ISO)"],
    "localContentRequirements": "string or null - local hiring/content requirements (e.g., '26% Saudi nationals')"
  },
  "specialRequirements": ["string array - any other special technical, legal, or compliance requirements"]
}

IMPORTANT INSTRUCTIONS:
- Extract EVERY phase and deliverable, no matter how many there are.
- Count quantities explicitly (e.g., "10 social media posts" → quantity: 10).
- Capture ALL dates mentioned (proposal deadline, project milestones, review dates).
- Extract contract terms from articles/clauses if present.
- For evaluationCriteria, include the weight as a number (e.g., 30 for "30%"), not a string.
- If the RFP has numbered articles (Article 1, Article 2, etc.), extract relevant terms from them.`;

const VERIFICATION_PROMPT = `You are verifying extracted RFP data for accuracy and completeness. Compare the extraction against the original document carefully.

You MUST respond with ONLY valid JSON matching this exact schema:
{
  "overallAccuracy": "number 0-100 - percentage accuracy of the extraction",
  "corrections": [
    {
      "field": "string - dot-notation path to the field (e.g., 'clientName', 'timeline.durationMonths', 'budget.currency')",
      "currentValue": "any - what was extracted",
      "correctedValue": "any - what it should be",
      "reason": "string - why this correction is needed"
    }
  ],
  "additions": [
    {
      "field": "string - dot-notation path for the missing field",
      "value": "any - the value that should be added",
      "evidence": "string - quote or reference from the document supporting this addition"
    }
  ],
  "missingPhases": ["string array - any project phases that were not captured"],
  "missingDeliverables": ["string array - any deliverables that were not captured"],
  "notes": "string - any other observations about extraction quality"
}

Focus on:
1. Are all phases and deliverables captured? Count them against the original.
2. Are dates correct and complete?
3. Are budget figures accurate?
4. Are contract terms fully captured?
5. Are evaluation criteria weights correct?
6. Are team requirements complete?`;

const RISK_PROMPT = `You are a contract risk analyst specializing in creative/marketing agency agreements. Identify ALL contractual, financial, and feasibility risks in this RFP.

You MUST respond with ONLY valid JSON matching this schema:
{
  "redFlags": [
    {
      "title": "string - concise risk title",
      "description": "string - detailed explanation of the risk and its implications for a bidding agency",
      "severity": "HIGH|MEDIUM|LOW",
      "category": "string - one of: 'Financial', 'Timeline', 'Scope', 'Legal', 'Resource', 'Compliance', 'Operational'",
      "evidence": "string - exact quote or close paraphrase from the RFP document that triggers this risk",
      "clauseReference": "string or null - article/section reference (e.g., 'Article 15', 'Section 3.2')",
      "recommendation": "string - what the agency should do about this risk (negotiate, mitigate, accept, etc.)",
      "financialImpact": "string or null - estimated financial impact if applicable (e.g., 'Up to 10% of contract value')"
    }
  ],
  "riskSummary": {
    "totalRisks": "number",
    "criticalCount": "number - HIGH severity count",
    "highCount": "number - HIGH severity count (same as criticalCount)",
    "mediumCount": "number",
    "lowCount": "number",
    "overallRiskLevel": "string - 'Critical', 'High', 'Moderate', or 'Low'",
    "topConcern": "string - the single most important risk to address"
  }
}

Look specifically for:
- Unrealistic timelines relative to scope
- Penalty clauses (delay penalties, performance guarantees)
- Broad IP transfer or work-for-hire clauses
- Perpetual or overly broad confidentiality
- Ambiguous scope that could lead to scope creep
- Missing budget or unrealistic budget expectations
- Unfavorable payment terms (long payment cycles, holdbacks)
- Local content or staffing requirements that may be hard to meet
- Excessive insurance or bonding requirements
- Termination clauses that favor the client
- Unlimited revision rounds
- No cap on liability`;

const COMPLETENESS_PROMPT = `You are assessing an RFP for completeness AND identifying internal contradictions. An agency needs this information to decide whether to bid.

You MUST respond with ONLY valid JSON matching this schema:
{
  "missingItems": [
    {
      "item": "string - what information is missing",
      "importance": "critical|important|nice-to-have",
      "impact": "string - why this matters for the bid decision"
    }
  ],
  "contradictions": [
    {
      "topic": "string - what the contradiction is about",
      "statement1": "string - first conflicting statement",
      "statement2": "string - second conflicting statement",
      "location1": "string - where in the document statement1 appears",
      "location2": "string - where in the document statement2 appears",
      "suggestedResolution": "string - how to resolve or what to ask the client"
    }
  ],
  "clarificationQuestions": [
    "string - questions the agency should ask the RFP issuer before bidding"
  ]
}

Check for:
MISSING ITEMS:
- Budget details (if not stated, this is critical)
- Detailed evaluation methodology
- Technical specifications
- Approval process and stakeholders
- Number of revision rounds allowed
- Content/asset provision from client
- Access to existing brand assets/guidelines
- Success metrics and KPIs
- Post-project support expectations

CONTRADICTIONS:
- Timeline vs. scope mismatches
- Budget vs. deliverable quantity mismatches
- Different dates for the same milestone in different sections
- Conflicting requirements between sections`;

export async function runLiveAnalysis(input: {
  analysisId: number;
  fileBuffer: Buffer;
  mimeType: string;
  fileName: string;
  runId: number;
  skipRunStart?: boolean;
}) {
  const flags = getAnalysisFeatureFlags();
  const workerMode = getWorkerMode(flags);

  await updateAnalysisMeta(input.analysisId, {
    workerEnabled: flags.analysisWorker,
    shadowEnabled: flags.shadowV2,
    evidenceUiEnabled: flags.evidenceUi,
    webResearchEnabled: flags.webResearch,
    liveCutoverEnabled: flags.liveV2Cutover,
    workerMode,
    liveVersion: "live-v1",
    shadowVersion: "shadow-v2",
  });

  try {
    await storage.updateAnalysis(input.analysisId, {
      status: "parsing",
      errorMessage: null,
      manualReviewRequired: false,
      reviewReasons: [],
      comparisonSummary: null,
      shadowRunStatus: "not_started",
    });
    if (!input.skipRunStart) {
      await markRunStarted(input.runId, input.analysisId, "parse_document");
    } else {
      await updateAnalysisMeta(input.analysisId, {
        activeRunId: input.runId,
        runStatus: "running",
        stageKey: "parse_document",
      });
    }

    const parseStartedAt = new Date().toISOString();
    const parseStartedMs = Date.now();
    const documentModel = await extractDocumentModel(input.fileBuffer, input.mimeType);
    const parseEnvelope = buildManualStageEnvelope({
      stageKey: "parse_document",
      label: "Parse document",
      degraded: documentModel.documentQuality.parseWarnings.length > 0,
      errorMessage:
        documentModel.documentQuality.parseWarnings.length > 0
          ? documentModel.documentQuality.parseWarnings.join(" | ")
          : null,
      elapsedMs: Date.now() - parseStartedMs,
      value: {
        textLength: documentModel.documentQuality.extractedTextLength,
        pageCount: documentModel.documentQuality.estimatedPageCount,
        parseMethod: documentModel.documentQuality.parseMethod,
      },
      startedAt: parseStartedAt,
    });
    await markRunStage(input.runId, input.analysisId, parseEnvelope);
    await persistDocumentModel(
      input.analysisId,
      input.runId,
      documentModel.documentQuality,
      documentModel.chunks,
    );

    if (!documentModel.documentText.trim()) {
      const reviewReasons = [
        "Failed to extract text from document. The file may be empty or OCR quality was insufficient.",
      ];
      await storage.updateAnalysis(input.analysisId, {
        status: "error",
        errorMessage: reviewReasons[0],
        manualReviewRequired: true,
        reviewReasons,
        documentQuality: documentModel.documentQuality,
      });
      await markRunFinished({
        runId: input.runId,
        analysisId: input.analysisId,
        status: "failed",
        errorCode: "document_parse_failed",
        errorMessage: reviewReasons[0],
        degraded: true,
        documentQuality: documentModel.documentQuality,
        reviewReasons,
      });
      return;
    }

    await storage.updateAnalysis(input.analysisId, {
      documentText: documentModel.documentText,
      documentQuality: documentModel.documentQuality,
      status: "extracting",
      currentPass: 0,
    });

    const coreExtractionStage = await executeClaudeJsonStage({
      stageKey: "core_extraction",
      label: "Core extraction",
      systemPrompt: CORE_EXTRACTION_PROMPT,
      userContent: `Extract comprehensive structured data from the following RFP document:\n\n${documentModel.documentText}`,
      schema: coreExtractionSchema,
      defaultValue: {},
    });
    await markRunStage(input.runId, input.analysisId, coreExtractionStage.envelope);
    await storage.updateAnalysis(input.analysisId, { currentPass: 1 });
    await heartbeatRun(input.runId);

    let pass1Result = coreExtractionStage.value;

    const verificationStage = await executeClaudeJsonStage({
      stageKey: "verification",
      label: "Verification",
      systemPrompt: VERIFICATION_PROMPT,
      userContent:
        `Original RFP Document:\n\n${documentModel.documentText}\n\nExtracted Data:\n\n${JSON.stringify(pass1Result, null, 2)}`,
      schema: verificationSchema,
      defaultValue: {},
    });
    await markRunStage(input.runId, input.analysisId, verificationStage.envelope);
    if (hasMeaningfulData(verificationStage.value)) {
      pass1Result = applyVerificationCorrections(pass1Result, verificationStage.value);
    }
    await storage.updateAnalysis(input.analysisId, { currentPass: 2 });
    await heartbeatRun(input.runId);

    const riskStage = await executeClaudeJsonStage({
      stageKey: "risk_analysis",
      label: "Risk analysis",
      systemPrompt: RISK_PROMPT,
      userContent: `Analyze the following RFP document for risks:\n\n${documentModel.documentText}`,
      schema: redFlagAnalysisSchema,
      defaultValue: {
        redFlags: [],
        riskSummary: {
          totalRisks: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          overallRiskLevel: "Low",
          topConcern: "None identified",
        },
      },
    });
    await markRunStage(input.runId, input.analysisId, riskStage.envelope);
    await storage.updateAnalysis(input.analysisId, { currentPass: 3 });
    await heartbeatRun(input.runId);

    const completenessStage = await executeClaudeJsonStage({
      stageKey: "completeness",
      label: "Completeness review",
      systemPrompt: COMPLETENESS_PROMPT,
      userContent:
        `Original RFP Document:\n\n${documentModel.documentText}\n\nExtracted Data:\n\n${JSON.stringify(pass1Result, null, 2)}\n\nIdentified Risks:\n\n${JSON.stringify(riskStage.value?.redFlags?.slice(0, 10) || [], null, 2)}`,
      schema: completenessAnalysisSchema,
      defaultValue: {
        missingItems: [],
        contradictions: [],
        clarificationQuestions: [],
      },
    });
    await markRunStage(input.runId, input.analysisId, completenessStage.envelope);
    await storage.updateAnalysis(input.analysisId, { currentPass: 4 });
    await heartbeatRun(input.runId);

    if (
      ![
        coreExtractionStage.value,
        verificationStage.value,
        riskStage.value,
        completenessStage.value,
      ].some(hasMeaningfulData)
    ) {
      const reviewReasons = ["All AI analysis stages degraded to defaults."];
      await storage.updateAnalysis(input.analysisId, {
        status: "error",
        errorMessage: reviewReasons[0],
        manualReviewRequired: true,
        reviewReasons,
      });
      await markRunFinished({
        runId: input.runId,
        analysisId: input.analysisId,
        status: "failed",
        errorCode: "all_ai_stages_degraded",
        errorMessage: reviewReasons[0],
        degraded: true,
        usedFallback: true,
        documentQuality: documentModel.documentQuality,
        reviewReasons,
      });
      return;
    }

    const extractedData = {
      coreExtraction: pass1Result,
      verification: verificationStage.value,
      redFlagAnalysis: riskStage.value,
      completenessAssessment: completenessStage.value,
    };

    const scopeStartedAt = new Date().toISOString();
    const scopeStartedMs = Date.now();
    let scopeEnvelope: AnalysisStageEnvelope;
    let scopeResult = null;
    try {
      const flatDeliverables = flattenDeliverables(pass1Result);
      const scopeOfWork = pass1Result?.scopeOfWork;
      const scopeText =
        typeof scopeOfWork === "string"
          ? scopeOfWork
          : typeof scopeOfWork === "object" &&
              scopeOfWork &&
              "overview" in scopeOfWork
            ? String((scopeOfWork as { overview?: string }).overview || "")
            : "";

      try {
        scopeResult = await aiScopeMatching(flatDeliverables, scopeText);
        scopeEnvelope = buildManualStageEnvelope({
          stageKey: "scope_matching",
          label: "Scope matching",
          elapsedMs: Date.now() - scopeStartedMs,
          value: scopeResult,
          startedAt: scopeStartedAt,
        });
      } catch (error: any) {
        scopeResult = matchScopeToServices(flatDeliverables, scopeText);
        scopeEnvelope = buildManualStageEnvelope({
          stageKey: "scope_matching",
          label: "Scope matching",
          usedFallback: true,
          degraded: true,
          errorCode: "ai_scope_matching_failed",
          errorMessage: error?.message || "AI scope matching failed",
          elapsedMs: Date.now() - scopeStartedMs,
          value: scopeResult,
          startedAt: scopeStartedAt,
        });
      }
    } catch (error: any) {
      scopeResult = {
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
      };
      scopeEnvelope = buildManualStageEnvelope({
        stageKey: "scope_matching",
        label: "Scope matching",
        usedFallback: true,
        degraded: true,
        errorCode: "scope_matching_failed",
        errorMessage: error?.message || "Scope matching failed",
        elapsedMs: Date.now() - scopeStartedMs,
        value: scopeResult,
        startedAt: scopeStartedAt,
      });
    }
    await markRunStage(input.runId, input.analysisId, scopeEnvelope);
    await heartbeatRun(input.runId);

    const clientStartedAt = new Date().toISOString();
    const clientStartedMs = Date.now();
    let clientResult = null;
    let clientEnvelope: AnalysisStageEnvelope;
    try {
      clientResult = await performClientResearch(documentModel.documentText, pass1Result);
      clientEnvelope = buildManualStageEnvelope({
        stageKey: "client_research",
        label: "Client research",
        degraded:
          clientResult.sourceType === "document_only_inference" &&
          !flags.webResearch,
        elapsedMs: Date.now() - clientStartedMs,
        value: clientResult,
        startedAt: clientStartedAt,
      });
    } catch (error: any) {
      clientResult = buildFallbackClientProfile(documentModel.documentText, pass1Result);
      clientEnvelope = buildManualStageEnvelope({
        stageKey: "client_research",
        label: "Client research",
        usedFallback: true,
        degraded: true,
        errorCode: "client_research_failed",
        errorMessage: error?.message || "Client research failed",
        elapsedMs: Date.now() - clientStartedMs,
        value: clientResult,
        startedAt: clientStartedAt,
      });
    }
    await markRunStage(input.runId, input.analysisId, clientEnvelope);
    await heartbeatRun(input.runId);

    const scoringStartedAt = new Date().toISOString();
    const scoringStartedMs = Date.now();
    let scoreResult = null;
    let scoringEnvelope: AnalysisStageEnvelope;
    try {
      scoreResult = calculateFinancialScore(
        pass1Result,
        scopeResult,
        clientResult,
        riskStage.value?.redFlags || [],
      );
      scoringEnvelope = buildManualStageEnvelope({
        stageKey: "financial_scoring",
        label: "Financial scoring",
        elapsedMs: Date.now() - scoringStartedMs,
        value: scoreResult,
        startedAt: scoringStartedAt,
      });
    } catch (error: any) {
      scoringEnvelope = buildManualStageEnvelope({
        stageKey: "financial_scoring",
        label: "Financial scoring",
        status: "failed",
        degraded: true,
        errorCode: "financial_scoring_failed",
        errorMessage: error?.message || "Financial scoring failed",
        elapsedMs: Date.now() - scoringStartedMs,
        startedAt: scoringStartedAt,
      });
    }
    await markRunStage(input.runId, input.analysisId, scoringEnvelope);

    await storage.updateAnalysis(input.analysisId, {
      extractedData,
      scopeAnalysis: scopeResult,
      clientResearch: clientResult,
      financialScore: scoreResult,
      redFlags: riskStage.value?.redFlags || [],
      overallScore: scoreResult?.totalScore ?? null,
      recommendation: scoreResult?.recommendation ?? null,
      status: "complete",
      currentPass: 4,
    });

    let reviewReasons: string[] = documentModel.documentQuality.parseWarnings;

    if (flags.shadowV2) {
      const shadowRun = await createAnalysisRun({
        analysisId: input.analysisId,
        pipelineVersion: "shadow-v2",
        trigger: "live_complete",
        meta: { parentRunId: input.runId },
      });

      await runShadowAnalysis({
        analysisId: input.analysisId,
        runId: shadowRun.id,
        fileName: input.fileName,
        documentText: documentModel.documentText,
        documentQuality: documentModel.documentQuality,
        documentChunks: documentModel.chunks,
        extractedData,
        scopeAnalysis: scopeResult,
        clientResearch: clientResult,
        financialScore: scoreResult,
        redFlags: riskStage.value?.redFlags || [],
        overallScore: scoreResult?.totalScore ?? null,
        recommendation: scoreResult?.recommendation ?? null,
      });

      const analysis = await storage.getAnalysis(input.analysisId);
      reviewReasons = Array.isArray(analysis?.reviewReasons)
        ? (analysis?.reviewReasons as string[])
        : reviewReasons;
    } else {
      await storage.updateAnalysis(input.analysisId, {
        shadowRunStatus: "not_started",
        manualReviewRequired: documentModel.documentQuality.parseWarnings.length > 0,
        reviewReasons,
      });
    }

    await markRunFinished({
      runId: input.runId,
      analysisId: input.analysisId,
      status: "complete",
      degraded: [
        parseEnvelope,
        coreExtractionStage.envelope,
        verificationStage.envelope,
        riskStage.envelope,
        completenessStage.envelope,
        scopeEnvelope,
        clientEnvelope,
        scoringEnvelope,
      ].some((envelope) => envelope.degraded),
      usedFallback: [
        coreExtractionStage.envelope,
        verificationStage.envelope,
        riskStage.envelope,
        completenessStage.envelope,
        scopeEnvelope,
        clientEnvelope,
        scoringEnvelope,
      ].some((envelope) => envelope.usedFallback),
      documentQuality: documentModel.documentQuality,
      reviewReasons,
    });
  } catch (error: any) {
    const reviewReasons = [error?.message || "Unexpected live analysis failure"];
    await storage.updateAnalysis(input.analysisId, {
      status: "error",
      errorMessage: reviewReasons[0],
      manualReviewRequired: true,
      reviewReasons,
    });
    await markRunFinished({
      runId: input.runId,
      analysisId: input.analysisId,
      status: "failed",
      degraded: true,
      errorCode: "live_run_failed",
      errorMessage: reviewReasons[0],
      reviewReasons,
    });
  }
}

export async function runShadowAnalysis(input: {
  analysisId: number;
  runId: number;
  fileName: string;
  documentText: string;
  documentQuality: AnalysisDocumentQuality;
  documentChunks?: AnalysisDocumentChunk[];
  extractedData: any;
  scopeAnalysis: any;
  clientResearch: any;
  financialScore: any;
  redFlags: any[];
  overallScore: number | null;
  recommendation: string | null;
  skipRunStart?: boolean;
}) {
  await storage.updateAnalysis(input.analysisId, {
    shadowRunStatus: "running",
    manualReviewRequired: false,
    reviewReasons: input.documentQuality.parseWarnings,
    comparisonSummary: null,
  });

  if (!input.skipRunStart) {
    await markRunStarted(input.runId, input.analysisId, "document_model");
  } else {
    await updateAnalysisMeta(input.analysisId, {
      activeRunId: input.runId,
      runStatus: "running",
      stageKey: "document_model",
    });
  }

  const docStageStartedAt = new Date().toISOString();
  const docStageStartedMs = Date.now();
  const documentStage = buildManualStageEnvelope({
    stageKey: "document_model",
    label: "Document model",
    degraded: input.documentQuality.parseWarnings.length > 0,
    errorMessage:
      input.documentQuality.parseWarnings.length > 0
        ? input.documentQuality.parseWarnings.join(" | ")
        : null,
    elapsedMs: Date.now() - docStageStartedMs,
    value: input.documentQuality,
    startedAt: docStageStartedAt,
  });
  await markRunStage(input.runId, input.analysisId, documentStage);

  const shadowStartedAt = new Date().toISOString();
  const shadowStartedMs = Date.now();
  const shadowResult = buildShadowOutputs({
    analysisId: input.analysisId,
    fileName: input.fileName,
    createdAt: new Date(),
    documentText: input.documentText,
    documentQuality: input.documentQuality,
    documentChunks: input.documentChunks,
    extractedData: input.extractedData,
    scopeAnalysis: input.scopeAnalysis,
    clientResearch: input.clientResearch,
    financialScore: input.financialScore,
    redFlags: input.redFlags,
    overallScore: input.overallScore,
    recommendation: input.recommendation,
  });

  const evidenceStage = buildManualStageEnvelope({
    stageKey: "evidence_index",
    label: "Evidence index",
    degraded: false,
    elapsedMs: 1,
    value: {
      buckets: Object.keys(shadowResult.shadowOutputs.evidenceIndex).length,
      sources: shadowResult.shadowOutputs.sources.length,
    },
    startedAt: shadowStartedAt,
  });
  await markRunStage(input.runId, input.analysisId, evidenceStage);
  await persistSources(
    input.analysisId,
    input.runId,
    shadowResult.shadowOutputs.sources,
  );
  await persistEvidenceIndex(
    input.analysisId,
    input.runId,
    shadowResult.shadowOutputs.evidenceIndex,
  );

  const scoreStage = buildManualStageEnvelope({
    stageKey: "shadow_scorecard",
    label: "Shadow scorecard",
    degraded: shadowResult.shadowOutputs.scorecard.recommendation === "Manual review",
    elapsedMs: Date.now() - shadowStartedMs,
    value: shadowResult.shadowOutputs.scorecard,
    startedAt: shadowStartedAt,
  });
  await markRunStage(input.runId, input.analysisId, scoreStage);

  const comparisonStage = buildManualStageEnvelope({
    stageKey: "comparison",
    label: "Comparison",
    degraded: shadowResult.comparisonSummary.parityStatus !== "pass",
    elapsedMs: Date.now() - shadowStartedMs,
    value: shadowResult.comparisonSummary,
    startedAt: shadowStartedAt,
  });
  await markRunStage(input.runId, input.analysisId, comparisonStage);

  const reviewReasons = collectReviewReasons(
    input.documentQuality,
    shadowResult,
  );

  await storage.updateAnalysis(input.analysisId, {
    shadowRunStatus: shadowResult.shadowRunStatus,
    shadowOutputs: shadowResult.shadowOutputs,
    manualReviewRequired: shadowResult.manualReviewRequired,
    comparisonSummary: shadowResult.comparisonSummary,
    reviewReasons,
    documentQuality: input.documentQuality,
  });

  await markRunFinished({
    runId: input.runId,
    analysisId: input.analysisId,
    status:
      shadowResult.shadowRunStatus === "manual_review"
        ? "manual_review"
        : shadowResult.shadowRunStatus === "failed"
          ? "failed"
          : "complete",
    degraded: shadowResult.manualReviewRequired,
    documentQuality: input.documentQuality,
    reviewReasons,
  });
}
