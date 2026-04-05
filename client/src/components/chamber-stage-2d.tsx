// client/src/components/chamber-stage-2d.tsx
import { useEffect, useRef } from "react";
import { chamberScrollState } from "./chamber-scroll-state";

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */
const FONT_DISPLAY = "'Playfair Display', serif";
const FONT_BODY    = "'Outfit', sans-serif";
const FONT_MONO    = "'IBM Plex Mono', monospace";
const AMBER        = "#d4814a";
const AMBER_RGB    = "212,129,74";
const TEXT_HI      = "rgba(240,238,235,";   // warm white prefix
const BG           = "#08080a";

/* ═══════════════════════════════════════════════════════════════════════════
   MATH
   ═══════════════════════════════════════════════════════════════════════════ */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp  = (a: number, b: number, t: number) => a + (b - a) * t;
const easeIO = (t: number) => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const easeInOutQuint = (t: number) =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/* ═══════════════════════════════════════════════════════════════════════════
   CARD DATA
   ═══════════════════════════════════════════════════════════════════════════ */
const CARDS = [
  { id: "requirements", label: "REQUIREMENTS",    accent: "#c8806a", rgb: "200,128,106" },
  { id: "risk",         label: "RISK VECTORS",    accent: "#4d9e7a", rgb: "77,158,122"  },
  { id: "terms",        label: "CLAUSE ANALYSIS", accent: "#c4a855", rgb: "196,168,85"  },
  { id: "scope",        label: "SCOPE BOUNDS",    accent: "#7e82b8", rgb: "126,130,184" },
] as const;

const CARD_W   = 260;
const CARD_H   = 360;
const SPACING  = CARD_W + 20;
const SPREAD_X = [-1.5, -0.5, 0.5, 1.5].map((n) => n * SPACING);
const ROTATIONS = [-4, -1.5, 1.5, 4];

/* ═══════════════════════════════════════════════════════════════════════════
   FRAGMENTS — RFP text with depth layers
   Layer 0 = close/large  |  Layer 1 = mid  |  Layer 2 = far/small
   ═══════════════════════════════════════════════════════════════════════════ */
const FRAGMENTS = [
  { text: "must demonstrate SOC 2 Type II compliance",          layer: 0 },
  { text: "liability shall not exceed total contract value",    layer: 1 },
  { text: "vendor shall provide 99.99% uptime guarantee",      layer: 2 },
  { text: "response deadline: 14 business days",                layer: 0 },
  { text: "encryption at rest and in transit required",         layer: 1 },
  { text: "indemnification clause per Section 8.2",             layer: 2 },
  { text: "maximum contract term of 36 months",                layer: 1 },
  { text: "proof of ISO 27001 certification mandatory",         layer: 0 },
  { text: "annual security audit reports required",             layer: 2 },
  { text: "data residency within continental United States",    layer: 1 },
];

const LAYER_STYLE: Record<number, { size: number; baseAlpha: number; blur: number }> = {
  0: { size: 15, baseAlpha: 0.50, blur: 0   },
  1: { size: 11, baseAlpha: 0.30, blur: 0.5 },
  2: { size: 9,  baseAlpha: 0.16, blur: 1.2 },
};

const FRAG_SEEDS = FRAGMENTS.map((_, i) => ({
  x:     8 + ((i * 31 + i * i * 7) % 78),
  speed: 0.5 + ((i * 17) % 60) / 100,
  rot:   -14 + ((i * 9) % 28),
  angle: (i * 137.5 * Math.PI) / 180,       // golden-angle radial scatter
}));

/* ═══════════════════════════════════════════════════════════════════════════
   DATA-CLUSTER POSITIONS (pixel offsets from center)
   Quadrant layout prevents the overlapping mess.
   ═══════════════════════════════════════════════════════════════════════════ */
const CLUSTER_POS = {
  req:    { x: -220, y: -70 },
  risk:   { x:  220, y: -70 },
  clause: { x: -190, y:  90 },
  scope:  { x:  190, y:  90 },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   PARTICLES (ambient floating dots — CSS animated, scroll-opacity-driven)
   ═══════════════════════════════════════════════════════════════════════════ */
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  size: 1 + (i % 3),
  x: (i * 17 + i * i * 3) % 100,
  y: (i * 23 + i * i * 5) % 100,
  dur: 20 + i * 2.3,
  delay: -i * 1.7,
  alpha: 0.06 + (i % 5) * 0.025,
}));

/* ═══════════════════════════════════════════════════════════════════════════
   CARD CONTENT COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function RequirementsContent({ accent, rgb }: { accent: string; rgb: string }) {
  const rows = [
    { label: "Security certifications", met: true },
    { label: "API compatibility", met: true },
    { label: "SLA guarantees", met: true },
    { label: "Data residency", met: true },
    { label: "Audit logging", met: false },
    { label: "Role-based access", met: false },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
      {rows.map((row, i) => (
        <div
          key={i}
          className="ch-row"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            opacity: 0, animationDelay: `${i * 80}ms`,
          }}
        >
          <div style={{
            width: 14, height: 14, borderRadius: 3, flexShrink: 0,
            border: `1.5px solid rgba(${rgb},0.4)`,
            background: row.met ? `rgba(${rgb},0.2)` : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {row.met && <div style={{ width: 6, height: 6, borderRadius: 1, background: accent }} />}
          </div>
          <span style={{
            fontSize: 10, letterSpacing: "0.06em", flex: 1,
            color: `rgba(${rgb},${row.met ? 0.85 : 0.45})`, fontFamily: FONT_MONO,
            textTransform: "uppercase", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{row.label}</span>
          <span style={{
            fontSize: 8, fontWeight: 600, color: row.met ? accent : `rgba(255,255,255,0.2)`,
            fontFamily: FONT_MONO, letterSpacing: "0.1em",
          }}>{row.met ? "MET" : "—"}</span>
        </div>
      ))}
    </div>
  );
}

function RiskContent({ accent, rgb }: { accent: string; rgb: string }) {
  const ARC_R = 38;
  const CIRC  = 2 * Math.PI * ARC_R;
  const threats = [
    { label: "VENDOR LOCK-IN", sev: "HIGH", pct: 0.82 },
    { label: "COMPLIANCE GAP", sev: "MED",  pct: 0.55 },
    { label: "PRICING DRIFT",  sev: "LOW",  pct: 0.28 },
  ];
  const sevColor: Record<string, string> = { HIGH: "#e07070", MED: "#e0b870", LOW: accent };
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
        <svg width={96} height={96} viewBox="0 0 96 96">
          <circle cx={48} cy={48} r={42} fill="none" stroke={`rgba(${rgb},0.06)`} strokeWidth="0.5" />
          <circle cx={48} cy={48} r={ARC_R} fill="none" stroke={`rgba(${rgb},0.12)`} strokeWidth={3} />
          <circle
            className="ch-arc"
            cx={48} cy={48} r={ARC_R} fill="none"
            stroke={accent} strokeWidth={3} strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * 0.30}
            transform="rotate(-90 48 48)"
            style={{ opacity: 0 }}
          />
          {Array.from({length: 24}).map((_, i) => {
            const ang = (i / 24) * 360 - 90;
            const rad = ang * Math.PI / 180;
            const r1 = i % 6 === 0 ? 33 : 35;
            return (
              <line key={i} x1={48 + Math.cos(rad) * r1} y1={48 + Math.sin(rad) * r1}
                x2={48 + Math.cos(rad) * 38} y2={48 + Math.sin(rad) * 38}
                stroke={`rgba(${rgb},${i % 6 === 0 ? 0.2 : 0.07})`} strokeWidth={i % 6 === 0 ? 0.8 : 0.4} />
            );
          })}
          <text x={48} y={46} textAnchor="middle" dominantBaseline="central"
            fill={accent} fontSize={16} fontWeight={700} fontFamily={FONT_BODY}>70</text>
          <text x={48} y={58} textAnchor="middle" dominantBaseline="central"
            fill={`rgba(${rgb},0.4)`} fontSize={7} fontWeight={500} fontFamily={FONT_MONO}
            letterSpacing="0.15em">RISK</text>
        </svg>
      </div>
      {threats.map((t, i) => (
        <div key={i} className="ch-row" style={{ opacity: 0, animationDelay: `${100 + i * 100}ms` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: "0.1em",
              color: "#fff", padding: "2px 7px", borderRadius: 3,
              background: sevColor[t.sev], opacity: 0.85,
            }}>{t.sev}</span>
            <span style={{
              fontSize: 9.5, letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.5)", fontFamily: FONT_MONO,
            }}>{t.label}</span>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div className="ch-bar" style={{
              height: "100%", width: `${t.pct * 100}%`,
              background: sevColor[t.sev], opacity: 0.7,
              transform: "scaleX(0)", transformOrigin: "left",
              animationDelay: `${200 + i * 100}ms`,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ClauseContent({ accent, rgb }: { accent: string; rgb: string }) {
  const clauses = [
    { num: "§1.2", flag: false },
    { num: "§3.1", flag: true  },
    { num: "§5.4", flag: false },
    { num: "§7.2", flag: true  },
    { num: "§9.1", flag: false },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
      {clauses.map((c, i) => (
        <div key={i} className="ch-row" style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "6px 8px", borderRadius: 5,
          background: c.flag ? `rgba(${rgb},0.08)` : "rgba(255,255,255,0.02)",
          border: c.flag ? `1px solid rgba(${rgb},0.18)` : "1px solid rgba(255,255,255,0.04)",
          opacity: 0, animationDelay: `${i * 80}ms`,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: accent,
            fontFamily: FONT_MONO, letterSpacing: "0.05em", minWidth: 28,
          }}>{c.num}</span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{
              height: 5, borderRadius: 2, background: `rgba(${rgb},0.22)`,
              width: `${60 + (i * 13) % 40}%`,
            }} />
            <div style={{
              height: 4, borderRadius: 2, background: `rgba(${rgb},0.10)`,
              width: `${40 + (i * 17) % 35}%`,
            }} />
          </div>
          {c.flag ? (
            <div style={{
              fontSize: 7, fontWeight: 700, color: "#fff",
              padding: "2px 6px", borderRadius: 3,
              background: `rgba(${rgb},0.45)`, letterSpacing: "0.08em",
            }}>FLAG</div>
          ) : (
            <div style={{
              fontSize: 7, fontWeight: 600, color: `rgba(${rgb},0.3)`,
              fontFamily: FONT_MONO, letterSpacing: "0.1em",
            }}>OK</div>
          )}
        </div>
      ))}
    </div>
  );
}

function ScopeContent({ accent, rgb }: { accent: string; rgb: string }) {
  const cells = [1,1,1,0, 1,1,2,0, 1,2,0,0, 2,0,0,0, 0,0,0,0];
  const cellBg = (s: number) =>
    s === 1 ? `rgba(${rgb},0.35)` : s === 2 ? `rgba(${rgb},0.15)` : "rgba(255,255,255,0.03)";
  const coverage = cells.filter((s) => s === 1).length / cells.length;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="ch-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, opacity: 0,
      }}>
        {cells.map((s, i) => (
          <div key={i} style={{
            height: 26, borderRadius: 3, background: cellBg(s),
            border: s === 2 ? `1px solid rgba(${rgb},0.35)` : `1px solid rgba(255,255,255,0.03)`,
          }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { lbl: "IN SCOPE", bg: `rgba(${rgb},0.35)` },
          { lbl: "EDGE",     bg: `rgba(${rgb},0.15)` },
          { lbl: "OUT",      bg: "rgba(255,255,255,0.05)" },
        ].map((l) => (
          <div key={l.lbl} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: l.bg }} />
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: FONT_MONO, letterSpacing: "0.08em" }}>{l.lbl}</span>
          </div>
        ))}
      </div>
      <div className="ch-row" style={{ opacity: 0, animationDelay: "200ms" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: FONT_MONO, letterSpacing: "0.1em" }}>COVERAGE</span>
          <span style={{ fontSize: 14, color: accent, fontFamily: FONT_BODY, fontWeight: 700 }}>{Math.round(coverage * 100)}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div className="ch-bar" style={{
            height: "100%", width: `${coverage * 100}%`,
            background: `linear-gradient(90deg, ${accent}, rgba(${rgb},0.6))`, opacity: 0.7,
            transform: "scaleX(0)", transformOrigin: "left",
          }} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export function ChamberStage2D() {
  /* ── Refs ────────────────────────────────────────────────────────────── */
  const cardRefs     = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const scoreRef     = useRef<HTMLDivElement>(null);
  const arcRef       = useRef<SVGCircleElement>(null);
  const countRef     = useRef<HTMLSpanElement>(null);
  const activeRef    = useRef<boolean[]>([false, false, false, false]);
  const orbAmberRef  = useRef<HTMLDivElement>(null);
  const orbVioletRef = useRef<HTMLDivElement>(null);
  const orbNeutralRef = useRef<HTMLDivElement>(null);
  const orbBloomRef  = useRef<HTMLDivElement>(null);
  const timeRef      = useRef(0);

  // Narrative
  const fragmentRefs   = useRef<(HTMLDivElement | null)[]>(new Array(FRAGMENTS.length).fill(null));
  const headlineRef    = useRef<HTMLDivElement>(null);
  const subtitleRef    = useRef<HTMLDivElement>(null);
  const scrollHintRef  = useRef<HTMLDivElement>(null);

  // Data clusters
  const transTextRef     = useRef<HTMLDivElement>(null);
  const scanLineRef      = useRef<HTMLDivElement>(null);
  const scanGlowRef      = useRef<HTMLDivElement>(null);
  const reqClusterRef    = useRef<HTMLDivElement>(null);
  const riskClusterRef   = useRef<HTMLDivElement>(null);
  const clauseClusterRef = useRef<HTMLDivElement>(null);
  const scopeClusterRef  = useRef<HTMLDivElement>(null);
  const connLineRef      = useRef<SVGSVGElement>(null);
  const labelReqRef      = useRef<HTMLDivElement>(null);
  const labelRiskRef     = useRef<HTMLDivElement>(null);
  const labelClauseRef   = useRef<HTMLDivElement>(null);
  const labelScopeRef    = useRef<HTMLDivElement>(null);
  const convergeTextRef  = useRef<HTMLDivElement>(null);

  // Transition effects
  const flashRef     = useRef<HTMLDivElement>(null);
  const scoreGlowRef = useRef<HTMLDivElement>(null);

  // End acts
  const proofRef     = useRef<HTMLDivElement>(null);
  const proofActive  = useRef(false);
  const ctaRef       = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);

  /* ── Animation loop ──────────────────────────────────────────────────── */
  useEffect(() => {
    const ARC_CIRC = 2 * Math.PI * 76;
    let raf: number;

    const loop = () => {
      const sp = chamberScrollState.progress;

      /* ── 9-ACT TIMELINE ───────────────────────────────────────────── */
      const weightT     = clamp(sp / 0.10, 0, 1);
      const fractureT   = clamp((sp - 0.10) / 0.10, 0, 1);
      const eyeT        = clamp((sp - 0.20) / 0.12, 0, 1);
      const patternT    = clamp((sp - 0.32) / 0.12, 0, 1);
      const structureT  = clamp((sp - 0.44) / 0.12, 0, 1);
      const convergeT   = clamp((sp - 0.54) / 0.10, 0, 1);
      const revealT     = clamp((sp - 0.61) / 0.04, 0, 1);
      const spreadT     = clamp((sp - 0.63) / 0.07, 0, 1);
      const easedSpread = easeOutBack(clamp(spreadT, 0, 1));
      const foldT       = clamp((sp - 0.70) / 0.07, 0, 1);
      const easedFold   = easeInOutQuint(foldT);
      const scoreT      = clamp((sp - 0.74) / 0.07, 0, 1);
      const easedScore  = easeOutExpo(scoreT);
      const proofT      = clamp((sp - 0.81) / 0.10, 0, 1);
      const ctaT        = clamp((sp - 0.91) / 0.09, 0, 1);

      /* ── Ambient time ─────────────────────────────────────────────── */
      timeRef.current += 0.003;
      const t = timeRef.current;

      /* ── PARTICLES — scroll-driven opacity ────────────────────────── */
      if (particlesRef.current) {
        const pIn  = clamp(sp * 8, 0, 1);
        const pOut = clamp((sp - 0.88) / 0.12, 0, 1);
        particlesRef.current.style.opacity = String(pIn * (1 - pOut));
      }

      /* ── ACT 1–2: FLOATING RFP FRAGMENTS ─────────────────────────── */
      fragmentRefs.current.forEach((frag, i) => {
        if (!frag) return;
        const seed = FRAG_SEEDS[i];
        const layer = LAYER_STYLE[FRAGMENTS[i].layer];

        // Rise from bottom during Act 1
        const riseY = 100 - easeOutExpo(weightT) * (30 + seed.speed * 28);
        // Radial scatter during Act 2 (golden-angle directions)
        const scatterDist = fractureT * (70 + seed.speed * 45);
        const sx = seed.x + Math.cos(seed.angle) * scatterDist;
        const sy = riseY  - Math.sin(seed.angle) * scatterDist * 0.4;
        // Rotation intensifies during scatter
        const rot = seed.rot * (1 + fractureT * 3);

        // Opacity: visible during weight, fades during fracture
        const alpha = easeOutExpo(weightT) * layer.baseAlpha * Math.max(0, 1 - fractureT * 1.8);

        // Amber highlight on select fragments before they scatter
        const isHighlighted = i === 0 || i === 3 || i === 7;
        const hl = isHighlighted ? clamp(fractureT * 2 - 0.2, 0, 1) * 0.7 : 0;

        frag.style.transform = `translateY(${sy}%) rotate(${rot}deg)`;
        frag.style.left   = `${sx}%`;
        frag.style.opacity = String(alpha);

        if (hl > 0.01) {
          frag.style.textShadow = `0 0 ${10 + hl * 24}px rgba(${AMBER_RGB},${hl})`;
          frag.style.color = `rgba(255,${185 + hl * 55},${155 + hl * 60},${Math.min(1, alpha + hl * 0.4)})`;
        } else {
          frag.style.textShadow = "none";
          frag.style.color = `${TEXT_HI}${alpha})`;
        }
      });

      /* ── ACT 1: HEADLINE ──────────────────────────────────────────── */
      if (headlineRef.current) {
        const hIn  = easeOutExpo(clamp(weightT * 1.8 - 0.3, 0, 1));
        const hOut = easeIO(clamp(fractureT * 2.2, 0, 1));
        const o = hIn * (1 - hOut);
        // Subtle tracking animation (starts tight, relaxes)
        const tracking = lerp(-3, -1.5, hIn);
        headlineRef.current.style.opacity = String(o);
        headlineRef.current.style.transform = `translate(-50%,-50%) translateY(${(1 - hIn) * 25}px)`;
        headlineRef.current.style.letterSpacing = `${tracking}px`;
      }

      /* ── ACT 2: SUBTITLE ──────────────────────────────────────────── */
      if (subtitleRef.current) {
        const sIn  = easeOutExpo(clamp((fractureT - 0.15) / 0.5, 0, 1));
        const sOut = easeIO(clamp(eyeT * 2, 0, 1));
        subtitleRef.current.style.opacity = String(sIn * (1 - sOut));
        subtitleRef.current.style.transform = `translate(-50%,-50%) translateY(${(1 - sIn) * 18}px)`;
      }

      /* ── SCROLL HINT ──────────────────────────────────────────────── */
      if (scrollHintRef.current) {
        scrollHintRef.current.style.opacity = String(Math.max(0, 1 - sp / 0.035));
      }

      /* ── ACT 3: "THE EYE OPENS" ──────────────────────────────────── */
      if (transTextRef.current) {
        const tIn  = easeOutExpo(clamp(eyeT * 2.5, 0, 1));
        const tOut = easeIO(clamp((eyeT - 0.5) / 0.35, 0, 1));
        transTextRef.current.style.opacity = String(tIn * (1 - tOut));
        transTextRef.current.style.transform = `translate(-50%,-50%) translateY(${(1 - tIn) * 20}px)`;
      }

      // Scan line — sweeps top to bottom
      if (scanLineRef.current) {
        const scanP = clamp((eyeT - 0.15) / 0.55, 0, 1);
        const scanY = 8 + easeIO(scanP) * 84;
        const scanO = scanP > 0.01 && scanP < 0.97 ? 0.7 : 0;
        scanLineRef.current.style.top     = `${scanY}%`;
        scanLineRef.current.style.opacity = String(scanO);
      }
      if (scanGlowRef.current) {
        const scanP = clamp((eyeT - 0.15) / 0.55, 0, 1);
        const scanY = 8 + easeIO(scanP) * 84;
        const scanO = scanP > 0.01 && scanP < 0.97 ? 0.35 : 0;
        scanGlowRef.current.style.top     = `${scanY - 3}%`;
        scanGlowRef.current.style.opacity = String(scanO);
      }

      /* ── CLUSTER HELPERS ──────────────────────────────────────────── */
      const convergeFade = clamp(convergeT * 4, 0, 1);
      const convergeSlide = easeIO(clamp(convergeT * 1.8, 0, 1));
      const convergeBlur = convergeFade * 8;
      const convergeShrink = 1 - convergeFade * 0.35;

      // Requirements cluster — appears late Act 3, positioned top-left quadrant
      if (reqClusterRef.current) {
        const rIn = easeOutExpo(clamp((eyeT - 0.55) / 0.35, 0, 1));
        const cx = CLUSTER_POS.req.x * (1 - convergeSlide);
        const cy = CLUSTER_POS.req.y * (1 - convergeSlide);
        reqClusterRef.current.style.opacity = String(rIn * (1 - convergeFade));
        reqClusterRef.current.style.transform =
          `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px)) scale(${(0.85 + rIn * 0.15) * convergeShrink})`;
        reqClusterRef.current.style.filter = convergeBlur > 0.2 ? `blur(${convergeBlur}px)` : "none";
      }

      // Risk cluster — appears Act 4, positioned top-right
      if (riskClusterRef.current) {
        const rIn = easeOutExpo(clamp(patternT / 0.55, 0, 1));
        const cx = CLUSTER_POS.risk.x * (1 - convergeSlide);
        const cy = CLUSTER_POS.risk.y * (1 - convergeSlide);
        riskClusterRef.current.style.opacity = String(rIn * (1 - convergeFade));
        riskClusterRef.current.style.transform =
          `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px)) scale(${(0.85 + rIn * 0.15) * convergeShrink})`;
        riskClusterRef.current.style.filter = convergeBlur > 0.2 ? `blur(${convergeBlur}px)` : "none";
      }

      // Connection lines — flash briefly during Act 4
      if (connLineRef.current) {
        const cIn  = easeOutExpo(clamp((patternT - 0.2) / 0.3, 0, 1));
        const cOut = clamp((structureT - 0.3) / 0.4, 0, 1);
        connLineRef.current.style.opacity = String(cIn * (1 - cOut) * 0.35);
      }

      // Clause cluster — appears Act 5, bottom-left
      if (clauseClusterRef.current) {
        const cIn = easeOutExpo(clamp(structureT / 0.45, 0, 1));
        const cx = CLUSTER_POS.clause.x * (1 - convergeSlide);
        const cy = CLUSTER_POS.clause.y * (1 - convergeSlide);
        clauseClusterRef.current.style.opacity = String(cIn * (1 - convergeFade));
        clauseClusterRef.current.style.transform =
          `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px)) scale(${(0.85 + cIn * 0.15) * convergeShrink})`;
        clauseClusterRef.current.style.filter = convergeBlur > 0.2 ? `blur(${convergeBlur}px)` : "none";
      }

      // Scope cluster — appears Act 5, bottom-right
      if (scopeClusterRef.current) {
        const sIn = easeOutExpo(clamp((structureT - 0.15) / 0.45, 0, 1));
        const cx = CLUSTER_POS.scope.x * (1 - convergeSlide);
        const cy = CLUSTER_POS.scope.y * (1 - convergeSlide);
        scopeClusterRef.current.style.opacity = String(sIn * (1 - convergeFade));
        scopeClusterRef.current.style.transform =
          `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px)) scale(${(0.85 + sIn * 0.15) * convergeShrink})`;
        scopeClusterRef.current.style.filter = convergeBlur > 0.2 ? `blur(${convergeBlur}px)` : "none";
      }

      /* ── FEATURE LABELS ───────────────────────────────────────────── */
      const labelsData = [
        { ref: labelReqRef,    t: eyeT,       th: 0.60 },
        { ref: labelRiskRef,   t: patternT,   th: 0.30 },
        { ref: labelClauseRef, t: structureT, th: 0.20 },
        { ref: labelScopeRef,  t: structureT, th: 0.40 },
      ];
      labelsData.forEach(({ ref, t: lt, th }) => {
        if (ref.current) {
          const lIn = easeOutExpo(clamp((lt - th) / 0.35, 0, 1));
          ref.current.style.opacity = String(lIn * (1 - convergeFade));
        }
      });

      /* ── ACT 6: CONVERGENCE TEXT ──────────────────────────────────── */
      if (convergeTextRef.current) {
        const cIn  = easeOutExpo(clamp(convergeT * 2.5, 0, 1));
        const cOut = easeIO(clamp((convergeT - 0.45) / 0.35, 0, 1));
        convergeTextRef.current.style.opacity = String(cIn * (1 - cOut));
        convergeTextRef.current.style.transform =
          `translate(-50%,-50%) translateY(${-28 + cOut * -12}%)`;
      }

      /* ── AMBIENT ORBS ─────────────────────────────────────────────── */
      if (orbAmberRef.current) {
        const x = 50 + Math.sin(t) * 14;
        const y = 48 + Math.cos(t * 0.7) * 9;
        const oA = 0.04 + fractureT * 0.06 + spreadT * 0.07 + easedScore * 0.08;
        orbAmberRef.current.style.left    = `${x}%`;
        orbAmberRef.current.style.top     = `${y}%`;
        orbAmberRef.current.style.opacity = String(oA);
      }
      if (orbVioletRef.current) {
        const x = 48 + Math.cos(t * 0.8) * 16;
        const y = 40 + Math.sin(t * 0.6) * 11;
        orbVioletRef.current.style.left    = `${x}%`;
        orbVioletRef.current.style.top     = `${y}%`;
        orbVioletRef.current.style.opacity = String(0.03 + patternT * 0.03);
      }
      if (orbNeutralRef.current) {
        orbNeutralRef.current.style.opacity = String(0.02 + eyeT * 0.035 + revealT * 0.025);
      }
      if (orbBloomRef.current) {
        const size = 300 + easedScore * 450;
        orbBloomRef.current.style.width      = `${size}px`;
        orbBloomRef.current.style.height     = `${size}px`;
        orbBloomRef.current.style.marginLeft = `${-size / 2}px`;
        orbBloomRef.current.style.marginTop  = `${-size / 2}px`;
        orbBloomRef.current.style.opacity    = String(easedScore * 0.22 * (1 - ctaT * 0.5));
      }

      /* ── FLASH — brief amber flash during convergence-to-card ──── */
      if (flashRef.current) {
        // Flash peaks when clusters are gone and cards about to appear
        const flashP = clamp((sp - 0.59) / 0.03, 0, 1);
        const flashOut = clamp((sp - 0.62) / 0.04, 0, 1);
        flashRef.current.style.opacity = String(flashP * (1 - flashOut) * 0.18);
      }

      /* ── SCORE GLOW — burst when score peaks ─────────────────── */
      if (scoreGlowRef.current) {
        const glowP = clamp((scoreT - 0.7) / 0.25, 0, 1);
        const glowFade = clamp((scoreT - 0.95) / 0.05, 0, 1);
        const glowSize = 200 + glowP * 300;
        scoreGlowRef.current.style.opacity = String(glowP * (1 - glowFade) * 0.4);
        scoreGlowRef.current.style.width = `${glowSize}px`;
        scoreGlowRef.current.style.height = `${glowSize}px`;
        scoreGlowRef.current.style.marginLeft = `${-glowSize / 2}px`;
        scoreGlowRef.current.style.marginTop = `${-glowSize / 2}px`;
      }

      /* ── CARDS ────────────────────────────────────────────────────── */
      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        const tx      = lerp(0, SPREAD_X[i], clamp(easedSpread, 0, 1.04)); // slight overshoot OK
        const foldedX = lerp(tx, 0, easedFold);
        const opacity = Math.max(0, revealT * (1 - Math.min(1, easedFold * 1.5)) * (1 - ctaT));
        const scale   = 0.90 + 0.12 * clamp(easedSpread, 0, 1) - 0.15 * easedFold;
        const rotate  = lerp(0, ROTATIONS[i], clamp(easedSpread, 0, 1))
                      - lerp(0, ROTATIONS[i], easedFold);
        card.style.transform = `translateX(${foldedX}px) scale(${scale}) rotate(${rotate}deg)`;
        card.style.opacity   = String(opacity);

        const threshold = 0.15 + i * 0.14;
        if (spreadT > threshold && !activeRef.current[i]) {
          activeRef.current[i] = true;
          card.classList.add("ch-active");
        }
        if (spreadT < 0.05 && activeRef.current[i]) {
          activeRef.current[i] = false;
          card.classList.remove("ch-active");
        }
      });

      /* ── SCORE ────────────────────────────────────────────────────── */
      if (arcRef.current)
        arcRef.current.style.strokeDashoffset = String(ARC_CIRC * (1 - easedScore * 0.94));
      if (countRef.current)
        countRef.current.textContent = String(Math.round(easedScore * 94));
      if (scoreRef.current) {
        const shift = easeOutExpo(proofT) * 20;
        scoreRef.current.style.opacity   = String(scoreT * Math.max(0, 1 - proofT * 1.2));
        scoreRef.current.style.transform =
          `translate(-50%,${-50 - shift}%) scale(${0.82 + 0.18 * easeOutExpo(scoreT) - ctaT * 0.1})`;
      }

      /* ── ACT 8: PROOF ─────────────────────────────────────────────── */
      if (proofRef.current) {
        const pO = easeOutExpo(proofT);
        proofRef.current.style.opacity = String(pO * Math.max(0, 1 - ctaT * 4));
        proofRef.current.style.transform =
          `translate(-50%, ${-50 + (1 - pO) * 10}%)`;
        // Trigger staggered line animation
        if (proofT > 0.08 && !proofActive.current) {
          proofActive.current = true;
          proofRef.current.classList.add("ch-proof-active");
        }
        if (proofT < 0.02 && proofActive.current) {
          proofActive.current = false;
          proofRef.current.classList.remove("ch-proof-active");
        }
      }

      /* ── ACT 9: CTA ──────────────────────────────────────────────── */
      if (ctaRef.current) {
        const cO = easeOutExpo(ctaT);
        ctaRef.current.style.opacity = String(cO);
        ctaRef.current.style.transform =
          `translate(-50%, ${-50 + (1 - cO) * 18}%)`;
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── Derived ──────────────────────────────────────────────────────── */
  const ARC_CIRC = 2 * Math.PI * 76;

  /* ═══════════════════════════════════════════════════════════════════
     JSX
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ position: "absolute", inset: 0, background: BG, overflow: "hidden" }}>

      {/* ── CSS Animations ── */}
      <style>{`
        .ch-active .ch-row  { animation: ch-up  0.5s ease forwards; }
        .ch-active .ch-grid { animation: ch-up  0.4s ease forwards; }
        .ch-active .ch-arc  { animation: ch-arc 0.7s ease forwards; }
        .ch-active .ch-bar  { animation: ch-bar 0.6s ease forwards; }
        .ch-proof-active .ch-proof-line {
          animation: ch-proof-reveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes ch-up       { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes ch-arc      { from { opacity:0 } to { opacity:1 } }
        @keyframes ch-bar      { from { transform:scaleX(0); opacity:0 } to { transform:scaleX(1); opacity:0.7 } }
        @keyframes ch-proof-reveal {
          from { opacity:0; transform:translateY(14px) translateX(-8px) }
          to   { opacity:1; transform:translateY(0) translateX(0) }
        }
        @keyframes ch-float {
          0%, 100% { transform: translate(0, 0) }
          33%      { transform: translate(28px, -18px) }
          66%      { transform: translate(-16px, 22px) }
        }
        @keyframes ch-glow-pulse {
          0%, 100% { box-shadow: 0 0 30px rgba(${AMBER_RGB},0.25), inset 0 1px 0 rgba(255,255,255,0.12) }
          50%      { box-shadow: 0 0 55px rgba(${AMBER_RGB},0.45), inset 0 1px 0 rgba(255,255,255,0.12) }
        }
        @keyframes ch-scroll-line {
          0%   { transform: translateY(0) }
          100% { transform: translateY(12px) }
        }
      `}</style>

      {/* ── Vignette — radial darkening at edges ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)",
      }} />

      {/* ── Architectural accent frame ── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
        {/* Corner brackets */}
        <div style={{ position: "absolute", top: 28, left: 28, width: 44, height: 44, borderTop: `1px solid rgba(${AMBER_RGB},0.12)`, borderLeft: `1px solid rgba(${AMBER_RGB},0.12)` }} />
        <div style={{ position: "absolute", top: 28, right: 28, width: 44, height: 44, borderTop: `1px solid rgba(${AMBER_RGB},0.12)`, borderRight: `1px solid rgba(${AMBER_RGB},0.12)` }} />
        <div style={{ position: "absolute", bottom: 28, left: 28, width: 44, height: 44, borderBottom: `1px solid rgba(${AMBER_RGB},0.12)`, borderLeft: `1px solid rgba(${AMBER_RGB},0.12)` }} />
        <div style={{ position: "absolute", bottom: 28, right: 28, width: 44, height: 44, borderBottom: `1px solid rgba(${AMBER_RGB},0.12)`, borderRight: `1px solid rgba(${AMBER_RGB},0.12)` }} />
        {/* Center crosshair */}
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 60, height: 1, marginLeft: -30, background: `rgba(${AMBER_RGB},0.04)` }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 1, height: 60, marginTop: -30, background: `rgba(${AMBER_RGB},0.04)` }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 6, height: 6, marginLeft: -3, marginTop: -3, borderRadius: "50%", border: `1px solid rgba(${AMBER_RGB},0.08)` }} />
        {/* Thin edge lines */}
        <div style={{ position: "absolute", top: 0, left: "50%", width: 1, height: 18, background: `linear-gradient(180deg, rgba(${AMBER_RGB},0.1), transparent)` }} />
        <div style={{ position: "absolute", bottom: 0, left: "50%", width: 1, height: 18, background: `linear-gradient(0deg, rgba(${AMBER_RGB},0.1), transparent)` }} />
        <div style={{ position: "absolute", top: "50%", left: 0, width: 18, height: 1, background: `linear-gradient(90deg, rgba(${AMBER_RGB},0.08), transparent)` }} />
        <div style={{ position: "absolute", top: "50%", right: 0, width: 18, height: 1, background: `linear-gradient(270deg, rgba(${AMBER_RGB},0.08), transparent)` }} />
      </div>

      {/* ── Ambient particles ── */}
      <div ref={particlesRef} style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, opacity: 0,
      }}>
        {PARTICLES.map((p, i) => (
          <div key={`p-${i}`} style={{
            position: "absolute",
            width: p.size, height: p.size, borderRadius: "50%",
            background: `rgba(${220 + (i % 3) * 12},${210 + (i % 4) * 8},${200 + (i % 5) * 6},${p.alpha})`,
            left: `${p.x}%`, top: `${p.y}%`,
            animation: `ch-float ${p.dur}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }} />
        ))}
      </div>

      {/* ── Ambient orbs ── */}
      <div ref={orbAmberRef} style={{
        position: "absolute", width: 650, height: 650, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${AMBER_RGB},0.16) 0%, transparent 70%)`,
        filter: "blur(90px)", pointerEvents: "none",
        marginLeft: -325, marginTop: -325, opacity: 0.04,
        left: "50%", top: "50%", zIndex: 1,
      }} />
      <div ref={orbVioletRef} style={{
        position: "absolute", width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(100,70,180,0.12) 0%, transparent 70%)",
        filter: "blur(90px)", pointerEvents: "none",
        marginLeft: -250, marginTop: -250, opacity: 0.03,
        left: "48%", top: "40%", zIndex: 1,
      }} />
      <div ref={orbNeutralRef} style={{
        position: "absolute", width: 420, height: 420, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
        filter: "blur(90px)", pointerEvents: "none",
        marginLeft: -210, marginTop: -210, opacity: 0.02,
        left: "50%", top: "15%", zIndex: 1,
      }} />
      <div ref={orbBloomRef} style={{
        position: "absolute", width: 300, height: 300, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${AMBER_RGB},0.22) 0%, transparent 70%)`,
        filter: "blur(90px)", pointerEvents: "none",
        marginLeft: -150, marginTop: -150, opacity: 0,
        left: "50%", top: "50%", zIndex: 1,
      }} />

      {/* ── Flash overlay — brief amber pulse during convergence-to-cards ── */}
      <div ref={flashRef} style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5, opacity: 0,
        background: `radial-gradient(ellipse 50% 50% at 50% 50%, rgba(${AMBER_RGB},0.35) 0%, transparent 70%)`,
      }} />

      {/* ── Score glow burst — appears when score peaks ── */}
      <div ref={scoreGlowRef} style={{
        position: "absolute", left: "50%", top: "50%", pointerEvents: "none",
        width: 200, height: 200, borderRadius: "50%", opacity: 0, zIndex: 9,
        marginLeft: -100, marginTop: -100,
        background: `radial-gradient(circle, rgba(${AMBER_RGB},0.5) 0%, rgba(${AMBER_RGB},0.15) 40%, transparent 70%)`,
        filter: "blur(30px)",
      }} />

      {/* ── Act 1–2: Floating RFP fragments (depth-layered) ── */}
      {FRAGMENTS.map((f, i) => {
        const ls = LAYER_STYLE[f.layer];
        return (
          <div
            key={`frag-${i}`}
            ref={(el) => { fragmentRefs.current[i] = el; }}
            style={{
              position: "absolute", pointerEvents: "none", opacity: 0,
              left: `${FRAG_SEEDS[i].x}%`, top: "100%",
              fontSize: ls.size,
              color: `${TEXT_HI}0)`,
              fontFamily: FONT_MONO, letterSpacing: "0.04em", fontWeight: 400,
              whiteSpace: "nowrap", willChange: "transform, opacity",
              filter: ls.blur > 0 ? `blur(${ls.blur}px)` : "none",
            }}
          >{f.text}</div>
        );
      })}

      {/* ── Act 1: Headline ── */}
      <div ref={headlineRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)", opacity: 0,
        textAlign: "center", pointerEvents: "none", zIndex: 5,
      }}>
        <div style={{
          width: 40, height: 1, margin: "0 auto 20px",
          background: `linear-gradient(90deg, transparent, rgba(${AMBER_RGB},0.4), transparent)`,
        }} />
        <h1 style={{
          fontSize: "clamp(34px, 6.5vw, 76px)", fontWeight: 700,
          color: `${TEXT_HI}0.95)`,
          lineHeight: 1.05, fontFamily: FONT_DISPLAY,
          margin: 0,
        }}>
          Every RFP is a wall<br/>
          of <em style={{ fontStyle: "italic", color: AMBER }}>demands.</em>
        </h1>
        <div style={{
          width: 40, height: 1, margin: "18px auto 0",
          background: `linear-gradient(90deg, transparent, rgba(${AMBER_RGB},0.3), transparent)`,
        }} />
      </div>

      {/* ── Act 2: Subtitle ── */}
      <div ref={subtitleRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)", opacity: 0,
        textAlign: "center", pointerEvents: "none", zIndex: 5,
        maxWidth: 560, padding: "0 24px",
      }}>
        <p style={{
          fontSize: "clamp(16px, 2.2vw, 24px)", fontWeight: 400,
          color: `${TEXT_HI}0.6)`, letterSpacing: "0.01em",
          lineHeight: 1.5, fontFamily: FONT_BODY, margin: 0,
        }}>Buried in the fine print: the requirements<br/>that make or break your bid.</p>
      </div>

      {/* ── Scroll indicator ── */}
      <div ref={scrollHintRef} style={{
        position: "absolute", bottom: "5%", left: "50%",
        transform: "translateX(-50%)", pointerEvents: "none",
        zIndex: 15, display: "flex", flexDirection: "column",
        alignItems: "center", gap: 8,
      }}>
        <span style={{
          fontSize: 9, letterSpacing: "4px", fontWeight: 500,
          color: `rgba(${AMBER_RGB},0.45)`, fontFamily: FONT_MONO,
          textTransform: "uppercase",
        }}>Scroll</span>
        <div style={{
          width: 1, height: 32,
          background: `linear-gradient(to bottom, rgba(${AMBER_RGB},0.5), transparent)`,
          animation: "ch-scroll-line 1.5s ease-in-out infinite",
        }} />
      </div>

      {/* ── Act 3: Transition text ── */}
      <div ref={transTextRef} style={{
        position: "absolute", top: "36%", left: "50%",
        transform: "translate(-50%,-50%)", opacity: 0,
        textAlign: "center", pointerEvents: "none", zIndex: 5,
      }}>
        <p style={{
          fontSize: "clamp(18px, 2.8vw, 34px)", fontWeight: 500,
          color: `${TEXT_HI}0.78)`, fontFamily: FONT_DISPLAY,
          fontStyle: "italic", letterSpacing: "-0.3px",
          margin: 0,
        }}>What if you could see through all of it?</p>
      </div>

      {/* ── Act 3: Scan line + trailing glow ── */}
      <div ref={scanGlowRef} style={{
        position: "absolute", left: "8%", right: "8%",
        height: 50, top: "10%", opacity: 0, pointerEvents: "none", zIndex: 2,
        background: `linear-gradient(180deg, transparent, rgba(${AMBER_RGB},0.06), transparent)`,
        filter: "blur(12px)",
      }} />
      <div ref={scanLineRef} style={{
        position: "absolute", left: "8%", right: "8%",
        height: 2, top: "10%", opacity: 0, pointerEvents: "none", zIndex: 2,
        background: `linear-gradient(90deg, transparent 2%, rgba(${AMBER_RGB},0.6) 30%, rgba(${AMBER_RGB},0.8) 50%, rgba(${AMBER_RGB},0.6) 70%, transparent 98%)`,
        boxShadow: `0 0 20px rgba(${AMBER_RGB},0.35), 0 0 60px rgba(${AMBER_RGB},0.12)`,
      }} />

      {/* ── Act 3–5: Data Clusters (quadrant layout) ── */}

      {/* Requirements — top-left quadrant */}
      <div ref={reqClusterRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: `translate(calc(-50% + ${CLUSTER_POS.req.x}px), calc(-50% + ${CLUSTER_POS.req.y}px))`,
        opacity: 0, pointerEvents: "none", width: 180, zIndex: 3,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        {["Security certifications", "API compatibility", "SLA guarantees", "Data residency", "Audit logging"].map((label, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 7,
            opacity: 0.85 - i * 0.06,
          }}>
            <div style={{
              width: 9, height: 9, borderRadius: "50%",
              border: "1.5px solid rgba(200,128,106,0.6)",
              background: i < 3 ? "rgba(200,128,106,0.25)" : "transparent",
            }} />
            <span style={{
              fontSize: 8.5, letterSpacing: "0.07em",
              color: "rgba(200,128,106,0.75)", fontFamily: FONT_MONO,
              textTransform: "uppercase",
            }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Risk — top-right quadrant */}
      <div ref={riskClusterRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: `translate(calc(-50% + ${CLUSTER_POS.risk.x}px), calc(-50% + ${CLUSTER_POS.risk.y}px))`,
        opacity: 0, pointerEvents: "none", width: 160, zIndex: 3,
        display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
      }}>
        <svg width={70} height={70} viewBox="0 0 70 70">
          <circle cx={35} cy={35} r={28} fill="none" stroke="rgba(77,158,122,0.15)" strokeWidth={2.5} />
          <circle cx={35} cy={35} r={28} fill="none" stroke="#4d9e7a" strokeWidth={2.5}
            strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 28}`}
            strokeDashoffset={`${2 * Math.PI * 28 * 0.30}`}
            transform="rotate(-90 35 35)" />
          <text x={35} y={35} textAnchor="middle" dominantBaseline="central"
            fill="#4d9e7a" fontSize={13} fontWeight={700} fontFamily={FONT_BODY}>70%</text>
        </svg>
        {[
          { label: "VENDOR LOCK-IN", sev: "HIGH", color: "#e07070" },
          { label: "COMPLIANCE GAP", sev: "MED",  color: "#e0b870" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 7, fontWeight: 700, letterSpacing: "0.1em",
              color: "#fff", padding: "2px 6px", borderRadius: 3,
              background: item.color, opacity: 0.85,
            }}>{item.sev}</span>
            <span style={{
              fontSize: 7.5, letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.42)", fontFamily: FONT_MONO,
            }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Clause — bottom-left quadrant */}
      <div ref={clauseClusterRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: `translate(calc(-50% + ${CLUSTER_POS.clause.x}px), calc(-50% + ${CLUSTER_POS.clause.y}px))`,
        opacity: 0, pointerEvents: "none", zIndex: 3,
        display: "flex", flexDirection: "column", gap: 5,
      }}>
        {["§1.2", "§3.1", "§5.4", "§7.2"].map((num, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "3px 7px", borderRadius: 4,
            background: (i === 1 || i === 3) ? "rgba(196,168,85,0.08)" : "transparent",
            border: (i === 1 || i === 3) ? "1px solid rgba(196,168,85,0.22)" : "1px solid transparent",
          }}>
            <span style={{
              fontSize: 8.5, fontWeight: 700, color: "#c4a855",
              fontFamily: FONT_MONO, letterSpacing: "0.05em",
            }}>{num}</span>
            <div style={{
              width: 50 + (i * 13) % 30, height: 4, borderRadius: 2,
              background: "rgba(196,168,85,0.22)",
            }} />
            {(i === 1 || i === 3) && (
              <span style={{
                fontSize: 6.5, fontWeight: 700, color: "#fff",
                padding: "1.5px 5px", borderRadius: 3,
                background: "rgba(196,168,85,0.4)", letterSpacing: "0.08em",
              }}>FLAG</span>
            )}
          </div>
        ))}
      </div>

      {/* Scope — bottom-right quadrant */}
      <div ref={scopeClusterRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: `translate(calc(-50% + ${CLUSTER_POS.scope.x}px), calc(-50% + ${CLUSTER_POS.scope.y}px))`,
        opacity: 0, pointerEvents: "none", zIndex: 3,
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, width: 100,
        }}>
          {[1,1,1,0, 1,1,2,0, 1,2,0,0, 2,0,0,0].map((s, i) => (
            <div key={i} style={{
              height: 16, borderRadius: 2,
              background: s === 1 ? "rgba(126,130,184,0.35)" : s === 2 ? "rgba(126,130,184,0.15)" : "rgba(255,255,255,0.04)",
              border: s === 2 ? "1px solid rgba(126,130,184,0.40)" : "1px solid rgba(255,255,255,0.04)",
            }} />
          ))}
        </div>
      </div>

      {/* Connection lines */}
      <svg ref={connLineRef} style={{
        position: "absolute", inset: 0, opacity: 0,
        pointerEvents: "none", zIndex: 3,
      }}>
        <line x1="36%" y1="44%" x2="62%" y2="44%" stroke={`rgba(${AMBER_RGB},0.3)`} strokeWidth={0.5} strokeDasharray="5 5" />
        <line x1="36%" y1="44%" x2="38%" y2="58%" stroke={`rgba(${AMBER_RGB},0.2)`} strokeWidth={0.5} strokeDasharray="5 5" />
        <line x1="62%" y1="44%" x2="60%" y2="58%" stroke={`rgba(${AMBER_RGB},0.2)`} strokeWidth={0.5} strokeDasharray="5 5" />
        <line x1="38%" y1="58%" x2="60%" y2="58%" stroke={`rgba(${AMBER_RGB},0.15)`} strokeWidth={0.5} strokeDasharray="5 5" />
      </svg>

      {/* Feature labels — positioned near their clusters */}
      <div ref={labelReqRef} style={{
        position: "absolute", top: "50%", left: "50%", opacity: 0, pointerEvents: "none", zIndex: 3,
        transform: `translate(calc(-50% + ${CLUSTER_POS.req.x}px), calc(-50% + ${CLUSTER_POS.req.y + 90}px))`,
      }}>
        <span style={{
          fontSize: 8.5, fontWeight: 600, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "rgba(200,128,106,0.5)",
          fontFamily: FONT_MONO,
        }}>Requirements Extraction</span>
      </div>
      <div ref={labelRiskRef} style={{
        position: "absolute", top: "50%", left: "50%", opacity: 0, pointerEvents: "none", zIndex: 3,
        transform: `translate(calc(-50% + ${CLUSTER_POS.risk.x}px), calc(-50% + ${CLUSTER_POS.risk.y + 90}px))`,
      }}>
        <span style={{
          fontSize: 8.5, fontWeight: 600, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "rgba(77,158,122,0.5)",
          fontFamily: FONT_MONO,
        }}>Risk Analysis</span>
      </div>
      <div ref={labelClauseRef} style={{
        position: "absolute", top: "50%", left: "50%", opacity: 0, pointerEvents: "none", zIndex: 3,
        transform: `translate(calc(-50% + ${CLUSTER_POS.clause.x}px), calc(-50% + ${CLUSTER_POS.clause.y + 65}px))`,
      }}>
        <span style={{
          fontSize: 8.5, fontWeight: 600, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "rgba(196,168,85,0.5)",
          fontFamily: FONT_MONO,
        }}>Clause Analysis</span>
      </div>
      <div ref={labelScopeRef} style={{
        position: "absolute", top: "50%", left: "50%", opacity: 0, pointerEvents: "none", zIndex: 3,
        transform: `translate(calc(-50% + ${CLUSTER_POS.scope.x}px), calc(-50% + ${CLUSTER_POS.scope.y + 80}px))`,
      }}>
        <span style={{
          fontSize: 8.5, fontWeight: 600, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "rgba(126,130,184,0.5)",
          fontFamily: FONT_MONO,
        }}>Scope Mapping</span>
      </div>

      {/* ── Act 6: Convergence text ── */}
      <div ref={convergeTextRef} style={{
        position: "absolute", top: "22%", left: "50%",
        transform: "translate(-50%,-50%)", opacity: 0,
        textAlign: "center", pointerEvents: "none", zIndex: 5,
      }}>
        <p style={{
          fontSize: "clamp(14px, 1.8vw, 22px)", fontWeight: 600,
          color: `${TEXT_HI}0.65)`, fontFamily: FONT_BODY,
          letterSpacing: "0.22em", textTransform: "uppercase",
          margin: 0,
        }}>Four dimensions. One assessment.</p>
      </div>

      {/* ── Cards ── */}
      {CARDS.map((card, i) => (
        <div
          key={card.id}
          ref={(el) => { cardRefs.current[i] = el; }}
          style={{
            position: "absolute", top: "50%", left: "50%",
            width: CARD_W, height: CARD_H,
            marginLeft: -CARD_W / 2, marginTop: -CARD_H / 2,
            opacity: 0, willChange: "transform, opacity", zIndex: 6,
          }}
        >
          <div style={{
            width: "100%", height: "100%", borderRadius: 14,
            background: `linear-gradient(170deg, rgba(${card.rgb},0.07) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.015) 100%)`,
            backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderLeft: `2px solid rgba(${card.rgb},0.6)`,
            boxShadow: `
              0 0 0 1px rgba(${card.rgb},0.04),
              0 32px 80px rgba(0,0,0,0.7),
              0 0 60px rgba(${card.rgb},0.05),
              inset 0 1px 0 rgba(255,255,255,0.06),
              inset 0 0 30px rgba(${card.rgb},0.03)
            `,
            padding: "20px 18px", display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.2em",
              textTransform: "uppercase", color: card.accent,
              marginBottom: 14, fontFamily: FONT_MONO,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span>{card.label}</span>
              <div style={{ flex: 1, height: 1, background: `rgba(${card.rgb},0.15)` }} />
            </div>
            {i === 0 && <RequirementsContent accent={card.accent} rgb={card.rgb} />}
            {i === 1 && <RiskContent         accent={card.accent} rgb={card.rgb} />}
            {i === 2 && <ClauseContent       accent={card.accent} rgb={card.rgb} />}
            {i === 3 && <ScopeContent        accent={card.accent} rgb={card.rgb} />}
          </div>
        </div>
      ))}

      {/* ── Score ── */}
      <div ref={scoreRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%) scale(0.82)",
        opacity: 0, textAlign: "center", pointerEvents: "none", zIndex: 10,
      }}>
        {/* Dark backdrop to cover any card remnants */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: 260, height: 260, borderRadius: "50%",
          background: `radial-gradient(circle, ${BG} 0%, ${BG} 55%, transparent 100%)`,
        }} />
        <svg width={200} height={200} viewBox="0 0 200 200"
          style={{ position: "relative", filter: `drop-shadow(0 0 16px rgba(${AMBER_RGB},0.5))` }}>
          {/* Outer decorative ring */}
          <circle cx={100} cy={100} r={92} fill="none" stroke={`rgba(${AMBER_RGB},0.06)`} strokeWidth="0.5" />
          {/* Tick marks */}
          {Array.from({length: 60}).map((_, i) => {
            const ang = (i / 60) * 360 - 90;
            const rad = ang * Math.PI / 180;
            const isMajor = i % 15 === 0;
            const isMid = i % 5 === 0;
            const r1 = isMajor ? 68 : isMid ? 72 : 74;
            return (
              <line key={i} x1={100 + Math.cos(rad) * r1} y1={100 + Math.sin(rad) * r1}
                x2={100 + Math.cos(rad) * 76} y2={100 + Math.sin(rad) * 76}
                stroke={`rgba(${AMBER_RGB},${isMajor ? 0.3 : isMid ? 0.12 : 0.05})`}
                strokeWidth={isMajor ? 1 : 0.5} />
            );
          })}
          {/* Track ring */}
          <circle cx={100} cy={100} r={76} fill="none" stroke={`rgba(${AMBER_RGB},0.1)`} strokeWidth={3.5} />
          {/* Active arc */}
          <circle
            ref={arcRef}
            cx={100} cy={100} r={76} fill="none"
            stroke={AMBER} strokeWidth={3.5} strokeLinecap="round"
            strokeDasharray={String(ARC_CIRC)}
            strokeDashoffset={String(ARC_CIRC)}
            transform="rotate(-90 100 100)"
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span ref={countRef} style={{
            fontSize: 62, fontWeight: 800, color: AMBER,
            fontFamily: FONT_BODY, letterSpacing: -3, lineHeight: 1,
            textShadow: `0 0 50px rgba(${AMBER_RGB},0.7)`,
          }}>0</span>
          <div style={{
            width: 24, height: 1, margin: "10px auto 8px",
            background: `linear-gradient(90deg, transparent, rgba(${AMBER_RGB},0.4), transparent)`,
          }} />
          <span style={{
            fontSize: 9, fontWeight: 600, letterSpacing: "0.28em",
            textTransform: "uppercase", color: `rgba(${AMBER_RGB},0.45)`,
            fontFamily: FONT_MONO,
          }}>Fit Score</span>
        </div>
      </div>

      {/* ── Act 8: Proof text (staggered reveal) ── */}
      <div ref={proofRef} style={{
        position: "absolute", top: "72%", left: "50%",
        transform: "translate(-50%,-50%)", opacity: 0,
        textAlign: "left", pointerEvents: "none", zIndex: 11,
        display: "flex", flexDirection: "column", gap: 20,
        maxWidth: 440,
      }}>
        {[
          { num: "01", bold: "Reads the entire document", rest: "requirements, risks, clauses, scope", delay: 0 },
          { num: "02", bold: "Surfaces what matters", rest: "flags, gaps, and opportunities", delay: 150 },
          { num: "03", bold: "Delivers a verdict", rest: "in under 60 seconds", delay: 300 },
        ].map((line, i) => (
          <div key={i} className="ch-proof-line" style={{
            display: "flex", gap: 14, alignItems: "flex-start",
            opacity: 0, animationDelay: `${line.delay}ms`,
          }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: `rgba(${AMBER_RGB},0.4)`,
              fontFamily: FONT_MONO, letterSpacing: "0.05em",
              minWidth: 22, paddingTop: 2,
            }}>{line.num}</span>
            <div>
              <p style={{
                fontSize: "clamp(13px, 1.6vw, 17px)",
                color: `${TEXT_HI}0.9)`, fontWeight: 600,
                fontFamily: FONT_BODY, lineHeight: 1.4,
                margin: "0 0 3px 0",
              }}>{line.bold}</p>
              <p style={{
                fontSize: "clamp(11px, 1.2vw, 14px)",
                color: `${TEXT_HI}0.35)`,
                fontFamily: FONT_BODY, lineHeight: 1.5,
                margin: 0,
              }}>{line.rest}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Act 9: CTA ── */}
      <div ref={ctaRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)", opacity: 0,
        textAlign: "center", pointerEvents: "auto", zIndex: 20,
      }}>
        <div style={{
          width: 32, height: 1, margin: "0 auto 22px",
          background: `linear-gradient(90deg, transparent, rgba(${AMBER_RGB},0.3), transparent)`,
        }} />
        <h2 style={{
          fontSize: "clamp(30px, 5.5vw, 62px)", fontWeight: 700,
          color: `${TEXT_HI}0.95)`,
          lineHeight: 1.05, fontFamily: FONT_DISPLAY,
          margin: "0 0 32px 0", letterSpacing: "-1.5px",
        }}>Try it with <em style={{ fontStyle: "italic", color: AMBER }}>your</em> RFP</h2>
        <a href="/upload" style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "17px 48px", fontSize: 13, fontWeight: 600,
          background: `linear-gradient(180deg, ${AMBER} 0%, #b86430 100%)`,
          color: "#fff", borderRadius: 8,
          textDecoration: "none", fontFamily: FONT_BODY,
          letterSpacing: "0.1em", textTransform: "uppercase",
          animation: "ch-glow-pulse 3s ease-in-out infinite",
          transition: "transform 0.2s, filter 0.2s",
          border: "1px solid rgba(255,255,255,0.1)",
        }}>Analyze your first RFP
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
        <p style={{
          marginTop: 22, fontSize: 13,
          color: `${TEXT_HI}0.3)`, fontFamily: FONT_BODY,
        }}>
          <a href="/pricing" style={{
            color: `${TEXT_HI}0.4)`,
            textDecoration: "none",
            borderBottom: `1px solid rgba(${AMBER_RGB},0.2)`,
            paddingBottom: 2,
            transition: "color 0.2s, border-color 0.2s",
          }}>
            or see how it works
          </a>
        </p>
      </div>
    </div>
  );
}
