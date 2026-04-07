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
          <span className="dash-panel-title">Client Profile</span>
        </div>
        <div className="dash-panel-body" data-testid="section-client-profile">
          <p className="text-sm italic" style={{ color: "rgba(255,255,255,0.4)" }}>
            Client intelligence data not available
          </p>
        </div>
      </div>
    );
  }

  const entityType = clientInfo.entityType || null;

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

  const entityBadge = entityType ? resolveValue(entityType) : sourceType;

  return (
    <div className="dash-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">Client Profile</span>
        {entityBadge && (
          <span className="dash-panel-badge">{entityBadge}</span>
        )}
      </div>

      <div className="dash-panel-body" data-testid="section-client-profile">
        {/* Source meta badges */}
        {(avgConfidence != null || sourceCount > 0) && (
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {avgConfidence != null && (
              <span className="dash-panel-badge">{avgConfidence}% avg confidence</span>
            )}
            {sourceCount > 0 && (
              <span className="dash-panel-badge">{sourceCount} source{sourceCount === 1 ? "" : "s"}</span>
            )}
          </div>
        )}

        {/* 2-column key-value grid with dashed dividers */}
        <div className="grid grid-cols-2 gap-x-8">
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
                className="py-3.5"
                style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="dash-metric-label !mb-1">{field.label}</p>
                  {typeof confidence === "number" && (
                    <span className="font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {Math.round(confidence * 100)}%
                    </span>
                  )}
                </div>
                {raw ? (
                  <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>{humanize(raw)}</p>
                ) : (
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>&mdash;</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Long-text fields rendered full-width below the grid */}
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
            <div
              key={field.label}
              className="py-3.5 mt-2"
              style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="dash-metric-label !mb-1">{field.label}</p>
                {confidence != null && (
                  <span className="font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {confidence}%
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed line-clamp-3" style={{ color: "rgba(255,255,255,0.5)" }}>
                {humanize(raw)}
              </p>
            </div>
          );
        })}

        {/* External sources */}
        {displayedSources.length > 0 && (
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <p className="dash-metric-label mb-3">External Sources</p>
            <div className="space-y-2">
              {displayedSources.map((source: any) => (
                <a
                  key={`${source.url}-${source.title}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block px-3 py-2 transition-colors"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p className="text-sm font-medium line-clamp-1" style={{ color: "rgba(255,255,255,0.9)" }}>
                    {source.title || source.url}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] line-clamp-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {source.url}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Research notes */}
        {displayedNotes.length > 0 && (
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <p className="dash-metric-label mb-3">Research Notes</p>
            <div className="space-y-2">
              {displayedNotes.map((note: string, index: number) => (
                <p
                  key={`${index}-${note.slice(0, 24)}`}
                  className="px-3 py-2 text-sm leading-relaxed"
                  style={{ border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
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
