import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { SpringCounter } from "@/components/ui/spring-counter";

function getScoreColor(s: number) {
  if (s >= 75) return "hsl(142 70% 45%)";
  if (s >= 50) return "hsl(var(--primary))";
  if (s >= 25) return "hsl(38 92% 50%)";
  return "hsl(0 72% 51%)";
}

function getRiskColor(risk: string): string {
  const lower = risk.toLowerCase();
  if (lower.includes("high") || lower.includes("critical")) return "text-red-400";
  if (lower.includes("moderate") || lower.includes("medium")) return "text-amber-400";
  return "text-emerald-400";
}

interface CommandStripProps {
  score: number;
  recommendation: string;
  clientName?: string;
  deadline?: string;
  budget?: string;
  industry?: string;
  riskLevel?: string;
  /** "hero" = score element for the top-right; "strip" = flat KPI data row */
  layout?: "hero" | "strip";
}

export function CommandStrip({
  score,
  recommendation,
  clientName,
  deadline,
  budget,
  industry,
  riskLevel,
  layout = "strip",
}: CommandStripProps) {
  const riskText = riskLevel || "Low";

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     HERO LAYOUT — Editorial typographic score
     Large number + thin bar + verdict label
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (layout === "hero") {
    const color = getScoreColor(score);
    const pct = Math.min(score, 100);

    return (
      <motion.div
        className="h-full flex flex-col items-end justify-center py-2 pl-6 pr-1"
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        {/* Label */}
        <span className="dash-metric-label mb-1.5">
          Fit Score
        </span>

        {/* Large typographic score */}
        <div className="flex items-baseline gap-1">
          <span
            className="text-[3.2rem] font-extrabold leading-none tracking-tighter tabular-nums"
            style={{ color }}
            data-testid="text-score"
          >
            <SpringCounter value={score} stiffness={120} damping={28} delay={200} />
          </span>
          <span className="text-base font-medium tracking-tight mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            /100
          </span>
        </div>

        {/* Thin progress bar */}
        <div className="w-full mt-2 mb-1.5">
          <div className="h-[2px] w-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            <motion.div
              className="h-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </div>
        </div>

        {/* Verdict */}
        <motion.span
          className="dash-metric-sub"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          style={{ color }}
        >
          {recommendation}
        </motion.span>
      </motion.div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     STRIP LAYOUT — 4-cell metric grid
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const deadlineDisplay = deadline || "Not specified";
  const hasBudget = budget && budget.toLowerCase() !== "not specified";
  const budgetDisplay = hasBudget ? budget : "\u2014";
  const industryDisplay = industry || "\u2014";

  return (
    <div className="dash-panel">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
        {/* ── Cell 1: Client ── */}
        <div className="px-7 py-6 md:border-r border-b md:border-b-0" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <p className="dash-metric-label">Client</p>
          <p className="dash-metric-value !text-xl">{clientName || "\u2014"}</p>
          <p className="dash-metric-sub">{industryDisplay}</p>
        </div>

        {/* ── Cell 2: Deadline ── */}
        <div className="px-7 py-6 md:border-r border-b md:border-b-0" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <p className="dash-metric-label">Deadline</p>
          <p className="dash-metric-value !text-xl">{deadlineDisplay}</p>
          <p className="dash-metric-sub">Submission deadline</p>
        </div>

        {/* ── Cell 3: Budget ── */}
        <div className="px-7 py-6 md:border-r border-b md:border-b-0" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <p className="dash-metric-label">Budget</p>
          <p className="dash-metric-value !text-xl">{budgetDisplay}</p>
          <p className="dash-metric-sub">{hasBudget ? "Total budget" : "Not specified"}</p>
        </div>

        {/* ── Cell 4: Risk ── */}
        <div className="px-7 py-6">
          <p className="dash-metric-label">Risk Level</p>
          <p className={cn("dash-metric-value !text-xl font-bold uppercase", getRiskColor(riskText))}>
            {riskText}
          </p>
          <p className="dash-metric-sub">Overall risk assessment</p>
        </div>
      </div>
    </div>
  );
}
