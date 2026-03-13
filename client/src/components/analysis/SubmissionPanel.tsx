import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  CollapsibleGroup,
  CollapsibleGroupSection,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible-section";
import { staggerFast, staggerItemLeft } from "@/lib/motion";

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
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="panel-heading">Submission Requirements</p>
        </div>

        {deadline && (
          <div className="border-l-2 border-l-primary pl-3 py-2 mb-4 bg-primary/5 rounded-r-lg">
            <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/60 mb-0.5">Deadline</p>
            <p className="text-sm font-semibold text-primary">
              {String(deadline)}
            </p>
          </div>
        )}

        {(format || method) && (
          <div className="grid grid-cols-1 gap-2 mb-4">
            {format && (
              <div className="px-3 py-2 rounded-lg bg-foreground/[0.03] border border-foreground/6">
                <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/60 mb-0.5">Format</p>
                <p className="text-xs leading-relaxed">{String(format)}</p>
              </div>
            )}
            {method && (
              <div className="px-3 py-2 rounded-lg bg-foreground/[0.03] border border-foreground/6">
                <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/60 mb-0.5">Method</p>
                <p className="text-xs leading-relaxed">{String(method)}</p>
              </div>
            )}
          </div>
        )}

        {(contact || contactEmail) && (
          <div className="mb-4 border-b border-foreground/8 pb-3">
            <p className="swiss-data-label">Contact</p>
            <p className="text-sm font-medium">
              {contact && typeof contact === "object"
                ? contact.name || JSON.stringify(contact)
                : contact || ""}
              {contact && contactEmail ? " — " : ""}
              {contactEmail ? String(contactEmail) : ""}
            </p>
          </div>
        )}

        {/* Collapsible sections for long lists */}
        {(requiredDocuments.length > 0 || specialInstructions.length > 0) && (
          <CollapsibleGroup type="multiple" defaultValue={["documents"]}>
            {requiredDocuments.length > 0 && (
              <CollapsibleGroupSection value="documents" className="border-b border-foreground/8">
                <CollapsibleTrigger className="py-2.5 hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="swiss-data-label !mb-0">Required Documents</span>
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      {requiredDocuments.length}
                    </span>
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <motion.div data-lenis-prevent className="max-h-[340px] overflow-y-auto overscroll-contain space-y-0" variants={staggerFast} initial="hidden" animate="visible">
                    {requiredDocuments.map((doc: any, idx: number) => {
                      const docText =
                        typeof doc === "string"
                          ? doc
                          : doc.name || doc.document || doc.title || String(doc);
                      return (
                        <motion.div key={idx} variants={staggerItemLeft} className="flex items-start gap-2.5 py-1.5 border-b border-foreground/6 last:border-0 row-hover rounded-md">
                          <span className="font-mono text-[10px] text-muted-foreground/50 w-4 text-right shrink-0 tabular-nums pt-[2px]">
                            {idx + 1}
                          </span>
                          <span className="text-xs leading-relaxed">{docText}</span>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </CollapsibleContent>
              </CollapsibleGroupSection>
            )}

            {specialInstructions.length > 0 && (
              <CollapsibleGroupSection value="instructions" className="border-b-0">
                <CollapsibleTrigger className="py-2.5 hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="swiss-data-label !mb-0">Special Instructions</span>
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      {specialInstructions.length}
                    </span>
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <motion.div data-lenis-prevent className="max-h-[340px] overflow-y-auto overscroll-contain space-y-0" variants={staggerFast} initial="hidden" animate="visible">
                    {specialInstructions.map((inst: any, idx: number) => {
                      const instText =
                        typeof inst === "string"
                          ? inst
                          : inst.instruction ||
                            inst.description ||
                            inst.text ||
                            String(inst);
                      return (
                        <motion.div key={idx} variants={staggerItemLeft} className="flex items-start gap-2.5 py-1.5 border-b border-foreground/6 last:border-0 row-hover rounded-md">
                          <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0 mt-[6px]" />
                          <span className="text-xs leading-relaxed">{instText}</span>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </CollapsibleContent>
              </CollapsibleGroupSection>
            )}
          </CollapsibleGroup>
        )}
      </CardContent>
    </Card>
  );
}
