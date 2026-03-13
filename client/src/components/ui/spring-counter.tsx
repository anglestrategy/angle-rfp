import { useSpring, useTransform, motion, useMotionValue } from "framer-motion";
import { useEffect, useRef } from "react";
import { useInView } from "framer-motion";

interface SpringCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
  delay?: number;
  stiffness?: number;
  damping?: number;
}

export function SpringCounter({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  className,
  delay = 0,
  stiffness = 100,
  damping = 30,
}: SpringCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  const motionValue = useMotionValue(0);

  const springValue = useSpring(motionValue, {
    stiffness,
    damping,
    mass: 1,
  });

  const displayed = useTransform(springValue, (current) => {
    const clamped = decimals === 0 ? Math.round(current) : current;
    const formatted =
      Math.abs(clamped) > 999
        ? clamped.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : clamped.toFixed(decimals);
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    if (!isInView) return;

    if (delay > 0) {
      const timeout = setTimeout(() => {
        motionValue.set(value);
      }, delay);
      return () => clearTimeout(timeout);
    }

    motionValue.set(value);
  }, [isInView, value, delay, motionValue]);

  return <motion.span ref={ref} className={className}>{displayed}</motion.span>;
}
