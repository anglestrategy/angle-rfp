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
  category?: string;
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

const typeStyles: Record<string, { dot: string; text: string }> = {
  full: { dot: "bg-emerald-500", text: "text-emerald-400" },
  partial: { dot: "bg-amber-500", text: "text-amber-400" },
  gap: { dot: "bg-red-500", text: "text-red-400" },
};

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
        <div className="dash-panel-body">
          <p className="text-sm text-white/40">Scope analysis data not available.</p>
        </div>
      </div>
    );
  }

  const total = fullMatches + partialMatches + gaps;
  const hasCategories = scopeCategories && scopeCategories.length > 0;
  const outputKeys = outputCounts ? Object.keys(outputCounts) : [];

  return (
    <div className="dash-panel" data-testid="section-scope">
      {/* Header */}
      <div className="dash-panel-header">
        <span className="dash-panel-title">Scope Analysis</span>
        <span className="dash-panel-badge">{agencyServicePct}% match</span>
      </div>

      <div className="dash-panel-body">
        {/* Summary stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-2xl font-bold text-emerald-400">{fullMatches}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Full match</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-400">{partialMatches}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Partial</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">{gaps}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Gap</p>
          </div>
        </div>

        {/* Summary bar */}
        {total > 0 && (
          <div className="h-2 overflow-hidden flex bg-white/[0.04] mb-6">
            <div className="bg-emerald-500" style={{ width: `${(fullMatches / total) * 100}%` }} />
            <div className="bg-amber-500" style={{ width: `${(partialMatches / total) * 100}%` }} />
            <div className="bg-red-500" style={{ width: `${(gaps / total) * 100}%` }} />
          </div>
        )}

        {/* Match list */}
        {matches && matches.length > 0 && (
          <div className="border-t border-white/[0.06] pt-4">
            {["full", "partial", "gap"].map((groupKey) => {
              const items = matches.filter((m) => (m.matchType || "gap") === groupKey);
              if (items.length === 0) return null;
              const style = typeStyles[groupKey] || typeStyles.gap;
              const labels: Record<string, string> = { full: "Full matches", partial: "Partial matches", gap: "Gaps" };

              return (
                <CollapsibleSection key={groupKey} value={groupKey}>
                  <CollapsibleTrigger className="py-2.5">
                    <div className="flex items-center gap-2 text-sm flex-1">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", style.dot)} />
                      <span className={cn("font-semibold", style.text)}>{labels[groupKey]}</span>
                      <span className="font-mono text-[10px] text-white/30 ml-auto">{items.length}</span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pl-4 mb-2">
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 py-2 border-b border-dashed border-white/[0.06] last:border-0 text-sm"
                        >
                          <span className="font-mono text-[10px] text-white/25 w-4 text-right shrink-0 pt-0.5 tabular-nums">
                            {idx + 1}
                          </span>
                          <span className="flex-1 text-white/80">{item.scopeItem || "Unnamed"}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </CollapsibleSection>
              );
            })}
          </div>
        )}

        {/* Output counts */}
        {outputKeys.length > 0 && (() => {
          const entries = outputKeys
            .map((key) => {
              const val = outputCounts![key];
              const num = typeof val === "number" ? val : typeof val === "object" ? val.count || val.value || 0 : parseInt(String(val), 10);
              return { key, num };
            })
            .filter(({ num }) => !isNaN(num) && num > 0);

          if (entries.length === 0) return null;

          return (
            <div className="border-t border-white/[0.06] pt-4 mt-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-3">Output counts</p>
              <div className="grid grid-cols-2 gap-3">
                {entries.map(({ key, num }) => (
                  <div key={key} className="flex items-baseline justify-between border-b border-dashed border-white/[0.06] pb-2">
                    <span className="text-sm text-white/60">{humanize(key)}</span>
                    <span className="text-lg font-bold tabular-nums">{num}</span>
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
