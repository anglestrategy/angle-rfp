/**
 * Motion — Shared animation primitives for awwwards-level UI
 *
 * Uses Framer Motion variants + GSAP transition presets.
 * All durations follow the 200-400ms sweet spot for UI animations.
 * Springs use physics-based configs for natural interruptibility.
 */

import type { Variants, Transition } from "framer-motion";

/* ── Spring Presets ────────────────────────────────────── */

export const springs = {
  /** Snappy, responsive — buttons, toggles */
  snappy: { type: "spring", stiffness: 500, damping: 30 } as const,
  /** Bouncy — notifications, badges, score rings */
  bouncy: { type: "spring", stiffness: 400, damping: 17 } as const,
  /** Smooth — cards, panels, page transitions */
  smooth: { type: "spring", stiffness: 300, damping: 26 } as const,
  /** Gentle — background elements, slow reveals */
  gentle: { type: "spring", stiffness: 150, damping: 20 } as const,
  /** Stiff — micro-interactions, quick feedback */
  stiff: { type: "spring", stiffness: 700, damping: 35 } as const,
} satisfies Record<string, Transition>;

/* ── Easing Presets ────────────────────────────────────── */

export const easings = {
  /** Material Design standard curve */
  standard: [0.4, 0.0, 0.2, 1] as [number, number, number, number],
  /** Fast in, slow out — entering elements */
  decelerate: [0.0, 0.0, 0.2, 1] as [number, number, number, number],
  /** Slow in, fast out — exiting elements */
  accelerate: [0.4, 0.0, 1, 1] as [number, number, number, number],
  /** Apple-style smooth ease */
  apple: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
  /** Dramatic editorial entrance */
  editorial: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

/* ── Variants: Card/Container Reveals ──────────────────── */

/** Fade up from below — main card entrance */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: easings.editorial },
  },
};

/** Fade in from left — sidebar content */
export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: easings.decelerate },
  },
};

/** Scale up from center — modals, popovers */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: easings.editorial },
  },
};

/* ── Variants: Staggered Children ──────────────────────── */

/** Parent container that staggers children */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

/** Fast stagger for data-dense lists */
export const staggerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
};

/** Child item — slides up with fade */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: easings.decelerate },
  },
};

/** Child item — slides in from left */
export const staggerItemLeft: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: easings.decelerate },
  },
};

/** Child item with subtle scale */
export const staggerItemScale: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.4, ease: easings.editorial },
  },
};

/* ── Variants: Row-level dashboard sections ────────────── */

/** Dashboard row — staggered card grid entrance */
export const dashboardRow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

/** Individual card in a dashboard grid */
export const dashboardCard: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: easings.editorial },
  },
};

/* ── Variants: Micro-interactions ──────────────────────── */

/** Hover lift — cards */
export const hoverLift: Variants = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -2,
    scale: 1.01,
    transition: springs.snappy,
  },
};

/** Button press */
export const buttonPress: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.97 },
};

/** Badge pop-in */
export const badgePop: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springs.bouncy,
  },
};

/* ── Variants: Progress bars ───────────────────────────── */

export const progressBar = (width: number, delay = 0): Variants => ({
  hidden: { width: 0, opacity: 0.5 },
  visible: {
    width: `${width}%`,
    opacity: 1,
    transition: {
      width: { duration: 0.8, delay, ease: easings.editorial },
      opacity: { duration: 0.3, delay },
    },
  },
});

/* ── Viewport trigger defaults ─────────────────────────── */

export const viewportOnce = {
  once: true,
  margin: "-60px" as any,
};

export const viewportRepeat = {
  once: false,
  amount: 0.3,
  margin: "-40px" as any,
};

/* ── Transition presets ────────────────────────────────── */

export const transitions = {
  /** Default page/section entrance */
  entrance: { duration: 0.6, ease: easings.editorial } as Transition,
  /** Fast micro-interaction */
  micro: { duration: 0.2, ease: easings.standard } as Transition,
  /** Slow dramatic reveal */
  dramatic: { duration: 0.8, ease: easings.editorial } as Transition,
  /** Layout shift */
  layout: { type: "spring", stiffness: 300, damping: 30 } as Transition,
};
