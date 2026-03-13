import { z, type ZodSchema } from "zod";
import type { ClientResearchResult } from "./clientResearch";

const deliverableSchema = z
  .object({
    name: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    quantity: z.number().optional().nullable(),
    format: z.string().optional().nullable(),
  })
  .passthrough();

const phaseSchema = z
  .object({
    name: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    timeline: z.string().optional().nullable(),
    deliverables: z.array(z.union([z.string(), deliverableSchema])).optional(),
  })
  .passthrough();

const keyDateSchema = z
  .object({
    date: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    phase: z.string().optional().nullable(),
  })
  .passthrough();

const contractTermsSchema = z
  .object({
    paymentTerms: z.string().optional().nullable(),
    delayPenalties: z.string().optional().nullable(),
    performanceGuarantees: z.string().optional().nullable(),
    confidentiality: z.string().optional().nullable(),
    ipOwnership: z.string().optional().nullable(),
    governingLaw: z.string().optional().nullable(),
    terminationClause: z.string().optional().nullable(),
    otherTerms: z.array(z.string()).optional(),
  })
  .passthrough();

export const coreExtractionSchema = z
  .object({
    clientName: z.string().optional().nullable(),
    projectTitle: z.string().optional().nullable(),
    industry: z.string().optional().nullable(),
    executiveSummary: z.string().optional().nullable(),
    scopeOfWork: z
      .object({
        overview: z.string().optional().nullable(),
        phases: z.array(phaseSchema).optional(),
      })
      .passthrough()
      .optional()
      .nullable(),
    deliverables: z.array(z.union([z.string(), deliverableSchema])).optional(),
    budget: z
      .object({
        totalBudget: z.string().optional().nullable(),
        currency: z.string().optional().nullable(),
        hasBOQ: z.boolean().optional().nullable(),
        pricingStructure: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
      .passthrough()
      .optional()
      .nullable(),
    timeline: z
      .object({
        overallDuration: z.string().optional().nullable(),
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
        durationMonths: z.number().optional().nullable(),
        phases: z.array(z.string()).optional(),
        keyMilestones: z.array(keyDateSchema).optional(),
      })
      .passthrough()
      .optional()
      .nullable(),
    keyDates: z.array(keyDateSchema).optional(),
    submissionDeadline: z.string().optional().nullable(),
    submissionRequirements: z
      .object({
        deadline: z.string().optional().nullable(),
        format: z.string().optional().nullable(),
        submissionMethod: z.string().optional().nullable(),
        contactInfo: z.string().optional().nullable(),
        requiredDocuments: z.array(z.string()).optional(),
        specialInstructions: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional()
      .nullable(),
    evaluationCriteria: z.array(z.record(z.any())).optional(),
    contractTerms: contractTermsSchema.optional().nullable(),
    teamRequirements: z.record(z.any()).optional().nullable(),
    specialRequirements: z.array(z.string()).optional(),
  })
  .passthrough();

export const verificationSchema = z
  .object({
    overallAccuracy: z.number().optional().nullable(),
    corrections: z
      .array(
        z
          .object({
            field: z.string(),
            currentValue: z.any().optional(),
            correctedValue: z.any().optional(),
            reason: z.string().optional().nullable(),
          })
          .passthrough(),
      )
      .optional(),
    additions: z
      .array(
        z
          .object({
            field: z.string(),
            value: z.any(),
            evidence: z.string().optional().nullable(),
          })
          .passthrough(),
      )
      .optional(),
    missingPhases: z.array(z.string()).optional(),
    missingDeliverables: z.array(z.string()).optional(),
    notes: z.string().optional().nullable(),
  })
  .passthrough();

export const redFlagAnalysisSchema = z
  .object({
    redFlags: z
      .array(
        z
          .object({
            title: z.string().optional().nullable(),
            description: z.string().optional().nullable(),
            severity: z.string().optional().nullable(),
            category: z.string().optional().nullable(),
            evidence: z.string().optional().nullable(),
            clauseReference: z.string().optional().nullable(),
            recommendation: z.string().optional().nullable(),
            financialImpact: z.string().optional().nullable(),
          })
          .passthrough(),
      )
      .optional(),
    riskSummary: z.record(z.any()).optional().nullable(),
  })
  .passthrough();

export const completenessAnalysisSchema = z
  .object({
    missingItems: z
      .array(
        z
          .object({
            item: z.string().optional().nullable(),
            importance: z.string().optional().nullable(),
            impact: z.string().optional().nullable(),
          })
          .passthrough(),
      )
      .optional(),
    contradictions: z
      .array(
        z
          .object({
            topic: z.string().optional().nullable(),
            statement1: z.string().optional().nullable(),
            statement2: z.string().optional().nullable(),
            location1: z.string().optional().nullable(),
            location2: z.string().optional().nullable(),
            suggestedResolution: z.string().optional().nullable(),
          })
          .passthrough(),
      )
      .optional(),
    clarificationQuestions: z.array(z.string()).optional(),
  })
  .passthrough();

export const clientResearchSchema: ZodSchema<ClientResearchResult> = z
  .object({
    companyName: z.string(),
    industry: z.string(),
    entityType: z.enum([
      "private",
      "public",
      "semi_government",
      "government",
      "ngo",
    ]),
    estimatedSize: z.enum(["startup", "small", "medium", "large", "enterprise"]),
    employeeRange: z.string(),
    holdingGroup: z.object({
      name: z.string().nullable(),
      tier: z.enum(["major", "mid_tier", "independent"]),
    }),
    geographicReach: z.enum(["local", "regional", "national", "international"]),
    marketingBudgetTier: z.enum([
      "low",
      "moderate",
      "significant",
      "major",
      "enterprise",
    ]),
    mediaSpendsSignal: z.enum(["minimal", "low", "moderate", "high", "very_high"]),
    socialActivityLevel: z.enum(["inactive", "low", "moderate", "active", "very_active"]),
    contentPublishingLevel: z.enum([
      "minimal",
      "low",
      "moderate",
      "active",
      "very_active",
    ]),
    digitalPresence: z.string(),
    confidenceScores: z.record(z.number()),
    researchNotes: z.array(z.string()),
    sourceType: z.enum(["document_only_inference", "web_research", "mixed"]),
    externalResearchAvailable: z.boolean(),
    sources: z.array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        retrievedAt: z.string(),
        evidenceTier: z.enum(["document", "external"]),
      }),
    ),
  });

export const analysisStageSchemas = {
  coreExtraction: coreExtractionSchema,
  verification: verificationSchema,
  redFlags: redFlagAnalysisSchema,
  completeness: completenessAnalysisSchema,
  clientResearch: clientResearchSchema,
} satisfies Record<string, ZodSchema<any>>;

export function formatSchemaIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path.join(".") || "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}
