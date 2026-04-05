import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CollapsibleSection,
  CollapsibleTrigger,
  CollapsibleContent,
  CollapsibleGroup,
  CollapsibleGroupSection,
} from "@/components/ui/collapsible-section";
import { staggerFast, staggerItemLeft } from "@/lib/motion";

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

type GroupMode = "category" | "severity";

function sevBadge(severity: string): { bg: string; text: string; glow: string } {
  const s = severity?.toUpperCase() || "LOW";
  if (s === "HIGH" || s === "CRITICAL")
    return { bg: "bg-red-500", text: "text-white", glow: "shadow-[0_0_8px_rgba(239,68,68,0.3)]" };
  if (s === "MEDIUM")
    return { bg: "bg-amber-500", text: "text-white", glow: "shadow-[0_0_8px_rgba(245,158,11,0.2)]" };
  return { bg: "bg-foreground/10", text: "text-muted-foreground", glow: "" };
}

function sevOrder(severity: string): number {
  const s = severity?.toUpperCase() || "LOW";
  if (s === "CRITICAL") return 0;
  if (s === "HIGH") return 1;
  if (s === "MEDIUM") return 2;
  return 3;
}

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function RiskRegister({ redFlagList, riskSummary }: RiskRegisterProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>("category");

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

  const hasCategories = sorted.some((f) => !!f.category);

  const categoryGroups = useMemo(() => {
    const groups: Record<string, RiskFlag[]> = {};
    sorted.forEach((flag) => {
      const cat = flag.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(flag);
    });
    return Object.entries(groups).sort(([, a], [, b]) => {
      const aMin = Math.min(...a.map((f) => sevOrder(f.severity || "LOW")));
      const bMin = Math.min(...b.map((f) => sevOrder(f.severity || "LOW")));
      return aMin - bMin;
    });
  }, [sorted]);

  const severityGroups = useMemo(() => {
    const groups: Record<string, RiskFlag[]> = {};
    sorted.forEach((flag) => {
      const sev = (flag.severity || "LOW").toUpperCase();
      if (!groups[sev]) groups[sev] = [];
      groups[sev].push(flag);
    });
    return SEVERITY_ORDER.filter((s) => groups[s] && groups[s].length > 0).map(
      (s) => [s, groups[s]] as [string, RiskFlag[]]
    );
  }, [sorted]);

  const activeGroups = groupMode === "category" ? categoryGroups : severityGroups;

  return (
    <div className="border border-white/[0.06] bg-[#050505]">
      <div className="pt-4 pb-4 px-5" data-testid="section-red-flags">
        <div className="flex items-center justify-between mb-3">
          <p className="panel-heading">Risk Register</p>
          {riskSummary && (() => {
            const level = riskSummary.overallRiskLevel?.toLowerCase() || "";
            const isHigh = level.includes("high") || level.includes("critical");
            const isMed = level.includes("med");
            return (
              <span className={cn(
                "px-3 py-1 text-[10px] font-bold uppercase tracking-wider border",
                isHigh
                  ? "border-red-500/30 bg-red-500/10 text-red-500"
                  : isMed
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              )}>
                {riskSummary.overallRiskLevel}
              </span>
            );
          })()}
        </div>

        {/* Stats row */}
        {riskSummary && (
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5 border border-red-500/20 bg-red-500/10 px-2.5 py-1">
              <span className="h-1.5 w-1.5 bg-red-500" />
              <span className="font-mono text-xs font-bold text-red-500">{highCount}</span>
              <span className="font-mono text-[10px] text-red-500/60 uppercase">High</span>
            </div>
            <div className="flex items-center gap-1.5 border border-amber-500/20 bg-amber-500/10 px-2.5 py-1">
              <span className="h-1.5 w-1.5 bg-amber-500" />
              <span className="font-mono text-xs font-bold text-amber-500">{medCount}</span>
              <span className="font-mono text-[10px] text-amber-500/60 uppercase">Med</span>
            </div>
            <div className="flex items-center gap-1.5 border border-white/[0.08] bg-white/[0.04] px-2.5 py-1">
              <span className="h-1.5 w-1.5 bg-white/20" />
              <span className="font-mono text-xs font-bold text-white/50">{lowCount}</span>
              <span className="font-mono text-[10px] text-white/30 uppercase">Low</span>
            </div>
          </div>
        )}

        {/* Group toggle */}
        {sorted.length > 0 && hasCategories && (
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Group:</span>
            {(["category", "severity"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setGroupMode(mode)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all border",
                  groupMode === mode
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/15"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        )}

        {/* Risk groups */}
        {sorted.length > 0 ? (
          <div className="space-y-0">
            {activeGroups.map(([groupKey, items]) => {
              const gBadge = groupMode === "severity" ? sevBadge(groupKey) : null;
              const groupHighCount = items.filter((f) => {
                const s = (f.severity || "LOW").toUpperCase();
                return s === "CRITICAL" || s === "HIGH";
              }).length;

              return (
                <CollapsibleSection key={groupKey} value={groupKey}>
                  <CollapsibleTrigger className="py-2 px-0 hover:no-underline">
                    <div className="flex items-center gap-2 flex-1 mr-2 min-w-0">
                      {gBadge ? (
                        <span className={cn(
                          "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0",
                          gBadge.bg, gBadge.text, gBadge.glow
                        )}>
                          {groupKey}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-muted-foreground uppercase shrink-0">
                          {groupKey}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {items.length}
                      </span>
                      {groupMode === "category" && groupHighCount > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-bold border border-red-500/20 bg-red-500/10 text-red-500 shrink-0 ml-auto">
                          {groupHighCount} HIGH
                        </span>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pb-1">
                    {/* Individual risks — each one expandable */}
                    <CollapsibleGroup type="single" collapsible>
                    <motion.div
                      data-lenis-prevent
                      className="max-h-[400px] overflow-y-auto overscroll-contain"
                      variants={staggerFast}
                      initial="hidden"
                      animate="visible"
                    >
                      {items.map((flag, i) => {
                        const title = flag.title || flag.name || flag.flag || `Risk ${i + 1}`;
                        const severity = flag.severity || "LOW";
                        const description = flag.description || flag.detail || "";
                        const rec = flag.recommendation || flag.mitigation || "";
                        const category = flag.category || "";
                        const evidence = flag.evidence || flag.quote || "";
                        const clauseReference = flag.clauseReference || "";
                        const badge = sevBadge(severity);

                        return (
                          <motion.div key={`${groupKey}-risk-${i}`} variants={staggerItemLeft}>
                          <CollapsibleGroupSection value={`${groupKey}-risk-${i}`}>
                            <CollapsibleTrigger className="py-1.5 px-0 hover:no-underline row-hover rounded-md">
                              <div className="flex items-center gap-2 flex-1 mr-2 min-w-0">
                        <span className={cn(
                          "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 transition-transform duration-150 hover:scale-105",
                          badge.bg, badge.text, badge.glow
                        )}>
                                  {severity.toUpperCase().slice(0, 4)}
                                </span>
                                {groupMode === "severity" && category && (
                                  <span className="text-[10px] font-mono text-muted-foreground/60 uppercase shrink-0">
                                    {category}
                                  </span>
                                )}
                                <span className="text-sm font-medium text-left truncate">
                                  {title}
                                </span>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pb-2 pl-10">
                              {description && (
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {description}
                                </p>
                              )}
                              {rec && (
                                <p className="text-xs text-muted-foreground/70 mt-1.5">
                                  <span className="font-bold text-muted-foreground">Rec:</span> {rec}
                                </p>
                              )}
                              {(evidence || clauseReference) && (
                                <div className="mt-2 space-y-1.5">
                                  {clauseReference && (
                                    <p className="text-[11px] text-muted-foreground/70">
                                      <span className="font-bold text-muted-foreground">Clause:</span> {clauseReference}
                                    </p>
                                  )}
                                  {evidence && (
                                    <div className="rounded-lg border border-foreground/8 bg-foreground/[0.02] px-3 py-2">
                                      <p className="text-[11px] text-muted-foreground/70 uppercase tracking-[0.08em] mb-1">
                                        Evidence
                                      </p>
                                      <p className="text-xs leading-relaxed text-muted-foreground">
                                        {evidence}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {flag.financialImpact && (
                                <p className="text-xs text-muted-foreground/70 mt-1">
                                  <span className="font-bold text-muted-foreground">Impact:</span> {flag.financialImpact}
                                </p>
                              )}
                            </CollapsibleContent>
                          </CollapsibleGroupSection>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                    </CollapsibleGroup>
                  </CollapsibleContent>
                </CollapsibleSection>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No risks identified</p>
        )}
      </div>
    </div>
  );
}
