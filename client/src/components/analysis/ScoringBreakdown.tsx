import { cn } from "@/lib/utils";

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

interface ScoringBreakdownProps {
  factors: ScoringFactor[];
  financial: {
    redFlagPenalty?: number;
    incompletePenalty?: number;
    qualityGateTriggered?: boolean;
    qualityGateReason?: string;
    [key: string]: any;
  };
}

function barColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-white/60";
  if (pct >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export function ScoringBreakdown({ factors, financial }: ScoringBreakdownProps) {
  const hasRedFlag = (financial.redFlagPenalty ?? 0) > 0;
  const hasIncomplete = (financial.incompletePenalty ?? 0) > 0;
  const hasPenalties = hasRedFlag || hasIncomplete;
  const totalPenalty = (financial.redFlagPenalty || 0) + (financial.incompletePenalty || 0);

  return (
    <div className="dash-panel" data-testid="section-financial">
      {/* Header */}
      <div className="dash-panel-header">
        <span className="dash-panel-title">Scoring Breakdown</span>
        {hasPenalties && (
          <span className="dash-panel-badge text-red-400">-{totalPenalty} penalty</span>
        )}
      </div>

      <div className="dash-panel-body">
        {Array.isArray(factors) && factors.length > 0 ? (
          <div>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_60px_60px] gap-2 pb-2 mb-1 border-b border-white/[0.08]">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">Factor</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/30 text-right">Score</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/30 text-right">Max</span>
            </div>

            {/* Factor rows */}
            {factors.map((f, i) => {
              const name = f.name || f.factor || `Factor ${i + 1}`;
              const factorScore = f.actualScore ?? f.score ?? f.value ?? 0;
              const maxWeight = f.maxWeight ?? f.max ?? f.maxScore ?? 10;
              const pct = maxWeight > 0 ? (factorScore / maxWeight) * 100 : 0;

              return (
                <div key={i} className="grid grid-cols-[1fr_60px_60px] gap-2 items-center py-2.5 border-b border-dashed border-white/[0.06]">
                  <div>
                    <span className="text-sm text-white/80">{name}</span>
                    <div className="mt-1.5 h-[3px] bg-white/[0.04] overflow-hidden">
                      <div
                        className={cn("h-full transition-all", barColor(pct))}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-right text-sm font-bold tabular-nums">{factorScore}</span>
                  <span className="text-right text-sm tabular-nums text-white/30">{maxWeight}</span>
                </div>
              );
            })}

            {/* Penalties */}
            {hasPenalties && (
              <div className="pt-3 mt-1 flex items-center justify-between text-sm">
                <span className="text-white/40">Penalties applied</span>
                <span className="font-bold text-red-400 tabular-nums">-{totalPenalty}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-white/40">No scoring factors available.</p>
        )}

        {financial.qualityGateTriggered && (
          <p className="text-[11px] text-amber-400 mt-3 border-t border-white/[0.06] pt-3">
            {financial.qualityGateReason}
          </p>
        )}
      </div>
    </div>
  );
}
