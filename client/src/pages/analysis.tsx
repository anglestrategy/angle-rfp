import { Suspense, lazy, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Trash2,
  CheckCircle2,
  Loader2,
  FileText,
  Download,
  AlertTriangle,
} from "lucide-react";
import { useIsAuthenticated } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CollapsibleSection,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible-section";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  staggerContainer, staggerItem, staggerItemScale, staggerFast,
  dashboardRow, dashboardCard, fadeInUp, scaleIn,
  springs, easings, viewportOnce, transitions,
} from "@/lib/motion";
// PDF is now generated server-side via Puppeteer

const CommandStrip = lazy(() =>
  import("@/components/analysis/CommandStrip").then((module) => ({ default: module.CommandStrip })),
);
const ExecutiveBrief = lazy(() =>
  import("@/components/analysis/ExecutiveBrief").then((module) => ({ default: module.ExecutiveBrief })),
);
const ScopePanel = lazy(() =>
  import("@/components/analysis/ScopePanel").then((module) => ({ default: module.ScopePanel })),
);
const RiskRegister = lazy(() =>
  import("@/components/analysis/RiskRegister").then((module) => ({ default: module.RiskRegister })),
);
const ClientIntel = lazy(() =>
  import("@/components/analysis/ClientIntel").then((module) => ({ default: module.ClientIntel })),
);
const ContractTermsPanel = lazy(() =>
  import("@/components/analysis/ContractTermsPanel").then((module) => ({ default: module.ContractTermsPanel })),
);
const SubmissionPanel = lazy(() =>
  import("@/components/analysis/SubmissionPanel").then((module) => ({ default: module.SubmissionPanel })),
);
const TimelinePanel = lazy(() =>
  import("@/components/analysis/TimelinePanel").then((module) => ({ default: module.TimelinePanel })),
);
const ScoringBreakdown = lazy(() =>
  import("@/components/analysis/ScoringBreakdown").then((module) => ({ default: module.ScoringBreakdown })),
);
const ClarificationSection = lazy(() =>
  import("@/components/analysis/ClarificationSection").then((module) => ({ default: module.ClarificationSection })),
);
const ShadowComparePanel = lazy(() =>
  import("@/components/analysis/ShadowComparePanel").then((module) => ({ default: module.ShadowComparePanel })),
);
const ShimmerBar = lazy(() =>
  import("@/components/ui/shimmer-bar").then((module) => ({ default: module.ShimmerBar })),
);
import type { RfpAnalysis } from "@shared/schema";
import type {
  AnalysisDocumentQuality,
  AnalysisMeta,
  ShadowComparisonSummary,
  ShadowOutputs,
} from "@shared/models/analysis";

type AnalysisWithRuns = RfpAnalysis & {
  liveStages?: any[];
  shadowStages?: any[];
};

function PageSectionFallback({ height = "min-h-[160px]" }: { height?: string }) {
  return (
    <div className={`border border-white/[0.06] bg-[#050505] p-4 ${height}`}>
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

/* ── Processing Steps with descriptive messages ── */
const STEPS = [
  {
    key: "uploading",
    label: "Uploading document",
    detail: "Transferring to secure analysis pipeline",
    shortLabel: "Upload",
  },
  {
    key: "parsing",
    label: "Parsing content",
    detail: "Extracting text, tables, and structure",
    shortLabel: "Parse",
  },
  {
    key: "extracting",
    label: "Deep extraction",
    detail: "Requirements, risks, terms, and scope",
    shortLabel: "Extract",
  },
  {
    key: "scoring",
    label: "Scoring & assessment",
    detail: "Calculating fit score and generating brief",
    shortLabel: "Score",
  },
];

function getStepIndex(status: string) {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

/* ── Stagger Text (for ProcessingView) ── */
function ProcessingStaggerText({
  text,
  className = "",
  charDelay = 0.04,
  startDelay = 0,
}: {
  text: string;
  className?: string;
  charDelay?: number;
  startDelay?: number;
}) {
  return (
    <span className={className} aria-label={text}>
      {text.split("").map((char, i) => (
        <motion.span
          key={`${char}-${i}`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: startDelay + i * charDelay,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className="inline-block"
          style={{ display: char === " " ? "inline" : "inline-block" }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </span>
  );
}

/* ── Elapsed Timer Hook ── */
function useElapsedTimer() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/* ── Animated Number ── */
function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(tick);
      else prevRef.current = to;
    }
    requestAnimationFrame(tick);
  }, [value, duration]);

  return <>{display}</>;
}

/* ── Processing View — Cinematic Full-Viewport Experience ── */
function ProcessingView({
  fileName,
  status,
  currentPass,
}: {
  fileName: string;
  status: string;
  currentPass: number;
}) {
  const activeStep = getStepIndex(status);
  const elapsedTime = useElapsedTimer();
  const [isComplete, setIsComplete] = useState(false);
  const prevStepRef = useRef(activeStep);

  // Progress percentage: 0→25→50→75→100
  const progressPercent = status === "complete" ? 100 : activeStep * 25;

  // Tab title update (Bruno Simon pattern)
  useEffect(() => {
    if (status === "complete") {
      document.title = "Complete ✓ | angle/rfp";
    } else {
      document.title = `Analyzing... ${progressPercent}% | angle/rfp`;
    }
    return () => {
      document.title = "angle/rfp";
    };
  }, [status, progressPercent]);

  // Track step changes for wipe animation
  useEffect(() => {
    prevStepRef.current = activeStep;
  }, [activeStep]);

  // Completion state
  useEffect(() => {
    if (status === "complete") {
      const timer = setTimeout(() => setIsComplete(true), 400);
      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Grain overlay */}
      <svg className="hidden">
        <filter id="processing-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] dark:opacity-[0.02]"
        style={{ filter: "url(#processing-grain)" }}
      />

      {/* Decorative editorial grid lines */}
      <div className="editorial-grid fixed inset-0 pointer-events-none" />

      {/* Main content — centered vertically */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-24 py-16 max-w-[1200px] w-full mx-auto">
        <AnimatePresence mode="wait">
          {!isComplete ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.5 }}
            >
              {/* ── Massive Title ── */}
              <div className="mb-8 sm:mb-12">
                <h1 className="font-display font-black tracking-tight leading-[0.85] text-foreground"
                    style={{ fontSize: "clamp(48px, 10vw, 100px)" }}>
                  <ProcessingStaggerText text="ANALYZING" charDelay={0.04} />
                </h1>
                {/* Pulsing terracotta accent line */}
                <motion.div
                  className="h-[2px] bg-primary mt-4"
                  initial={{ width: 0 }}
                  animate={{ width: 80, opacity: [1, 0.5, 1] }}
                  transition={{
                    width: { duration: 0.8, delay: 0.5, ease: "easeOut" },
                    opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                  }}
                />
              </div>

              {/* ── Full-Width Progress Bar (2px, ultra-minimal) ── */}
              <div className="mb-10 sm:mb-14">
                <div className="w-full h-[2px] bg-foreground/10 rounded-full overflow-hidden progress-track-glow">
                  <motion.div
                    className="h-full bg-primary shimmer-bar elastic-progress"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="font-mono text-[11px] text-muted-foreground tracking-wider uppercase">
                    Step {activeStep + 1} of {STEPS.length}
                  </span>
                  <span className="font-mono text-[11px] text-foreground tabular-nums">
                    <AnimatedNumber value={progressPercent} />%
                  </span>
                </div>
              </div>

              {/* ── Step List — Numbered Editorial Style ── */}
              <div className="space-y-3 sm:space-y-4 mb-10 sm:mb-14">
                {STEPS.map((step, i) => {
                  const isCurrent = i === activeStep;
                  const isDone = i < activeStep;

                  return (
                    <motion.div
                      key={step.key}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.08, duration: 0.5, ease: "easeOut" }}
                      className="flex items-baseline gap-3 sm:gap-4"
                    >
                      {/* Step number / check */}
                      <span className={`font-mono text-[13px] tabular-nums w-5 flex-shrink-0 ${
                        isDone ? "text-primary" : isCurrent ? "text-foreground" : "text-muted-foreground/25"
                      }`}>
                        {isDone ? "✓" : `0${i + 1}`}
                      </span>

                      {/* Arrow for active step */}
                      {isCurrent && (
                        <motion.span
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-primary text-sm flex-shrink-0"
                        >
                          →
                        </motion.span>
                      )}

                      {/* Step label with wipe reveal for active + detail text */}
                      <div className={`transition-all duration-300 ${
                        isCurrent
                          ? "text-foreground"
                          : isDone
                            ? "text-muted-foreground"
                            : "text-muted-foreground/25"
                      }`}>
                        <span className={`text-sm sm:text-base ${
                          isCurrent ? "font-medium" : isDone ? "line-through decoration-muted-foreground/30" : ""
                        }`}>
                          {isCurrent ? (
                            <motion.span
                              key={`active-${step.key}`}
                              initial={{ clipPath: "inset(0 100% 0 0)" }}
                              animate={{ clipPath: "inset(0 0% 0 0)" }}
                              transition={{ duration: 0.4, ease: "easeOut" }}
                              className="inline-block"
                            >
                              {step.label}
                              {step.key === "extracting" && (
                                <span className="font-mono text-xs text-muted-foreground">
                                  {" "}· Pass{" "}
                                  <motion.span
                                    key={currentPass}
                                    initial={{ scale: 1.4, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                                    className="inline-block"
                                  >
                                    {currentPass || 1}
                                  </motion.span>
                                  {" "}of 4
                                </span>
                              )}
                            </motion.span>
                          ) : (
                            step.label
                          )}
                        </span>
                        {/* Detail text for active step */}
                        {isCurrent && (
                          <motion.p
                            initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0 }}
                            animate={{ clipPath: "inset(0 0% 0 0)", opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                            className="text-xs text-muted-foreground mt-0.5 font-mono"
                          >
                            {step.detail}
                          </motion.p>
                        )}
                      </div>

                      {/* Spinning indicator for active step */}
                      {isCurrent && (
                        <motion.div
                          className="ml-auto flex-shrink-0"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <div className="w-3 h-3 border border-primary border-t-transparent rounded-full" />
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* ── Footer: File name & Elapsed Timer ── */}
              <div className="border-t border-foreground/10 pt-4 sm:pt-6">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-mono text-[11px] text-muted-foreground truncate max-w-[60%]" title={fileName}>
                    {fileName}
                  </p>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums flex-shrink-0">
                    {elapsedTime} elapsed
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── Completion State ── */
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="text-center"
            >
              <h1
                className="font-display font-black tracking-tight text-primary leading-[0.85] mb-4"
                style={{ fontSize: "clamp(48px, 10vw, 100px)" }}
              >
                COMPLETE
              </h1>
              <motion.div
                className="h-[2px] bg-primary mx-auto mb-6"
                initial={{ width: 0 }}
                animate={{ width: 120 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
              {/* Particle burst effect — small animated dots */}
              <div className="relative h-8 mb-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-primary"
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      x: Math.cos((i / 12) * Math.PI * 2) * 60,
                      y: Math.sin((i / 12) * Math.PI * 2) * 30,
                      opacity: 0,
                      scale: 0,
                    }}
                    transition={{
                      duration: 0.8,
                      delay: 0.1 + i * 0.03,
                      ease: "easeOut",
                    }}
                  />
                ))}
              </div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                Analysis ready · Redirecting...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Error View ── */
function ErrorView({ message }: { message: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full mx-4 border border-white/[0.08] bg-[#050505] p-10"
      >
        <div className="mb-6 inline-flex border border-red-500/20 bg-red-500/10 p-3 text-red-400">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white mb-2">Analysis Failed</h2>
        <p className="text-sm text-white/40 leading-relaxed mb-8">{message}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setLocation("/upload")}
            data-testid="button-try-again"
            className="w-full bg-white text-black px-6 py-3 text-sm font-bold hover:bg-white/90 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
          >
            Try another file
          </button>
          <button
            onClick={() => setLocation("/")}
            data-testid="link-back-home"
            className="w-full border border-white/[0.08] px-6 py-3 text-sm font-medium text-white/50 hover:text-white hover:border-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
          >
            Back to home
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/*  Dashboard Side Navigation                            */
/* ────────────────────────────────────────────────────── */

interface NavSection {
  id: string;
  label: string;
}

// Zones map to full horizontal bands of the page — top to bottom.
// The two-column grid (Scope/Risks/Scoring/etc.) is one single zone.
const NAV_SECTIONS: NavSection[] = [
  { id: "sec-brief",        label: "Brief" },
  { id: "sec-metrics",      label: "Metrics" },
  { id: "sec-deliverables", label: "Deliverables" },
  { id: "sec-grid",         label: "Analysis" },
];

const HEADER_H = 56;

function DashboardSideNav() {
  const [activeId, setActiveId] = useState<string>("");
  const [presentIds, setPresentIds] = useState<string[]>([]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const present = NAV_SECTIONS
        .filter((s) => !!document.getElementById(s.id))
        .map((s) => s.id);
      setPresentIds(present);
      if (present.length > 0) setActiveId(present[0]);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (presentIds.length === 0) return;

    const getActive = () => {
      const triggerY = window.scrollY + HEADER_H + 40;
      let bestId = presentIds[0];
      let bestTop = -Infinity;

      presentIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= triggerY && top > bestTop) {
          bestTop = top;
          bestId = id;
        }
      });

      setActiveId(bestId);
    };

    getActive();
    window.addEventListener("scroll", getActive, { passive: true });
    return () => window.removeEventListener("scroll", getActive);
  }, [presentIds]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_H - 12;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  const sectionsToShow = NAV_SECTIONS.filter((s) => presentIds.includes(s.id));
  if (sectionsToShow.length === 0) return null;

  return (
    <div className="hidden xl:flex flex-col w-[152px] shrink-0 print:hidden">
      <div className="sticky top-[56px] pt-5">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/20 mb-3 px-3">
          Analysis
        </p>
        <nav className="space-y-0.5">
          {sectionsToShow.map((section) => {
            const isActive = activeId === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollTo(section.id)}
                className={[
                  "w-full text-left px-3 py-[7px] text-[12px] transition-all duration-150 border-l-2",
                  isActive
                    ? "border-l-[#ff5a36] bg-white/[0.04] text-white font-medium"
                    : "border-l-transparent text-white/30 hover:text-white/60 hover:bg-white/[0.02]",
                ].join(" ")}
              >
                {section.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/*  Dashboard View                                        */
/* ────────────────────────────────────────────────────── */
function DashboardView({ analysis }: { analysis: AnalysisWithRuns }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [decisionValue, setDecisionValue] = useState<string>(
    (analysis as any)?.pursuitDecision?.userDecision || "",
  );
  const [decisionReason, setDecisionReason] = useState<string>(
    (analysis as any)?.pursuitDecision?.overrideReason || "",
  );
  const [outcomeValue, setOutcomeValue] = useState<string>(
    (analysis as any)?.pursuitOutcome?.outcome || "",
  );
  const [outcomeNotes, setOutcomeNotes] = useState<string>(
    (analysis as any)?.pursuitOutcome?.notes || "",
  );

  const handleDelete = useCallback(async () => {
    try {
      await apiRequest("DELETE", `/api/analyses/${analysis.id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      toast({ title: "Analysis deleted" });
      setLocation("/");
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
    setDeleteOpen(false);
  }, [analysis.id, setLocation, toast]);

  const saveDecision = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/analyses/${analysis.id}/decision`, {
        userDecision: decisionValue,
        overrideReason: decisionReason || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/analyses", String(analysis.id), "complete"] });
      toast({ title: "Decision saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save decision", description: error.message, variant: "destructive" });
    },
  });

  const saveOutcome = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/analyses/${analysis.id}/outcome`, {
        outcome: outcomeValue,
        notes: outcomeNotes || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/analyses", String(analysis.id), "complete"] });
      toast({ title: "Outcome saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save outcome", description: error.message, variant: "destructive" });
    },
  });

  /* ── Data extraction ── */
  const extracted = (analysis.extractedData as any) ?? {};
  const core = extracted?.coreExtraction ?? {};
  const scope = (analysis.scopeAnalysis as any) ?? {};
  const client = (analysis.clientResearch as any) ?? {};
  const financial = (analysis.financialScore as any) ?? {};
  const redFlags = (analysis.redFlags as any) ?? {};
  const shadowOutputs = (analysis.shadowOutputs as ShadowOutputs | null) ?? null;
  const pursuitDecision = (analysis as any)?.pursuitDecision ?? null;
  const pursuitOutcome = (analysis as any)?.pursuitOutcome ?? null;
  const comparisonSummary =
    (analysis.comparisonSummary as ShadowComparisonSummary | null) ??
    shadowOutputs?.comparisonSummary ??
    null;
  const completeness = extracted?.completenessAssessment ?? {};
  const score = analysis.overallScore ?? 0;
  const recommendation = analysis.recommendation || "N/A";
  const calibrationState =
    (analysis as any)?.calibrationState ||
    financial?.calibrationState ||
    "default";
  const calibrationDrivers = Array.isArray(financial?.calibrationDrivers)
    ? financial.calibrationDrivers
    : Array.isArray((analysis as any)?.calibrationDrivers)
      ? (analysis as any).calibrationDrivers
      : [];
  const showShadowAdmin =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("shadow") === "1";

  const hasScope = analysis.scopeAnalysis != null;
  const hasClient = analysis.clientResearch != null;
  const hasExtracted = analysis.extractedData != null;

  /* ── Scope ── */
  let scopeCategories: any[] = [];
  if (Array.isArray(scope?.categoryBreakdown)) {
    scopeCategories = scope.categoryBreakdown.map((c: any) => ({
      ...c,
      fullMatches: c.fullMatches ?? c.full ?? 0,
      partialMatches: c.partialMatches ?? c.partial ?? 0,
      gaps: c.gaps ?? c.gap ?? 0,
    }));
  } else if (scope?.categoryBreakdown && typeof scope.categoryBreakdown === "object") {
    scopeCategories = Object.entries(scope.categoryBreakdown)
      .map(([name, counts]: [string, any]) => ({
        name,
        fullMatches: counts.full ?? counts.fullMatches ?? 0,
        partialMatches: counts.partial ?? counts.partialMatches ?? 0,
        gaps: counts.gap ?? counts.gaps ?? 0,
      }))
      .filter((c) => c.fullMatches > 0 || c.partialMatches > 0 || c.gaps > 0);
  }

  const fullMatches = scope?.fullMatchCount ?? scope?.fullMatches ?? 0;
  const partialMatches = scope?.partialMatchCount ?? scope?.partialMatches ?? 0;
  const gaps = scope?.gapCount ?? scope?.gaps ?? 0;
  const agencyServicePct = scope?.agencyServicePercentage ?? scope?.matchPercentage ?? 0;

  // Transform matches so matchedService is always a string
  const scopeMatches: any[] | undefined = Array.isArray(scope?.matches)
    ? scope.matches.map((m: any) => ({
        ...m,
        matchedService:
          typeof m.matchedService === "object"
            ? m.matchedService?.name || ""
            : m.matchedService || "",
      }))
    : undefined;

  /* ── Financial ── */
  const factors = Array.isArray(financial?.factors)
    ? financial.factors
    : Array.isArray(financial?.scoringFactors)
      ? financial.scoringFactors
      : [];

  /* ── Red flags ── */
  let redFlagList: any[] = [];
  if (Array.isArray(redFlags)) redFlagList = redFlags;
  else if (Array.isArray(redFlags?.redFlags)) redFlagList = redFlags.redFlags;
  else if (Array.isArray(redFlags?.flags)) redFlagList = redFlags.flags;
  if (redFlagList.length === 0 && extracted?.redFlagAnalysis) {
    const rfa = extracted.redFlagAnalysis;
    if (Array.isArray(rfa?.redFlags)) redFlagList = rfa.redFlags;
    else if (Array.isArray(rfa?.flags)) redFlagList = rfa.flags;
    else if (Array.isArray(rfa)) redFlagList = rfa;
  }
  const riskSummary = extracted?.redFlagAnalysis?.riskSummary || null;

  /* ── Client ── */
  const clientInfo = client?.clientProfile ?? client ?? {};

  /* ── Timeline & dates ── */
  let dates: any[] = [];
  if (Array.isArray(core?.keyDates)) dates = core.keyDates;
  else if (Array.isArray(core?.dates)) dates = core.dates;
  if (core?.timeline?.keyMilestones && Array.isArray(core.timeline.keyMilestones)) {
    dates = [...dates, ...core.timeline.keyMilestones];
  }

  /* ── Clarification ── */
  let missingInfo: any[] = [];
  if (Array.isArray(completeness?.missingItems)) missingInfo = completeness.missingItems;
  else if (Array.isArray(completeness?.missingInformation)) missingInfo = completeness.missingInformation;
  else if (Array.isArray(completeness?.gaps)) missingInfo = completeness.gaps;

  let clarificationQuestions: string[] = [];
  if (Array.isArray(completeness?.clarificationQuestions)) clarificationQuestions = completeness.clarificationQuestions;

  let contradictions: any[] = [];
  if (Array.isArray(completeness?.contradictions)) contradictions = completeness.contradictions;

  /* ── Misc ── */
  const outputCounts = scope?.outputCounts ?? scope?.deliverableCounts ?? {};
  const phases = core?.scopeOfWork?.phases || [];
  const flatDeliverables = core?.deliverables || [];
  const evalCriteria = core?.evaluationCriteria || [];
  const submission = core?.submissionRequirements || {};
  const contractTerms = core?.contractTerms || {};
  const teamReqs = core?.teamRequirements || {};
  const executiveSummary = core?.executiveSummary || "";

  let totalDeliverableCount = 0;
  if (Array.isArray(phases) && phases.length > 0) {
    for (const phase of phases) {
      totalDeliverableCount += Array.isArray(phase.deliverables) ? phase.deliverables.length : 0;
    }
  } else {
    totalDeliverableCount = Array.isArray(flatDeliverables) ? flatDeliverables.length : 0;
  }

  const budgetStr = core?.budget?.totalBudget
    ? `${core.budget.totalBudget}${core.budget.currency ? " " + core.budget.currency : ""}`
    : undefined;
  const deadlineStr = submission?.deadline || core?.submissionDeadline || undefined;
  const durationStr =
    core?.timeline?.overallDuration ||
    (core?.timeline?.durationMonths ? `${core.timeline.durationMonths} months` : undefined);

  const [pdfLoading, setPdfLoading] = useState(false);

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const response = await fetch(`/api/analyses/${analysis.id}/pdf`);
      if (!response.ok) {
        throw new Error(`PDF generation failed: ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(analysis.fileName || "rfp-brief").replace(/\.[^.]+$/, "")}_executive_brief.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        title: "PDF Export Failed",
        description: err.message || "Could not generate the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="min-h-screen print:min-h-0 relative bg-black text-white">
      {/* ── Subtle grain texture ── */}
      <svg className="hidden" aria-hidden="true">
        <filter id="dashboard-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.025] print:hidden"
        style={{ filter: "url(#dashboard-grain)" }}
      />

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/[0.06] print:hidden">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-2.5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <motion.div whileHover={{ x: -3 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Button variant="ghost" size="icon" onClick={() => setLocation("/upload")} data-testid="button-back">
                <ArrowLeft />
              </Button>
            </motion.div>
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/30">RFP Analysis</span>
            <span className="text-white/20">/</span>
            <span className="text-sm font-medium truncate max-w-[200px] md:max-w-[400px]">
              {analysis.fileName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={pdfLoading} className="gap-2 font-mono text-[11px] uppercase tracking-[0.12em]">
                {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {pdfLoading ? "Generating..." : "Export PDF"}
              </Button>
            </motion.div>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-delete">
                  <Trash2 />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Analysis</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this analysis? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDelete} data-testid="button-confirm-delete">Delete</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* ── Decision Bar ── */}
      {analysis && (
        <div className="bg-[#050505] border-b border-white/[0.06] print:hidden">
          <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Decision</span>
                <select
                  value={decisionValue}
                  onChange={(event) => setDecisionValue(event.target.value)}
                  className="border border-white/[0.08] bg-black px-3 py-1.5 text-sm min-w-[140px]"
                >
                  <option value="">Select</option>
                  <option value="bid">Bid</option>
                  <option value="no-bid">No-bid</option>
                  <option value="bid-with-conditions">Bid with conditions</option>
                </select>
                <input
                  value={decisionReason}
                  onChange={(event) => setDecisionReason(event.target.value)}
                  placeholder="Reason (optional)"
                  className="flex-1 border border-white/[0.08] bg-black px-3 py-1.5 text-sm max-w-[300px] hidden sm:block"
                />
                <button
                  onClick={() => saveDecision.mutate()}
                  disabled={!decisionValue || saveDecision.isPending}
                  className="bg-white px-3 py-1.5 text-sm font-bold text-black disabled:opacity-40 whitespace-nowrap"
                >
                  {saveDecision.isPending ? "..." : pursuitDecision ? "Saved" : "Save"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Outcome</span>
                <select
                  value={outcomeValue}
                  onChange={(event) => setOutcomeValue(event.target.value)}
                  className="border border-white/[0.08] bg-black px-3 py-1.5 text-sm min-w-[120px]"
                >
                  <option value="">Select</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="declined">Declined</option>
                  <option value="no_submission">No submission</option>
                </select>
                <button
                  onClick={() => saveOutcome.mutate()}
                  disabled={!outcomeValue || saveOutcome.isPending}
                  className="border border-white/[0.08] px-3 py-1.5 text-sm font-bold text-white disabled:opacity-40 whitespace-nowrap"
                >
                  {saveOutcome.isPending ? "..." : pursuitOutcome ? "Saved" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12 pt-4 pb-8">
        {/* ── Two-column: side nav + content ── */}
        <div className="flex gap-0 xl:gap-6">

          {/* ── Side nav (xl+ only) ── */}
          <DashboardSideNav />

          {/* ── Scrollable content ── */}
          <div className="flex-1 min-w-0">

        {/* ═══════════════════════════════════════════════════
            ROW 1 — HERO: Brief (left) + Score (right)
            Single cohesive unit — editorial layout
        ═══════════════════════════════════════════════════ */}
        <div id="sec-brief">
        <motion.div
          className="mb-3"
          variants={dashboardRow}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={dashboardCard}>
            <Suspense fallback={<PageSectionFallback height="min-h-[220px]" />}>
              <div className="flex items-stretch gap-6 lg:gap-8">
                {/* Left: Executive brief — takes remaining space */}
                <div className="flex-1 min-w-0">
                  <ExecutiveBrief
                    projectTitle={core?.projectTitle}
                    executiveSummary={executiveSummary}
                    rationale={financial?.rationale || financial?.summary}
                    industry={core?.industry}
                    duration={durationStr}
                    deliverableCount={totalDeliverableCount}
                    budget={budgetStr}
                    fileName={analysis.fileName}
                    createdAt={analysis.createdAt}
                    recommendation={recommendation}
                    budgetAdequacy={financial?.budgetAdequacy}
                    pitchCostEstimate={financial?.pitchCostEstimate}
                    submissionComplexity={financial?.submissionComplexity}
                  />
                </div>

                {/* Right: Score — compact typographic accent */}
                <div className="hidden lg:flex shrink-0 w-[140px] border-l border-white/[0.06]">
                  <CommandStrip
                    score={score}
                    recommendation={recommendation}
                    clientName={clientInfo?.companyName || core?.clientName}
                    deadline={deadlineStr}
                    budget={budgetStr}
                    industry={core?.industry}
                    riskLevel={riskSummary?.overallRiskLevel}
                    layout="hero"
                  />
                </div>
              </div>
            </Suspense>
          </motion.div>
        </motion.div>
        </div>

        {/* ═══════════════════════════════════════════════════
            ROW 2 — METRICS STRIP: 3 compact KPI cards
        ═══════════════════════════════════════════════════ */}
        <div id="sec-metrics">
        <motion.div
          className="mb-3"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <Suspense fallback={<PageSectionFallback height="min-h-[96px]" />}>
            <CommandStrip
              score={score}
              recommendation={recommendation}
              clientName={clientInfo?.companyName || core?.clientName}
              deadline={deadlineStr}
              budget={budgetStr}
              industry={core?.industry}
              riskLevel={riskSummary?.overallRiskLevel}
              layout="strip"
            />
          </Suspense>
        </motion.div>

        {showShadowAdmin && (
          <motion.div
            className="mb-3"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
          >
            <Suspense fallback={<PageSectionFallback height="min-h-[180px]" />}>
              <ShadowComparePanel
                shadowRunStatus={analysis.shadowRunStatus}
                manualReviewRequired={analysis.manualReviewRequired}
                comparisonSummary={comparisonSummary}
                shadowOutputs={shadowOutputs}
                analysisMeta={(analysis.analysisMeta as AnalysisMeta | null) ?? null}
                documentQuality={(analysis.documentQuality as AnalysisDocumentQuality | null) ?? null}
                reviewReasons={Array.isArray(analysis.reviewReasons) ? (analysis.reviewReasons as string[]) : []}
                liveStages={Array.isArray(analysis.liveStages) ? analysis.liveStages : []}
                shadowStages={Array.isArray(analysis.shadowStages) ? analysis.shadowStages : []}
                liveScore={score}
                liveRecommendation={recommendation}
              />
            </Suspense>
          </motion.div>
        )}
        </div>{/* /sec-metrics */}

        {/* ═══════════════════════════════════════════════════
            ROW 3 — DELIVERABLES: Full-width for breathing room
        ═══════════════════════════════════════════════════ */}
        <div id="sec-deliverables">
        {Array.isArray(phases) && phases.length > 0 && (
          <motion.div
            className="mb-3"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            <div className="border border-white/[0.06] bg-[#050505]">
              <div className="pt-4 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="panel-heading">Deliverables</p>
                  <span className="font-mono text-[10px] text-muted-foreground/70">
                    {phases.length} phase{phases.length !== 1 ? "s" : ""} · {totalDeliverableCount} items
                  </span>
                </div>
                <div className="space-y-0">
                  {phases.map((phase: any, idx: number) => {
                    const phaseDeliverables = Array.isArray(phase.deliverables) ? phase.deliverables : [];
                    return (
                      <CollapsibleSection key={idx} value={`phase-${idx}`} className="border-b border-foreground/6">
                        <CollapsibleTrigger className="py-2 row-hover">
                          <div className="flex items-center gap-3 text-sm flex-1 mr-2">
                            <span className="font-mono text-[10px] text-muted-foreground/50 w-4 text-right shrink-0 tabular-nums">
                              {idx + 1}
                            </span>
                            <span className="font-medium text-left text-sm">{phase.name || `Phase ${idx + 1}`}</span>
                            <span className="font-mono text-[10px] text-muted-foreground/60 ml-auto">{phaseDeliverables.length}</span>
                            {phase.timeline && (
                              <span className="font-mono text-[10px] text-muted-foreground/50">{phase.timeline}</span>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="pl-6">
                            {phase.description && (
                              <p className="text-[11px] text-muted-foreground/70 mb-2 leading-relaxed">{phase.description}</p>
                            )}
                            {phaseDeliverables.map((d: any, di: number) => {
                              const name = typeof d === "string" ? d : d.name || d.description || "";
                              const qty = typeof d === "object" ? d.quantity : null;
                              const fmt = typeof d === "object" ? d.format : null;
                              return (
                                <div key={di} className="flex items-start gap-2 py-1 text-xs border-b border-foreground/6 last:border-0 row-hover">
                                  <span className="font-mono text-[9px] text-muted-foreground/40 w-3 text-right shrink-0 tabular-nums pt-[1px]">{di + 1}</span>
                                  <span className="flex-1 leading-relaxed">{name}</span>
                                  {qty && qty > 1 && (
                                    <span className="font-mono text-[9px] text-muted-foreground/60 shrink-0">×{qty}</span>
                                  )}
                                  {fmt && <span className="font-mono text-[9px] text-muted-foreground/50 shrink-0">{fmt}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </CollapsibleSection>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Flat deliverables fallback */}
        {(!Array.isArray(phases) || phases.length === 0) &&
          Array.isArray(flatDeliverables) &&
          flatDeliverables.length > 0 && (
            <motion.div
              className="mb-3"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: 0.08 }}
            >
              <div className="border border-white/[0.06] bg-[#050505]">
                <div className="pt-4 pb-4 px-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="panel-heading">Deliverables</p>
                    <span className="font-mono text-[10px] text-muted-foreground/70">
                      {flatDeliverables.length} items
                    </span>
                  </div>
                  <div className="space-y-0">
                    {flatDeliverables.map((d: any, i: number) => (
                      <div key={i} className="flex items-start gap-2.5 py-1.5 text-xs border-b border-foreground/6 last:border-0 row-hover">
                        <span className="font-mono text-[10px] text-muted-foreground/50 w-4 text-right shrink-0 tabular-nums">{i + 1}</span>
                        <span className="leading-relaxed">{typeof d === "string" ? d : d.name || JSON.stringify(d)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>{/* /sec-deliverables */}

        {/* ═══════════════════════════════════════════════════
            ROW 4 — MAIN GRID: 7/5 two-column dashboard
        ═══════════════════════════════════════════════════ */}
        <div id="sec-grid">
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-12 gap-3"
          variants={dashboardRow}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          {/* ── LEFT COLUMN (7 cols) ── */}
          <motion.div className="lg:col-span-7 space-y-3" variants={staggerContainer}>
            <motion.div variants={staggerItem}>
              <div id="sec-scope">
              <Suspense fallback={<PageSectionFallback />}>
                <ScopePanel
                  hasScope={hasScope}
                  fullMatches={fullMatches}
                  partialMatches={partialMatches}
                  gaps={gaps}
                  agencyServicePct={agencyServicePct}
                  matches={scopeMatches}
                  scopeCategories={scopeCategories}
                  outputCounts={outputCounts}
                />
              </Suspense>
              </div>
            </motion.div>

            <motion.div variants={staggerItem}>
              <div id="sec-scoring">
              <Suspense fallback={<PageSectionFallback />}>
                <ScoringBreakdown factors={factors} financial={financial} />
              </Suspense>
              </div>
            </motion.div>

            <motion.div variants={staggerItem}>
              <div id="sec-timeline">
              <Suspense fallback={<PageSectionFallback />}>
                <TimelinePanel
                  dates={dates}
                  overallDuration={durationStr}
                  startDate={core?.timeline?.startDate}
                  endDate={core?.timeline?.endDate}
                  submissionDeadline={deadlineStr}
                />
              </Suspense>
              </div>
            </motion.div>

            <motion.div variants={staggerItem}>
              <div id="sec-client">
              <Suspense fallback={<PageSectionFallback />}>
                <ClientIntel
                  clientInfo={clientInfo}
                  clientName={core?.clientName}
                  industry={core?.industry}
                  hasData={hasClient || hasExtracted}
                />
              </Suspense>
              </div>
            </motion.div>
          </motion.div>

          {/* ── RIGHT COLUMN (5 cols) ── */}
          <motion.div className="lg:col-span-5 flex flex-col gap-3" variants={staggerContainer}>
            <motion.div variants={staggerItemScale}>
              <div id="sec-risks">
              <Suspense fallback={<PageSectionFallback />}>
                <RiskRegister redFlagList={redFlagList} riskSummary={riskSummary} />
              </Suspense>
              </div>
            </motion.div>

            <motion.div variants={staggerItemScale}>
              <div id="sec-clarifications">
              <Suspense fallback={<PageSectionFallback />}>
                <ClarificationSection
                  clarificationQuestions={clarificationQuestions}
                  missingInfo={missingInfo}
                  contradictions={contradictions}
                />
              </Suspense>
              </div>
            </motion.div>

            <motion.div variants={staggerItemScale}>
              <div id="sec-submission">
              <Suspense fallback={<PageSectionFallback />}>
                <SubmissionPanel submission={submission} />
              </Suspense>
              </div>
            </motion.div>

            <motion.div variants={staggerItemScale}>
              <div id="sec-contract">
              <Suspense fallback={<PageSectionFallback />}>
                <ContractTermsPanel contractTerms={contractTerms} />
              </Suspense>
              </div>
            </motion.div>

            {/* Evaluation Criteria */}
            {Array.isArray(evalCriteria) && evalCriteria.length > 0 && (
              <motion.div variants={staggerItemScale}>
                <div className="border border-white/[0.06] bg-[#050505]">
                  <div className="pt-4 pb-4 px-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="panel-heading">Evaluation Criteria</p>
                    </div>
                    <div className="space-y-1">
                      {evalCriteria.map((crit: any, i: number) => {
                        const name =
                          typeof crit === "string"
                            ? crit
                            : crit.criterion || crit.name || `Criterion ${i + 1}`;
                        const weight = typeof crit === "object" ? crit.weight : null;
                        const desc = typeof crit === "object" ? crit.description : null;
                        return (
                          <div key={i} className="row-hover px-3 py-1.5 -mx-3">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-medium">{name}</span>
                              {weight && (
                                <span className="text-xs font-mono tabular-nums font-semibold">
                                  {weight}<span className="text-muted-foreground/50 text-[10px]">%</span>
                                </span>
                              )}
                            </div>
                            {weight && (
                              <ShimmerBar
                                value={Math.min(weight, 100)}
                                delay={i * 0.03}
                                height="h-1"
                                className="mt-1"
                                showGlow={false}
                              />
                            )}
                            {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Team Requirements */}
            {(teamReqs?.keyRoles?.length > 0 ||
              teamReqs?.certifications?.length > 0 ||
              teamReqs?.localContentRequirements) && (
              <motion.div variants={staggerItemScale}>
                <div className="border border-white/[0.06] bg-[#050505]">
                  <div className="pt-4 pb-4 px-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="panel-heading">Team Requirements</p>
                    </div>
                    {Array.isArray(teamReqs.keyRoles) && teamReqs.keyRoles.length > 0 && (
                      <div className="mb-3">
                        <p className="swiss-data-label mb-2">Key Roles</p>
                        <div className="space-y-1">
                          {teamReqs.keyRoles.map((role: any, i: number) => (
                            <div key={i} className="row-hover px-3 py-1.5 -mx-3">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-xs font-medium">{role.role}</p>
                                {role.experienceYears && (
                                  <span className="font-mono text-[9px] text-muted-foreground/60 shrink-0">
                                    {role.experienceYears}+ yr
                                  </span>
                                )}
                              </div>
                              {role.qualifications && (
                                <p className="text-[10px] text-muted-foreground/70 leading-relaxed mt-0.5">{role.qualifications}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {Array.isArray(teamReqs.certifications) && teamReqs.certifications.length > 0 && (
                      <div className="mb-2">
                        <p className="swiss-data-label mb-2">Certifications</p>
                        <div className="flex flex-wrap gap-1.5">
                          {teamReqs.certifications.map((cert: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[9px] no-default-hover-elevate">
                              {cert}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {teamReqs.localContentRequirements && (
                      <div>
                        <p className="swiss-data-label mb-1">Local Content</p>
                        <p className="text-xs">{teamReqs.localContentRequirements}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
        </div>{/* /sec-grid */}

        {/* Evidence Trail — collapsed at bottom */}
        <motion.div
          className="mt-3"
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <div className="border-t border-foreground/8 pt-4">
            <CollapsibleSection value="evidence">
              <CollapsibleTrigger className="py-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Evidence Trail</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div data-lenis-prevent className="space-y-3 max-h-[500px] overflow-y-auto overscroll-contain">
                  {Object.entries(core).map(([key, value]) => {
                    if (
                      !value ||
                      (typeof value === "object" && Object.keys(value as object).length === 0)
                    )
                      return null;
                    return (
                      <div key={key}>
                        <p className="swiss-data-label mb-1">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </p>
                        <pre className="text-[10px] bg-foreground/[0.03] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono">
                          {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                        </pre>
                      </div>
                    );
                  })}
                  {Object.keys(core).length === 0 && (
                    <p className="text-sm text-muted-foreground/50 italic">No extracted data available</p>
                  )}
                </div>
              </CollapsibleContent>
            </CollapsibleSection>
          </div>
        </motion.div>

          </div>{/* /flex-1 scrollable content */}
        </div>{/* /flex row with side nav */}
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:min-h-0 { min-height: 0 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .sticky { position: relative !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Main Export ── */
export default function AnalysisPage() {
  const [, params] = useRoute("/analysis/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const { user, isLoading: authLoading, isAuthenticated } = useIsAuthenticated();

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/sign-in");
    }
  }, [authLoading, setLocation, user]);

  const { data: statusData, isLoading: statusLoading } = useQuery<{
    status: string;
    currentPass: number;
    overallScore: number | null;
    recommendation: string | null;
    shadowRunStatus?: string | null;
    manualReviewRequired?: boolean | null;
    runStatus?: string | null;
    stageKey?: string | null;
    retryCount?: number;
    analysisMeta?: AnalysisMeta | null;
    documentQuality?: AnalysisDocumentQuality | null;
    reviewReasons?: string[] | null;
  }>({
    queryKey: ["/api/analyses", id, "status"],
    refetchInterval: (query) => {
      const data = query.state.data as any;
      if (!data) return 2000;
      if (data.status === "complete" || data.status === "error") return false;
      return 2000;
    },
    enabled: !!id && isAuthenticated,
  });

  const status = statusData?.status;

  const { data: analysis, isLoading: analysisLoading } = useQuery<AnalysisWithRuns>({
    queryKey: ["/api/analyses", id, "complete"],
    queryFn: async () => {
      const res = await fetch(`/api/analyses/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!id && isAuthenticated && status === "complete",
    staleTime: 0,
  });

  const { data: basicAnalysis } = useQuery<AnalysisWithRuns>({
    queryKey: ["/api/analyses", id, "basic"],
    queryFn: async () => {
      const res = await fetch(`/api/analyses/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!id && isAuthenticated && (status === "error" || (!!status && status !== "complete")),
  });

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Invalid analysis ID</p>
      </div>
    );
  }

  if (authLoading || (!isAuthenticated && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (status === "error") {
    return <ErrorView message={basicAnalysis?.errorMessage || "An unknown error occurred."} />;
  }

  if (status !== "complete") {
    return (
      <ProcessingView
        fileName={basicAnalysis?.fileName || `Analysis #${id}`}
        status={status || "uploading"}
        currentPass={statusData?.currentPass || 0}
      />
    );
  }

  if (analysisLoading || !analysis) {
    return (
      <div className="min-h-screen">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-8 space-y-6">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="lg:col-span-7 h-64 w-full" />
            <Skeleton className="lg:col-span-5 h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return <DashboardView analysis={analysis} />;
}
