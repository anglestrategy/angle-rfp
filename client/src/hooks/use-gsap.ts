import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * useGsapReveal — Scroll-triggered reveal for a single element.
 * Supports multiple animation presets for dramatic variety.
 */
export type RevealPreset =
  | "fade-up"
  | "fade-up-stagger"
  | "clip-up"
  | "clip-left"
  | "scale-up"
  | "parallax-slow"
  | "parallax-fast"
  | "draw-line"
  | "counter";

interface RevealOptions {
  preset?: RevealPreset;
  delay?: number;
  duration?: number;
  scrub?: boolean | number;
  start?: string;
  end?: string;
  markers?: boolean;
  stagger?: number;
  /** For counter preset: target number */
  countTo?: number;
  /** For counter preset: suffix text */
  countSuffix?: string;
  /** For counter preset: prefix text */
  countPrefix?: string;
}

/**
 * useGsapContext — Creates a GSAP context scoped to a container ref.
 * Returns a ref to attach to the container. All GSAP animations inside
 * will be automatically cleaned up on unmount.
 */
export function useGsapContext(
  setup: (ctx: gsap.Context) => void,
  deps: unknown[] = [],
) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ctx = gsap.context(() => {
      setup(ctx as unknown as gsap.Context);
    }, container);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}

/**
 * useGsapHeroParallax — Multi-layer parallax driven by scroll.
 * Attach to the hero section container. Returns refs for layers.
 */
export function useGsapHeroParallax() {
  const containerRef = useRef<HTMLElement>(null);
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const layer3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: "(min-width: 768px)",
          isReduced: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { isDesktop, isReduced } = context.conditions!;
          if (isReduced || !isDesktop) return;

          // Layer 1: slowest parallax (background elements)
          if (layer1Ref.current) {
            gsap.to(layer1Ref.current, {
              y: -80,
              ease: "none",
              scrollTrigger: {
                trigger: container,
                start: "top top",
                end: "bottom top",
                scrub: 1,
              },
            });
          }

          // Layer 2: medium speed (main content)
          if (layer2Ref.current) {
            gsap.to(layer2Ref.current, {
              y: -40,
              ease: "none",
              scrollTrigger: {
                trigger: container,
                start: "top top",
                end: "bottom top",
                scrub: 1,
              },
            });
          }

          // Layer 3: fastest (foreground accents)
          if (layer3Ref.current) {
            gsap.to(layer3Ref.current, {
              y: -120,
              opacity: 0,
              ease: "none",
              scrollTrigger: {
                trigger: container,
                start: "top top",
                end: "80% top",
                scrub: 1,
              },
            });
          }
        },
      );
    }, container);

    return () => ctx.revert();
  }, []);

  return { containerRef, layer1Ref, layer2Ref, layer3Ref };
}

/**
 * useGsapTextReveal — Character-by-character or word-by-word reveal
 * driven by scroll or viewport entry. Very dramatic effect.
 */
export function useGsapTextReveal(
  options: {
    type?: "chars" | "words" | "lines";
    scrub?: boolean;
    stagger?: number;
    duration?: number;
    delay?: number;
  } = {},
) {
  const textRef = useRef<HTMLElement>(null);
  const {
    type = "words",
    scrub = false,
    stagger = 0.03,
    duration = 0.6,
    delay = 0,
  } = options;

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    // Split text into spans
    const text = el.textContent || "";
    const parts =
      type === "chars"
        ? text.split("")
        : type === "words"
          ? text.split(/(\s+)/)
          : [text];

    el.innerHTML = "";
    const spans: HTMLElement[] = [];

    parts.forEach((part) => {
      if (/^\s+$/.test(part)) {
        el.appendChild(document.createTextNode(part));
        return;
      }
      const span = document.createElement("span");
      span.textContent = part;
      span.style.display = "inline-block";
      span.style.overflow = "hidden";

      const inner = document.createElement("span");
      inner.textContent = part;
      inner.style.display = "inline-block";
      span.textContent = "";
      span.appendChild(inner);
      el.appendChild(span);
      spans.push(inner);
    });

    const ctx = gsap.context(() => {
      gsap.fromTo(
        spans,
        {
          y: "110%",
          opacity: 0,
        },
        {
          y: "0%",
          opacity: 1,
          stagger,
          duration,
          delay,
          ease: "power3.out",
          scrollTrigger: scrub
            ? {
                trigger: el,
                start: "top 85%",
                end: "top 40%",
                scrub: 1,
              }
            : {
                trigger: el,
                start: "top 85%",
                toggleActions: "play none none none",
              },
        },
      );
    });

    return () => ctx.revert();
  }, [type, scrub, stagger, duration, delay]);

  return textRef;
}

/**
 * useGsapCounter — Animated number counter that triggers on scroll.
 */
export function useGsapCounter(
  target: number,
  options: { duration?: number; suffix?: string; prefix?: string; decimals?: number } = {},
) {
  const ref = useRef<HTMLElement>(null);
  const { duration = 1.5, suffix = "", prefix = "", decimals = 0 } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obj = { val: 0 };

    const ctx = gsap.context(() => {
      gsap.to(obj, {
        val: target,
        duration,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none none",
        },
        onUpdate: () => {
          el.textContent = `${prefix}${decimals > 0 ? obj.val.toFixed(decimals) : Math.round(obj.val)}${suffix}`;
        },
      });
    });

    return () => ctx.revert();
  }, [target, duration, suffix, prefix, decimals]);

  return ref;
}

/**
 * useGsapBatchReveal — Staggered batch reveal for grids of elements.
 * Applies to all children matching the selector.
 */
export function useGsapBatchReveal(
  selector: string,
  options: {
    from?: gsap.TweenVars;
    to?: gsap.TweenVars;
    stagger?: number;
    start?: string;
  } = {},
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    from = { opacity: 0, y: 60, scale: 0.95 },
    to = { opacity: 1, y: 0, scale: 1 },
    stagger = 0.08,
    start = "top 80%",
  } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const elements = container.querySelectorAll(selector);
    if (!elements.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(elements, from, {
        ...to,
        stagger,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: {
          trigger: container,
          start,
          toggleActions: "play none none none",
        },
      });
    }, container);

    return () => ctx.revert();
  }, [selector, stagger, start]);

  return containerRef;
}

/**
 * useGsapDrawLine — Animate an SVG line/path drawing on scroll.
 */
export function useGsapDrawLine() {
  const pathRef = useRef<SVGPathElement | SVGLineElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    const length =
      "getTotalLength" in path ? (path as SVGPathElement).getTotalLength() : 100;

    const ctx = gsap.context(() => {
      gsap.set(path, {
        strokeDasharray: length,
        strokeDashoffset: length,
      });

      gsap.to(path, {
        strokeDashoffset: 0,
        duration: 1.5,
        ease: "power2.inOut",
        scrollTrigger: {
          trigger: path,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      });
    });

    return () => ctx.revert();
  }, []);

  return pathRef;
}

/**
 * useGsapScaleReveal — Dramatic scale-up from smaller + clipped state.
 */
export function useGsapScaleReveal(
  options: { start?: string; duration?: number } = {},
) {
  const ref = useRef<HTMLDivElement>(null);
  const { start = "top 80%", duration = 1 } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        {
          scale: 0.85,
          opacity: 0,
          clipPath: "inset(10% 10% 10% 10%)",
        },
        {
          scale: 1,
          opacity: 1,
          clipPath: "inset(0% 0% 0% 0%)",
          duration,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start,
            toggleActions: "play none none none",
          },
        },
      );
    });

    return () => ctx.revert();
  }, [start, duration]);

  return ref;
}
