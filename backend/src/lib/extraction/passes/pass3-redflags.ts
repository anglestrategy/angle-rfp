import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import type { AnalyzeRfpInput } from "@/lib/extraction/analyze-rfp";
import { resolveGoogleApiKey, runWithGeminiFlashModel } from "@/lib/ai/model-resolver";

const RED_FLAG_TIMEOUT_MS = 60_000;

const RedFlagSchema = z.object({
  type: z.enum(["contractual", "feasibility", "process"]),
  severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(320),
  sourceText: z.string().min(1).max(260),
  recommendation: z.string().min(1).max(260)
});

const RedFlagsResponseSchema = z.object({
  redFlags: z.array(RedFlagSchema).max(12).default([])
});

const deterministicRedFlagKeywords: Array<{
  type: "contractual" | "feasibility" | "process";
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  pattern: RegExp;
  recommendation: string;
}> = [
  {
    type: "contractual",
    severity: "HIGH",
    title: "Unlimited Revisions",
    pattern: /unlimited\s+revisions|غير\s+محدود\s+من\s+التعديلات/i,
    recommendation: "Negotiate revision cap with change-request process."
  },
  {
    type: "contractual",
    severity: "HIGH",
    title: "Full IP Transfer",
    pattern: /all\s+(?:intellectual\s+property|ip|work)\s+(?:shall\s+)?(?:become|transfer|vest|belong).*(?:client|company|employer)|work\s+for\s+hire|work\s+made\s+for\s+hire/i,
    recommendation: "Request ownership carve-out for unused concepts and pre-existing IP."
  },
  {
    type: "contractual",
    severity: "HIGH",
    title: "Unlimited Liability",
    pattern: /unlimited\s+liability|unlimited\s+indemnification|indemnify.*(?:all|any)\s+(?:claims?|losses?|damages?)(?!\s*up\s*to)/i,
    recommendation: "Negotiate liability cap proportional to contract value."
  },
  {
    type: "contractual",
    severity: "HIGH",
    title: "Unilateral Termination",
    pattern: /terminate\s+(?:at\s+)?(?:any\s+time|without\s+cause|for\s+convenience)(?!\s+with\s+(?:\d+|thirty|sixty|ninety)\s+days?\s+(?:prior\s+)?notice)|إنهاء.*دون\s+سبب/i,
    recommendation: "Ensure termination for convenience includes reasonable notice period and payment for work completed."
  },
  {
    type: "contractual",
    severity: "MEDIUM",
    title: "Non-Compete Clause",
    pattern: /non-?compete|non-?solicitation|(?:shall|will)\s+not\s+(?:work|engage|provide\s+services)\s+(?:with|for|to)\s+(?:any\s+)?(?:competitor|similar|other\s+(?:client|company))/i,
    recommendation: "Review scope and duration of non-compete; negotiate reasonable boundaries."
  },
  {
    type: "contractual",
    severity: "MEDIUM",
    title: "Penalty Clauses",
    pattern: /penalty\s+(?:of|for)|liquidated\s+damages|delay\s+penalty|غرامة\s+تأخير|عقوبة/i,
    recommendation: "Review penalty amounts and conditions; negotiate reasonable grace periods."
  },
  {
    type: "contractual",
    severity: "MEDIUM",
    title: "Payment Terms Risk",
    pattern: /(?:payment|pay).*(?:90|120|180)\s*(?:days?|calendar)|net\s*(?:90|120|180)/i,
    recommendation: "Negotiate shorter payment terms or milestone-based payments."
  },
  {
    type: "contractual",
    severity: "MEDIUM",
    title: "Scope Creep Risk",
    pattern: /additional\s+(?:work|services|scope)\s+(?:as\s+)?(?:required|needed|requested)(?!\s+(?:will|shall)\s+be\s+(?:separately|additionally)\s+(?:priced|compensated))|any\s+other\s+(?:tasks?|work|services?)\s+(?:as\s+)?(?:deemed|considered)\s+necessary/i,
    recommendation: "Clarify scope boundaries and ensure change order process for additional work."
  },
  {
    type: "feasibility",
    severity: "HIGH",
    title: "Extremely Tight Timeline",
    pattern: /within\s+(?:[1-7]|one|two|three|four|five|six|seven)\s+(?:business\s+)?days?|خلال\s+[١-٧1-7]\s+(?:أيام|يوم)/i,
    recommendation: "Assess feasibility; request timeline extension or phased delivery approach."
  },
  {
    type: "feasibility",
    severity: "MEDIUM",
    title: "Unrealistic Timeline",
    pattern: /within\s+(?:[8-9]|1[0-4]|eight|nine|ten|eleven|twelve|thirteen|fourteen)\s+(?:business\s+)?days?|خلال\s+\d{1,2}\s+(?:أيام|يوم)/i,
    recommendation: "Clarify delivery sequencing and milestone expectations."
  },
  {
    type: "feasibility",
    severity: "MEDIUM",
    title: "Large Volume Requirement",
    pattern: /(?:\d{3,}|hundred|thousand)\s+(?:deliverables?|assets?|designs?|videos?|pieces?|items?)|mass\s+production|high\s+volume/i,
    recommendation: "Ensure volume is accurately scoped and priced; consider phased delivery."
  },
  {
    type: "feasibility",
    severity: "LOW",
    title: "Multi-Language Requirement",
    pattern: /(?:multiple|several|many)\s+languages?|(?:translat(?:e|ion)|locali[sz](?:e|ation))\s+(?:in|into|to)\s+(?:\d+|multiple|several)\s+languages?/i,
    recommendation: "Factor in translation and cultural adaptation costs and timelines."
  },
  {
    type: "process",
    severity: "MEDIUM",
    title: "No Q&A Window",
    pattern: /no\s+questions?|without\s+(?:q&a|clarification)|بدون\s+أسئلة|لا\s+(?:أسئلة|استفسارات)/i,
    recommendation: "Request formal clarification window before submission."
  },
  {
    type: "process",
    severity: "MEDIUM",
    title: "Lowest Price Wins",
    pattern: /lowest\s+(?:price|bid|cost)\s+(?:wins?|selected|awarded)|أقل\s+سعر/i,
    recommendation: "Evaluate if quality-focused agency can compete; consider strategic pricing."
  },
  {
    type: "process",
    severity: "LOW",
    title: "Incumbent Advantage",
    pattern: /(?:current|existing|incumbent)\s+(?:agency|vendor|supplier|provider)|extension\s+of\s+(?:current|existing)\s+(?:contract|agreement)/i,
    recommendation: "Research incumbent relationship; assess realistic win probability."
  },
  {
    type: "process",
    severity: "LOW",
    title: "Blackout Period",
    pattern: /blackout\s+period|no\s+contact|communication\s+(?:ban|restriction|blackout)/i,
    recommendation: "Ensure all questions are submitted before blackout period begins."
  }
];

function runDeterministicRedFlags(text: string): Array<{
  type: "contractual" | "feasibility" | "process";
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  sourceText: string;
  recommendation: string;
}> {
  return deterministicRedFlagKeywords
    .filter((item) => item.pattern.test(text))
    .map((item) => {
      const match = item.pattern.exec(text);
      const matchStart = match?.index ?? 0;
      const contextStart = Math.max(0, matchStart - 40);
      const contextEnd = Math.min(text.length, matchStart + (match?.[0]?.length ?? 0) + 80);
      const sourceText = text.slice(contextStart, contextEnd).replace(/\s+/g, " ").trim();

      return {
        type: item.type,
        severity: item.severity,
        title: item.title,
        description: `${item.title} detected in RFP language.`,
        sourceText: sourceText.slice(0, 260),
        recommendation: item.recommendation
      };
    });
}

async function runAiRedFlagAnalysis(rawText: string, scopeOfWork: string): Promise<Array<{
  type: "contractual" | "feasibility" | "process";
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  sourceText: string;
  recommendation: string;
}>> {
  const apiKey = resolveGoogleApiKey();
  if (!apiKey) {
    return [];
  }

  const googleProvider = createGoogleGenerativeAI({ apiKey });
  const textHead = rawText.slice(0, 30_000);
  const textTail = rawText.length > 30_000 ? rawText.slice(Math.max(0, rawText.length - 10_000)) : "";

  const prompt = `You are a senior agency risk analyst reviewing an RFP (Request for Proposal) for a creative/marketing agency.

Analyze the following RFP text for red flags and risks that could impact the agency's decision to bid or the project's success.

## RED FLAG CATEGORIES

### Contractual Risks (type: "contractual")
- Unlimited revisions or changes without additional compensation
- Full IP/intellectual property transfer including pre-existing work or unused concepts
- Unlimited or disproportionate liability/indemnification
- Unilateral termination without notice or compensation for work done
- Non-compete clauses that are overly broad
- Punitive penalty clauses for delays
- Payment terms exceeding 60 days
- Scope creep language ("and any other work as needed")
- Automatic renewal or lock-in provisions
- Exclusivity requirements without premium
- One-sided confidentiality agreements

### Feasibility Risks (type: "feasibility")
- Unrealistically tight timelines for the scope of work
- Very large volume of deliverables relative to timeline
- Technical requirements beyond typical agency capabilities
- Multi-language/multi-market requirements that multiply effort
- Ambiguous or contradictory scope requirements
- Dependencies on client-provided materials without guarantees
- 24/7 support or availability requirements

### Process Risks (type: "process")
- No Q&A or clarification window
- Lowest-price-wins evaluation criteria
- Incumbent advantage signals
- Very short proposal preparation window
- Blackout/communication restrictions
- Unclear evaluation criteria or decision process
- Required speculative creative work without compensation
- Mandatory presentations with short notice

## SEVERITY GUIDELINES
- HIGH: Could cause significant financial loss, legal exposure, or project failure
- MEDIUM: Creates moderate risk; manageable with negotiation or planning
- LOW: Worth noting for awareness; minor impact

## INSTRUCTIONS
1. Read the RFP text carefully for both explicit and implicit risks.
2. For each red flag found, cite the EXACT source text from the document (max 260 chars).
3. Provide specific, actionable recommendations.
4. Do NOT flag standard industry practices (e.g., normal NDA requirements, standard payment terms).
5. Focus on risks that are genuinely concerning for a creative agency.
6. If no significant red flags exist, return an empty array.
7. Handle both English and Arabic text.

Return ONLY valid JSON matching this schema:
{
  "redFlags": [
    {
      "type": "contractual" | "feasibility" | "process",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "title": "Short descriptive title",
      "description": "Detailed explanation of why this is a risk",
      "sourceText": "Exact quote from the document",
      "recommendation": "Specific actionable recommendation"
    }
  ]
}

## RFP TEXT (beginning):
${textHead}

${textTail ? `## RFP TEXT (end section):\n${textTail}` : ""}

## EXTRACTED SCOPE OF WORK:
${scopeOfWork.slice(0, 4_000)}
`;

  const result = await runWithGeminiFlashModel((model) =>
    generateText({
      model: googleProvider(model),
      output: Output.object({
        schema: RedFlagsResponseSchema
      }),
      temperature: 0.1,
      maxOutputTokens: 4000,
      abortSignal: AbortSignal.timeout(RED_FLAG_TIMEOUT_MS),
      prompt
    })
  );

  if (!result.output?.redFlags) {
    return [];
  }

  return result.output.redFlags.map((flag) => ({
    type: flag.type,
    severity: flag.severity,
    title: flag.title.slice(0, 120),
    description: flag.description.slice(0, 320),
    sourceText: flag.sourceText.slice(0, 260),
    recommendation: flag.recommendation.slice(0, 260)
  }));
}

function deduplicateRedFlags(flags: Array<{
  type: "contractual" | "feasibility" | "process";
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  sourceText: string;
  recommendation: string;
}>): typeof flags {
  const seen = new Set<string>();
  const result: typeof flags = [];

  for (const flag of flags) {
    const key = flag.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(flag);
  }

  return result;
}

export async function runPass3RedFlags(input: AnalyzeRfpInput, extracted: { scopeOfWork: string }) {
  const text = `${input.parsedDocument.rawText}\n${extracted.scopeOfWork}`;
  const warnings: string[] = [];

  const deterministicFlags = runDeterministicRedFlags(text);

  let aiFlags: typeof deterministicFlags = [];
  try {
    aiFlags = await runAiRedFlagAnalysis(input.parsedDocument.rawText, extracted.scopeOfWork);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Pass3] AI red flag analysis failed, using deterministic fallback:", message);
    warnings.push("AI red flag analysis unavailable; using deterministic detection only.");
  }

  const allFlags = deduplicateRedFlags([...aiFlags, ...deterministicFlags]);

  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  allFlags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const redFlags = allFlags.slice(0, 12);

  if (redFlags.length > 0) {
    const highCount = redFlags.filter((f) => f.severity === "HIGH").length;
    const medCount = redFlags.filter((f) => f.severity === "MEDIUM").length;
    const lowCount = redFlags.filter((f) => f.severity === "LOW").length;
    warnings.push(
      `${redFlags.length} red flag(s) detected: ${highCount} HIGH, ${medCount} MEDIUM, ${lowCount} LOW severity.`
    );
  }

  return { redFlags, warnings };
}
