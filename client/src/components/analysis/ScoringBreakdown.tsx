import { formatEvidence } from "@/lib/format-evidence";
import { cn } from "@/lib/utils";
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

export function ScoringBreakdown({ factors, financial }: ScoringBreakdownProps) {
  const hasRedFlag = (financial.redFlagPenalty ?? 0) > 0;
  const hasIncomplete = (financial.incompletePenalty ?? 0) > 0;
  const hasPenalties = hasRedFlag || hasIncomplete;
  const totalPenalty =
    (financial.redFlagPenalty || 0) + (financial.incompletePenalty || 0);

  const penaltyBadge = hasPenalties ? `-${totalPenalty} penalty` : null;

  return (
    <div className="dash-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">Scoring Breakdown</span>
        {penaltyBadge && (
          <span className="dash-panel-badge">{penaltyBadge}</span>
        )}
      </div>

      <div className="dash-panel-body" data-testid="section-financial">
        {Array.isArray(factors) && factors.length > 0 ? (
          <>
            {/* Header row */}
            <div className="dash-data-header" style={{ gridTemplateColumns: "2fr 80px 60px" }}>
              <span>Factor</span>
              <span className="text-right">Score</span>
              <span className="text-right">Max</span>
            </div>

            {/* Factor rows */}
            {factors.map((f, i) => {
              const name = f.name || f.factor || `Factor ${i + 1}`;
              const factorScore = f.actualScore ?? f.score ?? f.value ?? 0;
              const maxWeight = f.maxWeight ?? f.max ?? f.maxScore ?? 10;
              const pct = maxWeight > 0 ? (factorScore / maxWeight) * 100 : 0;

              const rowContent = (
                <div
                  key={i}
                  className="dash-data-row"
                  style={{ gridTemplateColumns: "2fr 80px 60px" }}
                >
                  <div>
                    <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>{name}</span>
                    <div className="mt-2 w-full">
                      <div className="h-[3px] w-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div
                          className={cn("h-full", getBarColor(pct))}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-mono tabular-nums font-bold text-right" style={{ color: "rgba(255,255,255,0.9)" }}>
                    {factorScore}
                  </span>
                  <span className="text-sm font-mono tabular-nums text-right" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {maxWeight}
                  </span>
                </div>
              );

              if (f.evidence) {
                return (
                  <TooltipProvider key={i}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-default">{rowContent}</div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                        {formatEvidence(f.evidence, name)}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }
              return <div key={i}>{rowContent}</div>;
            })}
          </>
        ) : (
          <p className="text-sm italic" style={{ color: "rgba(255,255,255,0.4)" }}>No scoring factors available</p>
        )}

        {/* Penalties section */}
        {hasPenalties && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center gap-4 text-xs">
              {hasRedFlag && hasIncomplete ? (
                <>
                  <span className="font-mono font-bold text-red-400">Red Flags: -{financial.redFlagPenalty}</span>
                  <span className="font-mono font-bold text-red-400">Incomplete: -{financial.incompletePenalty}</span>
                  <span className="font-mono font-bold text-red-400 ml-auto">Total: -{totalPenalty}</span>
                </>
              ) : (
                <span className="font-mono font-bold text-red-400">
                  {hasRedFlag ? "Red Flag" : "Incomplete Data"} Penalty: -{totalPenalty}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Quality gate */}
        {financial.qualityGateTriggered && (
          <p className="text-xs text-amber-400 font-semibold mt-3">
            Quality gate triggered: {financial.qualityGateReason}
          </p>
        )}
      </div>
    </div>
  );
}
