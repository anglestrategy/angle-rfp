import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { gsap } from "gsap";

gsap.registerPlugin(ScrollTrigger);

/** Pages where Lenis smooth scroll should be active */
const LENIS_PATHS = ["/"];

/**
 * Initialises Lenis smooth scroll synced with GSAP ScrollTrigger.
 *
 * Follows the official Lenis + GSAP integration pattern:
 * https://github.com/darkroomengineering/lenis#gsap-integration
 *
 * Key additions for ScrollTrigger pin compatibility:
 *
 * • naiveDimensions: true — Forces Lenis to read live scrollHeight
 *   on every frame instead of relying on its internal ResizeObserver
 *   cache. ScrollTrigger's pin-spacers inflate document height, but
 *   the ResizeObserver on <html> doesn't always fire reliably when
 *   only scrollHeight changes (not the element's border-box).
 *
 * • ScrollTrigger "refresh" listener — When ScrollTrigger creates or
 *   recalculates pin-spacers, we tell Lenis to recalculate too.
 *
 * • Deferred ScrollTrigger.refresh(true) — Child components create
 *   their ScrollTrigger pins in useEffect. Since React fires effects
 *   depth-first (children before parents), pins exist by the time
 *   this hook runs, but we schedule a refresh anyway to be safe.
 */
export function useLenis() {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Only enable Lenis on pages that benefit from smooth scroll (landing)
    if (!LENIS_PATHS.includes(window.location.pathname)) return;

    const lenis = new Lenis({
      autoRaf: false,
      // Always read live scrollHeight instead of cached dimensions.
      // Prevents scroll from stopping early when ScrollTrigger pins
      // add pin-spacer divs that inflate document height.
      naiveDimensions: true,
    });

    lenisRef.current = lenis;
    (window as any).__lenis = lenis;

    // Sync Lenis → ScrollTrigger on every scroll frame
    lenis.on("scroll", ScrollTrigger.update);

    // Drive Lenis from GSAP's ticker (official integration pattern)
    // gsap.ticker passes time in SECONDS; lenis.raf expects MILLISECONDS
    function update(time: number) {
      lenis.raf(time * 1000);
    }
    gsap.ticker.add(update);

    // Disable lag smoothing for immediate scroll responsiveness
    gsap.ticker.lagSmoothing(0);

    // ── Pin-spacer synchronisation ──────────────────────────────
    // ScrollTrigger pins create wrapper divs that inflate document
    // scrollHeight. When ST refreshes (pin create/update/destroy),
    // tell Lenis to recalculate its internal scroll dimensions.
    function syncLenisLimit() {
      lenis.resize();
    }
    ScrollTrigger.addEventListener("refresh", syncLenisLimit);

    // Force a full ScrollTrigger recalculation after all child
    // components have mounted their pins. RAF ensures we're in the
    // next frame after React's effect cycle completes.
    const rafId = requestAnimationFrame(() => {
      ScrollTrigger.refresh(true);
    });

    return () => {
      cancelAnimationFrame(rafId);
      ScrollTrigger.removeEventListener("refresh", syncLenisLimit);
      gsap.ticker.remove(update);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return lenisRef;
}
