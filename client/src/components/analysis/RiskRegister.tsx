import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  CollapsibleSection,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible-section";

interface RiskFlag {
  title?: string;
  name?: string;
  flag?: string;
  severity?: string;
  description?: string;
  detail?: string;
  evidence?: string;
  quote?: string;
  recommendation?: string;
  mitigation?: string;
  category?: string;
  clauseReference?: string;
  financialImpact?: string;
}

interface RiskSummary {
  overallRiskLevel: string;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  totalRisks?: number;
}

interface RiskRegisterProps {
  redFlagList: RiskFlag[];
  riskSummary: RiskSummary | null;
}

function sevOrder(severity: string): number {
  const s = severity?.toUpperCase() || "LOW";
  if (s === "CRITICAL") return 0;
  if (s === "HIGH") return 1;
  if (s === "MEDIUM") return 2;
  return 3;
}

function sevColor(severity: string): string {
  const s = severity?.toUpperCase() || "LOW";
  if (s === "HIGH" || s === "CRITICAL") return "text-red-400";
  if (s === "MEDIUM") return "text-amber-400";
  return "text-white/40";
}

export function RiskRegister({ redFlagList, riskSummary }: RiskRegisterProps) {
  const highCount = (riskSummary?.criticalCount || 0) + (riskSummary?.highCount || 0);
  const medCount = riskSummary?.mediumCount || 0;
  const lowCount = riskSummary?.lowCount || 0;

  const sorted = useMemo(
    () => [...redFlagList].sort((a, b) => sevOrder(a.severity || "LOW") - sevOrder(b.severity || "LOW")),
    [redFlagList],
  );

  return (
    <div className="dash-panel" data-testid="section-red-flags">
      {/* Header */}
      <div className="dash-panel-header">
        <span className="dash-panel-title">Risk Register</span>
        {riskSummary && (
          <span className="dash-panel-badge">
            {riskSummary.overallRiskLevel}
          </span>
        )}
      </div>

      <div className="dash-panel-body">
        {/* Summary counts */}
        {riskSummary && (
          <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-white/[0.06]">
            <div>
              <p className="text-2xl font-bold text-red-400">{highCount}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">High</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{medCount}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Medium</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white/50">{lowCount}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Low</p>
            </div>
          </div>
        )}

        {/* Risk list */}
        {sorted.length > 0 ? (
          <div>
            {sorted.map((flag, i) => {
              const title = flag.title || flag.name || flag.flag || `Risk ${i + 1}`;
              const severity = (flag.severity || "LOW").toUpperCase();
              const description = flag.description || flag.detail || "";
              const rec = flag.recommendation || flag.mitigation || "";
              const clauseRef = flag.clauseReference || "";

              return (
                <CollapsibleSection key={i} value={`risk-${i}`}>
                  <CollapsibleTrigger className="py-3 border-b border-dashed border-white/[0.06]">
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <span className={cn("font-mono text-[10px] font-bold uppercase tracking-wider w-10 shrink-0", sevColor(severity))}>
                        {severity.slice(0, 4)}
                      </span>
                      <span className="text-sm text-white/80 flex-1">{title}</span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pl-[52px] pb-4 space-y-2">
                      {description && (
                        <p className="text-[13px] leading-relaxed text-white/60">{description}</p>
                      )}
                      {clauseRef && (
                        <p className="text-[11px] text-white/40">
                          <span className="font-mono uppercase tracking-wider">Clause:</span> {clauseRef}
                        </p>
                      )}
                      {rec && (
                        <p className="text-[11px] text-white/40">
                          <span className="font-mono uppercase tracking-wider">Recommendation:</span> {rec}
                        </p>
                      )}
                      {flag.financialImpact && (
                        <p className="text-[11px] text-white/40">
                          <span className="font-mono uppercase tracking-wider">Impact:</span> {flag.financialImpact}
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </CollapsibleSection>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-white/40">No risks identified.</p>
        )}
      </div>
    </div>
  );
}
