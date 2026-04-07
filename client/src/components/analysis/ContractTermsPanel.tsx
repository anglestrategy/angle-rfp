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
  { key: "performanceGuarantees", label: "Performance Guarantees", warn: true },
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
  return str === "" ? null : str;
}

export function ContractTermsPanel({ contractTerms }: ContractTermsPanelProps) {
  if (!contractTerms) return null;

  const visibleTerms = TERMS.filter((t) => formatTermValue(contractTerms[t.key]) !== null);

  const rawOther = contractTerms.otherTerms;
  const otherTerms: any[] = Array.isArray(rawOther)
    ? rawOther
    : typeof rawOther === "string" && rawOther.trim()
      ? [{ name: "Other", description: rawOther }]
      : [];

  // Merge all terms into one flat list
  const allTerms = [
    ...visibleTerms.map((t) => ({
      label: t.label,
      value: formatTermValue(contractTerms[t.key])!,
      warn: t.warn && formatTermValue(contractTerms[t.key]) !== "Not specified",
    })),
    ...otherTerms.map((t: any, idx: number) => ({
      label: typeof (t.name || t.term || t.title) === "string"
        ? humanize(t.name || t.term || t.title)
        : `Term ${idx + 1}`,
      value: String(t.description || t.value || t.details || t.content || ""),
      warn: false,
    })),
  ].filter((t) => t.value);

  if (allTerms.length === 0) return null;

  return (
    <div className="dash-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">Contract Terms</span>
        <span className="dash-panel-badge">{allTerms.length} terms</span>
      </div>

      <div className="dash-panel-body">
        {allTerms.map((term, i) => (
          <CollapsibleSection key={i} value={`term-${i}`}>
            <CollapsibleTrigger className="py-3" style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 flex-1 text-left">
                <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>
                  {term.label}
                </span>
                {term.warn && (
                  <span className="dash-panel-badge" style={{ borderColor: "rgba(255,90,54,0.3)", color: "#ff5a36" }}>
                    WARN
                  </span>
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="text-sm leading-relaxed pb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
                {term.value}
              </p>
            </CollapsibleContent>
          </CollapsibleSection>
        ))}
      </div>
    </div>
  );
}
