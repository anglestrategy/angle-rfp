import { motion } from "framer-motion";
import { formatEvidence } from "@/lib/format-evidence";
import { cn } from "@/lib/utils";
import { ShimmerBar } from "@/components/ui/shimmer-bar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ScoringFactor {
  name?: string;
  factor?: string;
  actualScore?: number;
  score?: number;
  value?: number;
  maxWeight?: number;
  max?: number;
  maxScore?: number;
  evidence?: string;
}

interface RedFlagBreakdownItem {
  title?: string;
  flag?: string;
  penalty?: number;
  category?: string;
}

interface ScoringBreakdownProps {
  factors: ScoringFactor[];
  financial: {
    redFlagPenalty?: number;
    incompletePenalty?: number;
    qualityGateTriggered?: boolean;
    qualityGateReason?: string;
    redFlagBreakdown?: RedFlagBreakdownItem[];
    budgetAdequacy?: {
      status?: string;
      summary?: string;
    };
    pitchCostEstimate?: {
      effortLevel?: string;
      estimatedHoursRange?: string;
      summary?: string;
    };
    agencyRiskFlags?: Array<{
      title?: string;
      severity?: string;
      category?: string;
      summary?: string;
    }>;
    submissionComplexity?: {
      level?: string;
      requirementsCount?: number;
      summary?: string;
    };
    credentialsMatch?: {
      status?: string;
      summary?: string;
    };
    clientQualityNotes?: {
      signal?: string;
      summary?: string;
      notes?: string[];
    };
    saudiComplianceReadiness?: {
      status?: string;
      summary?: string;
      signals?: string[];
    };
  };
}

function getBarColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-primary";
  if (pct >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function getBarGlow(pct: number): string {
  if (pct >= 80) return "shadow-[0_0_8px_rgba(34,197,94,0.3)]";
  if (pct >= 60) return "shadow-[0_0_8px_rgba(232,121,59,0.2)]";
  if (pct >= 40) return "shadow-[0_0_8px_rgba(245,158,11,0.2)]";
  return "shadow-[0_0_8px_rgba(239,68,68,0.2)]";
}

export function ScoringBreakdown({ factors, financial }: ScoringBreakdownProps) {
  const hasRedFlag = (financial.redFlagPenalty ?? 0) > 0;
  const hasIncomplete = (financial.incompletePenalty ?? 0) > 0;
  const hasPenalties = hasRedFlag || hasIncomplete;
  const totalPenalty =
    (financial.redFlagPenalty || 0) + (financial.incompletePenalty || 0);
  const qualificationCards = [
    {
      label: "Budget adequacy",
      value:
        financial.budgetAdequacy?.status === "likely_viable"
          ? "Likely viable"
          : financial.budgetAdequacy?.status === "under_scoped"
            ? "Under-scoped"
            : "Unclear",
      detail: financial.budgetAdequacy?.summary,
    },
    {
      label: "Pursuit cost",
      value:
        financial.pitchCostEstimate?.estimatedHoursRange ||
        financial.pitchCostEstimate?.effortLevel ||
        "Not estimated",
      detail: financial.pitchCostEstimate?.summary,
    },
    {
      label: "Submission complexity",
      value:
        financial.submissionComplexity?.level
          ? `${financial.submissionComplexity.level}${typeof financial.submissionComplexity.requirementsCount === "number" ? ` · ${financial.submissionComplexity.requirementsCount} reqs` : ""}`
          : "Not assessed",
      detail: financial.submissionComplexity?.summary,
    },
    {
      label: "Credentials match",
      value:
        financial.credentialsMatch?.status === "strong"
          ? "Strong"
          : financial.credentialsMatch?.status === "partial"
            ? "Partial"
            : "Weak",
      detail: financial.credentialsMatch?.summary,
    },
  ];
  const clientNotes = Array.isArray(financial.clientQualityNotes?.notes)
    ? financial.clientQualityNotes?.notes ?? []
    : [];
  const riskFlags = Array.isArray(financial.agencyRiskFlags)
    ? financial.agencyRiskFlags.slice(0, 4)
    : [];
  const saudiSignals = Array.isArray(financial.saudiComplianceReadiness?.signals)
    ? financial.saudiComplianceReadiness?.signals ?? []
    : [];

  return (
    <div className="border border-white/[0.06] bg-[#050505]">
      <div className="pt-4 pb-4 px-5" data-testid="section-financial">
        <div className="flex items-center justify-between mb-3">
          <p className="panel-heading">Scoring Breakdown</p>
        </div>

        {Array.isArray(factors) && factors.length > 0 ? (
          <div className="space-y-1">
            {factors.map((f, i) => {
              const name = f.name || f.factor || `Factor ${i + 1}`;
              const factorScore = f.actualScore ?? f.score ?? f.value ?? 0;
              const maxWeight = f.maxWeight ?? f.max ?? f.maxScore ?? 10;
              const pct = maxWeight > 0 ? (factorScore / maxWeight) * 100 : 0;

              const factorContent = (
                <div className="group row-hover rounded-md px-3 py-1.5 -mx-3">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold">{name}</span>
                    <span className="text-sm font-mono tabular-nums font-bold">
                      {factorScore}
                      <span className="text-muted-foreground/60">/{maxWeight}</span>
                    </span>
                  </div>
                  <ShimmerBar
                    value={Math.min(pct, 100)}
                    delay={i * 0.04}
                    color={cn(getBarColor(pct))}
                    height="h-1.5"
                  />
                </div>
              );

              if (f.evidence) {
                return (
                  <TooltipProvider key={i}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-default">{factorContent}</div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                        {formatEvidence(f.evidence, name)}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }
              return <div key={i}>{factorContent}</div>;
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No scoring factors available</p>
        )}

        {hasPenalties && (
          <div className="border-t border-foreground/8 mt-3 pt-3">
            <div className="flex items-center gap-4 text-xs">
              {hasRedFlag && hasIncomplete ? (
                <>
                  <span className="font-mono font-bold text-red-500/80">Red Flags: -{financial.redFlagPenalty}</span>
                  <span className="font-mono font-bold text-red-500/80">Incomplete: -{financial.incompletePenalty}</span>
                  <span className="font-mono font-bold text-red-500 ml-auto">Total: -{totalPenalty}</span>
                </>
              ) : (
                <span className="font-mono font-bold text-red-500/80">
                  {hasRedFlag ? "Red Flag" : "Incomplete Data"} Penalty: -{totalPenalty}
                </span>
              )}
            </div>
          </div>
        )}

        {financial.qualityGateTriggered && (
          <p className="text-xs text-amber-500 font-semibold mt-2">
            Quality gate triggered: {financial.qualityGateReason}
          </p>
        )}

        <div className="border-t border-foreground/8 mt-4 pt-4">
          <p className="panel-heading mb-3">Qualification Lens</p>
          <div className="grid gap-2 md:grid-cols-2">
            {qualificationCards.map((card) => (
              <div key={card.label} className="border border-white/[0.06] bg-black/40 px-3 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
                  {card.label}
                </p>
                <p className="mt-1 text-sm font-semibold">{card.value}</p>
                {card.detail && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {card.detail}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
