import { useEffect, useRef, useState, useCallback } from "react";
import { gsap } from "gsap";

/**
 * Awwwards-inspired preloader — revised based on 3 reference videos:
 *
 * Reference 1 (ONTO/Founder Studio): Shape-morphing grid → logo dissolve → page reveal
 * Reference 2 (3200 Kelvin): Brand-narrative loading — progress IS the story
 * Reference 3 (ARAGO): Dark + wordmark + arc progress → seamless 3D hero transition
 *
 * Our approach blends all three:
 * - Dark full-screen with centered angle/RFP wordmark (Ref 3)
 * - Cycling narrative status text during load (Ref 2's temperature milestones)
 * - SVG arc progress indicator (Ref 3's circular arc)
 * - Orange "/" glow pulse as brand accent (Ref 2's warm orange)
 * - Clip-path circle-expand reveal instead of curtain wipe (Ref 1's dissolve)
 *
 * SessionStorage gated — only runs once per browser session.
 */

const STORAGE_KEY = "rfp-preloader-seen";

/** RFP-relevant narrative steps shown during loading */
const NARRATIVE_STEPS = [
  "Initializing",
  "Scanning documents",
  "Analyzing requirements",
  "Processing data",
  "Ready",
];

export function Preloader({
  onExiting,
  onComplete,
}: {
  onExiting?: () => void;
  onComplete: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const slashRef = useRef<HTMLSpanElement>(null);
  const [shouldShow, setShouldShow] = useState(false);

  // Stabilize refs to avoid restarting animation on parent re-renders
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onExitingRef = useRef(onExiting);
  onExitingRef.current = onExiting;
  const env = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env ?? {};

  useEffect(() => {
    const isDev = env.DEV === true || String(env.DEV) === "true";
    const showDevPreloader = String(env.VITE_ENABLE_DEV_PRELOADER ?? "").toLowerCase() === "true";
    const alreadySeen = sessionStorage.getItem(STORAGE_KEY);

    // Default dev behavior should favor speed and stability, not cinematics.
    // The preloader can still be re-enabled locally with VITE_ENABLE_DEV_PRELOADER=true.
    if ((isDev && !showDevPreloader) || (!isDev && alreadySeen)) {
      onExitingRef.current?.();
      onCompleteRef.current();
      return;
    }
    setShouldShow(true);
  }, []);

  useEffect(() => {
    if (!shouldShow) return;
    if (
      !overlayRef.current ||
      !lineRef.current ||
      !counterRef.current ||
      !wordmarkRef.current ||
      !statusRef.current ||
      !arcRef.current ||
      !slashRef.current
    )
      return;

    const tl = gsap.timeline({
      onComplete: () => {
        sessionStorage.setItem(STORAGE_KEY, "1");
        onCompleteRef.current();
      },
    });

    /* ─── Phase 1: Wordmark letters stagger in with perspective ─── */
    const letters = wordmarkRef.current.querySelectorAll(".preloader-letter");
    tl.fromTo(
      letters,
      { opacity: 0, y: 24, rotateX: -60, filter: "blur(4px)" },
      {
        opacity: 1,
        y: 0,
        rotateX: 0,
        filter: "blur(0px)",
        stagger: 0.055,
        duration: 0.6,
        ease: "power3.out",
      },
      0.3
    );

    /* ─── Phase 1b: Orange "/" pulse glow (inspired by Ref 2 warm accent) ─── */
    tl.to(
      slashRef.current,
      {
        textShadow: "0 0 20px rgba(232,121,59,0.6), 0 0 40px rgba(232,121,59,0.3)",
        duration: 0.4,
        ease: "power2.out",
      },
      0.8
    );
    // Continuous subtle pulse on the slash
    tl.to(
      slashRef.current,
      {
        textShadow:
          "0 0 12px rgba(232,121,59,0.4), 0 0 24px rgba(232,121,59,0.15)",
        duration: 0.8,
        ease: "sine.inOut",
        yoyo: true,
        repeat: 3,
      },
      1.0
    );

    /* ─── Phase 2: Progress line + arc + counter ─── */
    // Linear progress line grows
    tl.to(
      lineRef.current,
      {
        scaleX: 1,
        duration: 2.2,
        ease: "power2.inOut",
      },
      0.8
    );

    // SVG arc progress (inspired by Ref 3 ARAGO circular arc)
    const circumference = 2 * Math.PI * 28; // radius 28
    tl.fromTo(
      arcRef.current,
      { strokeDashoffset: circumference },
      {
        strokeDashoffset: 0,
        duration: 2.2,
        ease: "power2.inOut",
      },
      0.8
    );

    // Counter counts up 000→100
    const counter = { val: 0 };
    tl.to(
      counter,
      {
        val: 100,
        duration: 2.2,
        ease: "power2.inOut",
        onUpdate: () => {
          if (counterRef.current) {
            counterRef.current.textContent = String(
              Math.round(counter.val)
            ).padStart(3, "0");
          }
        },
      },
      0.8
    );

    /* ─── Phase 2b: Narrative status text cycling (Ref 2 milestones) ─── */
    const stepDuration = 2.2 / NARRATIVE_STEPS.length;
    NARRATIVE_STEPS.forEach((step, i) => {
      tl.call(
        () => {
          if (statusRef.current) {
            // Fade-swap the text
            gsap.to(statusRef.current, {
              opacity: 0,
              y: -4,
              duration: 0.12,
              ease: "power2.in",
              onComplete: () => {
                if (statusRef.current) {
                  statusRef.current.textContent = step;
                  gsap.fromTo(
                    statusRef.current,
                    { opacity: 0, y: 4 },
                    { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }
                  );
                }
              },
            });
          }
        },
        undefined,
        0.8 + i * stepDuration
      );
    });

    /* ─── Phase 3: Brief hold at 100% ─── */
    tl.to({}, { duration: 0.35 });

    /* ─── Phase 4: Everything fades (counter, line, status, arc) ─── */
    tl.to(
      [lineRef.current, counterRef.current, statusRef.current, arcRef.current],
      {
        opacity: 0,
        duration: 0.3,
        ease: "power2.in",
      }
    );

    /* ─── Phase 5: Wordmark scales up + fades (Ref 1 dissolve feel) ─── */
    /* Signal hero to begin cross-dissolve underneath the fading overlay */
    tl.call(() => {
      onExitingRef.current?.();
    });
    tl.to(
      wordmarkRef.current,
      {
        scale: 1.15,
        opacity: 0,
        filter: "blur(8px)",
        duration: 0.5,
        ease: "power3.in",
      },
      "-=0.15"
    );

    /* ─── Phase 6: Smooth dissolve reveal (Ref 1 + 3 seamless) ─── */
    // Overlay fades out while scaling slightly — creates dissolve feel
    // matching Ref 1's smooth page reveal and Ref 3's seamless hero transition.
    tl.to(
      overlayRef.current,
      {
        opacity: 0,
        scale: 1.05,
        duration: 0.8,
        ease: "power3.inOut",
      },
      "-=0.3"
    );

    // Final: ensure overlay is fully gone
    tl.set(overlayRef.current, { display: "none" });

    return () => {
      tl.kill();
    };
    // onComplete is accessed via stable ref — no need in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  if (!shouldShow) return null;

  const arcRadius = 28;
  const arcCircumference = 2 * Math.PI * arcRadius;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        backgroundColor: "#080808",
      }}
    >
      {/* Subtle radial glow behind wordmark (Ref 3 ambient feel) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 40% 35% at 50% 48%, rgba(232,121,59,0.04) 0%, transparent 70%)",
        }}
      />

      {/* SVG arc progress ring (Ref 3 ARAGO-inspired) */}
      <svg
        className="absolute"
        width="72"
        height="72"
        viewBox="0 0 72 72"
        style={{ top: "calc(50% - 68px)", opacity: 0.25 }}
      >
        {/* Track */}
        <circle
          cx="36"
          cy="36"
          r={arcRadius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.5"
        />
        {/* Active arc */}
        <circle
          ref={arcRef}
          cx="36"
          cy="36"
          r={arcRadius}
          fill="none"
          stroke="rgba(232,121,59,0.5)"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeDasharray={arcCircumference}
          strokeDashoffset={arcCircumference}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
          }}
        />
      </svg>

      {/* Wordmark */}
      <div
        ref={wordmarkRef}
        className="flex items-baseline gap-0 select-none mb-10"
        style={{ perspective: "800px" }}
      >
        {"angle".split("").map((char, i) => (
          <span
            key={`a-${i}`}
            className="preloader-letter text-[clamp(32px,5vw,52px)] font-black tracking-[-0.04em] text-white/90"
            style={{
              display: "inline-block",
              willChange: "transform, opacity, filter",
            }}
          >
            {char}
          </span>
        ))}
        <span
          ref={slashRef}
          className="preloader-letter text-[clamp(32px,5vw,52px)] font-black tracking-[-0.04em] text-[#e8793b]"
          style={{
            display: "inline-block",
            willChange: "transform, opacity, filter",
          }}
        >
          /
        </span>
        {"RFP".split("").map((char, i) => (
          <span
            key={`r-${i}`}
            className="preloader-letter text-[clamp(32px,5vw,52px)] font-black tracking-[-0.04em] text-white/90"
            style={{
              display: "inline-block",
              willChange: "transform, opacity, filter",
            }}
          >
            {char}
          </span>
        ))}
      </div>

      {/* Progress line */}
      <div className="w-[200px] h-px bg-white/[0.06] relative overflow-hidden">
        <div
          ref={lineRef}
          className="absolute inset-0 origin-left"
          style={{
            transform: "scaleX(0)",
            background:
              "linear-gradient(90deg, rgba(232,121,59,0.5) 0%, rgba(255,255,255,0.4) 100%)",
          }}
        />
      </div>

      {/* Counter */}
      <span
        ref={counterRef}
        className="mt-4 font-mono text-[11px] tracking-[0.3em] text-white/20"
      >
        000
      </span>

      {/* Narrative status text (Ref 2 brand-narrative milestones) */}
      <span
        ref={statusRef}
        className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/15"
      >
        Initializing
      </span>
    </div>
  );
}
