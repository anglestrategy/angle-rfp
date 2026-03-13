import React, { useRef, useEffect, useCallback } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Shield,
  FileText,
  Target,
  Scale,
  Clock,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════
   SHOWCASE SCENES — Data for each scroll step
   ═══════════════════════════════════════════════════════════ */
interface ShowcaseScene {
  id: string;
  step: string;
  title: string;
  subtitle: string;
  accent: string;
  accentHsl: string;
}

const SCENES: ShowcaseScene[] = [
  {
    id: "fit-score",
    step: "01",
    title: "Fit Score",
    subtitle: "Weighted scoring across 6 dimensions gives you a clear go/no-go signal before you invest hours writing a response.",
    accent: "bg-primary",
    accentHsl: "hsl(var(--primary))",
  },
  {
    id: "risk-register",
    step: "02",
    title: "Risk Register",
    subtitle: "Every contractual, technical, and compliance risk ranked by severity — with mitigation strategies ready to copy.",
    accent: "bg-red-500",
    accentHsl: "hsl(0, 72%, 51%)",
  },
  {
    id: "executive-brief",
    step: "03",
    title: "Executive Brief",
    subtitle: "A one-page PDF summary designed for leadership sign-off. Print it, email it, present it — in seconds.",
    accent: "bg-primary",
    accentHsl: "hsl(var(--primary))",
  },
  {
    id: "contract-terms",
    step: "04",
    title: "Contract Terms",
    subtitle: "Key clauses, obligations, payment terms, and red flags surfaced automatically from dense legal language.",
    accent: "bg-yellow-500",
    accentHsl: "hsl(40, 90%, 55%)",
  },
  {
    id: "scope-analysis",
    step: "05",
    title: "Scope Analysis",
    subtitle: "Full and partial matches mapped against your capabilities. Know exactly where you fit — and where the gaps are.",
    accent: "bg-green-600",
    accentHsl: "hsl(142, 70%, 42%)",
  },
  {
    id: "submission-guide",
    step: "06",
    title: "Submission Guide",
    subtitle: "Deadlines, format requirements, page limits, and compliance checklists extracted into an actionable checklist.",
    accent: "bg-primary",
    accentHsl: "hsl(var(--primary))",
  },
];

const SCENE_ICONS = [Scale, Shield, FileText, FileCheck, Target, Clock];

/* ═══════════════════════════════════════════════════════════
   MOCK DASHBOARD VISUALS — One per scene
   ═══════════════════════════════════════════════════════════ */

function FitScoreMock() {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-2 w-20 bg-foreground/10 rounded-sm mb-1.5" />
          <div className="h-1.5 w-32 bg-foreground/5 rounded-sm" />
        </div>
        <div className="text-right">
          <span className="text-4xl font-black tracking-tight text-primary">87</span>
          <span className="text-sm font-bold text-muted-foreground">/100</span>
        </div>
      </div>

      <div className="flex justify-center mb-6">
        <svg viewBox="0 0 200 110" className="w-48">
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="hsl(var(--foreground) / 0.06)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${0.87 * Math.PI * 80} ${Math.PI * 80}`}
          />
        </svg>
      </div>

      <div className="space-y-2.5 flex-1">
        {[
          { label: "Technical", pct: 92 },
          { label: "Experience", pct: 85 },
          { label: "Pricing", pct: 78 },
          { label: "Timeline", pct: 90 },
          { label: "Compliance", pct: 88 },
          { label: "Resources", pct: 82 },
        ].map((dim) => (
          <div key={dim.label} className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0 uppercase tracking-wider">
              {dim.label}
            </span>
            <div className="flex-1 h-2 bg-foreground/[0.04] overflow-hidden">
              <div
                className="h-full bg-primary/70"
                style={{ width: `${dim.pct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-foreground/40 w-6 text-right">
              {dim.pct}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="h-5 px-2.5 bg-green-500/10 border border-green-500/20 flex items-center">
          <span className="text-[9px] font-mono font-bold text-green-600 uppercase tracking-wider">
            Strong Bid
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">Recommended to pursue</span>
      </div>
    </div>
  );
}

function RiskRegisterMock() {
  const risks = [
    { severity: "HIGH", label: "Unlimited liability clause §4.2", color: "bg-red-500", textColor: "text-red-600" },
    { severity: "HIGH", label: "IP assignment without limitation", color: "bg-red-500", textColor: "text-red-600" },
    { severity: "MED", label: "Aggressive payment terms (Net-60)", color: "bg-yellow-500", textColor: "text-yellow-600" },
    { severity: "MED", label: "Non-compete scope unclear", color: "bg-yellow-500", textColor: "text-yellow-600" },
    { severity: "LOW", label: "Standard NDA requirements", color: "bg-green-500", textColor: "text-green-600" },
  ];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-bold">5 Risks Identified</span>
        </div>
        <div className="flex gap-1.5">
          <span className="h-4 px-1.5 bg-red-500/10 border border-red-500/20 text-[8px] font-mono font-bold text-red-600 flex items-center">2 HIGH</span>
          <span className="h-4 px-1.5 bg-yellow-500/10 border border-yellow-500/20 text-[8px] font-mono font-bold text-yellow-600 flex items-center">2 MED</span>
          <span className="h-4 px-1.5 bg-green-500/10 border border-green-500/20 text-[8px] font-mono font-bold text-green-600 flex items-center">1 LOW</span>
        </div>
      </div>

      <div className="space-y-2 flex-1">
        {risks.map((risk, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 border border-foreground/5 bg-foreground/[0.01]">
            <div className={`h-6 w-10 flex items-center justify-center text-[8px] font-mono font-bold text-white ${risk.color}`}>
              {risk.severity}
            </div>
            <span className="text-xs text-foreground/70 flex-1">{risk.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 p-2.5 border border-primary/10 bg-primary/[0.02]">
        <span className="text-[9px] font-mono text-primary/70 uppercase tracking-wider">Mitigation available for all items →</span>
      </div>
    </div>
  );
}

function ExecutiveBriefMock() {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="border border-foreground/10 bg-background p-5 flex-1 relative">
        <div className="mb-4">
          <div className="h-1.5 w-28 bg-primary/60 mb-2" />
          <div className="h-1 w-40 bg-foreground/10 mb-1" />
          <div className="h-1 w-36 bg-foreground/10" />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="h-1 w-12 bg-foreground/15 mb-1.5" />
            <span className="text-lg font-black text-primary">87</span>
            <div className="h-0.5 w-8 bg-foreground/10 mt-1" />
          </div>
          <div>
            <div className="h-1 w-12 bg-foreground/15 mb-1.5" />
            <span className="text-lg font-black text-foreground/60">Low</span>
            <div className="h-0.5 w-8 bg-foreground/10 mt-1" />
          </div>
        </div>

        <div className="space-y-1.5">
          {[100, 95, 80, 100, 70, 90, 60, 100, 85, 75].map((w, i) => (
            <div key={i} className="h-[2px] bg-foreground/5" style={{ width: `${w}%` }} />
          ))}
        </div>

        <div className="absolute bottom-4 right-4 h-8 w-8 border-2 border-primary/30 flex items-center justify-center rotate-[-8deg]">
          <CheckCircle2 className="h-4 w-4 text-primary/50" />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-7 px-3 bg-foreground text-background flex items-center">
          <span className="text-[10px] font-bold">Export PDF</span>
        </div>
        <span className="text-[10px] text-muted-foreground">CEO-ready in one click</span>
      </div>
    </div>
  );
}

function ContractTermsMock() {
  const clauses = [
    { name: "IP Assignment", status: "flagged" },
    { name: "Liability Cap", status: "flagged" },
    { name: "Payment Terms", status: "review" },
    { name: "Non-Compete", status: "review" },
    { name: "Termination", status: "ok" },
    { name: "NDA", status: "ok" },
    { name: "SLA Guarantees", status: "flagged" },
    { name: "Indemnification", status: "ok" },
  ];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-bold">8 Terms Extracted</span>
      </div>

      <div className="grid grid-cols-2 gap-2 flex-1">
        {clauses.map((clause) => (
          <div
            key={clause.name}
            className={`p-2.5 border flex items-center gap-2 ${
              clause.status === "flagged"
                ? "border-red-500/20 bg-red-500/[0.03]"
                : clause.status === "review"
                  ? "border-yellow-500/20 bg-yellow-500/[0.03]"
                  : "border-foreground/5 bg-foreground/[0.01]"
            }`}
          >
            <div
              className={`h-1.5 w-1.5 shrink-0 ${
                clause.status === "flagged"
                  ? "bg-red-500"
                  : clause.status === "review"
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
            />
            <span className="text-[10px] font-mono text-foreground/60">{clause.name}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-3 text-[9px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 bg-red-500" /> 3 Flagged</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 bg-yellow-500" /> 2 Review</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 bg-green-500" /> 3 Clear</span>
      </div>
    </div>
  );
}

function ScopeAnalysisMock() {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm font-bold">Scope Coverage</span>
        <span className="text-2xl font-black text-green-600">92%</span>
      </div>

      <div className="h-4 flex overflow-hidden mb-2">
        <div className="bg-green-600 h-full" style={{ width: "65%" }} />
        <div className="bg-yellow-500 h-full" style={{ width: "20%" }} />
        <div className="bg-red-500 h-full" style={{ width: "15%" }} />
      </div>
      <div className="flex gap-4 mb-5 text-[9px] font-mono text-muted-foreground">
        <span>Full: 13</span>
        <span>Partial: 4</span>
        <span>Gap: 3</span>
      </div>

      <div className="space-y-2 flex-1">
        {[
          { name: "Development", full: 5, partial: 1, gap: 0 },
          { name: "Design", full: 3, partial: 1, gap: 1 },
          { name: "Infrastructure", full: 3, partial: 1, gap: 1 },
          { name: "Support", full: 2, partial: 1, gap: 1 },
        ].map((cat) => {
          const total = cat.full + cat.partial + cat.gap;
          return (
            <div key={cat.name} className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-muted-foreground w-20 shrink-0">{cat.name}</span>
              <div className="flex-1 h-2 flex overflow-hidden bg-foreground/[0.03]">
                <div className="bg-green-600/70 h-full" style={{ width: `${(cat.full / total) * 100}%` }} />
                <div className="bg-yellow-500/70 h-full" style={{ width: `${(cat.partial / total) * 100}%` }} />
              </div>
              <span className="text-[9px] font-mono text-foreground/30 w-6 text-right">{cat.full}/{total}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubmissionGuideMock() {
  const items = [
    { label: "PDF format required", done: true },
    { label: "Max 40 pages", done: true },
    { label: "Executive summary ≤ 2 pages", done: true },
    { label: "Pricing in separate volume", done: false },
    { label: "3 client references", done: false },
    { label: "Insurance certificates", done: false },
  ];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm font-bold">Submission Checklist</span>
        <span className="text-xs font-mono text-muted-foreground">3/6 Ready</span>
      </div>

      <div className="p-3 bg-primary/5 border border-primary/15 mb-4 flex items-center justify-between">
        <div>
          <span className="text-[9px] font-mono text-primary/60 uppercase tracking-wider block">Deadline</span>
          <span className="text-sm font-bold">March 15, 2025</span>
        </div>
        <Clock className="h-4 w-4 text-primary/40" />
      </div>

      <div className="space-y-2 flex-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className={`h-4 w-4 flex items-center justify-center border shrink-0 ${
              item.done ? "border-green-500/40 bg-green-500/10" : "border-foreground/10"
            }`}>
              {item.done && <div className="h-1.5 w-1.5 bg-green-500" />}
            </div>
            <span className={`text-xs ${item.done ? "text-foreground/60 line-through" : "text-foreground/80"}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 h-1.5 bg-foreground/[0.04] overflow-hidden">
        <div className="h-full bg-primary/60 w-1/2" />
      </div>
    </div>
  );
}

const SCENE_MOCKS: React.FC[] = [
  FitScoreMock,
  RiskRegisterMock,
  ExecutiveBriefMock,
  ContractTermsMock,
  ScopeAnalysisMock,
  SubmissionGuideMock,
];

/* ═══════════════════════════════════════════════════════════
   SCROLL SHOWCASE — Award-quality GSAP ScrollTrigger

   Patterns applied from studying 10+ Awwwards GSAP sites:
   ─ Timeline-based scrub (not basic ScrollTrigger.create)
   ─ Snap to labels for crisp section stops
   ─ GSAP-driven crossfades (not CSS transitions)
   ─ Parallax floating decorative elements
   ─ Clip-path text reveals
   ─ Staggered element entrances
   ─ Scroll-linked progress indicator
   ─ gsap.matchMedia for responsive
   ─ prefers-reduced-motion respect
   ═══════════════════════════════════════════════════════════ */
export function ScrollShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const scenesRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textsRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dotsRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stepNumRef = useRef<HTMLSpanElement>(null);
  const titleRevealRef = useRef<HTMLDivElement>(null);
  const parallaxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const counterRef = useRef<HTMLSpanElement>(null);

  const setSceneRef = useCallback((el: HTMLDivElement | null, i: number) => {
    scenesRefs.current[i] = el;
  }, []);
  const setTextRef = useCallback((el: HTMLDivElement | null, i: number) => {
    textsRefs.current[i] = el;
  }, []);
  const setDotRef = useCallback((el: HTMLDivElement | null, i: number) => {
    dotsRefs.current[i] = el;
  }, []);
  const setParallaxRef = useCallback((el: HTMLDivElement | null, i: number) => {
    parallaxRefs.current[i] = el;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const panel = panelRef.current;
    if (!container || !panel) return;

    // Kill any existing triggers on this element
    ScrollTrigger.getAll().forEach((t) => {
      if (t.vars.trigger === container) t.kill();
    });

    const ctx = gsap.context(() => {
      /* ── Responsive: disable heavy effects on mobile ── */
      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: "(min-width: 1024px)",
          isMobile: "(max-width: 1023px)",
          isReduced: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { isDesktop, isReduced } = context.conditions!;
          const duration = isReduced ? 0.01 : 1;

          /* ══════════════════════════════════
             MASTER TIMELINE — pinned & scrubbed
             ══════════════════════════════════ */
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: container,
              start: "top top",
              end: `+=${SCENES.length * 100}%`,
              pin: panel,
              pinSpacing: true,
              scrub: isReduced ? true : 1.2,
              snap: {
                snapTo: "labels",
                duration: { min: 0.15, max: 0.6 },
                delay: 0.05,
                ease: "power1.inOut",
              },
              onUpdate: (self) => {
                // Update progress bar
                if (progressRef.current) {
                  gsap.set(progressRef.current, {
                    scaleX: self.progress,
                  });
                }
                // Update counter text
                if (counterRef.current) {
                  const idx = Math.min(
                    Math.floor(self.progress * SCENES.length),
                    SCENES.length - 1
                  );
                  counterRef.current.textContent = `${String(idx + 1).padStart(2, "0")} / ${String(SCENES.length).padStart(2, "0")}`;
                }
              },
            },
          });

          /* ── Initial state: first scene visible ── */
          // Set first scene and text visible
          if (scenesRefs.current[0]) {
            gsap.set(scenesRefs.current[0], { opacity: 1, scale: 1, y: 0 });
          }
          if (textsRefs.current[0]) {
            gsap.set(textsRefs.current[0], {
              opacity: 1,
              y: 0,
              clipPath: "inset(0% 0% 0% 0%)",
            });
          }
          if (dotsRefs.current[0]) {
            gsap.set(dotsRefs.current[0], { opacity: 1, scale: 1 });
          }

          // Set rest hidden
          for (let i = 1; i < SCENES.length; i++) {
            if (scenesRefs.current[i]) {
              gsap.set(scenesRefs.current[i], { opacity: 0, scale: 0.94, y: 30 });
            }
            if (textsRefs.current[i]) {
              gsap.set(textsRefs.current[i], {
                opacity: 0,
                y: 40,
                clipPath: "inset(0% 0% 100% 0%)",
              });
            }
          }

          // Set initial dots
          for (let i = 1; i < SCENES.length; i++) {
            if (dotsRefs.current[i]) {
              gsap.set(dotsRefs.current[i], { opacity: 0.2, scale: 0.85 });
            }
          }

          // Initial label
          tl.addLabel("scene-0");

          /* ── Build scene transitions ── */
          for (let i = 0; i < SCENES.length - 1; i++) {
            const currentScene = scenesRefs.current[i];
            const nextScene = scenesRefs.current[i + 1];
            const currentText = textsRefs.current[i];
            const nextText = textsRefs.current[i + 1];
            const currentDot = dotsRefs.current[i];
            const nextDot = dotsRefs.current[i + 1];

            /* Crossfade out current scene */
            tl.to(
              currentScene,
              {
                opacity: 0,
                scale: 0.94,
                y: -20,
                duration,
                ease: "none",
              },
              `scene-${i}+=0.5`
            );

            /* Clip-path wipe out current text */
            tl.to(
              currentText,
              {
                opacity: 0,
                y: -30,
                clipPath: "inset(0% 0% 100% 0%)",
                duration,
                ease: "none",
              },
              `scene-${i}+=0.5`
            );

            /* Fade out current dot */
            tl.to(
              currentDot,
              {
                opacity: 0.2,
                scale: 0.85,
                duration: duration * 0.5,
                ease: "none",
              },
              `scene-${i}+=0.5`
            );

            /* Crossfade in next scene */
            tl.fromTo(
              nextScene,
              { opacity: 0, scale: 0.94, y: 30 },
              {
                opacity: 1,
                scale: 1,
                y: 0,
                duration,
                ease: "none",
              },
              `scene-${i}+=0.6`
            );

            /* Clip-path reveal next text */
            tl.fromTo(
              nextText,
              {
                opacity: 0,
                y: 40,
                clipPath: "inset(100% 0% 0% 0%)",
              },
              {
                opacity: 1,
                y: 0,
                clipPath: "inset(0% 0% 0% 0%)",
                duration: duration * 1.2,
                ease: "none",
              },
              `scene-${i}+=0.65`
            );

            /* Activate next dot */
            tl.to(
              nextDot,
              {
                opacity: 1,
                scale: 1,
                duration: duration * 0.5,
                ease: "none",
              },
              `scene-${i}+=0.6`
            );

            /* Parallax decorative elements — move at different speeds */
            if (isDesktop && !isReduced) {
              parallaxRefs.current.forEach((el, pIdx) => {
                if (!el) return;
                const speed = 15 + pIdx * 12;
                tl.to(
                  el,
                  {
                    y: `-=${speed}`,
                    duration,
                    ease: "none",
                  },
                  `scene-${i}+=0.5`
                );
              });
            }

            tl.addLabel(`scene-${i + 1}`);
          }

          /* ── Hold last scene ── */
          tl.to({}, { duration: 0.3 });
        }
      );
    }, container);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative"
      style={{ height: `${(SCENES.length + 1) * 100}vh` }}
    >
      <div
        ref={panelRef}
        className="h-screen w-full flex items-center overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-6 w-full relative">
          {/* ── Parallax floating decorative elements ── */}
          <div
            ref={(el) => setParallaxRef(el, 0)}
            className="absolute -top-16 -right-8 w-32 h-32 border border-foreground/[0.03] pointer-events-none hidden lg:block"
            style={{ willChange: "transform" }}
          />
          <div
            ref={(el) => setParallaxRef(el, 1)}
            className="absolute -bottom-12 -left-6 w-24 h-24 pointer-events-none hidden lg:block"
            style={{ willChange: "transform" }}
          >
            <svg viewBox="0 0 96 96" className="w-full h-full opacity-[0.04]">
              <circle cx="48" cy="48" r="46" stroke="hsl(var(--foreground))" strokeWidth="1" fill="none" />
              <circle cx="48" cy="48" r="28" stroke="hsl(var(--primary))" strokeWidth="1" fill="none" />
            </svg>
          </div>
          <div
            ref={(el) => setParallaxRef(el, 2)}
            className="absolute top-1/4 -right-16 w-px h-40 bg-gradient-to-b from-transparent via-primary/10 to-transparent pointer-events-none hidden lg:block"
            style={{ willChange: "transform" }}
          />
          <div
            ref={(el) => setParallaxRef(el, 3)}
            className="absolute bottom-1/4 -left-12 w-16 h-16 pointer-events-none hidden lg:block"
            style={{ willChange: "transform" }}
          >
            <svg viewBox="0 0 64 64" className="w-full h-full opacity-[0.03]">
              <path d="M 0 64 L 32 0 L 64 64 Z" stroke="hsl(var(--foreground))" strokeWidth="1" fill="none" />
            </svg>
          </div>

          {/* ── Section header ── */}
          <div className="flex items-center gap-4 mb-10">
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              The Full Analysis
            </h2>
            <div className="flex-1 h-px bg-foreground/5" />
            <span
              ref={counterRef}
              className="font-mono text-[10px] text-muted-foreground/50"
            >
              01 / {String(SCENES.length).padStart(2, "0")}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* ── Left: Text + progress ── */}
            <div className="lg:col-span-5 flex flex-col">
              {/* Progress indicator — vertical dots */}
              <div className="flex lg:flex-col gap-2 mb-8">
                {SCENES.map((scene, i) => {
                  const Icon = SCENE_ICONS[i];
                  return (
                    <div
                      key={scene.id}
                      ref={(el) => setDotRef(el, i)}
                      className="flex items-center gap-2.5"
                      style={{ willChange: "transform, opacity" }}
                    >
                      <div
                        className={`h-8 w-8 flex items-center justify-center border transition-colors duration-300 ${
                          i === 0
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-foreground/10 bg-transparent text-foreground/30"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span
                        className={`text-xs font-mono hidden lg:block ${
                          i === 0 ? "text-foreground font-bold" : "text-muted-foreground/40"
                        }`}
                      >
                        {scene.title}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Active scene text — stacked with GSAP crossfade */}
              <div ref={titleRevealRef} className="relative min-h-[200px]">
                {SCENES.map((scene, i) => (
                  <div
                    key={scene.id}
                    ref={(el) => setTextRef(el, i)}
                    className={`${i === 0 ? "" : "absolute inset-0"}`}
                    style={{ willChange: "transform, opacity, clip-path" }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-mono text-[64px] font-black text-foreground/[0.05] leading-none select-none">
                        {scene.step}
                      </span>
                    </div>
                    <h3 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                      {scene.title}
                    </h3>
                    <p className="text-base text-muted-foreground leading-relaxed max-w-md">
                      {scene.subtitle}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right: Mock dashboard panel ── */}
            <div className="lg:col-span-7">
              <div className="relative border border-foreground/10 bg-card overflow-hidden">
                {/* Window chrome */}
                <div className="h-8 border-b border-foreground/5 bg-foreground/[0.02] flex items-center px-3 gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
                  <div className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
                  <div className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
                  <div className="ml-4 h-4 flex-1 max-w-[200px] bg-foreground/[0.03] rounded-sm flex items-center px-2">
                    <span className="text-[8px] font-mono text-muted-foreground/40">angle/rfp — analysis</span>
                  </div>
                </div>

                {/* Dashboard content area */}
                <div className="p-6 md:p-8 min-h-[420px] relative">
                  {SCENE_MOCKS.map((MockComponent, i) => (
                    <div
                      key={SCENES[i].id}
                      ref={(el) => setSceneRef(el, i)}
                      className={`${i === 0 ? "" : "absolute inset-0 p-6 md:p-8"}`}
                      style={{ willChange: "transform, opacity" }}
                    >
                      <MockComponent />
                    </div>
                  ))}
                </div>

                {/* Decorative corner accent */}
                <div className="absolute bottom-0 right-0 h-16 w-16">
                  <svg viewBox="0 0 64 64" className="w-full h-full opacity-[0.03]">
                    <path d="M 64 0 L 64 64 L 0 64" fill="hsl(var(--foreground))" />
                  </svg>
                </div>
              </div>

              {/* Progress bar below panel */}
              <div className="mt-3 h-0.5 bg-foreground/5 overflow-hidden">
                <div
                  ref={progressRef}
                  className="h-full bg-primary origin-left"
                  style={{ transform: "scaleX(0)" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
