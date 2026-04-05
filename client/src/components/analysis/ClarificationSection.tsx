import { motion } from "framer-motion";
import {
  CollapsibleGroup,
  CollapsibleGroupSection,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible-section";
import { cn } from "@/lib/utils";
import { staggerFast, staggerItemLeft } from "@/lib/motion";

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

function importanceBadge(importance: string): string {
  const i = importance?.toLowerCase() || "";
  if (i === "critical") return "border-red-500/30 bg-red-500/15 text-red-500";
  if (i === "important") return "border-amber-500/30 bg-amber-500/15 text-amber-500";
  return "border-white/[0.06] bg-foreground/[0.06] text-muted-foreground";
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

  // Build default open sections
  const defaultOpen: string[] = [];
  if (qCount > 0) defaultOpen.push("questions");

  return (
    <div className="border border-white/[0.06] bg-[#050505]">
      <div className="pt-4 pb-4 px-5">
        <div className="flex items-center justify-between mb-3">
          <p className="panel-heading">Clarifications</p>
          <span className="font-mono text-[10px] text-muted-foreground/60">{totalItems} items</span>
        </div>

        <CollapsibleGroup type="multiple" defaultValue={defaultOpen} className="space-y-0">
          {/* Questions */}
          {qCount > 0 && (
            <CollapsibleGroupSection value="questions" className="border-b border-foreground/8">
              <CollapsibleTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="font-bold">Questions to Ask</span>
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {qCount}
                  </span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <motion.div data-lenis-prevent className="max-h-[360px] overflow-y-auto overscroll-contain" variants={staggerFast} initial="hidden" animate="visible">
                  {clarificationQuestions.map((q, i) => (
                    <motion.div key={i} variants={staggerItemLeft} className="flex items-start gap-3 py-3 border-b border-foreground/8 last:border-0 row-hover">
                      <span className="font-mono text-[10px] text-muted-foreground w-5 text-right shrink-0 leading-relaxed mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed">{q}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </CollapsibleContent>
            </CollapsibleGroupSection>
          )}

          {/* Missing Info */}
          {mCount > 0 && (
            <CollapsibleGroupSection value="missing" className="border-b border-foreground/8">
              <CollapsibleTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="font-bold">Missing Information</span>
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {mCount}
                  </span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <motion.div data-lenis-prevent className="max-h-[360px] overflow-y-auto overscroll-contain" variants={staggerFast} initial="hidden" animate="visible">
                  {missingInfo.map((item, i) => {
                    const question = typeof item === "string" ? item : item.question || item.item || item.description;
                    const importance = typeof item === "string" ? "important" : item.importance || item.priority || "important";
                    const impact = typeof item === "object" ? item.impact : null;
                    return (
                      <motion.div key={i} variants={staggerItemLeft} className="flex items-start gap-3 py-3 border-b border-foreground/8 last:border-0 row-hover">
                        <span className={cn("px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5 border", importanceBadge(importance))}>
                          {importance}
                        </span>
                        <div className="min-w-0">
                          <span className="text-sm">{question}</span>
                          {impact && <p className="text-xs text-muted-foreground mt-0.5">{impact}</p>}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </CollapsibleContent>
            </CollapsibleGroupSection>
          )}

          {/* Contradictions */}
          {cCount > 0 && (
            <CollapsibleGroupSection value="contradictions" className="border-b border-foreground/8">
              <CollapsibleTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="font-bold">Conflicts</span>
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {cCount}
                  </span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <motion.div data-lenis-prevent className="max-h-[360px] overflow-y-auto overscroll-contain space-y-3" variants={staggerFast} initial="hidden" animate="visible">
                  {contradictions.map((c, i) => {
                    const title = c.topic || c.description || `Contradiction ${i + 1}`;
                    const line1 = c.statement1 || c.reference1 || c.details;
                    const line2 = c.statement2 || c.reference2;
                    const resolution = c.suggestedResolution;
                    return (
                      <motion.div key={i} variants={staggerItemLeft} className="border border-amber-500/20 p-4 bg-amber-500/[0.03]">
                        <p className="text-sm font-bold">{title}</p>
                        <div className="space-y-1.5 mt-2">
                          {line1 && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-bold text-yellow-600">{c.statement1 ? "Statement 1:" : "Details:"}</span> {line1}
                            </p>
                          )}
                          {line2 && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-bold text-yellow-600">{c.statement2 ? "Statement 2:" : "Reference:"}</span> {line2}
                            </p>
                          )}
                          {resolution && (
                            <p className="text-xs text-muted-foreground mt-2">
                              <span className="font-bold text-primary">Resolution:</span> {resolution}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </CollapsibleContent>
            </CollapsibleGroupSection>
          )}
        </CollapsibleGroup>
      </div>
    </div>
  );
}
