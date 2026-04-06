import { useEffect, useState, useRef } from "react";
import { ArrowRight, Check, X, Menu, FileText, Shield, Clock } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useIsAuthenticated } from "@/hooks/use-auth";
import {
  motion,
  useInView,
  useMotionValue,
  useMotionTemplate,
  useAnimationFrame,
} from "framer-motion";
import { GlowingEffect } from "@/components/ui/glowing-effect";

// ─── Constants ────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: "Product", href: "#features" },
  { label: "Workflow", href: "#workflow" },
];

const FADE_UP = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.25, 0.4, 0.25, 1] },
  }),
};

const FADE_IN = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" },
  }),
};

// ─── Layout primitives ────────────────────────────────────────────────────────
function Section({
  children,
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={`mx-auto max-w-[1400px] px-6 sm:px-8 lg:px-16 ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Bento card ───────────────────────────────────────────────────────────────
type GlowTier = "hero" | "feature" | "none";

const GLOW_PRESETS: Record<GlowTier, { spread: number; proximity: number; blur: number; borderWidth: number; disabled: boolean }> = {
  hero:    { spread: 240, proximity: 160, blur: 4, borderWidth: 2, disabled: false },
  feature: { spread: 180, proximity: 120, blur: 0, borderWidth: 1, disabled: false },
  none:    { spread: 120, proximity: 80,  blur: 0, borderWidth: 1, disabled: true },
};

function BentoCard({
  glow = "feature",
  className = "",
  children,
}: {
  glow?: GlowTier;
  className?: string;
  children: React.ReactNode;
}) {
  const preset = GLOW_PRESETS[glow];
  return (
    <div className={`relative bg-black p-8 sm:p-10 lg:p-14 ${className}`}>
      <GlowingEffect glow={!preset.disabled} {...preset} inactiveZone={0.18} />
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}

function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
      {children}
    </div>
  );
}

// ─── Product illustrations ────────────────────────────────────────────────────

function FitScorePanel() {
  return (
    <div className="mt-auto border border-white/[0.08] bg-[#080808] p-5 font-mono">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-widest text-white/50">Overall Score</span>
        <span className="border border-[#ff5a36]/30 px-2 py-0.5 text-[11px] uppercase tracking-widest text-[#ff5a36]">Good</span>
      </div>
      <div className="mb-5 text-6xl font-bold tracking-tighter text-white leading-none">
        81<span className="text-xl font-normal text-white/25">/100</span>
      </div>
      <div className="space-y-2.5">
        {[
          { label: "Scope clearly defined",        met: true },
          { label: "Timeline is achievable",        met: true },
          { label: "Financial terms are fair",      met: true },
          { label: "3 high-severity risk flags",    met: false },
        ].map(({ label, met }) => (
          <div key={label} className="flex items-center gap-3 text-[13px] text-white/65">
            <div className={`flex h-4 w-4 shrink-0 items-center justify-center ${met ? "bg-[#ff5a36]/15" : "bg-white/5"}`}>
              {met
                ? <Check className="h-2.5 w-2.5 text-[#ff5a36]" aria-hidden="true" />
                : <X className="h-2.5 w-2.5 text-white/25" aria-hidden="true" />}
            </div>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScopePanel() {
  const items = [
    { tag: "Creative",   text: "Brand identity refresh covering digital, print, and OOH touchpoints" },
    { tag: "Delivery",   text: "Campaign assets live by 14 March — no extensions without written approval" },
    { tag: "Financial",  text: "Fixed-fee engagement. All third-party costs pre-approved before commitment" },
    { tag: "Reporting",  text: "Monthly performance reviews with senior client contact, not account exec" },
  ];
  return (
    <div className="mt-auto border border-white/[0.08] bg-[#080808] p-5 font-mono">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-widest text-white/50">Extracted Requirements</span>
        <span className="text-[11px] text-white/25">14 items</span>
      </div>
      <div className="space-y-2.5">
        {items.map(({ tag, text }) => (
          <div key={tag} className="flex gap-3 border border-white/[0.06] bg-black/50 p-3">
            <span className="mt-0.5 shrink-0 border border-[#ff5a36]/25 px-1.5 py-0.5 text-[11px] uppercase tracking-widest text-[#ff5a36]/80">{tag}</span>
            <span className="text-[12px] leading-relaxed text-white/50">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BriefPanel() {
  return (
    <div className="mt-auto border border-white/[0.08] bg-[#080808] p-5 font-mono">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-bold text-white">Sports Brand Campaign RFP</span>
        <span className="border border-white/15 px-2 py-0.5 text-[11px] uppercase tracking-widest text-white/40">PDF</span>
      </div>
      <div className="space-y-3.5">
        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-widest text-white/35">Recommendation</div>
          <div className="text-sm font-bold text-[#ff5a36]">Bid — Strong fit, manageable risk</div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-widest text-white/35">Summary</div>
          <div className="space-y-1.5">
            <div className="h-1.5 w-full bg-white/[0.08]" />
            <div className="h-1.5 w-5/6 bg-white/[0.08]" />
            <div className="h-1.5 w-3/5 bg-white/[0.08]" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { label: "Deadline", value: "14 Mar 2026" },
                            { label: "Score",    value: "81/100", accent: true },
                            { label: "Flags",    value: "8 issues" },
          ].map(({ label, value, accent }) => (
            <div key={label} className="border border-white/[0.08] p-2.5">
              <div className="text-[11px] uppercase text-white/35">{label}</div>
              <div className={`mt-1 text-xs ${accent ? "font-bold text-[#ff5a36]" : "text-white/70"}`}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PipelinePanel() {
  const flags = [
    { category: "Timeline",  severity: "HIGH",   text: "Hero video required 4 weeks before launch — no buffer for revisions" },
    { category: "Financial", severity: "HIGH",   text: "Fixed fee with no provision for scope changes after briefing" },
    { category: "Creative",  severity: "MEDIUM", text: "Final approval rights reserved by client marketing committee" },
  ];
  return (
    <div className="border border-white/[0.08] bg-[#080808] p-5 font-mono flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-widest text-white/50">Risk flags</span>
        <span className="text-[11px] text-white/25">20 total · 3 high</span>
      </div>
      {flags.map(({ category, severity, text }) => (
        <div key={category} className="border border-white/[0.06] bg-black/50 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest text-white/40">{category}</span>
            <span className={`text-[11px] font-bold ${severity === "HIGH" ? "text-[#ff5a36]" : "text-white/40"}`}>{severity}</span>
          </div>
          <div className="text-[12px] leading-relaxed text-white/55">{text}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Hero grid background ──────────────────────────────────────────────────────
function GridLines({ offsetX, offsetY, id }: { offsetX: any; offsetY: any; id: string }) {
  return (
    <svg className="w-full h-full" aria-hidden="true">
      <defs>
        <motion.pattern
          id={id}
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="white"
            strokeWidth="0.5"
          />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function HeroGrid({ children, gridId = "hero-grid", className = "" }: { children: React.ReactNode; gridId?: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const gridOffsetX = useMotionValue(0);
  const gridOffsetY = useMotionValue(0);

  useAnimationFrame(() => {
    gridOffsetX.set((gridOffsetX.get() + 0.3) % 40);
    gridOffsetY.set((gridOffsetY.get() + 0.15) % 40);
  });

  const maskImage = useMotionTemplate`radial-gradient(600px circle at ${mouseX}px ${mouseY}px, black, transparent)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative ${className}`}
    >
      {/* Base grid — very subtle */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.06]">
        <GridLines offsetX={gridOffsetX} offsetY={gridOffsetY} id={`${gridId}-base`} />
      </div>

      {/* Mouse-reveal grid — brighter where cursor is */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 opacity-30"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        <GridLines offsetX={gridOffsetX} offsetY={gridOffsetY} id={`${gridId}-reveal`} />
      </motion.div>

      {/* Orange glow — top right, matching brand */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 75% 0%, rgba(255,90,54,0.12) 0%, transparent 70%)",
        }}
      />

      {children}
    </div>
  );
}

// ─── Hero product screenshot mock ─────────────────────────────────────────────
function HeroProductMock() {
  return (
    <div className="relative mx-auto mt-16 max-w-4xl">
      <div className="border border-white/[0.08] bg-[#060606]">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
          </div>
          <div className="ml-3 font-mono text-[11px] text-white/30">angle/rfp — Sports Brand Campaign RFP</div>
        </div>
        {/* Dashboard mock */}
        <div className="grid grid-cols-12 gap-px bg-white/[0.04] p-px">
          {/* Sidebar */}
          <div className="col-span-3 bg-[#070707] p-4 hidden sm:block">
            <div className="space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-widest text-white/30 mb-4">Analysis</div>
              {["Executive Brief", "Fit Score", "Scope Map", "Risk Register", "Timeline"].map((item, i) => (
                <div key={item} className={`px-3 py-2 text-[13px] ${i === 0 ? "bg-white/[0.04] text-white/80 font-medium" : "text-white/35"}`}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          {/* Main content */}
          <div className="col-span-12 sm:col-span-9 bg-[#080808] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-white">Sports Brand Campaign RFP</div>
                <div className="mt-1 font-mono text-[11px] text-white/35">Uploaded 2 minutes ago · 34 pages extracted</div>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <div className="border border-white/10 px-3 py-1.5 font-mono text-[11px] uppercase text-white/40">Export PDF</div>
                <div className="bg-[#ff5a36] px-4 py-1.5 text-[13px] font-bold text-white">Bid — 74/100</div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Deadline",     value: "14 Mar 2026", icon: Clock },
                { label: "Requirements", value: "12 extracted", icon: FileText },
                { label: "Risk flags",   value: "8 issues",    icon: Shield },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="border border-white/[0.06] bg-black/30 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className="h-3 w-3 text-white/25" />
                    <span className="font-mono text-[11px] uppercase tracking-widest text-white/35">{label}</span>
                  </div>
                  <div className="text-sm font-medium text-white/75">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5">
              <div className="h-2 w-full bg-white/[0.04]" />
              <div className="h-2 w-11/12 bg-white/[0.04]" />
              <div className="h-2 w-4/5 bg-white/[0.04]" />
              <div className="h-2 w-9/12 bg-white/[0.04]" />
            </div>
          </div>
        </div>
      </div>
      {/* Gradient fade at bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useIsAuthenticated();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/upload");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#ff5a36]/30 overflow-x-hidden">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-[#ff5a36] focus:text-white focus:px-4 focus:py-2 focus:font-bold focus:text-sm"
      >
        Skip to main content
      </a>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 lg:px-12 py-5 max-w-[1400px] mx-auto border-b border-white/[0.06]">
        <Link
          href="/"
          className="font-bold text-lg tracking-tight text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
          aria-label="angle/rfp home"
        >
          angle<span className="text-white/35">/rfp</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-10 text-[11px] font-mono text-white/40 uppercase tracking-[0.15em]">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="hover:text-white/80 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4 md:gap-6 text-sm font-medium">
          <Link
            href="/sign-in"
            className="text-white/50 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="bg-[#ff5a36] text-white px-5 py-2 font-bold text-[13px] hover:bg-[#ff5a36]/90 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Try free
          </Link>
          <button
            className="md:hidden text-white/60 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff5a36]"
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ── Mobile menu ── */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="fixed inset-0 z-50 bg-black/95 flex flex-col px-8 pt-8 pb-12"
        >
          <div className="flex items-center justify-between mb-12">
            <span className="font-bold text-lg tracking-tight">
              angle<span className="text-white/35">/rfp</span>
            </span>
            <button
              className="text-white/60 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff5a36]"
              aria-label="Close navigation menu"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Mobile navigation" className="flex flex-col gap-6">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-2xl font-bold text-white/80 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff5a36]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-4">
            <Link
              href="/sign-up"
              className="block bg-[#ff5a36] text-white text-center py-4 font-bold text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              Try free
            </Link>
            <Link
              href="/sign-in"
              className="block text-center text-white/50 py-3 font-medium hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff5a36]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign in
            </Link>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main id="main-content" tabIndex={-1}>

        {/* ━━━ Hero ━━━ */}
        <section id="features" className="max-w-[1400px] mx-auto" aria-labelledby="hero-heading">
          <HeroGrid>
          <div className="relative z-10 px-6 sm:px-8 lg:px-16 pt-16 lg:pt-28 pb-6">
            <AnimatedSection>
              <motion.h1
                id="hero-heading"
                className="text-[clamp(2.75rem,5.5vw+1rem,7rem)] leading-[0.92] font-extrabold tracking-[-0.04em] mb-7 max-w-4xl text-balance"
                variants={FADE_UP}
                custom={0}
              >
                Bid qualification for{" "}
                <span className="text-[#ff5a36] italic">Saudi agencies.</span>
              </motion.h1>
              <motion.p
                className="text-white/50 text-lg sm:text-xl max-w-lg mb-10 leading-relaxed"
                variants={FADE_UP}
                custom={1}
              >
                Upload an RFP. angle turns it into a go / no-go brief with
                commercial risks, deadline pressure, and agency-fit judgment in minutes.
              </motion.p>
              <motion.div className="flex flex-wrap items-center gap-5" variants={FADE_UP} custom={2}>
                <Link
                  href="/sign-up"
                  className="bg-white text-black px-7 py-3.5 font-bold hover:bg-white/90 transition-colors text-[15px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
                >
                  Start qualifying RFPs
                </Link>
              </motion.div>
            </AnimatedSection>

            {/* Hero product visual */}
            <AnimatedSection>
              <motion.div variants={FADE_UP} custom={3}>
                <HeroProductMock />
              </motion.div>
            </AnimatedSection>
          </div>
          </HeroGrid>
        </section>

        {/* ━━━ Stats strip ━━━ */}
        <section className="border-y border-white/[0.06] bg-black" aria-label="Key metrics">
          <AnimatedSection>
            <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4">
              {[
                { value: "1",   unit: " brief",      label: "to start" },
                { value: "~7",  unit: " min",        label: "qualification pass" },
                { value: "6",   unit: " lenses",     label: "budget to risk" },
                { value: "Bid", unit: " / No-Bid",   label: "decision output" },
              ].map(({ value, unit, label }, i) => (
                <motion.div
                  key={label}
                  className={`p-7 sm:p-10 md:p-12 ${i < 3 ? "border-b md:border-b-0 md:border-r" : ""} border-white/[0.06]`}
                  variants={FADE_IN}
                  custom={i}
                >
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-3 tracking-tighter text-white leading-none">
                    {value}<span className={`text-white/25 ${i === 3 ? "text-xl sm:text-2xl lg:text-3xl" : "text-2xl sm:text-3xl lg:text-4xl"}`}>{unit}</span>
                  </div>
                  <div className="text-white/45 font-mono text-[11px] uppercase tracking-[0.14em]">{label}</div>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </section>

        {/* ━━━ Bento grid ━━━ */}
        <section id="workflow" className="max-w-[1400px] mx-auto pt-24 sm:pt-28 pb-12" aria-labelledby="bento-heading">
          <AnimatedSection className="px-6 sm:px-8 lg:px-16">
            <motion.h2
              id="bento-heading"
              className="text-[clamp(1.75rem,3.5vw+0.5rem,4rem)] leading-[1.05] font-bold mb-14 tracking-tight text-white max-w-3xl text-balance"
              variants={FADE_UP}
              custom={0}
            >
              Stop spending senior time on the wrong pursuits.{" "}
              <span className="text-[#ff5a36]">Qualify before you pitch.</span>
            </motion.h2>
          </AnimatedSection>

          <div className="px-6 sm:px-8 lg:px-16">
            <div className="grid gap-px bg-white/[0.06] md:grid-cols-12">

              {/* Row 1 — Decision layer (hero, 5 cols) + Scope extraction (7 cols) */}
              <AnimatedSection className="md:col-span-5">
                <motion.div variants={FADE_UP} custom={0} className="h-full">
                  <BentoCard glow="hero" className="h-full">
                    <MonoLabel>Decision layer</MonoLabel>
                    <h3 className="text-[clamp(1.25rem,1.8vw+0.5rem,2rem)] font-bold leading-[1.15] text-white text-balance">
                      Know whether to pursue before the pitch team starts working.
                    </h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-white/50 max-w-sm">
                      Upload the brief. angle scores agency fit, surfaces commercial and contractual issues,
                      and gives leadership a clear bid / no-bid read.
                    </p>
                    <FitScorePanel />
                  </BentoCard>
                </motion.div>
              </AnimatedSection>

              <AnimatedSection className="md:col-span-7">
                <motion.div variants={FADE_UP} custom={1} className="h-full">
                  <BentoCard glow="none" className="h-full bg-[#050505]">
                    <MonoLabel>Scope extraction</MonoLabel>
                    <h3 className="text-xl sm:text-2xl font-bold text-white text-balance">
                      Every requirement, extracted into an internal decision view.
                    </h3>
                    <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/50">
                      Scope, deadlines, submission load, and commercial clauses are separated so the team can judge the opportunity, not just read it.
                    </p>
                    <ScopePanel />
                  </BentoCard>
                </motion.div>
              </AnimatedSection>

              {/* Row 2 — Recommendation engine (5 cols) + Executive brief (4 cols) + Platform (3 cols) */}
              <AnimatedSection className="md:col-span-5">
                <motion.div variants={FADE_UP} custom={2} className="h-full">
                  <BentoCard glow="feature" className="h-full">
                    <MonoLabel>Risk analysis</MonoLabel>
                    <h3 className="text-xl sm:text-2xl font-bold text-white text-balance">
                      Agency risks ranked by commercial impact.
                    </h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-white/50">
                      Unlimited revisions, under-scoped budgets, exclusivity issues, and timeline pressure are framed for agency decision-making.
                    </p>
                    <div className="mt-auto space-y-2 pt-6">
                      {[
                        { label: "Severity", value: "HIGH — Aggressive parallel timeline" },
                        { label: "Clause ref", value: "Project Duration, page 22" },
                      ].map(({ label, value }) => (
                        <div key={label} className="border border-white/[0.06] bg-[#050505] px-4 py-3">
                          <div className="font-mono text-[11px] uppercase tracking-widest text-white/40">{label}</div>
                          <div className="mt-1 text-[13px] text-white/70">{value}</div>
                        </div>
                      ))}
                    </div>
                  </BentoCard>
                </motion.div>
              </AnimatedSection>

              <AnimatedSection className="md:col-span-4">
                <motion.div variants={FADE_UP} custom={3} className="h-full">
                  <BentoCard glow="none" className="h-full bg-[#050505]">
                    <MonoLabel>Executive brief</MonoLabel>
                    <h3 className="text-xl sm:text-2xl font-bold text-white text-balance">
                      A short internal brief leadership can act on.
                    </h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-white/50">
                      Recommendation, budget adequacy, pursuit cost, and key risks in one exportable briefing pack.
                    </p>
                    <BriefPanel />
                  </BentoCard>
                </motion.div>
              </AnimatedSection>

              <AnimatedSection className="md:col-span-3">
                <motion.div variants={FADE_UP} custom={4} className="h-full">
                  <BentoCard glow="none" className="h-full flex flex-col justify-between">
                    <div>
                      <MonoLabel>Built for the beachhead</MonoLabel>
                      <h3 className="text-xl font-bold leading-tight text-white text-balance">
                        Saudi creative, branding, and integrated agencies deciding what to chase next.
                      </h3>
                    </div>
                    <Link
                      href="/sign-up"
                      className="mt-8 inline-flex items-center gap-2 font-mono text-[13px] font-bold uppercase tracking-widest text-[#ff5a36] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
                    >
                      Get started <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </Link>
                  </BentoCard>
                </motion.div>
              </AnimatedSection>

              {/* Row 3 — Delivery view (full width) */}
              <AnimatedSection className="md:col-span-12">
                <motion.div variants={FADE_UP} custom={5} className="h-full">
                  <BentoCard glow="feature" className="bg-[#050505]">
                    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
                      <div className="flex flex-col justify-between gap-6">
                        <div>
                          <MonoLabel>Analysis view</MonoLabel>
                          <h3 className="text-[clamp(1.25rem,1.8vw+0.5rem,2rem)] font-bold text-white text-balance">
                            The decision surface for new business teams.
                          </h3>
                          <p className="mt-3 text-[15px] leading-relaxed text-white/50 max-w-lg">
                            One screen for scope fit, commercial risk, submission complexity, and the recommendation leadership actually needs.
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {[
                            { label: "Recommendation", value: "Good — bid" },
                            { label: "Risk flags",      value: "20 identified" },
                            { label: "High severity",   value: "3 flagged" },
                          ].map(({ label, value }) => (
                            <div key={label} className="border border-white/[0.06] bg-black px-4 py-3">
                              <div className="font-mono text-[11px] uppercase tracking-widest text-white/40">{label}</div>
                              <div className="mt-1 text-[13px] text-white/70">{value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <PipelinePanel />
                    </div>
                  </BentoCard>
                </motion.div>
              </AnimatedSection>

            </div>
          </div>
        </section>

        {/* ━━━ Bottom CTA — quiet decrescendo ━━━ */}
        <section aria-labelledby="cta-heading">
          <HeroGrid gridId="cta-grid" className="py-20 sm:py-28">
          <AnimatedSection className="relative z-10 max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-16">
            <motion.div variants={FADE_UP} custom={0}>
              <h2
                id="cta-heading"
                className="text-[clamp(2rem,3.5vw+0.75rem,4.5rem)] font-extrabold mb-6 tracking-tighter leading-[0.95] text-balance"
              >
                One RFP. <span className="text-[#ff5a36] italic">One bid decision.</span>
              </h2>
              <p className="text-white/45 text-base sm:text-lg mb-8 max-w-md leading-relaxed">
                Upload the brief and know whether it deserves pitch effort before the day is out.
              </p>
              <Link
                href="/sign-up"
                className="inline-block bg-white text-black px-8 py-3.5 font-bold hover:bg-white/90 transition-colors text-[15px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
              >
                Start qualifying RFPs
              </Link>
            </motion.div>
          </AnimatedSection>
          </HeroGrid>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] bg-black py-14" aria-label="Site footer">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-16 flex flex-col md:flex-row items-center justify-between gap-7">
          <Link
            href="/"
            className="font-bold text-xl tracking-tight text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
            aria-label="angle/rfp home"
          >
            angle<span className="text-white/35">/rfp</span>
          </Link>
          <nav aria-label="Footer navigation" className="flex items-center gap-8 text-[11px] font-bold font-mono text-white/30 uppercase tracking-[0.15em] flex-wrap justify-center">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="hover:text-white/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a36]"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-16 mt-10 text-[11px] text-white/20 flex flex-col sm:flex-row justify-between gap-4 font-mono tracking-wide uppercase">
          <div>&copy; {new Date().getFullYear()} Angle Strategy. All rights reserved.</div>
          <div>angle/rfp by Angle Strategy</div>
        </div>
      </footer>
    </div>
  );
}
