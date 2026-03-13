import { motion } from "framer-motion";

export function StaggerText({
  text,
  className = "",
  delayOffset = 0,
  charDelay = 0.05,
  fromDirection = "below",
}: {
  text: string;
  className?: string;
  delayOffset?: number;
  charDelay?: number;
  fromDirection?: "below" | "right";
}) {
  const chars = text.split("");
  const initial =
    fromDirection === "below"
      ? { opacity: 0, y: 40 }
      : { opacity: 0, x: 40 };
  const animate =
    fromDirection === "below"
      ? { opacity: 1, y: 0 }
      : { opacity: 1, x: 0 };

  return (
    <span className={`inline-flex ${className}`} aria-label={text}>
      {chars.map((char, i) => (
        <motion.span
          key={`${char}-${i}`}
          initial={initial}
          animate={animate}
          transition={{
            duration: 0.4,
            delay: delayOffset + i * charDelay,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block"
          style={{ whiteSpace: char === " " ? "pre" : undefined }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}
