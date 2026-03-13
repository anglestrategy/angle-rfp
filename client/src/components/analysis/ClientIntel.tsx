import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { humanize } from "@/lib/format-evidence";
import { staggerFast, staggerItemLeft } from "@/lib/motion";

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
      <Card>
        <CardContent className="pt-4 pb-4" data-testid="section-client-profile">
          <p className="section-heading">CLIENT INTELLIGENCE</p>
          <p className="text-sm text-muted-foreground italic">
            Client intelligence data not available
          </p>
        </CardContent>
      </Card>
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

  // Split into short (grid) and long (full-width) fields
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
    <Card>
      <CardContent className="pt-4 pb-4" data-testid="section-client-profile">
        <div className="flex items-center justify-between mb-2">
          <p className="panel-heading">Client Intelligence</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2.5 py-1 rounded-full bg-foreground/[0.04] text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
            {sourceType}
          </span>
          {avgConfidence != null && (
            <span className="px-2.5 py-1 rounded-full bg-primary/10 text-[10px] font-mono uppercase tracking-[0.08em] text-primary">
              {avgConfidence}% avg confidence
            </span>
          )}
          {sourceCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-[10px] font-mono uppercase tracking-[0.08em] text-emerald-600">
              {sourceCount} source{sourceCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <motion.div className="grid grid-cols-2 gap-x-6 gap-y-3" variants={staggerFast} initial="hidden" animate="visible">
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
              <motion.div key={field.label} variants={staggerItemLeft} className="border-b border-foreground/8 pb-2 row-hover rounded-md">
                <div className="flex items-center justify-between gap-2">
                  <p className="swiss-data-label">{field.label}</p>
                  {typeof confidence === "number" && (
                    <span className="font-mono text-[9px] text-muted-foreground/60">
                      {Math.round(confidence * 100)}%
                    </span>
                  )}
                </div>
                {raw ? (
                  <p className="swiss-data-value">{humanize(raw)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground/40">&mdash;</p>
                )}
              </motion.div>
            );
          })}
        </motion.div>

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
            <div key={field.label} className="border-b border-foreground/8 pb-2 mt-3 row-hover rounded-md">
              <div className="flex items-center justify-between gap-2">
                <p className="swiss-data-label">{field.label}</p>
                {confidence != null && (
                  <span className="font-mono text-[9px] text-muted-foreground/60">
                    {confidence}%
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {humanize(raw)}
              </p>
            </div>
          );
        })}

        {displayedSources.length > 0 && (
          <div className="mt-4 border-t border-foreground/8 pt-3">
            <p className="swiss-data-label mb-2">External Sources</p>
            <div className="space-y-2">
              {displayedSources.map((source: any) => (
                <a
                  key={`${source.url}-${source.title}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md border border-foreground/8 px-3 py-2 transition-colors hover:border-foreground/16 hover:bg-foreground/[0.02]"
                >
                  <p className="text-sm font-medium text-foreground line-clamp-1">
                    {source.title || source.url}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70 line-clamp-1">
                    {source.url}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}

        {displayedNotes.length > 0 && (
          <div className="mt-4 border-t border-foreground/8 pt-3">
            <p className="swiss-data-label mb-2">Research Notes</p>
            <div className="space-y-2">
              {displayedNotes.map((note: string, index: number) => (
                <p
                  key={`${index}-${note.slice(0, 24)}`}
                  className="rounded-md border border-foreground/8 px-3 py-2 text-sm leading-relaxed text-muted-foreground"
                >
                  {note}
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
