import {
  CollapsibleGroup,
  CollapsibleGroupSection,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible-section";
import { cn } from "@/lib/utils";

interface Contradiction {
  topic?: string;
  statement1?: string;
  statement2?: string;
  suggestedResolution?: string;
  description?: string;
  details?: string;
  reference1?: string;
  reference2?: string;
}

interface ClarificationSectionProps {
  clarificationQuestions: string[];
  missingInfo: any[];
  contradictions: Contradiction[];
}

export function ClarificationSection({
  clarificationQuestions,
  missingInfo,
  contradictions,
}: ClarificationSectionProps) {
  const qCount = clarificationQuestions.length;
  const mCount = missingInfo.length;
  const cCount = contradictions.length;

  const hasContent = qCount > 0 || mCount > 0 || cCount > 0;
  if (!hasContent) return null;

  const totalItems = qCount + mCount + cCount;

  const defaultOpen: string[] = [];
  if (qCount > 0) defaultOpen.push("questions");

  return (
    <div className="dash-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">Clarifications</span>
        <span className="dash-panel-badge">{totalItems} items</span>
      </div>

      <div className="dash-panel-body">
        <CollapsibleGroup type="multiple" defaultValue={defaultOpen} className="space-y-0">
          {/* Questions */}
          {qCount > 0 && (
            <CollapsibleGroupSection value="questions">
              <CollapsibleTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>Questions to Ask</span>
                  <span className="dash-panel-badge">{qCount}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div data-lenis-prevent className="max-h-[360px] overflow-y-auto overscroll-contain">
                  {clarificationQuestions.map((q, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 py-3.5"
                      style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)" }}
                    >
                      <span className="font-mono text-[10px] w-5 text-right shrink-0 leading-relaxed mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>{q}</p>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </CollapsibleGroupSection>
          )}

          {/* Missing Info */}
          {mCount > 0 && (
            <CollapsibleGroupSection value="missing">
              <CollapsibleTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>Missing Information</span>
                  <span className="dash-panel-badge">{mCount}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div data-lenis-prevent className="max-h-[360px] overflow-y-auto overscroll-contain">
                  {missingInfo.map((item, i) => {
                    const question = typeof item === "string" ? item : item.question || item.item || item.description;
                    const importance = typeof item === "string" ? "important" : item.importance || item.priority || "important";
                    const impact = typeof item === "object" ? item.impact : null;

                    const importanceColor =
                      importance?.toLowerCase() === "critical"
                        ? "text-red-400"
                        : importance?.toLowerCase() === "important"
                          ? "text-amber-400"
                          : "";

                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 py-3.5"
                        style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)" }}
                      >
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5", importanceColor)}>
                          {importance}
                        </span>
                        <div className="min-w-0">
                          <span className="text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>{question}</span>
                          {impact && <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{impact}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </CollapsibleGroupSection>
          )}

          {/* Contradictions */}
          {cCount > 0 && (
            <CollapsibleGroupSection value="contradictions">
              <CollapsibleTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>Conflicts</span>
                  <span className="dash-panel-badge">{cCount}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div data-lenis-prevent className="max-h-[360px] overflow-y-auto overscroll-contain">
                  {contradictions.map((c, i) => {
                    const title = c.topic || c.description || `Contradiction ${i + 1}`;
                    const line1 = c.statement1 || c.reference1 || c.details;
                    const line2 = c.statement2 || c.reference2;
                    const resolution = c.suggestedResolution;
                    return (
                      <div
                        key={i}
                        className="py-4"
                        style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)" }}
                      >
                        <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>{title}</p>
                        <div className="space-y-1.5 mt-2">
                          {line1 && (
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                              <span className="font-bold text-amber-400">{c.statement1 ? "Statement 1:" : "Details:"}</span> {line1}
                            </p>
                          )}
                          {line2 && (
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                              <span className="font-bold text-amber-400">{c.statement2 ? "Statement 2:" : "Reference:"}</span> {line2}
                            </p>
                          )}
                          {resolution && (
                            <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                              <span className="font-bold" style={{ color: "#ff5a36" }}>Resolution:</span> {resolution}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </CollapsibleGroupSection>
          )}
        </CollapsibleGroup>
      </div>
    </div>
  );
}
