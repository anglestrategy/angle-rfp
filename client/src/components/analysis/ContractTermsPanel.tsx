import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  CollapsibleGroup,
  CollapsibleGroupSection,
  CollapsibleSection,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible-section";
import { humanize } from "@/lib/format-evidence";
import { staggerFast, staggerItemLeft } from "@/lib/motion";

interface ContractTermsPanelProps {
  contractTerms: Record<string, any>;
}

interface TermDef {
  key: string;
  label: string;
  warn: boolean;
}

const TERMS: TermDef[] = [
  { key: "paymentTerms", label: "Payment Terms", warn: false },
  { key: "delayPenalties", label: "Delay Penalties", warn: true },
  {
    key: "performanceGuarantees",
    label: "Performance Guarantees",
    warn: true,
  },
  { key: "confidentiality", label: "Confidentiality", warn: false },
  { key: "ipOwnership", label: "IP Ownership", warn: true },
  { key: "governingLaw", label: "Governing Law", warn: false },
  { key: "termination", label: "Termination", warn: false },
];

function formatTermValue(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object") {
    if (val.description) return String(val.description);
    if (val.value) return String(val.value);
    if (val.details) return String(val.details);
    return JSON.stringify(val);
  }
  const str = String(val).trim();
  if (str === "") return null;
  return str;
}

export function ContractTermsPanel({
  contractTerms,
}: ContractTermsPanelProps) {
  if (!contractTerms) return null;

  const visibleTerms = TERMS.filter((t) => {
    const val = contractTerms[t.key];
    return formatTermValue(val) !== null;
  });

  const rawOther = contractTerms.otherTerms;
  const otherTerms: any[] = Array.isArray(rawOther)
    ? rawOther
    : typeof rawOther === "string" && rawOther.trim()
      ? [{ name: "Other", description: rawOther }]
      : [];

  if (visibleTerms.length === 0 && otherTerms.length === 0) return null;

  return (
    <div className="dash-panel">
      <div className="dash-panel-body">
        <div className="flex items-center justify-between mb-3">
          <p className="panel-heading">Contract Terms</p>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {visibleTerms.length + otherTerms.length} terms
          </span>
        </div>

        <CollapsibleGroup type="multiple" className="space-y-0">
          {visibleTerms.map((term) => {
            const val = formatTermValue(contractTerms[term.key]);
            const isWarn = term.warn && val !== "Not specified";
            return (
              <CollapsibleGroupSection key={term.key} value={term.key} className="border-b border-foreground/8">
                <CollapsibleTrigger className="py-2.5 px-1 text-sm hover:no-underline row-hover">
                  <div className="flex items-center gap-2.5">
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 border",
                      isWarn ? "border-primary/30 bg-primary/15 text-primary" : "border-white/[0.06] bg-foreground/[0.06] text-muted-foreground"
                    )}>
                      {isWarn ? "WARN" : "STD"}
                    </span>
                    <span className="font-medium">{term.label}</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-1 pb-3 text-sm text-muted-foreground">
                  {val}
                </CollapsibleContent>
              </CollapsibleGroupSection>
            );
          })}
        </CollapsibleGroup>

        {otherTerms.length > 0 && (
          <div className="mt-3 border-t border-foreground/8 pt-3">
            <CollapsibleSection value="other-terms">
              <CollapsibleTrigger className="hover:no-underline py-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Other Terms ({otherTerms.length})
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <motion.div data-lenis-prevent className="max-h-[340px] overflow-y-auto overscroll-contain space-y-0" variants={staggerFast} initial="hidden" animate="visible">
                  {otherTerms.map((term: any, idx: number) => {
                    const termName =
                      term.name || term.term || term.title || `Term ${idx + 1}`;
                    const termVal =
                      term.description ||
                      term.value ||
                      term.details ||
                      term.content ||
                      "";
                    return (
                      <motion.div key={idx} variants={staggerItemLeft} className="py-2 border-b border-foreground/8 last:border-0 row-hover">
                        <p className="swiss-data-label">
                          {typeof termName === "string"
                            ? humanize(termName)
                            : termName}
                        </p>
                        {termVal && (
                          <p className="text-sm">{String(termVal)}</p>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              </CollapsibleContent>
            </CollapsibleSection>
          </div>
        )}
      </div>
    </div>
  );
}
