import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { staggerFast, staggerItem } from "@/lib/motion";

interface TimelineDate {
  date?: string;
  event?: string;
  description?: string;
  milestone?: string;
  label?: string;
  phase?: string; // "submission" | "project"
  [key: string]: any;
}

interface TimelinePanelProps {
  dates: TimelineDate[];
  overallDuration?: string;
  startDate?: string;
  endDate?: string;
  submissionDeadline?: string;
}

/* ── Helpers ── */

/** Detect if a date entry is about submission/RFP process vs project execution */
function isSubmissionDate(item: TimelineDate): boolean {
  // Explicit phase tag from AI
  if (item.phase === "submission") return true;
  if (item.phase === "project") return false;

  // Heuristic: check description for RFP-process-specific keywords.
  // Must be tight — "submit execution plan" is a PROJECT task, not RFP process.
  const text = [
    item.description,
    item.event,
    item.label,
    item.date,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // These phrases specifically mean "submitting the proposal/bid itself"
  const rfpPhrases = [
    "proposal submission", "proposal deadline", "proposal due",
    "bid submission", "bid deadline", "bid due",
    "rfp response", "rfp deadline", "rfp due",
    "submit proposal", "submit bid", "submit rfp",
    "submission deadline", "response deadline",
    "last day for question", "questions deadline", "q&a deadline",
    "q&a period", "clarification deadline", "clarification period",
    "pre-qualification", "pre-bid", "prebid",
    "shortlist", "shortlisting",
    "intent to bid", "intent to respond",
    "mandatory briefing", "bidder conference",
    "award notification", "contract award",
    "evaluation period", "evaluation committee",
    "site visit for bidder",
  ];

  return rfpPhrases.some((phrase) => text.includes(phrase));
}

/** Shorten verbose date strings for display */
function shortenDate(raw: string): string {
  if (!raw) return "—";

  let s = raw.trim();

  // Already short (e.g., "Feb 2026", "Week 3")
  if (s.length <= 20) return s;

  // Remove common filler phrases
  const fillers = [
    /^no more than\s*/i,
    /^within\s*/i,
    /^no later than\s*/i,
    /^at least\s*/i,
    /^approximately\s*/i,
    /^a maximum of\s*/i,
    /^a minimum of\s*/i,
  ];
  for (const re of fillers) s = s.replace(re, "");

  // Collapse "X calendar/business/working days after/before/prior to Y" → "X days post-Y" / "X days pre-Y"
  const daysPattern =
    /^(\d+)\s*(?:calendar|business|working)?\s*days?\s*(?:after|from|following)\s*(.+)$/i;
  const daysMatch = s.match(daysPattern);
  if (daysMatch) return `${daysMatch[1]}d post ${simplifyAnchor(daysMatch[2])}`;

  const daysPriorPattern =
    /^(\d+)\s*(?:calendar|business|working)?\s*days?\s*(?:before|prior to|ahead of)\s*(.+)$/i;
  const daysPriorMatch = s.match(daysPriorPattern);
  if (daysPriorMatch) return `${daysPriorMatch[1]}d pre ${simplifyAnchor(daysPriorMatch[2])}`;

  // Collapse "X weeks from/after Y" → "Xw post Y"
  const weeksPattern =
    /^(\d+)\s*weeks?\s*(?:from|after|following)\s*(.+)$/i;
  const weeksMatch = s.match(weeksPattern);
  if (weeksMatch) return `${weeksMatch[1]}w post ${simplifyAnchor(weeksMatch[2])}`;

  const weeksPriorPattern =
    /^(\d+)\s*weeks?\s*(?:before|prior to)\s*(.+)$/i;
  const weeksPriorMatch = s.match(weeksPriorPattern);
  if (weeksPriorMatch) return `${weeksPriorMatch[1]}w pre ${simplifyAnchor(weeksPriorMatch[2])}`;

  // If still long, truncate at 30 chars
  if (s.length > 30) return s.slice(0, 28) + "…";
  return s;
}

/** Simplify anchor phrases like "Contract Effective Date" → "signing" */
function simplifyAnchor(anchor: string): string {
  const a = anchor.trim().toLowerCase();
  if (a.includes("contract") && (a.includes("effective") || a.includes("signing") || a.includes("execution")))
    return "signing";
  if (a.includes("kick-off") || a.includes("kickoff"))
    return "kick-off";
  if (a.includes("project start") || a.includes("commencement"))
    return "start";
  if (a.includes("launch"))
    return "launch";
  if (a.includes("conclusion") || a.includes("completion"))
    return "completion";
  // Capitalize first word, cap at 15 chars
  const short = anchor.trim();
  return short.length > 15 ? short.slice(0, 13) + "…" : short;
}

/* ── Component ── */

export function TimelinePanel({
  dates,
  overallDuration,
  startDate,
  endDate,
  submissionDeadline,
}: TimelinePanelProps) {
  const { submissionDates, projectDates } = useMemo(() => {
    const sub: TimelineDate[] = [];
    const proj: TimelineDate[] = [];

    if (!dates || dates.length === 0) return { submissionDates: sub, projectDates: proj };

    for (const d of dates) {
      if (isSubmissionDate(d)) sub.push(d);
      else proj.push(d);
    }

    return { submissionDates: sub, projectDates: proj };
  }, [dates]);

  // Filter out non-real deadlines ("not specified", "TBD", "N/A", null-ish)
  const deadlineIsReal = !!submissionDeadline &&
    !/not\s*specified|n\/?a|tbd|tba|unknown|none|null/i.test(submissionDeadline);

  const hasSub = submissionDates.length > 0 || deadlineIsReal;
  const hasProj = projectDates.length > 0;
  const hasAnything = hasSub || hasProj || startDate || endDate;

  if (!hasAnything) {
    return (
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="mb-3">
            <p className="panel-heading">Key Dates</p>
          </div>
          <p className="text-sm text-muted-foreground italic">No key dates identified</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="panel-heading">Key Dates</p>
          {overallDuration && (
            <span className="font-mono text-xs text-muted-foreground">
              {overallDuration}
            </span>
          )}
        </div>

        {/* ── SUBMISSION / RFP PROCESS SECTION ── */}
        {hasSub && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary">
                RFP Process
              </span>
            </div>

            {/* Standalone submission deadline if not in dates */}
            {deadlineIsReal && (
              <div className="group flex items-center gap-3 py-2 border-b border-foreground/8 row-hover rounded-md">
                <span className="font-mono text-xs font-bold text-primary shrink-0 w-32 text-right">
                  {shortenDate(submissionDeadline)}
                </span>
                <span className="h-2 w-2 rounded-full bg-primary shrink-0 transition-transform duration-150 group-hover:scale-150" />
                <span className="text-sm font-medium">Proposal Submission Deadline</span>
              </div>
            )}

            {submissionDates.map((item, idx) => {
              const dateStr = item.date || item.milestone || "";
              const desc = item.description || item.event || item.label || "";
              const isDupe =
                submissionDeadline &&
                desc.toLowerCase().includes("submission") &&
                desc.toLowerCase().includes("deadline");
              if (isDupe) return null;

              return (
                <motion.div
                  key={`sub-${idx}`}
                  className="group flex items-center gap-3 py-2 border-b border-foreground/8 last:border-0 row-hover rounded-md"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05, ease: [0, 0, 0.2, 1] }}
                >
                  <span className="font-mono text-xs font-bold shrink-0 w-32 text-right">
                    {shortenDate(dateStr)}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-primary/40 shrink-0 transition-transform duration-150 group-hover:scale-150" />
                  <span className="text-sm text-muted-foreground">{desc}</span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── PROJECT MILESTONES SECTION ── */}
        {(hasProj || startDate || endDate) && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-foreground/[0.08] text-foreground">
                Project
              </span>
              {startDate && endDate && (
                <span className="font-mono text-[10px] text-muted-foreground ml-auto">
                  {startDate} → {endDate}
                </span>
              )}
            </div>

            {projectDates.map((item, idx) => {
              const dateStr = item.date || item.milestone || "";
              const desc =
                item.description || item.event || item.label || "";
              // Don't show row if desc is same as date (redundant)
              const showDesc = desc && desc !== dateStr;

              return (
                <motion.div
                  key={`proj-${idx}`}
                  className="group flex items-center gap-3 py-2 border-b border-foreground/8 last:border-0 row-hover rounded-md"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05, ease: [0, 0, 0.2, 1] }}
                >
                  <span className={cn(
                    "font-mono text-xs font-bold shrink-0 w-32 text-right",
                  )}>
                    {shortenDate(dateStr)}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-foreground/30 shrink-0 transition-transform duration-150 group-hover:scale-150" />
                  {showDesc && (
                    <span className="text-sm text-muted-foreground">{desc}</span>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
