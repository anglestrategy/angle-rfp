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
        <span className="dash-panel-title">SUBMISSION REQUIREMENTS</span>
      </div>
      <div className="dash-panel-body">
        {deadline && (
          <div className="py-3 border-b border-dashed border-white/[0.06]">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-1">Deadline</p>
            <p className="text-sm font-bold text-white/90">{String(deadline)}</p>
          </div>
        )}

        {format && (
          <div className="py-3 border-b border-dashed border-white/[0.06]">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-1">Format</p>
            <p className="text-sm text-white/70">{String(format)}</p>
          </div>
        )}

        {method && (
          <div className="py-3 border-b border-dashed border-white/[0.06]">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-1">Method</p>
            <p className="text-sm text-white/70">{String(method)}</p>
          </div>
        )}

        {(contact || contactEmail) && (
          <div className="py-3 border-b border-dashed border-white/[0.06]">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-1">Contact</p>
            <p className="text-sm text-white/70">
              {contact && typeof contact === "object"
                ? contact.name || JSON.stringify(contact)
                : contact || ""}
              {contact && contactEmail ? " — " : ""}
              {contactEmail ? String(contactEmail) : ""}
            </p>
          </div>
        )}

        {requiredDocuments.length > 0 && (
          <div className="py-3 border-b border-dashed border-white/[0.06]">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-2">
              Required Documents
              <span className="ml-2 text-white/20">{requiredDocuments.length}</span>
            </p>
            <div className="space-y-0">
              {requiredDocuments.map((doc: any, idx: number) => {
                const docText =
                  typeof doc === "string"
                    ? doc
                    : doc.name || doc.document || doc.title || String(doc);
                return (
                  <div key={idx} className="flex items-start gap-2.5 py-1.5">
                    <span className="font-mono text-[10px] text-white/20 w-4 text-right shrink-0 tabular-nums pt-[2px]">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-white/70 leading-relaxed">{docText}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {specialInstructions.length > 0 && (
          <div className="py-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-2">
              Special Instructions
              <span className="ml-2 text-white/20">{specialInstructions.length}</span>
            </p>
            <div className="space-y-0">
              {specialInstructions.map((inst: any, idx: number) => {
                const instText =
                  typeof inst === "string"
                    ? inst
                    : inst.instruction ||
                      inst.description ||
                      inst.text ||
                      String(inst);
                return (
                  <div key={idx} className="flex items-start gap-2.5 py-1.5">
                    <span className="w-1 h-1 bg-white/20 shrink-0 mt-[6px]" />
                    <span className="text-sm text-white/70 leading-relaxed">{instText}</span>
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
