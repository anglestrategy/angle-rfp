import { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  FileText,
  Shield,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
} from "lucide-react";
import { LazyVideo } from "@/components/lazy-video";

gsap.registerPlugin(ScrollTrigger);

const DEMO_VIDEOS = [
  { webm: "/videos/demo-upload.webm", mp4: "/videos/demo-upload.mp4", poster: "/videos/demo-upload-poster.jpg" },
  { webm: "/videos/demo-analyze.webm", mp4: "/videos/demo-analyze.mp4", poster: "/videos/demo-analyze-poster.jpg" },
  { webm: "/videos/demo-results.webm", mp4: "/videos/demo-results.mp4", poster: "/videos/demo-results-poster.jpg" },
];

/**
 * Scroll-scrubbed product demo — pinned section showing 3 UI states
 * that transition as the user scrolls. Reveals how the RFP analysis
 * works step-by-step: Upload → Analysis → Results.
 *
 * Inspired by Awwwards product showcases with pinned scroll-driven
 * state transitions. Each step cross-fades as scroll progress advances.
 */

const DEMO_STEPS = [
  {
    num: "01",
    label: "Upload",
    title: "Drop your RFP",
    desc: "PDF or DOCX, up to 20 MB. No formatting needed.",
  },
  {
    num: "02",
    label: "Analyze",
    title: "4-pass AI engine",
    desc: "Requirements, risks, terms, and scope extracted in seconds.",
  },
  {
    num: "03",
    label: "Results",
    title: "Actionable intelligence",
    desc: "Fit score, risk register, and executive brief — ready to act on.",
  },
];

/* ── Step 1: Upload UI Mockup ── */
function UploadState() {
  return (
    <div className="w-full max-w-[520px] mx-auto">
      <div className="border-2 border-dashed border-foreground/[0.08] bg-foreground/[0.015] p-12 text-center">
        <div className="h-14 w-14 mx-auto mb-5 rounded-full bg-primary/[0.06] flex items-center justify-center">
          <FileText className="h-6 w-6 text-primary/50" />
        </div>
        <p className="text-sm font-medium text-foreground/70 mb-1">
          Drag & drop your RFP document
        </p>
        <p className="text-xs text-muted-foreground/40 mb-5">
          PDF or DOCX &middot; Up to 20 MB
        </p>
        <div className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium border border-foreground/10 bg-card text-foreground/70">
          Browse files
        </div>
      </div>
      {/* Recent uploads hint */}
      <div className="mt-4 flex items-center gap-3 px-3 py-2.5 bg-foreground/[0.02] border border-foreground/[0.04]">
        <div className="h-8 w-8 bg-primary/[0.06] flex items-center justify-center shrink-0">
          <FileText className="h-3.5 w-3.5 text-primary/40" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-2 w-32 bg-foreground/[0.08] rounded-sm mb-1" />
          <div className="h-1.5 w-20 bg-foreground/[0.04] rounded-sm" />
        </div>
        <span className="font-mono text-[8px] text-muted-foreground/30 uppercase">
          2.4 MB
        </span>
      </div>
    </div>
  );
}

/* ── Step 2: Analysis UI Mockup ── */
function AnalysisState() {
  return (
    <div className="w-full max-w-[520px] mx-auto">
      <div className="border border-foreground/[0.06] bg-card/50 backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-foreground/[0.04] flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary/60 font-medium">
            Analyzing — Pass 3 of 4
          </span>
          <div className="ml-auto flex-1 max-w-[120px] h-[3px] bg-foreground/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/40 rounded-full"
              style={{ width: "75%" }}
            />
          </div>
        </div>

        {/* Analysis layers */}
        <div className="px-6 py-4 space-y-3">
          {[
            {
              label: "Requirements Extraction",
              pct: 100,
              icon: FileCheck,
              done: true,
            },
            {
              label: "Risk Assessment",
              pct: 100,
              icon: Shield,
              done: true,
            },
            {
              label: "Contract Analysis",
              pct: 68,
              icon: AlertTriangle,
              done: false,
            },
            {
              label: "Scope Mapping",
              pct: 0,
              icon: BarChart3,
              done: false,
            },
          ].map((layer) => {
            const Icon = layer.icon;
            return (
              <div
                key={layer.label}
                className="flex items-center gap-3 py-2"
              >
                <div
                  className={`h-7 w-7 flex items-center justify-center border shrink-0 ${
                    layer.done
                      ? "border-emerald-500/20 bg-emerald-500/[0.06]"
                      : "border-foreground/[0.06] bg-foreground/[0.02]"
                  }`}
                >
                  {layer.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/70" />
                  ) : (
                    <Icon className="h-3.5 w-3.5 text-muted-foreground/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/70">
                    {layer.label}
                  </p>
                  <div className="mt-1 h-[2px] w-full bg-foreground/[0.04] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        layer.done ? "bg-emerald-500/40" : "bg-primary/30"
                      }`}
                      style={{ width: `${layer.pct}%` }}
                    />
                  </div>
                </div>
                <span className="font-mono text-[9px] text-muted-foreground/30 tabular-nums">
                  {layer.pct}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Extraction preview */}
        <div className="px-6 py-3 border-t border-foreground/[0.04] bg-foreground/[0.01]">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
            <span className="font-mono text-[8px] text-muted-foreground/40 uppercase tracking-wider">
              Live extraction
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="h-[5px] w-[90%] bg-foreground/[0.04] rounded-sm" />
            <div className="h-[5px] w-full bg-primary/[0.08] rounded-sm border-l-2 border-primary/30" />
            <div className="h-[5px] w-[75%] bg-foreground/[0.04] rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Step 3: Results UI Mockup ── */
function ResultsState() {
  return (
    <div className="w-full max-w-[520px] mx-auto">
      <div className="border border-foreground/[0.06] bg-card/50 backdrop-blur-sm overflow-hidden">
        {/* Results header with fit score */}
        <div className="px-6 py-4 border-b border-foreground/[0.04] flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40 mb-0.5">
              Analysis Complete
            </p>
            <p className="text-sm font-bold tracking-tight">
              Enterprise Cloud RFP
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[8px] uppercase tracking-wider text-emerald-500/60">
              Fit Score
            </p>
            <p className="text-2xl font-black text-foreground leading-none">
              82
            </p>
          </div>
        </div>

        {/* Results grid */}
        <div className="px-6 py-4 grid grid-cols-2 gap-3">
          {[
            { label: "Requirements", count: "24", sublabel: "extracted", color: "text-primary" },
            { label: "Risks", count: "7", sublabel: "identified", color: "text-amber-500" },
            { label: "Key Terms", count: "12", sublabel: "flagged", color: "text-violet-500" },
            { label: "Deadlines", count: "3", sublabel: "tracked", color: "text-emerald-500" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-3 border border-foreground/[0.04] bg-foreground/[0.01]"
            >
              <p className={`text-xl font-black ${stat.color} leading-none mb-1`}>
                {stat.count}
              </p>
              <p className="text-[10px] font-medium text-foreground/60">
                {stat.label}
              </p>
              <p className="font-mono text-[8px] text-muted-foreground/30 uppercase">
                {stat.sublabel}
              </p>
            </div>
          ))}
        </div>

        {/* Recommendation bar */}
        <div className="px-6 py-3 border-t border-foreground/[0.04] bg-emerald-500/[0.03] flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500/70 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Recommended: Proceed to bid
            </p>
            <p className="text-[10px] text-emerald-600/50 dark:text-emerald-500/40">
              Strong alignment with capabilities &middot; Manageable risk profile
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductDemo() {
  const sectionRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLDivElement[]>([]);
  const indicatorRefs = useRef<HTMLDivElement[]>([]);
  const mockupRefs = useRef<HTMLDivElement[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!sectionRef.current || isMobile) return;

    const ctx = gsap.context(() => {
      const section = sectionRef.current!;

      // Pin the section for 3 scroll heights (one per step)
      const pinTrigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "+=200%",
        pin: true,
        pinSpacing: true,
        anticipatePin: 1, // helps Lenis smooth-scroll predict pin start
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const progress = self.progress;
          const activeIdx =
            progress < 0.33 ? 0 : progress < 0.66 ? 1 : 2;

          // Cross-fade mockup states
          mockupRefs.current.forEach((el, i) => {
            if (!el) return;
            if (i === activeIdx) {
              gsap.set(el, { opacity: 1, scale: 1, pointerEvents: "auto" });
            } else {
              gsap.set(el, { opacity: 0, scale: 0.96, pointerEvents: "none" });
            }
          });

          // Update step indicators
          // NOTE: Color properties use direct style assignment instead of
          // gsap.set() because CSS variable strings like "hsl(var(--primary))"
          // crash GSAP's splitColor2 parser (no numeric values for regex).
          // Non-color props (scale) still use gsap.set() for transform handling.
          indicatorRefs.current.forEach((el, i) => {
            if (!el) return;
            const dot = el.querySelector<HTMLElement>(".demo-dot");
            const label = el.querySelector<HTMLElement>(".demo-label");
            if (!dot || !label) return;
            if (i === activeIdx) {
              gsap.set(dot, { scale: 1 });
              dot.style.backgroundColor = "hsl(var(--primary))";
              label.style.opacity = "1";
              label.style.color = "hsl(var(--foreground))";
            } else if (i < activeIdx) {
              gsap.set(dot, { scale: 0.7 });
              dot.style.backgroundColor = "hsl(var(--primary) / 0.3)";
              label.style.opacity = "0.4";
              label.style.color = "hsl(var(--muted-foreground))";
            } else {
              gsap.set(dot, { scale: 0.7 });
              dot.style.backgroundColor = "hsl(var(--foreground) / 0.1)";
              label.style.opacity = "0.3";
              label.style.color = "hsl(var(--muted-foreground))";
            }
          });

          // Update step text
          stepsRef.current.forEach((el, i) => {
            if (!el) return;
            if (i === activeIdx) {
              gsap.set(el, { opacity: 1, y: 0 });
            } else {
              gsap.set(el, { opacity: 0, y: i < activeIdx ? -10 : 10 });
            }
          });
        },
      });

      return () => pinTrigger.kill();
    }, sectionRef.current);

    return () => ctx.revert();
  }, [isMobile]);

  const MockupComponents = [UploadState, AnalysisState, ResultsState];

  // Mobile: vertical stack
  if (isMobile) {
    return (
      <section className="py-20 px-6">
        <div className="mb-12 text-center">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 block mb-3">
            How It Works
          </span>
          <h2 className="text-3xl font-bold tracking-tight">
            Three steps to clarity.
          </h2>
        </div>
        <div className="space-y-12">
          {DEMO_STEPS.map((step, i) => {
            const Mockup = MockupComponents[i];
            return (
              <div key={step.num}>
                <div className="mb-4 text-center">
                  <span className="font-mono text-[10px] text-primary/50 uppercase tracking-wider">
                    {step.num} — {step.label}
                  </span>
                  <h3 className="text-xl font-bold tracking-tight mt-1">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {step.desc}
                  </p>
                </div>
                <Mockup />
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="min-h-screen relative flex items-center"
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 w-full">
        <div className="grid grid-cols-[300px,1fr] gap-16 items-center">
          {/* Left: Step navigator */}
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 block mb-8">
              Product Demo
            </span>

            {/* Step indicators */}
            <div className="space-y-8 relative">
              {/* Connecting line */}
              <div className="absolute left-[5px] top-[14px] bottom-[14px] w-px bg-foreground/[0.06]" />

              {DEMO_STEPS.map((step, i) => (
                <div
                  key={step.num}
                  ref={(el) => {
                    if (el) indicatorRefs.current[i] = el;
                  }}
                  className="flex items-start gap-4 relative"
                >
                  <div
                    className="demo-dot h-[11px] w-[11px] rounded-full shrink-0 mt-1 relative z-10 transition-all"
                    style={{
                      backgroundColor:
                        i === 0
                          ? "hsl(var(--primary))"
                          : "hsl(var(--foreground) / 0.1)",
                    }}
                  />
                  <div>
                    <span className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-wider block mb-0.5">
                      {step.num} — {step.label}
                    </span>
                    <p
                      className="demo-label text-base font-bold tracking-tight transition-all"
                      style={{
                        opacity: i === 0 ? 1 : 0.3,
                      }}
                    >
                      {step.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Active step description */}
            <div className="mt-10 relative h-16">
              {DEMO_STEPS.map((step, i) => (
                <div
                  key={step.num}
                  ref={(el) => {
                    if (el) stepsRef.current[i] = el;
                  }}
                  className="absolute inset-0"
                  style={{
                    opacity: i === 0 ? 1 : 0,
                    transform: i === 0 ? "none" : "translateY(10px)",
                  }}
                >
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Video states (cross-fade) */}
          <div className="relative min-h-[400px]">
            {DEMO_VIDEOS.map((video, i) => (
              <div
                key={i}
                ref={(el) => {
                  if (el) mockupRefs.current[i] = el;
                }}
                className="absolute inset-0 flex items-center justify-center transition-none"
                style={{
                  opacity: i === 0 ? 1 : 0,
                  transform: i === 0 ? "scale(1)" : "scale(0.96)",
                  willChange: "opacity, transform",
                }}
              >
                <LazyVideo
                  webmSrc={video.webm}
                  mp4Src={video.mp4}
                  posterSrc={video.poster}
                  style={{ width: "100%", maxWidth: 520, aspectRatio: "4/3" }}
                  rootMargin="0px"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
