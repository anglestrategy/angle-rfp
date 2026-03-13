import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useEffect } from "react";
import type { ReactNode } from "react";

/**
 * Animated page transitions using Framer Motion.
 * Wraps around the route Switch to provide fade + slide
 * transitions between pages.
 *
 * Also scrolls to top on route change — essential for
 * Lenis smooth scroll which retains scroll position.
 */

const pageVariants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuad
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.25,
      ease: [0.55, 0.06, 0.68, 0.19], // easeInCubic
    },
  },
};

/** Scroll to top whenever the route changes */
function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    // Use requestAnimationFrame to ensure it fires after Framer Motion
    // has mounted the new page and Lenis has updated
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }, [location]);

  return null;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <>
      <ScrollToTop />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="min-h-screen"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
