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
}

export function ExecutiveBrief({
  projectTitle,
  executiveSummary,
  fileName,
  createdAt,
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
    </div>
  );
}
