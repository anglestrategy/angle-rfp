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

  return (
    <div className="dash-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">CLARIFICATIONS</span>
        <span className="dash-panel-badge">{totalItems} items</span>
      </div>
      <div className="dash-panel-body">
        {/* Questions */}
        {qCount > 0 && (
          <div className="py-3 border-b border-dashed border-white/[0.06]">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-2">
              Questions to Ask
              <span className="ml-2 text-white/20">{qCount}</span>
            </p>
            <div className="space-y-0">
              {clarificationQuestions.map((q, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 py-2"
                >
                  <span className="font-mono text-[10px] text-white/20 w-5 text-right shrink-0 leading-relaxed mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-white/70 leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing Info */}
        {mCount > 0 && (
          <div className="py-3 border-b border-dashed border-white/[0.06]">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-2">
              Missing Information
              <span className="ml-2 text-white/20">{mCount}</span>
            </p>
            <div className="space-y-0">
              {missingInfo.map((item, i) => {
                const question = typeof item === "string" ? item : item.question || item.item || item.description;
                const importance = typeof item === "string" ? "important" : item.importance || item.priority || "important";
                const impact = typeof item === "object" ? item.impact : null;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-2"
                  >
                    <span className="font-mono text-[9px] uppercase tracking-wider text-white/40 shrink-0 mt-0.5">
                      {importance}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm text-white/70">{question}</span>
                      {impact && <p className="text-xs text-white/40 mt-0.5">{impact}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contradictions */}
        {cCount > 0 && (
          <div className="py-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-2">
              Conflicts
              <span className="ml-2 text-white/20">{cCount}</span>
            </p>
            <div className="space-y-3">
              {contradictions.map((c, i) => {
                const title = c.topic || c.description || `Contradiction ${i + 1}`;
                const line1 = c.statement1 || c.reference1 || c.details;
                const line2 = c.statement2 || c.reference2;
                const resolution = c.suggestedResolution;
                return (
                  <div
                    key={i}
                    className="border border-dashed border-white/[0.06] p-3"
                  >
                    <p className="text-sm font-bold text-white/80">{title}</p>
                    <div className="space-y-1.5 mt-2">
                      {line1 && (
                        <p className="text-xs text-white/50">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
                            {c.statement1 ? "Statement 1:" : "Details:"}
                          </span>{" "}
                          {line1}
                        </p>
                      )}
                      {line2 && (
                        <p className="text-xs text-white/50">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
                            {c.statement2 ? "Statement 2:" : "Reference:"}
                          </span>{" "}
                          {line2}
                        </p>
                      )}
                      {resolution && (
                        <p className="text-xs text-white/50 mt-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">Resolution:</span>{" "}
                          {resolution}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
