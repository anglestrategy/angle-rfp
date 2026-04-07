import { humanize } from "@/lib/format-evidence";

interface ClientIntelProps {
  clientInfo: Record<string, any>;
  clientName?: string;
  industry?: string;
  hasData: boolean;
}

interface FieldDef {
  label: string;
  value: any;
  long?: boolean;
}

function resolveValue(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "object" && val !== null) {
    if (val.name) return String(val.name);
    if (val.value) return String(val.value);
    return null;
  }
  if (typeof val === "string" && val.trim() === "") return null;
  return String(val);
}

function isPlaceholderValue(value: string | null): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === "unknown" || normalized === "n/a" || normalized === "not specified";
}

function averageConfidence(confidenceScores: Record<string, number> | undefined): number | null {
  if (!confidenceScores) return null;
  const values = Object.values(confidenceScores).filter(
    (value): value is number => typeof value === "number",
  );
  if (values.length === 0) return null;
  return Math.round(
    (values.reduce((sum, value) => sum + value, 0) / values.length) * 100,
  );
}

function sourceTypeLabel(sourceType: string | undefined): string {
  if (sourceType === "web_research") return "Web research";
  if (sourceType === "mixed") return "Mixed sources";
  return "Document inference";
}

export function ClientIntel({
  clientInfo,
  clientName,
  industry,
  hasData,
}: ClientIntelProps) {
  if (!hasData) {
    return (
      <div className="dash-panel">
        <div className="dash-panel-header">
          <span className="dash-panel-title">CLIENT INTELLIGENCE</span>
        </div>
        <div className="dash-panel-body" data-testid="section-client-profile">
          <p className="text-sm text-white/40 italic">
            Client intelligence data not available
          </p>
        </div>
      </div>
    );
  }

  const fields: FieldDef[] = [
    {
      label: "Company",
      value: isPlaceholderValue(resolveValue(clientInfo.companyName))
        ? clientName || null
        : clientInfo.companyName || clientName || null,
    },
    {
      label: "Industry",
      value: isPlaceholderValue(resolveValue(clientInfo.industry))
        ? industry || null
        : clientInfo.industry || industry || null,
    },
    {
      label: "Entity Type",
      value: clientInfo.entityType || null,
    },
    {
      label: "Company Size",
      value:
        clientInfo.estimatedSize || clientInfo.employeeRange || null,
    },
    {
      label: "Holding Group",
      value: clientInfo.holdingGroup || null,
    },
    {
      label: "Geographic Reach",
      value: clientInfo.geographicReach || null,
    },
    {
      label: "Media Spend",
      value: clientInfo.mediaSpendsSignal || clientInfo.mediaSpend || null,
    },
    {
      label: "Digital Presence",
      value: clientInfo.digitalPresence || null,
      long: true,
    },
  ];

  const shortFields = fields.filter((f) => !f.long);
  const longFields = fields.filter((f) => f.long);
  const confidenceScores = clientInfo.confidenceScores as Record<string, number> | undefined;
  const avgConfidence = averageConfidence(confidenceScores);
  const sourceType = sourceTypeLabel(clientInfo.sourceType);
  const sourceCount = Array.isArray(clientInfo.sources) ? clientInfo.sources.length : 0;
  const displayedSources = Array.isArray(clientInfo.sources)
    ? clientInfo.sources.slice(0, 3)
    : [];
  const displayedNotes = Array.isArray(clientInfo.researchNotes)
    ? clientInfo.researchNotes.filter((note: unknown): note is string => typeof note === "string" && note.trim().length > 0).slice(0, 4)
    : [];

  return (
    <div className="dash-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">CLIENT INTELLIGENCE</span>
        <div className="flex items-center gap-2">
          <span className="dash-panel-badge">{sourceType}</span>
          {avgConfidence != null && (
            <span className="dash-panel-badge">{avgConfidence}% confidence</span>
          )}
          {sourceCount > 0 && (
            <span className="dash-panel-badge">
              {sourceCount} source{sourceCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
      <div className="dash-panel-body" data-testid="section-client-profile">
        {/* Short fields in a 2-col grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-0">
          {shortFields.map((field) => {
            const raw = resolveValue(field.value);
            const confidenceKey = field.label === "Company"
              ? "companyName"
              : field.label === "Company Size"
                ? "estimatedSize"
                : field.label === "Geographic Reach"
                  ? "geographicReach"
                  : field.label === "Media Spend"
                    ? "mediaSpendsSignal"
                    : field.label === "Entity Type"
                      ? "entityType"
                      : field.label === "Industry"
                        ? "industry"
                        : undefined;
            const confidence = confidenceKey ? confidenceScores?.[confidenceKey] : undefined;
            return (
              <div
                key={field.label}
                className="py-3 border-b border-dashed border-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-white/30">{field.label}</p>
                  {typeof confidence === "number" && (
                    <span className="font-mono text-[9px] text-white/20">
                      {Math.round(confidence * 100)}%
                    </span>
                  )}
                </div>
                {raw ? (
                  <p className="text-sm text-white/70 mt-0.5">{humanize(raw)}</p>
                ) : (
                  <p className="text-sm text-white/20 mt-0.5">&mdash;</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Long-text fields rendered full-width */}
        {longFields.map((field) => {
          const raw = resolveValue(field.value);
          if (!raw) return null;
          const confidence =
            field.label === "Digital Presence"
              ? averageConfidence({
                  digitalPresence:
                    typeof clientInfo.confidenceScores?.digitalPresence === "number"
                      ? clientInfo.confidenceScores.digitalPresence
                      : avgConfidence != null
                        ? avgConfidence / 100
                        : 0,
                })
              : null;
          return (
            <div key={field.label} className="py-3 border-b border-dashed border-white/[0.06]">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-white/30">{field.label}</p>
                {confidence != null && (
                  <span className="font-mono text-[9px] text-white/20">
                    {confidence}%
                  </span>
                )}
              </div>
              <p className="text-sm text-white/70 leading-relaxed mt-0.5 line-clamp-3">
                {humanize(raw)}
              </p>
            </div>
          );
        })}

        {/* External Sources */}
        {displayedSources.length > 0 && (
          <div className="pt-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-2">External Sources</p>
            <div className="space-y-0">
              {displayedSources.map((source: any) => (
                <a
                  key={`${source.url}-${source.title}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block py-2 border-b border-dashed border-white/[0.06] last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <p className="text-sm text-white/70 line-clamp-1">
                    {source.title || source.url}
                  </p>
                  <p className="font-mono text-[10px] text-white/20 line-clamp-1 mt-0.5">
                    {source.url}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Research Notes */}
        {displayedNotes.length > 0 && (
          <div className="pt-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-2">Research Notes</p>
            <div className="space-y-0">
              {displayedNotes.map((note: string, index: number) => (
                <p
                  key={`${index}-${note.slice(0, 24)}`}
                  className="py-2 border-b border-dashed border-white/[0.06] last:border-0 text-sm text-white/70 leading-relaxed"
                >
                  {note}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
