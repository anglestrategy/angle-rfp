import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface ShimmerBarProps {
  value: number;
  className?: string;
  delay?: number;
  color?: string;
  height?: string;
  showGlow?: boolean;
}

export function ShimmerBar({
  value,
  className,
  delay = 0,
  color = "bg-primary",
  height = "h-1.5",
  showGlow = true,
}: ShimmerBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });

  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {/* Track */}
      <div
        className={cn(
          "w-full rounded-full bg-muted/50 overflow-hidden",
          height
        )}
      >
        {/* Animated fill */}
        <motion.div
          className={cn("h-full rounded-full relative overflow-hidden", color)}
          initial={{ width: 0 }}
          animate={isInView ? { width: `${clamped}%` } : { width: 0 }}
          transition={{
            duration: 0.8,
            delay,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          {/* Shimmer overlay */}
          <div
            className="shimmer-sweep absolute inset-0 rounded-full"
            style={{ animationDelay: `${delay + 0.8}s` }}
          />
        </motion.div>
      </div>

      {/* Glow effect */}
      {showGlow && (
        <motion.div
          className={cn(
            "absolute top-0 left-0 rounded-full blur-md opacity-30",
            color,
            height
          )}
          initial={{ width: 0 }}
          animate={isInView ? { width: `${clamped}%` } : { width: 0 }}
          transition={{
            duration: 0.8,
            delay,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        />
      )}

      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .shimmer-sweep {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.15) 45%,
            rgba(255, 255, 255, 0.25) 50%,
            rgba(255, 255, 255, 0.15) 55%,
            transparent 100%
          );
          animation: shimmer 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
