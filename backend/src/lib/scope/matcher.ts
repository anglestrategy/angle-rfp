import type { AgencyService } from "@/lib/scope/taxonomy-loader";
import { normalizeForMatching } from "@/lib/scope/taxonomy-loader";

export interface ScopeMatch {
  scopeItem: string;
  service: string;
  class: "full" | "partial" | "none";
  confidence: number;
}

const PARTIAL_HINTS = [/supervision/i, /manage/i, /management/i, /coordination/i, /إشراف/, /إدارة/];

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeForMatching(text)
      .split(" ")
      .map((part) => part.trim())
      .filter((part) => part.length >= 3)
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

  return overlap / Math.max(a.size, b.size);
}

export function splitScopeItems(scopeOfWork: string): string[] {
  const lines = scopeOfWork
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const chunks = lines.flatMap((line) => line.split(/[؛;•\-]/).map((part) => part.trim()));
  return chunks.filter((chunk) => chunk.length > 4);
}

function classifyMatch(scopeItem: string, service: AgencyService, score: number): ScopeMatch["class"] {
  if (score < 0.22) {
    return "none";
  }

  const isPartialHint = PARTIAL_HINTS.some((pattern) => pattern.test(scopeItem) || pattern.test(service.service));
  if (isPartialHint || score < 0.42) {
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
      const serviceTokens = tokenize(service.normalized);
      const score = tokenOverlapScore(scopeTokens, serviceTokens);
      if (score > bestScore) {
        bestScore = score;
        bestService = service;
      }
    }

    if (!bestService || bestScore < 0.22) {
      return {
        scopeItem,
        service: "No direct match",
        class: "none",
        confidence: 0.2
      };
    }

    const className = classifyMatch(scopeItem, bestService, bestScore);

    return {
      scopeItem,
      service: bestService.service,
      class: className,
      confidence: Math.max(0.2, Math.min(0.99, bestScore + (className === "full" ? 0.25 : 0.1)))
    };
  });
}
