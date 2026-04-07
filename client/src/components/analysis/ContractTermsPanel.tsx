import { cn } from "@/lib/utils";
import {
  CollapsibleSection,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible-section";
import { humanize } from "@/lib/format-evidence";

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

  const termCount = visibleTerms.length + otherTerms.length;

  return (
    <div className="dash-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">Contract Terms</span>
        <span className="dash-panel-badge">{termCount} terms</span>
      </div>

      <div className="dash-panel-body">
        {/* Term/value rows with dashed dividers */}
        {visibleTerms.map((term) => {
          const val = formatTermValue(contractTerms[term.key]);
          return (
            <div
              key={term.key}
              className="py-3.5"
              style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>
                  {term.label}
                </span>
                {term.warn && val !== "Not specified" && (
                  <span className="dash-panel-badge" style={{ borderColor: "rgba(255,90,54,0.3)", color: "#ff5a36" }}>
                    WARN
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{val}</p>
            </div>
          );
        })}

        {/* Other terms */}
        {otherTerms.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <CollapsibleSection value="other-terms">
              <CollapsibleTrigger className="hover:no-underline py-2">
                <span className="dash-metric-sub" style={{ cursor: "pointer" }}>
                  Other Terms ({otherTerms.length})
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div data-lenis-prevent className="max-h-[340px] overflow-y-auto overscroll-contain">
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
                      <div
                        key={idx}
                        className="py-3.5"
                        style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)" }}
                      >
                        <p className="dash-metric-label">
                          {typeof termName === "string"
                            ? humanize(termName)
                            : termName}
                        </p>
                        {termVal && (
                          <p className="text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>{String(termVal)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </CollapsibleSection>
          </div>
        )}
      </div>
    </div>
  );
}
