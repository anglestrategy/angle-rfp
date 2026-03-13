import { motion } from "framer-motion";

/* ═══════════════════════════════════════════════════════════
   AURORA ORBS — Subtle ambient gradient orbs for dark mode

   Extremely soft, barely-perceptible floating gradient blobs
   that add atmospheric depth behind content. Uses Framer
   Motion for smooth, organic drifting animation.

   Each orb uses heavy blur + very low opacity so the effect
   is felt rather than seen — warm tonal shifts in the
   background that reward slow attention.
   ═══════════════════════════════════════════════════════════ */

interface OrbConfig {
  /** CSS width/height */
  size: number;
  /** CSS blur filter in px */
  blur: number;
  /** 0-1 opacity */
  opacity: number;
  /** CSS gradient string */
  gradient: string;
  /** Tailwind-style position classes */
  position: string;
  /** x drift range in px */
  driftX: number;
  /** y drift range in px */
  driftY: number;
  /** animation cycle duration in seconds */
  duration: number;
  /** animation start delay in seconds */
  delay: number;
  /** scale range: [min, max] */
  scale: [number, number];
}

const ORBS: OrbConfig[] = [
  {
    // Top-left — warm orange glow
    size: 380,
    blur: 110,
    opacity: 0.06,
    gradient:
      "radial-gradient(circle, rgba(234,120,50,0.8) 0%, rgba(217,160,60,0.4) 40%, transparent 70%)",
    position: "top-[5%] left-[-5%]",
    driftX: 40,
    driftY: 35,
    duration: 22,
    delay: 0,
    scale: [0.92, 1.08],
  },
  {
    // Center-right — amber/rose blend
    size: 320,
    blur: 100,
    opacity: 0.05,
    gradient:
      "radial-gradient(circle, rgba(245,158,80,0.7) 0%, rgba(220,90,80,0.35) 45%, transparent 70%)",
    position: "top-[35%] right-[-8%]",
    driftX: 30,
    driftY: 50,
    duration: 18,
    delay: 3,
    scale: [0.9, 1.1],
  },
  {
    // Bottom-left — deep warm ember
    size: 400,
    blur: 120,
    opacity: 0.04,
    gradient:
      "radial-gradient(circle, rgba(200,100,60,0.75) 0%, rgba(180,80,50,0.3) 40%, transparent 70%)",
    position: "bottom-[5%] left-[10%]",
    driftX: 50,
    driftY: 25,
    duration: 25,
    delay: 7,
    scale: [0.93, 1.07],
  },
  {
    // Top-right — subtle golden haze
    size: 260,
    blur: 90,
    opacity: 0.045,
    gradient:
      "radial-gradient(circle, rgba(250,180,80,0.65) 0%, rgba(230,130,70,0.25) 45%, transparent 70%)",
    position: "top-[10%] right-[15%]",
    driftX: 25,
    driftY: 45,
    duration: 20,
    delay: 11,
    scale: [0.95, 1.05],
  },
];

export function AuroraOrbs({ className = "" }: { className?: string }) {
  return (
    <div
      className={`fixed inset-0 z-0 pointer-events-none overflow-hidden print:hidden ${className}`}
      aria-hidden="true"
    >
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${orb.position}`}
          style={{
            width: orb.size,
            height: orb.size,
            background: orb.gradient,
            filter: `blur(${orb.blur}px)`,
            opacity: orb.opacity,
            willChange: "transform",
          }}
          animate={{
            x: [0, orb.driftX, -orb.driftX * 0.6, orb.driftX * 0.3, 0],
            y: [0, -orb.driftY * 0.7, orb.driftY, -orb.driftY * 0.4, 0],
            scale: [
              orb.scale[0],
              orb.scale[1],
              orb.scale[0],
              orb.scale[1],
              orb.scale[0],
            ],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
