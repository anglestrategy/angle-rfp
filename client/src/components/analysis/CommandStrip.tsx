import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { SpringCounter } from "@/components/ui/spring-counter";
import { ShimmerBar } from "@/components/ui/shimmer-bar";

function getScoreColor(s: number) {
  if (s >= 75) return "hsl(142 70% 45%)";
  if (s >= 50) return "hsl(var(--primary))";
  if (s >= 25) return "hsl(38 92% 50%)";
  return "hsl(0 72% 51%)";
}

function getRiskColor(risk: string): string {
  const lower = risk.toLowerCase();
  if (lower.includes("high") || lower.includes("critical")) return "text-red-500";
  if (lower.includes("moderate") || lower.includes("medium")) return "text-amber-500";
  return "text-emerald-500";
}

function getRiskDotColor(risk: string): string {
  const lower = risk.toLowerCase();
  if (lower.includes("high") || lower.includes("critical")) return "bg-red-500";
  if (lower.includes("moderate") || lower.includes("medium")) return "bg-amber-500";
  return "bg-emerald-500";
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
        <span className="metric-label mb-1.5 text-muted-foreground/50">
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
          <span className="text-base font-medium text-muted-foreground/30 tracking-tight mb-1">
            /100
          </span>
        </div>

        {/* Thin progress bar */}
        <div className="w-full mt-2 mb-1.5">
          <div className="h-[2px] w-full rounded-full bg-foreground/[0.04] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </div>
        </div>

        {/* Verdict */}
        <motion.span
          className="text-[10px] font-bold tracking-[0.1em] uppercase"
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
     STRIP LAYOUT — Flat typographic data row
     No cards — just clean data blocks with dividers
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const deadlineDisplay = deadline || "Not specified in document";
  const hasBudget = budget && budget.toLowerCase() !== "not specified";
  const secondaryLabel = hasBudget ? "Budget" : "Industry";
  const secondaryValue = hasBudget ? budget : (industry || "\u2014");

  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-[var(--glass-border)] rounded-xl overflow-hidden bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* ── Cell 1: Client ── */}
      <div className="px-5 py-3.5 md:border-r border-b md:border-b-0 border-[var(--glass-border)]">
        <p className="metric-label mb-1">Client</p>
        <p
          className="text-sm font-semibold tracking-tight leading-snug break-words line-clamp-1"
          title={clientName || "Unknown"}
        >
          {clientName || "\u2014"}
        </p>
        <div className="flex items-baseline gap-2 mt-1.5">
          <span className="metric-label !text-[9px]">{secondaryLabel}</span>
          <span className="text-xs text-muted-foreground truncate">{secondaryValue}</span>
        </div>
      </div>

      {/* ── Cell 2: Deadline ── */}
      <div className="px-5 py-3.5 md:border-r border-b md:border-b-0 border-[var(--glass-border)]">
        <p className="metric-label mb-1" style={{ color: "hsl(var(--primary) / 0.7)" }}>
          Deadline
        </p>
        <p className="text-sm font-semibold tracking-tight leading-snug">
          {deadlineDisplay}
        </p>
        <ShimmerBar value={33} delay={0.4} height="h-[3px]" className="mt-2" showGlow={false} />
        <p className="metric-label mt-1" style={{ color: "hsl(var(--primary) / 0.5)" }}>
          Submission Deadline
        </p>
      </div>

      {/* ── Cell 3: Risk ── */}
      <div className="px-5 py-3.5">
        <p className="metric-label mb-1">Risk Level</p>
        <div className="flex items-center gap-2 mb-1">
          <motion.div
            className={cn("h-2 w-2 rounded-full", getRiskDotColor(riskText))}
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <p className={cn("text-sm font-bold uppercase tracking-tight", getRiskColor(riskText))}>
            {riskText}
          </p>
        </div>
        <p className="text-[10px] text-muted-foreground mb-1.5">Overall risk assessment</p>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => {
            const isActive = riskText.toLowerCase().includes("critical")
              ? true
              : riskText.toLowerCase().includes("high")
                ? i < 2
                : riskText.toLowerCase().includes("med") || riskText.toLowerCase().includes("moderate")
                  ? i < 1
                  : false;
            return (
              <ShimmerBar
                key={i}
                value={isActive ? 100 : 0}
                delay={0.3 + i * 0.1}
                height="h-1"
                color={isActive ? getRiskDotColor(riskText).replace("bg-", "bg-") : "bg-foreground/8"}
                showGlow={false}
                className="flex-1"
              />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
