import { makeError } from "@/lib/api/errors";

interface AnalysisUsage {
  tokens: number;
  ocrPages: number;
  queries: number;
}

interface DailyQuotaEntry {
  analyses: Set<string>;
}

const usageByAnalysis = new Map<string, AnalysisUsage>();
const dailyQuotaByUser = new Map<string, DailyQuotaEntry>();

const TOKEN_CAP = Number(process.env.BUDGET_TOKENS_PER_ANALYSIS ?? 220_000);
const OCR_PAGE_CAP = Number(process.env.BUDGET_OCR_PAGES_PER_ANALYSIS ?? 120);
const QUERY_CAP = Number(process.env.BUDGET_QUERIES_PER_ANALYSIS ?? 24);
const DAILY_ANALYSIS_CAP = Number(process.env.BUDGET_DAILY_ANALYSES_PER_USER ?? 20);

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function getUsage(analysisId: string): AnalysisUsage {
  const existing = usageByAnalysis.get(analysisId);
  if (existing) {
    return existing;
  }
  const next: AnalysisUsage = {
    tokens: 0,
    ocrPages: 0,
    queries: 0
  };
  usageByAnalysis.set(analysisId, next);
  return next;
}

function assertWithinCaps(analysisId: string, usage: AnalysisUsage): void {
  if (usage.tokens > TOKEN_CAP) {
    throw makeError(429, "rate_limited", "Analysis token budget exceeded", "cost-budget", {
      retryable: false,
      details: { analysisId, tokens: usage.tokens, tokenCap: TOKEN_CAP }
    });
  }

  if (usage.ocrPages > OCR_PAGE_CAP) {
    throw makeError(429, "rate_limited", "Analysis OCR page budget exceeded", "cost-budget", {
      retryable: false,
      details: { analysisId, ocrPages: usage.ocrPages, ocrPageCap: OCR_PAGE_CAP }
    });
  }

  if (usage.queries > QUERY_CAP) {
    throw makeError(429, "rate_limited", "Analysis query budget exceeded", "cost-budget", {
      retryable: false,
      details: { analysisId, queries: usage.queries, queryCap: QUERY_CAP }
    });
  }
}

export interface RegisterUsageInput {
  analysisId: string;
  tokens?: number;
  ocrPages?: number;
  queries?: number;
}

export function reserveUserDailyAnalysis(userKey: string, analysisId: string, date = new Date()): void {
  const key = `${userKey}:${dayKey(date)}`;
  const entry = dailyQuotaByUser.get(key) ?? { analyses: new Set<string>() };

  if (!entry.analyses.has(analysisId) && entry.analyses.size >= DAILY_ANALYSIS_CAP) {
    throw makeError(429, "rate_limited", "Daily analysis quota exceeded", "cost-budget", {
      retryable: false,
      details: {
        userKey,
        dailyLimit: DAILY_ANALYSIS_CAP
      }
    });
  }

  entry.analyses.add(analysisId);
  dailyQuotaByUser.set(key, entry);
}

export function registerAnalysisUsage(input: RegisterUsageInput): AnalysisUsage {
  if (!input.analysisId) {
    throw makeError(400, "validation_error", "analysisId is required for budget tracking", "cost-budget", {
      retryable: false
    });
  }

  const usage = getUsage(input.analysisId);
  usage.tokens += Math.max(0, Math.floor(input.tokens ?? 0));
  usage.ocrPages += Math.max(0, Math.floor(input.ocrPages ?? 0));
  usage.queries += Math.max(0, Math.floor(input.queries ?? 0));

  assertWithinCaps(input.analysisId, usage);
  return { ...usage };
}

export function getBudgetSnapshot(analysisId: string): AnalysisUsage {
  return { ...getUsage(analysisId) };
}

export function getMonthlyBurnRateForecast(currentDate = new Date()): {
  projectedTokenUsage: number;
  projectedOcrPages: number;
  projectedQueries: number;
} {
  const usage = [...usageByAnalysis.values()].reduce(
    (acc, item) => {
      acc.tokens += item.tokens;
      acc.ocrPages += item.ocrPages;
      acc.queries += item.queries;
      return acc;
    },
    { tokens: 0, ocrPages: 0, queries: 0 }
  );

  const dayOfMonth = currentDate.getUTCDate();
  const daysInMonth = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0)).getUTCDate();
  const multiplier = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 1;

  return {
    projectedTokenUsage: Math.ceil(usage.tokens * multiplier),
    projectedOcrPages: Math.ceil(usage.ocrPages * multiplier),
    projectedQueries: Math.ceil(usage.queries * multiplier)
  };
}

export function resetBudgetTracking(): void {
  usageByAnalysis.clear();
  dailyQuotaByUser.clear();
}
