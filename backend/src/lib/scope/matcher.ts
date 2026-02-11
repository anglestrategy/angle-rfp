import type { AgencyService } from "@/lib/scope/taxonomy-loader";
import { normalizeForMatching } from "@/lib/scope/taxonomy-loader";

export interface ScopeMatch {
  scopeItem: string;
  service: string;
  class: "full" | "partial" | "none";
  confidence: number;
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
  /communication/i,
  /content/i,
  /design/i,
  /creative/i,
  /media/i,
  /narrative/i,
  /strategy/i,
  /launch/i,
  /research/i,
  /social/i,
  /digital/i,
  /production/i,
  /messaging/i,
  /identity/i,
  /locali[sz]ation/i,
  /positioning/i,
  /insight/i,
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
  /audit/i,
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

const STRUCTURAL_LINE_PATTERNS = [
  /^(overview|key objectives|deliverables|timeline|important dates|submission requirements|special conditions)$/i,
  /^(scope of work|evaluation criteria|project description|financial potential)$/i,
  /^(market mapping|competitive research|brand book|post launch plan)$/i,
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

function isStructuralLine(line: string): boolean {
  const normalized = normalizeForMatching(line);
  if (!normalized) {
    return true;
  }

  if (STRUCTURAL_LINE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  return /^#+/.test(line.trim());
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
    const fragments = line.split(/[؛;•]/).map((part) => part.trim()).filter(Boolean);

    for (const fragment of fragments) {
      const cleaned = cleanScopeFragment(fragment);
      if (cleaned.length < 8 || isStructuralLine(cleaned)) {
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
  if (containsAny(scopeItem, OUT_OF_SCOPE_HINTS) && score < 0.45) {
    return "none";
  }

  const hasAgencySignal = containsAny(scopeItem, AGENCY_DOMAIN_HINTS);
  if (score < 0.15) {
    return hasAgencySignal ? "partial" : "none";
  }

  const isPartialHint = PARTIAL_HINTS.some((pattern) => pattern.test(scopeItem) || pattern.test(service.service));
  if (isPartialHint || score < 0.45) {
    return "partial";
  }

  return "full";
}

export function matchScopeItems(scopeItems: string[], services: AgencyService[]): ScopeMatch[] {
  return scopeItems.map((scopeItem) => {
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

    if (!bestService) {
      return {
        scopeItem,
        service: hasAgencySignal ? "Broad agency capability" : "No direct match",
        class: hasAgencySignal ? "partial" : "none",
        confidence: hasAgencySignal ? 0.45 : 0.2
      };
    }

    if (bestScore < 0.15) {
      return {
        scopeItem,
        service: hasAgencySignal ? bestService.service : "No direct match",
        class: hasAgencySignal ? "partial" : "none",
        confidence: hasAgencySignal ? 0.45 : 0.2
      };
    }

    const className = classifyMatch(scopeItem, bestService, bestScore);
    const confidence =
      className === "full"
        ? Math.max(0.6, Math.min(0.99, 0.6 + bestScore * 0.35))
        : className === "partial"
          ? Math.max(0.45, Math.min(0.9, 0.45 + bestScore * 0.3))
          : Math.max(0.2, Math.min(0.7, bestScore * 0.5));

    return {
      scopeItem,
      service: bestService.service,
      class: className,
      confidence
    };
  });
}
