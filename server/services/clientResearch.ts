import { executeClaudeJsonStage } from "./analysisAi";
import { getAnalysisFeatureFlags } from "./analysisFlags";
import { clientResearchSchema } from "./analysisValidation";
import { performExaClientResearch } from "./exaResearch";

export interface ClientResearchResult {
  companyName: string;
  industry: string;
  entityType: "private" | "public" | "semi_government" | "government" | "ngo";
  estimatedSize: "startup" | "small" | "medium" | "large" | "enterprise";
  employeeRange: string;
  holdingGroup: { name: string | null; tier: "major" | "mid_tier" | "independent" };
  geographicReach: "local" | "regional" | "national" | "international";
  marketingBudgetTier: "low" | "moderate" | "significant" | "major" | "enterprise";
  mediaSpendsSignal: "minimal" | "low" | "moderate" | "high" | "very_high";
  socialActivityLevel: "inactive" | "low" | "moderate" | "active" | "very_active";
  contentPublishingLevel: "minimal" | "low" | "moderate" | "active" | "very_active";
  digitalPresence: string;
  confidenceScores: Record<string, number>;
  researchNotes: string[];
  sourceType: "document_only_inference" | "web_research" | "mixed";
  externalResearchAvailable: boolean;
  sources: Array<{
    title: string;
    url: string;
    retrievedAt: string;
    evidenceTier: "document" | "external";
  }>;
}

const SYSTEM_PROMPT = `You are an expert business analyst specializing in client intelligence for creative and marketing agencies. Your task is to analyze an RFP (Request for Proposal) document and infer as much as possible about the issuing company/organization.

Analyze the RFP text for context clues including:
- Company/organization name (from letterhead references, signatures, "about us" sections)
- Industry indicators (sector-specific terminology, product/service mentions)
- Entity type signals (government procurement language, corporate structure references)
- Size indicators (project scale, budget hints, number of brands/products, geographic scope)
- Holding group references (parent company mentions, portfolio brand references)
- Marketing sophistication (complexity of requirements, existing channel mentions)
- Digital maturity (tech stack references, digital channel requirements, platform mentions)

You MUST respond with valid JSON matching this exact structure:
{
  "companyName": "string - best guess at company name, or 'Unknown' if not identifiable",
  "industry": "string - primary industry sector",
  "entityType": "private" | "public" | "semi_government" | "government" | "ngo",
  "estimatedSize": "startup" | "small" | "medium" | "large" | "enterprise",
  "employeeRange": "string - e.g. '50-200', '1000-5000', 'Unknown'",
  "holdingGroup": { "name": "string or null", "tier": "major" | "mid_tier" | "independent" },
  "geographicReach": "local" | "regional" | "national" | "international",
  "marketingBudgetTier": "low" | "moderate" | "significant" | "major" | "enterprise",
  "mediaSpendsSignal": "minimal" | "low" | "moderate" | "high" | "very_high",
  "socialActivityLevel": "inactive" | "low" | "moderate" | "active" | "very_active",
  "contentPublishingLevel": "minimal" | "low" | "moderate" | "active" | "very_active",
  "digitalPresence": "string - ONE short sentence (max 15 words) rating their digital footprint, e.g. 'Sophisticated multi-platform presence with high social activity'",
  "confidenceScores": {
    "companyName": 0.0-1.0,
    "industry": 0.0-1.0,
    "entityType": 0.0-1.0,
    "estimatedSize": 0.0-1.0,
    "holdingGroup": 0.0-1.0,
    "geographicReach": 0.0-1.0,
    "marketingBudgetTier": 0.0-1.0,
    "mediaSpendsSignal": 0.0-1.0,
    "socialActivityLevel": 0.0-1.0,
    "contentPublishingLevel": 0.0-1.0
  },
  "researchNotes": ["string - key observations and evidence used for inferences"]
}

Be conservative with confidence scores. If evidence is weak, assign lower confidence (0.2-0.4). Only assign high confidence (0.8+) when there is clear textual evidence.`;

export async function performClientResearch(
  documentText: string,
  extractedData: any
): Promise<ClientResearchResult> {
  const flags = getAnalysisFeatureFlags();
  // Smart truncation: use document opening (letterhead/intro) + closing (signatures/contact)
  // plus the comprehensive extracted data from Pass 1
  let documentContext: string;
  if (documentText.length > 16000) {
    const opening = documentText.slice(0, 8000);
    const closing = documentText.slice(-8000);
    documentContext = `[Document Opening - first 8000 chars]\n${opening}\n\n[Document Closing - last 8000 chars]\n${closing}`;
  } else {
    documentContext = documentText;
  }

  const userContent = `Analyze the following RFP document and extracted data to build a client intelligence profile.

RFP Document Text:
${documentContext}

Comprehensive Extracted Data (from full document analysis):
${JSON.stringify(extractedData, null, 2)}`;
  const { value } = await executeClaudeJsonStage({
    stageKey: "client_research",
    label: "Client research",
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    schema: clientResearchSchema,
    defaultValue: {
      companyName: "Unknown",
      industry: "Unknown",
      entityType: "private",
      estimatedSize: "medium",
      employeeRange: "Unknown",
      holdingGroup: { name: null, tier: "independent" },
      geographicReach: "regional",
      marketingBudgetTier: "moderate",
      mediaSpendsSignal: "moderate",
      socialActivityLevel: "moderate",
      contentPublishingLevel: "moderate",
      digitalPresence: "Unknown",
      confidenceScores: {},
      researchNotes: [],
      sourceType: "document_only_inference",
      externalResearchAvailable: false,
      sources: [],
    },
    maxTokens: 8192,
  });

  const result = value;
  const researchNotes = Array.isArray(result.researchNotes)
    ? [...result.researchNotes]
    : [];
  const extractedCompanyName =
    typeof extractedData?.clientName === "string" && extractedData.clientName.trim()
      ? extractedData.clientName.trim()
      : typeof extractedData?.coreExtraction?.clientName === "string" &&
          extractedData.coreExtraction.clientName.trim()
        ? extractedData.coreExtraction.clientName.trim()
        : null;
  const extractedIndustry =
    typeof extractedData?.industry === "string" && extractedData.industry.trim()
      ? extractedData.industry.trim()
      : typeof extractedData?.coreExtraction?.industry === "string" &&
          extractedData.coreExtraction.industry.trim()
        ? extractedData.coreExtraction.industry.trim()
        : null;

  const normalizedCompanyName =
    typeof result.companyName === "string" ? result.companyName.trim() : "";
  const normalizedIndustry =
    typeof result.industry === "string" ? result.industry.trim() : "";

  let externalSources: ClientResearchResult["sources"] = [];
  if (flags.webResearch) {
    try {
      const exaResult = await performExaClientResearch({
        clientName: extractedCompanyName || normalizedCompanyName || null,
        projectTitle:
          typeof extractedData?.projectTitle === "string"
            ? extractedData.projectTitle
            : typeof extractedData?.coreExtraction?.projectTitle === "string"
              ? extractedData.coreExtraction.projectTitle
              : null,
        industry: extractedIndustry || normalizedIndustry || null,
      });
      externalSources = exaResult.sources;
      researchNotes.push(...exaResult.notes);
    } catch (error: any) {
      researchNotes.push(
        `External web research failed and was skipped: ${error?.message || "Unknown Exa error"}`,
      );
    }
  }

  let companyName =
    normalizedCompanyName &&
    normalizedCompanyName.toLowerCase() !== "unknown"
      ? normalizedCompanyName
      : extractedCompanyName || "Unknown";
  let industry =
    normalizedIndustry &&
    normalizedIndustry.toLowerCase() !== "unknown"
      ? normalizedIndustry
      : extractedIndustry || "Unknown";

  const confidenceScores = { ...(result.confidenceScores || {}) };
  if (
    companyName === extractedCompanyName &&
    (!normalizedCompanyName || normalizedCompanyName.toLowerCase() === "unknown")
  ) {
    confidenceScores.companyName = Math.max(confidenceScores.companyName || 0, 0.85);
    researchNotes.push(
      "Client name inherited from core extraction because the client research pass did not resolve it reliably.",
    );
  }
  if (
    industry === extractedIndustry &&
    (!normalizedIndustry || normalizedIndustry.toLowerCase() === "unknown")
  ) {
    confidenceScores.industry = Math.max(confidenceScores.industry || 0, 0.7);
  }

  if (!flags.webResearch) {
    researchNotes.push("External web research is disabled by feature flag; profile is document-only inference.");
  } else if (externalSources.length === 0) {
    researchNotes.push("External web research was enabled but no verified external sources were retrieved.");
  }

  return {
    companyName,
    industry,
    entityType: result.entityType || "private",
    estimatedSize: result.estimatedSize || "medium",
    employeeRange: result.employeeRange || "Unknown",
    holdingGroup: result.holdingGroup || { name: null, tier: "independent" },
    geographicReach: result.geographicReach || "regional",
    marketingBudgetTier: result.marketingBudgetTier || "moderate",
    mediaSpendsSignal: result.mediaSpendsSignal || "moderate",
    socialActivityLevel: result.socialActivityLevel || "moderate",
    contentPublishingLevel: result.contentPublishingLevel || "moderate",
    digitalPresence: result.digitalPresence || "Unknown",
    confidenceScores,
    researchNotes,
    sourceType:
      externalSources.length > 0
        ? "mixed"
        : "document_only_inference",
    externalResearchAvailable:
      Boolean(flags.webResearch) && externalSources.length > 0,
    sources: externalSources,
  };
}
