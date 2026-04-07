import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  CollapsibleSection,
  CollapsibleTrigger,
  CollapsibleContent,
  CollapsibleGroup,
  CollapsibleGroupSection,
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

function sevTextColor(severity: string): string {
  const s = severity?.toUpperCase() || "LOW";
  if (s === "HIGH" || s === "CRITICAL") return "text-red-400";
  if (s === "MEDIUM") return "text-amber-400";
  return "text-emerald-400";
}

function sevOrder(severity: string): number {
  const s = severity?.toUpperCase() || "LOW";
  if (s === "CRITICAL") return 0;
  if (s === "HIGH") return 1;
  if (s === "MEDIUM") return 2;
  return 3;
}

export function RiskRegister({ redFlagList, riskSummary }: RiskRegisterProps) {
  const highCount = (riskSummary?.criticalCount || 0) + (riskSummary?.highCount || 0);
  const medCount = riskSummary?.mediumCount || 0;
  const lowCount = riskSummary?.lowCount || 0;

  const sorted = useMemo(
    () =>
      [...redFlagList].sort(
        (a, b) => sevOrder(a.severity || "LOW") - sevOrder(b.severity || "LOW")
      ),
    [redFlagList]
  );

  const levelBadge = riskSummary?.overallRiskLevel || "Low";

  return (
    <div className="dash-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">Risk Register</span>
        <span className="dash-panel-badge">{levelBadge}</span>
      </div>

      <div className="dash-panel-body" data-testid="section-red-flags">
        {/* 3 metric groups side by side */}
        {riskSummary && (
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="dash-metric-group">
              <p className="dash-metric-label">High</p>
              <p className="dash-metric-value text-red-400">{highCount}</p>
              <p className="dash-metric-sub">Critical + High</p>
            </div>
            <div className="dash-metric-group">
              <p className="dash-metric-label">Medium</p>
              <p className="dash-metric-value text-amber-400">{medCount}</p>
              <p className="dash-metric-sub">Medium severity</p>
            </div>
            <div className="dash-metric-group">
              <p className="dash-metric-label">Low</p>
              <p className="dash-metric-value text-emerald-400">{lowCount}</p>
              <p className="dash-metric-sub">Low severity</p>
            </div>
          </div>
        )}

        {/* Sorted risk list with dashed dividers */}
        {sorted.length > 0 ? (
          <CollapsibleGroup type="single" collapsible>
            <div data-lenis-prevent className="max-h-[500px] overflow-y-auto overscroll-contain">
              {sorted.map((flag, i) => {
                const title = flag.title || flag.name || flag.flag || `Risk ${i + 1}`;
                const severity = flag.severity || "LOW";
                const description = flag.description || flag.detail || "";
                const rec = flag.recommendation || flag.mitigation || "";
                const category = flag.category || "";
                const evidence = flag.evidence || flag.quote || "";
                const clauseReference = flag.clauseReference || "";

                return (
                  <CollapsibleGroupSection key={`risk-${i}`} value={`risk-${i}`}>
                    <CollapsibleTrigger className="w-full text-left">
                      <div
                        className="py-3.5"
                        style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)" }}
                      >
                        <div className="flex items-center gap-3">
                          <span className={cn("text-xs font-bold uppercase tracking-wider shrink-0", sevTextColor(severity))}>
                            {severity.toUpperCase()}
                          </span>
                          {category && (
                            <span className="font-mono text-[10px] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
                              {category}
                            </span>
                          )}
                          <span className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.9)" }}>
                            {title}
                          </span>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pb-3 pl-6">
                      {description && (
                        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                          {description}
                        </p>
                      )}
                      {rec && (
                        <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                          <span className="font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>Rec:</span> {rec}
                        </p>
                      )}
                      {(evidence || clauseReference) && (
                        <div className="mt-2 space-y-1.5">
                          {clauseReference && (
                            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                              <span className="font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>Clause:</span> {clauseReference}
                            </p>
                          )}
                          {evidence && (
                            <div className="px-3 py-2" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                              <p className="text-[11px] uppercase tracking-[0.08em] mb-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                                Evidence
                              </p>
                              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                                {evidence}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      {flag.financialImpact && (
                        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                          <span className="font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>Impact:</span> {flag.financialImpact}
                        </p>
                      )}
                    </CollapsibleContent>
                  </CollapsibleGroupSection>
                );
              })}
            </div>
          </CollapsibleGroup>
        ) : (
          <p className="text-sm italic" style={{ color: "rgba(255,255,255,0.4)" }}>No risks identified</p>
        )}
      </div>
    </div>
  );
}
