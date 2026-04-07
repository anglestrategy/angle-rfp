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

  return (
    <div className="dash-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">CONTRACT TERMS</span>
        <span className="dash-panel-badge">
          {visibleTerms.length + otherTerms.length} terms
        </span>
      </div>
      <div className="dash-panel-body">
        {visibleTerms.map((term) => {
          const val = formatTermValue(contractTerms[term.key]);
          const isWarn = term.warn && val !== "Not specified";
          return (
            <div
              key={term.key}
              className="py-3 border-b border-dashed border-white/[0.06]"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
                  {term.label}
                </span>
                {isWarn && (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/40">
                    WARN
                  </span>
                )}
              </div>
              <p className="text-sm text-white/70">{val}</p>
            </div>
          );
        })}

        {otherTerms.length > 0 && (
          <>
            <div className="py-3 border-b border-dashed border-white/[0.06]">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/30">
                Other Terms
                <span className="ml-2 text-white/20">{otherTerms.length}</span>
              </p>
            </div>
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
                  className="py-3 border-b border-dashed border-white/[0.06] last:border-0"
                >
                  <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-1">
                    {typeof termName === "string"
                      ? humanize(termName)
                      : termName}
                  </p>
                  {termVal && (
                    <p className="text-sm text-white/70">{String(termVal)}</p>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
