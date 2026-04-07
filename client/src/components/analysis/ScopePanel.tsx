import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { humanize } from "@/lib/format-evidence";
import {
  CollapsibleSection,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible-section";
import { staggerFast, staggerItemLeft } from "@/lib/motion";

interface ScopeMatch {
  scopeItem?: string;
  matchType?: string;
  matchedService?: string;
  confidence?: number;
  explanation?: string;
  [key: string]: any;
}

interface ScopeCategory {
  name?: string;
  category?: string;
  fullMatches?: number;
  partialMatches?: number;
  gaps?: number;
  [key: string]: any;
}

interface ScopePanelProps {
  hasScope: boolean;
  fullMatches: number;
  partialMatches: number;
  gaps: number;
  agencyServicePct: number;
  matches?: ScopeMatch[];
  scopeCategories?: ScopeCategory[];
  outputCounts?: Record<string, any>;
}

const matchTypeConfig: Record<string, { label: string; badge: string; symbol: string }> = {
  full: { label: "Full Match", badge: "bg-emerald-500 text-white", symbol: "✓" },
  partial: { label: "Partial", badge: "bg-amber-500 text-white", symbol: "~" },
  gap: { label: "Gap", badge: "bg-red-500 text-white", symbol: "✕" },
};

function formatConfidence(value: number): string {
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(Math.max(0, Math.min(100, normalized)))}%`;
}

export function ScopePanel({
  hasScope,
  fullMatches,
  partialMatches,
  gaps,
  agencyServicePct,
  matches,
  scopeCategories,
  outputCounts,
}: ScopePanelProps) {
  if (!hasScope) {
    return (
      <div className="dash-panel">
        <div className="dash-panel-body" data-testid="section-scope">
          <p className="section-heading">SCOPE ANALYSIS</p>
          <p className="text-sm text-muted-foreground italic">Scope analysis data not available</p>
        </div>
      </div>
    );
  }

  const total = fullMatches + partialMatches + gaps;
  const fullPct = total > 0 ? (fullMatches / total) * 100 : 0;
  const partialPct = total > 0 ? (partialMatches / total) * 100 : 0;
  const gapPct = total > 0 ? (gaps / total) * 100 : 0;

  const outputKeys = outputCounts ? Object.keys(outputCounts) : [];

  // Determine if we have categories to use as primary grouping
  const hasCategories = scopeCategories && scopeCategories.length > 0;

  return (
    <div className="dash-panel">
      <div className="dash-panel-body" data-testid="section-scope">
        <div className="flex items-center justify-between mb-3">
          <p className="panel-heading">Scope Analysis</p>
          <span className="font-mono text-lg font-bold text-primary">{agencyServicePct}%</span>
        </div>

        {/* Summary bar chart — animated with sharp ends */}
        {total > 0 ? (
          <div className="h-3 overflow-hidden flex bg-foreground/[0.04]">
            <motion.div
              className="bg-emerald-500"
              style={{ boxShadow: "0 0 8px rgba(34,197,94,0.3)" }}
              initial={{ width: 0 }}
              whileInView={{ width: `${fullPct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            />
            <motion.div
              className="bg-amber-500"
              initial={{ width: 0 }}
              whileInView={{ width: `${partialPct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
            />
            <motion.div
              className="bg-red-500"
              initial={{ width: 0 }}
              whileInView={{ width: `${gapPct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </div>
        ) : (
          <div className="h-3 bg-foreground/[0.04]" />
        )}

        {/* Legend — sharp badges */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-emerald-500/20 bg-emerald-500/10">
            <span className="h-1.5 w-1.5 bg-emerald-500" />
            <span className="text-xs font-bold text-emerald-500">Full: {fullMatches}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-amber-500/20 bg-amber-500/10">
            <span className="h-1.5 w-1.5 bg-amber-500" />
            <span className="text-xs font-bold text-amber-500">Partial: {partialMatches}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-red-500/20 bg-red-500/10">
            <span className="h-1.5 w-1.5 bg-red-500" />
            <span className="text-xs font-bold text-red-500">Gap: {gaps}</span>
          </div>
        </div>

        {/* Category accordion (primary view when categories available) */}
        {hasCategories && (
          <div className="mt-5">
            <div className="space-y-0">
              {scopeCategories!.map((cat, idx) => {
                const catName = cat.name || cat.category || `Category ${idx + 1}`;
                const catFull = cat.fullMatches || 0;
                const catPartial = cat.partialMatches || 0;
                const catGap = cat.gaps || 0;
                const catTotal = catFull + catPartial + catGap;
                const catFullPct = catTotal > 0 ? (catFull / catTotal) * 100 : 0;
                const catPartialPct = catTotal > 0 ? (catPartial / catTotal) * 100 : 0;

                return (
                  <CollapsibleSection key={idx} value={`cat-${idx}`}>
                    <CollapsibleTrigger className="py-3 hover:no-underline">
                      <div className="flex items-center gap-3 flex-1 mr-2">
                        <span className="text-sm font-bold flex-1 text-left">{catName}</span>
                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          {catTotal} items
                        </span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {/* Category mini bar */}
                      <div className="mb-3">
                        <div className="h-2 rounded-full overflow-hidden flex bg-foreground/[0.04]">
                          <div className="bg-emerald-500 transition-all" style={{ width: `${catFullPct}%` }} />
                          <div className="bg-amber-500 transition-all" style={{ width: `${catPartialPct}%` }} />
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-muted-foreground">
                          <span>F:{catFull}</span>
                          <span>P:{catPartial}</span>
                          <span>G:{catGap}</span>
                        </div>
                      </div>

                      {/* Match items that belong to this category (if matches available) */}
                      {matches && matches.length > 0 && (() => {
                        const catMatches = matches.filter((m) => {
                          const ms = m.matchedService;
                          const mCat = m.category || (typeof ms === "object" && ms !== null ? (ms as any).category : undefined);
                          if (mCat) return mCat === catName || mCat === cat.category;
                          return false;
                        });

                        if (catMatches.length > 0) {
                          return (
                            <motion.div className="space-y-0" variants={staggerFast} initial="hidden" animate="visible">
                              {catMatches.map((item, mIdx) => {
                                const type = item.matchType || "gap";
                                const cfg = matchTypeConfig[type] || matchTypeConfig.gap;
                                return (
                                  <motion.div
                                    key={mIdx}
                                    variants={staggerItemLeft}
                                    className="flex items-center gap-3 py-1.5 border-b border-foreground/8 last:border-0 row-hover rounded-md"
                                  >
                                    <span className={cn("h-5 w-5 flex items-center justify-center text-[10px] font-bold shrink-0", cfg.badge)}>
                                      {cfg.symbol}
                                    </span>
                                    <span className="text-sm flex-1">{item.scopeItem || "Unnamed item"}</span>
                                    {item.confidence != null && (
                                      <span className="font-mono text-[10px] text-muted-foreground">{formatConfidence(item.confidence)}</span>
                                    )}
                                  </motion.div>
                                );
                              })}
                            </motion.div>
                          );
                        }
                        return null;
                      })()}
                    </CollapsibleContent>
                  </CollapsibleSection>
                );
              })}
            </div>
          </div>
        )}

        {/* Flat match list (shown when no categories, or as supplementary detail) */}
        {matches && matches.length > 0 && !hasCategories && (
          <div className="mt-5">
            <div className="space-y-0">
              {["full", "partial", "gap"].map((groupKey) => {
                const items = matches.filter((m) => (m.matchType || "gap") === groupKey);
                if (items.length === 0) return null;
                const cfg = matchTypeConfig[groupKey] || matchTypeConfig.gap;
                const groupLabels: Record<string, string> = { full: "Full Matches", partial: "Partial Matches", gap: "Gaps" };
                const groupTextColors: Record<string, string> = { full: "text-green-600", partial: "text-yellow-600", gap: "text-red-600" };
                return (
                  <CollapsibleSection key={groupKey} value={groupKey}>
                    <CollapsibleTrigger className="py-3 hover:no-underline">
                      <div className="flex items-center gap-2.5 text-sm">
                        <span className={cn("h-3 w-3 rounded-full", cfg.badge.split(" ")[0])} />
                        <span className={cn("font-bold", groupTextColors[groupKey])}>{groupLabels[groupKey]}</span>
                        <span className="font-mono text-[10px] text-muted-foreground/60">
                          {items.length}
                        </span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <motion.div className="space-y-0" variants={staggerFast} initial="hidden" animate="visible">
                        {items.map((item, idx) => (
                          <motion.div
                            key={idx}
                            variants={staggerItemLeft}
                            className="flex items-center gap-3 py-1.5 border-b border-foreground/8 last:border-0 row-hover rounded-md"
                          >
                            <span className={cn("h-5 w-5 flex items-center justify-center text-[10px] font-bold shrink-0", cfg.badge)}>
                              {cfg.symbol}
                            </span>
                            <span className="text-sm font-medium flex-1">{item.scopeItem || "Unnamed item"}</span>
                            {item.matchedService && (
                              <span className="font-mono text-[10px] text-muted-foreground">{typeof item.matchedService === 'string' ? item.matchedService : ''}</span>
                            )}
                          </motion.div>
                        ))}
                      </motion.div>
                    </CollapsibleContent>
                  </CollapsibleSection>
                );
              })}
            </div>
          </div>
        )}

        {/* Output counts — only non-zero values */}
        {outputKeys.length > 0 && (() => {
          const nonZeroEntries = outputKeys
            .map((key) => {
              const val = outputCounts![key];
              const displayVal = typeof val === "object" ? val.count || val.value || 0 : val;
              const numVal = typeof displayVal === "number" ? displayVal : parseInt(String(displayVal), 10);
              return { key, displayVal, numVal };
            })
            .filter(({ numVal }) => !isNaN(numVal) && numVal > 0);

          if (nonZeroEntries.length === 0) return null;

          return (
            <div className="mt-5 border-t border-foreground/10 pt-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {nonZeroEntries.map(({ key, displayVal }) => (
                  <div key={key}>
                    <p className="text-2xl font-bold">{displayVal}</p>
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{humanize(key)}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
