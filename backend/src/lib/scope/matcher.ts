import type { AgencyService } from "@/lib/scope/taxonomy-loader";
import { normalizeForMatching } from "@/lib/scope/taxonomy-loader";

export interface ScopeMatch {
  scopeItem: string;
  service: string;
  class: "full" | "partial" | "none" | "uncertain";
  confidence: number;
  classificationSource: "token" | "rule";
}

const PARTIAL_HINTS = [
  /supervision/i,
  /manage/i,
  /management/i,
  /coordination/i,
  /governance/i,
  /oversight/i,
  /support/i,
  /إشراف/,
  /إدارة/,
  /تنسيق/
];

const AGENCY_DOMAIN_HINTS = [
  /brand/i,
  /campaign/i,
  /marketing/i,
  /research/i,
  /insights?/i,
  /benchmark/i,
  /market mapping/i,
  /competitive/i,
  /communication/i,
  /content/i,
  /design/i,
  /creative/i,
  /media/i,
  /narrative/i,
  /strategy/i,
  /launch/i,
  /social/i,
  /digital/i,
  /production/i,
  /messaging/i,
  /identity/i,
  /locali[sz]ation/i,
  /positioning/i,
  /branding/i,
  /إبداع/,
  /تسويق/,
  /هوية/,
  /استراتيجية/,
  /محتوى/,
  /تصميم/
];

const OUT_OF_SCOPE_HINTS = [
  /construction/i,
  /civil/i,
  /structural/i,
  /legal/i,
  /litigation/i,
  /financial audit|statutory audit|external audit/i,
  /tax/i,
  /payroll/i,
  /human resources/i,
  /\bhr\b/i,
  /it infrastructure/i,
  /data center/i,
  /network operations/i,
  /cybersecurity operations/i,
  /facility maintenance/i,
  /security guards?/i,
  /janitorial|cleaning/i,
  /mechanical engineering/i,
  /plumbing/i,
  /electrical installation/i,
  /أعمال إنشائية/,
  /خدمات قانونية/,
  /صيانة مباني/
];

const MARKET_RESEARCH_SCOPE_HINTS = [
  /market research/i,
  /consumer research/i,
  /qualitative research/i,
  /quantitative research/i,
  /research methodologies?/i,
  /focus groups?/i,
  /benchmarks?/i,
  /benchmarking/i,
  /market mapping/i,
  /competitive research/i,
  /competitor analysis/i,
  /cultural analysis/i,
  /local insights?/i,
  /أبحاث السوق/i,
  /بحث السوق/i,
  /مجموعات التركيز/i,
  /بحث نوعي/i,
  /بحث كمي/i,
  /تحليل ثقافي/i
];

const MARKET_RESEARCH_CAPABILITY_HINTS = [
  /market research/i,
  /consumer research/i,
  /qualitative/i,
  /quantitative/i,
  /focus groups?/i,
  /benchmark/i,
  /competitive research/i,
  /audience research/i,
  /insight/i,
  /أبحاث السوق/i,
  /بحث السوق/i,
  /بحث نوعي/i,
  /بحث كمي/i,
  /مجموعات التركيز/i
];

const NON_SCOPE_OPERATIONAL_HINTS = [
  /submission deadline/i,
  /proposal submission/i,
  /email submission/i,
  /intent to tender/i,
  /deadline for questions/i,
  /responses? to questions?/i,
  /bidder|bidders/i,
  /submission requirements?/i,
  /terms?\s*&?\s*conditions?/i,
  /commercial proposal/i,
  /certificate/i,
  /\bcv\b|resume/i,
  /non[-\s]?disclosure|nda/i,
  /must comprise|minimum\s+\d+%/i,
  /evaluation criteria/i,
  /special conditions/i,
  /qa deadline/i,
  /presentation deadline/i,
  /proposal deadline/i,
  /prepared by|procurement department/i,
  /expo\s*2030\s*riyadh\s*company/i,
  /fifa\s*world\s*cup|expo\s*dubai/i,
  /موعد تقديم|آخر موعد|شروط التقديم|معايير التقييم|شروط خاصة/
];

const STRUCTURAL_LINE_PATTERNS = [
  /^(executive summary)$/i,
  /^(overview|key objectives|deliverables|timeline|important dates|submission requirements|special conditions)$/i,
  /^(scope of work|evaluation criteria|project description|financial potential)$/i,
  /^(phase|section)\s+\d+/i,
  /^(نطاق العمل|المخرجات|الجدول الزمني|معايير التقييم|الشروط الخاصة)$/
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "will",
  "into",
  "within",
  "across",
  "through",
  "project",
  "phase",
  "plan",
  "deliverables",
  "timeline",
  "overview"
]);

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function isMarketResearchScopeItem(text: string): boolean {
  return containsAny(text, MARKET_RESEARCH_SCOPE_HINTS);
}

export function taxonomySupportsMarketResearch(services: AgencyService[]): boolean {
  return services.some((service) =>
    containsAny(`${service.category} ${service.service} ${service.normalized}`, MARKET_RESEARCH_CAPABILITY_HINTS)
  );
}

function cleanScopeFragment(fragment: string): string {
  return fragment
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\s*(?:[-*•▪‣●]|\d+[.)])\s+/u, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^important\s*:\s*/i, "")
    .replace(/^note\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoScopeClauses(line: string): string[] {
  const normalized = line.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const sentenceParts = normalized
    .split(/(?<=[.!?؟])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const seed = sentenceParts.length > 1 ? sentenceParts : [normalized];
  const out: string[] = [];
  for (const part of seed) {
    const commaClauses = part
      .split(/\s+[–—-]\s+|;\s+|،\s+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (commaClauses.length > 1) {
      out.push(...commaClauses);
      continue;
    }
    out.push(part);
  }
  return out;
}

function isStructuralLine(line: string): boolean {
  const normalized = normalizeForMatching(line);
  if (!normalized) {
    return true;
  }

  if (/^(phase|section)\s+\d+/i.test(normalized)) {
    const remainder = normalized
      .replace(/^(phase|section)\s+\d+\s*[:\-]?\s*/i, "")
      .trim();
    const isShortSectionTitle = remainder.split(" ").filter(Boolean).length <= 5 && !/[,.!?؛]/.test(remainder);
    if (isShortSectionTitle) {
      return true;
    }
    const hasActionSignal =
      /(develop|design|create|build|launch|define|align|deliver|craft|implement|execute|produce|manage|lead|map|research|analy[sz]e|optimi[sz]e|monitor|coordinate|supervise|إعداد|تطوير|تصميم|تنفيذ|إطلاق|إدارة|تحليل|تنسيق|إشراف|إنتاج)/i.test(
        remainder
      );
    if (remainder.length >= 12 && hasActionSignal) {
      return false;
    }
  }

  if (STRUCTURAL_LINE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  return /^#+/.test(line.trim());
}

function isScopeCandidate(line: string): boolean {
  const normalized = normalizeForMatching(line);
  if (!normalized) {
    return false;
  }

  if (containsAny(normalized, NON_SCOPE_OPERATIONAL_HINTS)) {
    return false;
  }

  return true;
}

function isLikelyOrphanScopeNoise(line: string): boolean {
  const normalized = normalizeForMatching(line);
  if (!normalized) {
    return true;
  }

  const upperMetadata =
    /^[A-Z0-9\s&/\-]{6,}$/.test(line) &&
    !/[a-z]/.test(line) &&
    line.trim().split(/\s+/).length <= 8;
  if (upperMetadata) {
    return true;
  }

  const orphanBenchmark =
    (/(?:fifa|expo)\s*\d{4}/i.test(line) || /qatar\s*2022/i.test(line)) &&
    !/(benchmark|analysis|identify|research|compare|insight|دراسة|تحليل|مقارنة)/i.test(line);
  if (orphanBenchmark) {
    return true;
  }

  return false;
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeForMatching(text)
      .split(" ")
      .map((part) => part.trim())
      .filter((part) => part.length >= 3 && !STOP_WORDS.has(part))
  );
}

function tokenOverlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) {
      overlap += 1;
    }
  }

  const precision = overlap / a.size;
  const recall = overlap / b.size;
  const containment = overlap / Math.min(a.size, b.size);
  return Math.min(1, Math.max(containment * 0.8, 0.35 * precision + 0.65 * recall));
}

export function splitScopeItems(scopeOfWork: string): string[] {
  const lines = scopeOfWork
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const output: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const fragments = line
      .split(/[؛;•]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .flatMap((part) => splitIntoScopeClauses(part));

    for (const fragment of fragments) {
      const cleaned = cleanScopeFragment(fragment);
      if (
        cleaned.length < 8 ||
        isStructuralLine(cleaned) ||
        !isScopeCandidate(cleaned) ||
        isLikelyOrphanScopeNoise(cleaned)
      ) {
        continue;
      }

      const dedupeKey = normalizeForMatching(cleaned);
      if (!dedupeKey || seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);
      output.push(cleaned);
    }
  }

  return output;
}

function classifyMatch(scopeItem: string, service: AgencyService, score: number): ScopeMatch["class"] {
  const isExplicitOutOfScope = containsAny(scopeItem, OUT_OF_SCOPE_HINTS);

  if (isExplicitOutOfScope) {
    return "none";
  }

  if (score < 0.15) {
    const hasAgencySignal = containsAny(scopeItem, AGENCY_DOMAIN_HINTS);
    return hasAgencySignal ? "partial" : "none";
  }

  const hasAgencySignal = containsAny(scopeItem, AGENCY_DOMAIN_HINTS);

  const isPartialHint = PARTIAL_HINTS.some((pattern) => pattern.test(scopeItem) || pattern.test(service.service));
  if (isPartialHint || score < 0.45) {
    return "partial";
  }

  return "full";
}

export function matchScopeItems(scopeItems: string[], services: AgencyService[]): ScopeMatch[] {
  return scopeItems.map((scopeItem) => {
    const isExplicitOutOfScope = containsAny(scopeItem, OUT_OF_SCOPE_HINTS);
    const isMarketResearch = isMarketResearchScopeItem(scopeItem);

    const scopeTokens = tokenize(scopeItem);
    let bestService: AgencyService | null = null;
    let bestScore = 0;

    for (const service of services) {
      const serviceTokens = tokenize(`${service.category} ${service.normalized}`);
      const score = tokenOverlapScore(scopeTokens, serviceTokens);
      if (score > bestScore) {
        bestScore = score;
        bestService = service;
      }
    }

    const hasAgencySignal = containsAny(scopeItem, AGENCY_DOMAIN_HINTS);

    if (isExplicitOutOfScope && !isMarketResearch) {
      return {
        scopeItem,
        service: "No direct match",
        class: "none",
        confidence: 0.2,
        classificationSource: "rule"
      };
    }

    if (!bestService) {
      return {
        scopeItem,
        service: isMarketResearch ? "Market research & insights" : hasAgencySignal ? "Broad agency capability" : "No direct match",
        class: isMarketResearch ? "partial" : hasAgencySignal ? "uncertain" : "none",
        confidence: isMarketResearch ? 0.58 : hasAgencySignal ? 0.45 : 0.2,
        classificationSource: isMarketResearch ? "rule" : hasAgencySignal ? "token" : "rule"
      };
    }

    if (bestScore < 0.15) {
      return {
        scopeItem,
        service: hasAgencySignal ? bestService.service : "No direct match",
        class: hasAgencySignal ? "partial" : "none",
        confidence: hasAgencySignal ? 0.5 : 0.2,
        classificationSource: "token"
      };
    }

    const className = classifyMatch(scopeItem, bestService, bestScore);
    const confidence =
      className === "full"
        ? Math.max(0.6, Math.min(0.99, 0.6 + bestScore * 0.35))
        : className === "partial"
          ? Math.max(0.45, Math.min(0.9, 0.45 + bestScore * 0.3))
          : className === "uncertain"
            ? Math.max(0.3, Math.min(0.65, 0.35 + bestScore * 0.25))
          : Math.max(0.2, Math.min(0.7, bestScore * 0.5));

    return {
      scopeItem,
      service: bestService.service,
      class: className,
      confidence,
      classificationSource: "token"
    };
  });
}
