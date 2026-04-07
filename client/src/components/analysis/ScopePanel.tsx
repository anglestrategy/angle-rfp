import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { humanize } from "@/lib/format-evidence";
import {
  CollapsibleSection,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible-section";

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
  full: { label: "Full Match", badge: "bg-emerald-500 text-white", symbol: "\u2713" },
  partial: { label: "Partial", badge: "bg-amber-500 text-white", symbol: "~" },
  gap: { label: "Gap", badge: "bg-red-500 text-white", symbol: "\u2715" },
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
        <div className="dash-panel-header">
          <span className="dash-panel-title">Scope Analysis</span>
        </div>
        <div className="dash-panel-body" data-testid="section-scope">
          <p className="text-sm italic" style={{ color: "rgba(255,255,255,0.4)" }}>Scope analysis data not available</p>
        </div>
      </div>
    );
  }

  const total = fullMatches + partialMatches + gaps;
  const fullPct = total > 0 ? (fullMatches / total) * 100 : 0;
  const partialPct = total > 0 ? (partialMatches / total) * 100 : 0;
  const gapPct = total > 0 ? (gaps / total) * 100 : 0;

  const outputKeys = outputCounts ? Object.keys(outputCounts) : [];

  const hasCategories = scopeCategories && scopeCategories.length > 0;

  return (
    <div className="dash-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">Scope Analysis</span>
        <span className="dash-panel-badge">{agencyServicePct}% Match</span>
      </div>

      <div className="dash-panel-body" data-testid="section-scope">
        {/* 3 metric groups side by side */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="dash-metric-group">
            <p className="dash-metric-label">Full</p>
            <p className="dash-metric-value text-emerald-400">{fullMatches}</p>
            <p className="dash-metric-sub">Full matches</p>
          </div>
          <div className="dash-metric-group">
            <p className="dash-metric-label">Partial</p>
            <p className="dash-metric-value text-amber-400">{partialMatches}</p>
            <p className="dash-metric-sub">Partial matches</p>
          </div>
          <div className="dash-metric-group">
            <p className="dash-metric-label">Gaps</p>
            <p className="dash-metric-value text-red-400">{gaps}</p>
            <p className="dash-metric-sub">Gaps identified</p>
          </div>
        </div>

        {/* Simple horizontal bar */}
        {total > 0 && (
          <div className="h-[3px] flex overflow-hidden mb-6" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="bg-emerald-500" style={{ width: `${fullPct}%` }} />
            <div className="bg-amber-500" style={{ width: `${partialPct}%` }} />
            <div className="bg-red-500" style={{ width: `${gapPct}%` }} />
          </div>
        )}

        {/* Category accordion */}
        {hasCategories && (
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
                      <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {catTotal} items
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {/* Category mini bar */}
                    <div className="mb-3">
                      <div className="h-[3px] overflow-hidden flex" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div className="bg-emerald-500" style={{ width: `${catFullPct}%` }} />
                        <div className="bg-amber-500" style={{ width: `${catPartialPct}%` }} />
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>F:{catFull}</span>
                        <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>P:{catPartial}</span>
                        <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>G:{catGap}</span>
                      </div>
                    </div>

                    {/* Match items that belong to this category */}
                    {matches && matches.length > 0 && (() => {
                      const catMatches = matches.filter((m) => {
                        const ms = m.matchedService;
                        const mCat = m.category || (typeof ms === "object" && ms !== null ? (ms as any).category : undefined);
                        if (mCat) return mCat === catName || mCat === cat.category;
                        return false;
                      });

                      if (catMatches.length > 0) {
                        return (
                          <div className="space-y-0">
                            {catMatches.map((item, mIdx) => {
                              const type = item.matchType || "gap";
                              const cfg = matchTypeConfig[type] || matchTypeConfig.gap;
                              return (
                                <div
                                  key={mIdx}
                                  className="dash-data-row"
                                  style={{ gridTemplateColumns: "20px 1fr auto" }}
                                >
                                  <span className={cn("h-5 w-5 flex items-center justify-center text-[10px] font-bold shrink-0", cfg.badge)}>
                                    {cfg.symbol}
                                  </span>
                                  <span className="text-sm">{item.scopeItem || "Unnamed item"}</span>
                                  {item.confidence != null && (
                                    <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{formatConfidence(item.confidence)}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </CollapsibleContent>
                </CollapsibleSection>
              );
            })}
          </div>
        )}

        {/* Flat match list (shown when no categories) */}
        {matches && matches.length > 0 && !hasCategories && (
          <div className="space-y-0">
            {["full", "partial", "gap"].map((groupKey) => {
              const items = matches.filter((m) => (m.matchType || "gap") === groupKey);
              if (items.length === 0) return null;
              const cfg = matchTypeConfig[groupKey] || matchTypeConfig.gap;
              const groupLabels: Record<string, string> = { full: "Full Matches", partial: "Partial Matches", gap: "Gaps" };
              const groupTextColors: Record<string, string> = { full: "text-emerald-400", partial: "text-amber-400", gap: "text-red-400" };
              return (
                <CollapsibleSection key={groupKey} value={groupKey}>
                  <CollapsibleTrigger className="py-3 hover:no-underline">
                    <div className="flex items-center gap-2.5 text-sm">
                      <span className={cn("h-3 w-3", cfg.badge.split(" ")[0])} />
                      <span className={cn("font-bold", groupTextColors[groupKey])}>{groupLabels[groupKey]}</span>
                      <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                        {items.length}
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-0">
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className="dash-data-row"
                          style={{ gridTemplateColumns: "20px 1fr auto" }}
                        >
                          <span className={cn("h-5 w-5 flex items-center justify-center text-[10px] font-bold shrink-0", cfg.badge)}>
                            {cfg.symbol}
                          </span>
                          <span className="text-sm font-medium">{item.scopeItem || "Unnamed item"}</span>
                          {item.matchedService && (
                            <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{typeof item.matchedService === 'string' ? item.matchedService : ''}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </CollapsibleSection>
              );
            })}
          </div>
        )}

        {/* Output counts as metric groups at bottom */}
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
            <div className="mt-6 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-6">
                {nonZeroEntries.map(({ key, displayVal }) => (
                  <div key={key} className="dash-metric-group">
                    <p className="dash-metric-label">{humanize(key)}</p>
                    <p className="dash-metric-value">{displayVal}</p>
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
