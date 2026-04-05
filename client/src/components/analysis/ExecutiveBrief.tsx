import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface ExecutiveBriefProps {
  projectTitle?: string;
  executiveSummary?: string;
  rationale?: string;
  industry?: string;
  duration?: string;
  deliverableCount?: number;
  budget?: string;
  fileName?: string;
  createdAt?: string | Date | null;
  recommendation?: string;
  budgetAdequacy?: {
    status?: string;
    summary?: string;
  };
  pitchCostEstimate?: {
    effortLevel?: string;
    estimatedHoursRange?: string;
    summary?: string;
  };
  submissionComplexity?: {
    level?: string;
    requirementsCount?: number;
    summary?: string;
  };
}

export function ExecutiveBrief({
  projectTitle,
  executiveSummary,
  rationale,
  fileName,
  createdAt,
  recommendation,
  budgetAdequacy,
  pitchCostEstimate,
  submissionComplexity,
}: ExecutiveBriefProps) {
  const [expanded, setExpanded] = useState(false);
  const hasTitle = !!projectTitle;
  const hasSummary = !!executiveSummary;

  if (!hasTitle && !hasSummary) {
    return null;
  }

  const summaryText = executiveSummary || "";

  const formattedTime = createdAt
    ? (() => {
        try {
          return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
        } catch {
          return null;
        }
      })()
    : null;

  const insightTiles = [
    {
      label: "Bid posture",
      value: recommendation || "Pending",
      detail: rationale || "Primary recommendation generated from scope, risk, and commercial signals.",
    },
    {
      label: "Budget adequacy",
      value:
        budgetAdequacy?.status === "likely_viable"
          ? "Likely viable"
          : budgetAdequacy?.status === "under_scoped"
            ? "Under-scoped"
            : "Unclear",
      detail:
        budgetAdequacy?.summary ||
        "Budget viability has not been resolved yet.",
    },
    {
      label: "Pursuit cost",
      value:
        pitchCostEstimate?.estimatedHoursRange ||
        pitchCostEstimate?.effortLevel ||
        "Not estimated",
      detail:
        pitchCostEstimate?.summary ||
        "Estimated effort required to qualify and prepare the bid.",
    },
    {
      label: "Submission load",
      value:
        submissionComplexity?.level
          ? `${submissionComplexity.level}${typeof submissionComplexity.requirementsCount === "number" ? ` · ${submissionComplexity.requirementsCount} reqs` : ""}`
          : "Not assessed",
      detail:
        submissionComplexity?.summary ||
        "Submission complexity has not been assessed yet.",
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center py-2">
      {/* Status line */}
      <div className="flex items-center gap-2 mb-2">
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ boxShadow: "0 0 6px rgba(52, 211, 153, 0.4)" }}
        />
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
          Open RFP
          {fileName && <> &mdash; {fileName}</>}
          {formattedTime && <> &mdash; {formattedTime}</>}
        </span>
      </div>

      {/* Title — clean, no decorative bars */}
      {hasTitle && (
        <h1 className="text-xl md:text-2xl lg:text-[1.7rem] font-extrabold tracking-tight leading-[1.2] mb-1">
          <span className="line-clamp-2">{projectTitle}</span>
        </h1>
      )}

      {/* Summary — collapsed by default, expandable */}
      {summaryText && (
        <div className="mt-1.5">
          <p
            className={`text-[13px] text-muted-foreground leading-relaxed max-w-3xl transition-all duration-300 ${
              expanded ? "" : "line-clamp-2"
            }`}
          >
            {summaryText}
          </p>
          {summaryText.length > 150 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-1 text-[11px] font-medium text-primary/60 hover:text-primary transition-colors"
            >
              {expanded ? "Show less" : "Read more"}
              <ChevronDown
                className={`h-3 w-3 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {insightTiles.map((tile) => (
          <div
            key={tile.label}
            className="border border-white/[0.06] bg-[#050505] px-3 py-3"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
              {tile.label}
            </p>
            <p className="mt-1 text-sm font-semibold leading-tight">{tile.value}</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {tile.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
