import {
  CollapsibleGroup,
  CollapsibleGroupSection,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible-section";

interface SubmissionPanelProps {
  submission: Record<string, any>;
}

function normalizeList(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
}

export function SubmissionPanel({ submission }: SubmissionPanelProps) {
  if (!submission) return null;

  const deadline = submission.deadline || submission.submissionDeadline || null;
  const format = submission.format || submission.submissionFormat || null;
  const method = submission.method || submission.submissionMethod || null;
  const contact =
    submission.contactPerson ||
    submission.contact ||
    submission.contactInfo ||
    null;
  const contactEmail =
    submission.contactEmail || submission.email || null;
  const requiredDocuments = normalizeList(
    submission.requiredDocuments ||
      submission.documents ||
      submission.requiredDocs,
  );
  const specialInstructions = normalizeList(
    submission.specialInstructions ||
      submission.instructions ||
      submission.additionalRequirements,
  );

  const hasContent =
    deadline || format || requiredDocuments.length > 0;

  if (!hasContent) return null;

  return (
    <div className="dash-panel">
      <div className="dash-panel-header">
        <span className="dash-panel-title">Submission Requirements</span>
      </div>

      <div className="dash-panel-body">
        {/* Labeled rows with dashed dividers */}
        {deadline && (
          <div className="dash-data-row" style={{ display: "block" }}>
            <p className="dash-metric-label">Deadline</p>
            <p className="text-sm font-semibold" style={{ color: "#ff5a36" }}>
              {String(deadline)}
            </p>
          </div>
        )}

        {format && (
          <div className="dash-data-row" style={{ display: "block" }}>
            <p className="dash-metric-label">Format</p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>{String(format)}</p>
          </div>
        )}

        {method && (
          <div className="dash-data-row" style={{ display: "block" }}>
            <p className="dash-metric-label">Method</p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>{String(method)}</p>
          </div>
        )}

        {(contact || contactEmail) && (
          <div className="dash-data-row" style={{ display: "block" }}>
            <p className="dash-metric-label">Contact</p>
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
              {contact && typeof contact === "object"
                ? contact.name || JSON.stringify(contact)
                : contact || ""}
              {contact && contactEmail ? " \u2014 " : ""}
              {contactEmail ? String(contactEmail) : ""}
            </p>
          </div>
        )}

        {/* Collapsible sections for long lists */}
        {(requiredDocuments.length > 0 || specialInstructions.length > 0) && (
          <CollapsibleGroup type="multiple" defaultValue={["documents"]}>
            {requiredDocuments.length > 0 && (
              <CollapsibleGroupSection value="documents">
                <CollapsibleTrigger className="py-3 hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>Required Documents</span>
                    <span className="dash-panel-badge">{requiredDocuments.length}</span>
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div data-lenis-prevent className="max-h-[340px] overflow-y-auto overscroll-contain">
                    {requiredDocuments.map((doc: any, idx: number) => {
                      const docText =
                        typeof doc === "string"
                          ? doc
                          : doc.name || doc.document || doc.title || String(doc);
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 py-3"
                          style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)" }}
                        >
                          <span className="font-mono text-[10px] w-4 text-right shrink-0 tabular-nums pt-[2px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                            {idx + 1}
                          </span>
                          <span className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>{docText}</span>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </CollapsibleGroupSection>
            )}

            {specialInstructions.length > 0 && (
              <CollapsibleGroupSection value="instructions">
                <CollapsibleTrigger className="py-3 hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>Special Instructions</span>
                    <span className="dash-panel-badge">{specialInstructions.length}</span>
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div data-lenis-prevent className="max-h-[340px] overflow-y-auto overscroll-contain">
                    {specialInstructions.map((inst: any, idx: number) => {
                      const instText =
                        typeof inst === "string"
                          ? inst
                          : inst.instruction ||
                            inst.description ||
                            inst.text ||
                            String(inst);
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 py-3"
                          style={{ borderBottom: "1px dashed rgba(255,255,255,0.06)" }}
                        >
                          <span className="w-1 h-1 bg-amber-400 shrink-0 mt-[6px]" />
                          <span className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>{instText}</span>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </CollapsibleGroupSection>
            )}
          </CollapsibleGroup>
        )}
      </div>
    </div>
  );
}
