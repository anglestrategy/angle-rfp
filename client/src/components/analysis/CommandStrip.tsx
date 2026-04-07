import { motion } from "framer-motion";
import { SpringCounter } from "@/components/ui/spring-counter";

function getScoreColor(s: number) {
  if (s >= 75) return "hsl(142 70% 45%)";
  if (s >= 50) return "hsl(var(--primary))";
  if (s >= 25) return "hsl(38 92% 50%)";
  return "hsl(0 72% 51%)";
}

interface CommandStripProps {
  score: number;
  recommendation: string;
  clientName?: string;
  deadline?: string;
  budget?: string;
  industry?: string;
  riskLevel?: string;
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
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/40 mb-1.5">
          Fit Score
        </span>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[3.2rem] font-extrabold leading-none tracking-tighter tabular-nums"
            style={{ color }}
            data-testid="text-score"
          >
            <SpringCounter value={score} stiffness={120} damping={28} delay={200} />
          </span>
          <span className="text-base font-medium text-white/25 tracking-tight mb-1">
            /100
          </span>
        </div>
        <div className="w-full mt-2 mb-1.5">
          <div className="h-[2px] w-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </div>
        </div>
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

  /* ── STRIP LAYOUT ── */
  const deadlineDisplay = deadline || "Not specified";
  const hasBudget = budget && budget.toLowerCase() !== "not specified";

  const cells = [
    {
      label: "Client",
      value: clientName || "Unknown",
      sub: industry || undefined,
    },
    {
      label: "Deadline",
      value: deadlineDisplay,
    },
    {
      label: "Budget",
      value: hasBudget ? budget! : "Not disclosed",
    },
    {
      label: "Risk level",
      value: riskText,
    },
  ];

  return (
    <motion.div
      className="dash-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={`px-5 py-4 ${i < cells.length - 1 ? "border-r border-white/[0.06]" : ""} ${i < 2 ? "border-b md:border-b-0 border-white/[0.06]" : ""}`}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35 mb-1.5">
              {cell.label}
            </p>
            <p className="text-sm font-semibold tracking-tight leading-snug text-white">
              {cell.value}
            </p>
            {cell.sub && (
              <p className="text-[11px] text-white/40 mt-1">{cell.sub}</p>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
