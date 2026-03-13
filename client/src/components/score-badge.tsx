import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getScoreColor(score: number) {
  if (score >= 85) return "text-green-400";
  if (score >= 70) return "text-blue-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function getScoreBg(score: number) {
  if (score >= 85) return "bg-green-400/10";
  if (score >= 70) return "bg-blue-400/10";
  if (score >= 50) return "bg-yellow-400/10";
  return "bg-red-400/10";
}

const sizeClasses = {
  sm: "text-sm px-2 py-0.5",
  md: "text-base px-3 py-1",
  lg: "text-lg px-4 py-1.5",
};

export function ScoreBadge({ score, size = "md", className }: ScoreBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-mono font-bold",
        getScoreColor(score),
        getScoreBg(score),
        sizeClasses[size],
        className
      )}
      data-testid="text-score-badge"
    >
      {score}
    </span>
  );
}

export { getScoreColor, getScoreBg };
