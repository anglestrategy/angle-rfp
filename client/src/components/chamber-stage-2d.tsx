// client/src/components/chamber-stage-2d.tsx
import { useEffect, useRef } from "react";
import { chamberScrollState } from "./chamber-scroll-state";

// ─── Card data ────────────────────────────────────────────────────────────────
const CARDS = [
  { id: "requirements", label: "REQUIREMENTS",    accent: "#C8806A", rgb: "200,128,106" },
  { id: "risk",         label: "RISK VECTORS",    accent: "#4A9975", rgb: "74,153,117"  },
  { id: "terms",        label: "CLAUSE ANALYSIS", accent: "#D4B87A", rgb: "212,184,122" },
  { id: "scope",        label: "SCOPE BOUNDS",    accent: "#8A8EBF", rgb: "138,142,191" },
] as const;

const CARD_W   = 260;
const CARD_H   = 360;
const SPACING  = CARD_W + 16;   // card width + gap
const SPREAD_X = [-1.5, -0.5, 0.5, 1.5].map((n) => n * SPACING);
const ROTATIONS = [-3, -1, 1, 3]; // degrees at full spread

const clamp     = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp      = (a: number, b: number, t: number)   => a + (b - a) * t;
const easeIO    = (t: number) => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);

// ─── RFP fragment text ───────────────────────────────────────────────────────
const FRAGMENTS = [
  "...must demonstrate SOC 2 Type II compliance...",
  "...liability shall not exceed...",
  "...vendor shall provide 99.99% uptime...",
  "...response deadline: 14 business days...",
  "...data encryption at rest and in transit...",
  "...indemnification clause required...",
  "...maximum contract term of 36 months...",
  "...proof of ISO 27001 certification...",
];

const FRAG_SEEDS = FRAGMENTS.map((_, i) => ({
  x: 15 + (i * 37) % 70,             // scattered horizontal start
  speed: 0.6 + (i * 0.13) % 0.5,     // vertical drift speed
  rot: -8 + (i * 5) % 16,            // rotation in degrees
  delay: i * 0.12,                    // stagger
}));

// ─── Card content ─────────────────────────────────────────────────────────────

function RequirementsContent({ accent, rgb }: { accent: string; rgb: string }) {
  const rows = [
    "Security certifications",
    "API compatibility",
    "SLA guarantees",
    "Data residency",
    "Audit logging",
    "Role-based access",
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
      {rows.map((label, i) => (
        <div
          key={i}
          className="ch-row"
          style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0, animationDelay: `${i * 80}ms` }}
        >
          <div style={{
            width: 10, height: 10, borderRadius: 2, flexShrink: 0,
            border: `1px solid ${accent}`,
            background: i < 4 ? `rgba(${rgb},0.25)` : "transparent",
          }} />
          <span style={{
            fontSize: 8, letterSpacing: "0.06em", flex: 1,
            color: `rgba(${rgb},0.75)`, fontFamily: "Inter,sans-serif",
            textTransform: "uppercase", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{label}</span>
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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 2 }}>
        <svg width={90} height={90} viewBox="0 0 90 90">
          <circle cx={45} cy={45} r={ARC_R} fill="none" stroke={`rgba(${rgb},0.12)`} strokeWidth={3} />
          <circle
            className="ch-arc"
            cx={45} cy={45} r={ARC_R} fill="none"
            stroke={accent} strokeWidth={3} strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * 0.30}
            transform="rotate(-90 45 45)"
            style={{ opacity: 0 }}
          />
          <text x={45} y={45} textAnchor="middle" dominantBaseline="central"
            fill={accent} fontSize={14} fontWeight={700} fontFamily="Inter,sans-serif">70%</text>
        </svg>
      </div>
      {threats.map((t, i) => (
        <div key={i} className="ch-row" style={{ opacity: 0, animationDelay: `${100 + i * 100}ms` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 7, fontWeight: 700, letterSpacing: "0.1em",
              color: sevColor[t.sev], padding: "1px 5px", borderRadius: 2,
              border: `1px solid ${sevColor[t.sev]}`,
            }}>{t.sev}</span>
            <span style={{
              fontSize: 8, letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.45)", fontFamily: "Inter,sans-serif",
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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
      {clauses.map((c, i) => (
        <div key={i} className="ch-row" style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "5px 6px", borderRadius: 4,
          background: c.flag ? `rgba(${rgb},0.10)` : "transparent",
          border: c.flag ? `1px solid rgba(${rgb},0.20)` : "1px solid transparent",
          opacity: 0, animationDelay: `${i * 80}ms`,
        }}>
          <span style={{
            fontSize: 8, fontWeight: 700, color: accent,
            fontFamily: "Inter,sans-serif", letterSpacing: "0.05em", minWidth: 24,
          }}>{c.num}</span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{
              height: 5, borderRadius: 2, background: `rgba(${rgb},0.25)`,
              width: `${60 + (i * 13) % 40}%`,
            }} />
            <div style={{
              height: 4, borderRadius: 2, background: `rgba(${rgb},0.13)`,
              width: `${40 + (i * 17) % 35}%`,
            }} />
          </div>
          {c.flag && (
            <div style={{
              fontSize: 6, fontWeight: 700, color: accent,
              padding: "1px 4px", borderRadius: 2,
              border: `1px solid rgba(${rgb},0.35)`, letterSpacing: "0.08em",
            }}>FLAG</div>
          )}
        </div>
      ))}
    </div>
  );
}

function ScopeContent({ accent, rgb }: { accent: string; rgb: string }) {
  // 0=out, 1=in, 2=boundary
  const cells = [1,1,1,0, 1,1,2,0, 1,2,0,0, 2,0,0,0, 0,0,0,0];
  const cellBg = (s: number) =>
    s === 1 ? `rgba(${rgb},0.35)` : s === 2 ? `rgba(${rgb},0.15)` : "rgba(255,255,255,0.04)";
  const coverage = cells.filter((s) => s === 1).length / cells.length;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="ch-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, opacity: 0,
      }}>
        {cells.map((s, i) => (
          <div key={i} style={{
            height: 22, borderRadius: 3, background: cellBg(s),
            border: s === 2 ? `1px solid rgba(${rgb},0.40)` : "1px solid rgba(255,255,255,0.04)",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { lbl: "IN",       bg: `rgba(${rgb},0.35)` },
          { lbl: "BOUNDARY", bg: `rgba(${rgb},0.15)` },
          { lbl: "OUT",      bg: "rgba(255,255,255,0.06)" },
        ].map((l) => (
          <div key={l.lbl} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 8, height: 8, borderRadius: 1, background: l.bg }} />
            <span style={{ fontSize: 7, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif", letterSpacing: "0.06em" }}>{l.lbl}</span>
          </div>
        ))}
      </div>
      <div className="ch-row" style={{ opacity: 0, animationDelay: "200ms" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif", letterSpacing: "0.08em" }}>COVERAGE</span>
          <span style={{ fontSize: 8, color: accent, fontFamily: "Inter,sans-serif", fontWeight: 700 }}>{Math.round(coverage * 100)}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div className="ch-bar" style={{
            height: "100%", width: `${coverage * 100}%`,
            background: accent, opacity: 0.6,
            transform: "scaleX(0)", transformOrigin: "left",
          }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function ChamberStage2D() {
  const cardRefs  = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const scoreRef  = useRef<HTMLDivElement>(null);
  const arcRef    = useRef<SVGCircleElement>(null);
  const countRef  = useRef<HTMLSpanElement>(null);
  const activeRef = useRef<boolean[]>([false, false, false, false]);
  const orbAmberRef  = useRef<HTMLDivElement>(null);
  const orbVioletRef = useRef<HTMLDivElement>(null);
  const orbNeutralRef = useRef<HTMLDivElement>(null);
  const orbBloomRef  = useRef<HTMLDivElement>(null);
  const timeRef      = useRef(0);

  // ── Narrative refs ──
  const fragmentRefs = useRef<(HTMLDivElement | null)[]>(new Array(FRAGMENTS.length).fill(null));
  const headlineRef    = useRef<HTMLDivElement>(null);
  const subtitleRef    = useRef<HTMLDivElement>(null);
  const scrollHintRef  = useRef<HTMLDivElement>(null);

  // ── Data cluster refs (free-floating previews before cards) ──
  const transTextRef   = useRef<HTMLDivElement>(null);  // "What if..." text
  const scanLineRef    = useRef<HTMLDivElement>(null);
  const reqClusterRef  = useRef<HTMLDivElement>(null);  // requirements preview
  const riskClusterRef = useRef<HTMLDivElement>(null);  // risk preview
  const clauseClusterRef = useRef<HTMLDivElement>(null);
  const scopeClusterRef  = useRef<HTMLDivElement>(null);
  const connLineRef    = useRef<SVGSVGElement>(null);   // connection lines
  const labelReqRef    = useRef<HTMLDivElement>(null);
  const labelRiskRef   = useRef<HTMLDivElement>(null);
  const labelClauseRef = useRef<HTMLDivElement>(null);
  const labelScopeRef  = useRef<HTMLDivElement>(null);
  const convergeTextRef = useRef<HTMLDivElement>(null);  // "Four dimensions" text
  const proofRef = useRef<HTMLDivElement>(null);
  const ctaRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ARC_CIRC = 2 * Math.PI * 76;
    let raf: number;

    const loop = () => {
      const sp = chamberScrollState.progress;

      // ── 9-Act Timeline ────────────────────────────────────────────────────────
      // Act 1: The Weight      0.00–0.10
      const weightT    = clamp(sp / 0.10, 0, 1);
      // Act 2: The Fracture    0.10–0.20
      const fractureT  = clamp((sp - 0.10) / 0.10, 0, 1);
      // Act 3: The Eye Opens   0.20–0.32
      const eyeT       = clamp((sp - 0.20) / 0.12, 0, 1);
      // Act 4: The Patterns    0.32–0.44
      const patternT   = clamp((sp - 0.32) / 0.12, 0, 1);
      // Act 5: The Structure   0.44–0.56
      const structureT = clamp((sp - 0.44) / 0.12, 0, 1);
      // Act 6: Convergence     0.56–0.68  (cards appear + spread)
      const convergeT   = clamp((sp - 0.56) / 0.12, 0, 1);
      const revealT     = clamp((sp - 0.56) / 0.04, 0, 1);
      const spreadT     = clamp((sp - 0.60) / 0.08, 0, 1);
      const easedSpread = easeIO(spreadT);
      // Act 7: Verdict         0.68–0.82  (cards fold + score)
      const foldT       = clamp((sp - 0.68) / 0.07, 0, 1);
      const easedFold   = easeIO(foldT);
      const scoreT      = clamp((sp - 0.75) / 0.07, 0, 1);
      const easedScore  = 1 - (1 - scoreT) * (1 - scoreT);
      // Act 8: The Proof       0.82–0.92
      const proofT     = clamp((sp - 0.82) / 0.10, 0, 1);
      // Act 9: The Invitation  0.92–1.00
      const ctaT       = clamp((sp - 0.92) / 0.08, 0, 1);

      // ── Ambient orbs ──────────────────────────────────────────────────────────
      timeRef.current += 0.003;
      const t = timeRef.current;

      // ── Act 1: The Weight — fragments drift up ─────────────────────────────
      fragmentRefs.current.forEach((frag, i) => {
        if (!frag) return;
        const seed = FRAG_SEEDS[i];
        // Fragments drift upward during Act 1, scatter outward during Act 2
        const driftY = 110 - weightT * (40 + seed.speed * 30) - fractureT * 60;
        const scatterX = seed.x + fractureT * (seed.x < 50 ? -30 : 30);
        const fragOpacity = weightT * Math.max(0, 1 - fractureT * 1.5) * (0.3 + seed.speed * 0.4);
        // Amber highlight on 2-3 fragments during Act 2
        const highlight = (i === 0 || i === 4 || i === 6) ? fractureT * 0.6 : 0;
        frag.style.transform = `translateY(${driftY}%) rotate(${seed.rot * (1 - fractureT * 0.5)}deg)`;
        frag.style.left = `${scatterX}%`;
        frag.style.opacity = String(fragOpacity);
        frag.style.textShadow = highlight > 0.01
          ? `0 0 ${12 + highlight * 20}px rgba(232,121,59,${highlight})`
          : "none";
      });

      // ── Act 1: Headline ────────────────────────────────────────────────────
      if (headlineRef.current) {
        const hIn  = clamp(weightT * 2 - 0.5, 0, 1);          // fades in 0.25–0.75 of Act 1
        const hOut = clamp(fractureT * 2.5, 0, 1);             // fades out during Act 2
        headlineRef.current.style.opacity = String(hIn * (1 - hOut));
        headlineRef.current.style.transform = `translate(-50%,-50%) translateY(${(1 - hIn) * 20}px)`;
      }

      // ── Act 2: Subtitle (word-reveal handled via CSS, opacity via scroll) ─
      if (subtitleRef.current) {
        const sIn  = clamp((fractureT - 0.2) / 0.5, 0, 1);    // fades in 20%–70% of Act 2
        const sOut = clamp((eyeT * 2), 0, 1);                  // fades out start of Act 3
        subtitleRef.current.style.opacity = String(sIn * (1 - sOut));
      }

      // ── Scroll hint ────────────────────────────────────────────────────────
      if (scrollHintRef.current) {
        scrollHintRef.current.style.opacity = String(Math.max(0, 1 - sp / 0.04));
      }

      // ── Act 3: "The Eye Opens" — scan line + requirements materialize ──────
      if (transTextRef.current) {
        const tIn  = clamp(eyeT * 3, 0, 1);
        const tOut = clamp((eyeT - 0.6) / 0.3, 0, 1);
        transTextRef.current.style.opacity = String(tIn * (1 - tOut));
        transTextRef.current.style.transform = `translate(-50%,-50%) translateY(${(1 - tIn) * 15}px)`;
      }
      if (scanLineRef.current) {
        const scanProgress = clamp((eyeT - 0.2) / 0.5, 0, 1);
        scanLineRef.current.style.top = `${10 + scanProgress * 80}%`;
        scanLineRef.current.style.opacity = String(scanProgress > 0.01 && scanProgress < 0.99 ? 0.6 : 0);
      }
      if (reqClusterRef.current) {
        // Appears during Act 3, drifts left in Act 4
        const rIn = clamp((eyeT - 0.3) / 0.5, 0, 1);
        const driftLeft = patternT * 22;
        const driftUp   = structureT * 15;
        const fadeForConverge = clamp(convergeT * 3, 0, 1);
        reqClusterRef.current.style.opacity = String(rIn * (1 - fadeForConverge));
        reqClusterRef.current.style.transform = `translate(${-50 - driftLeft}%, ${-50 - driftUp}%)`;
      }

      // ── Act 4: "The Patterns" — risk appears, connections flash ────────────
      if (riskClusterRef.current) {
        const rIn = clamp(patternT / 0.6, 0, 1);
        const driftUp = structureT * 15;
        const fadeForConverge = clamp(convergeT * 3, 0, 1);
        riskClusterRef.current.style.opacity = String(rIn * (1 - fadeForConverge));
        riskClusterRef.current.style.transform = `translate(${-50 + 22}%, ${-50 - driftUp}%)`;
      }
      if (connLineRef.current) {
        const cIn  = clamp((patternT - 0.3) / 0.3, 0, 1);
        const cOut = clamp((patternT - 0.8) / 0.2, 0, 1);
        connLineRef.current.style.opacity = String(cIn * (1 - cOut) * 0.4);
      }

      // ── Act 5: "The Structure" — clauses + scope grid appear ───────────────
      if (clauseClusterRef.current) {
        const cIn = clamp(structureT / 0.5, 0, 1);
        const fadeForConverge = clamp(convergeT * 3, 0, 1);
        clauseClusterRef.current.style.opacity = String(cIn * (1 - fadeForConverge));
        clauseClusterRef.current.style.transform = `translate(${-50 - 20}%, ${-50 + 12}%)`;
      }
      if (scopeClusterRef.current) {
        const sIn = clamp((structureT - 0.2) / 0.5, 0, 1);
        const fadeForConverge = clamp(convergeT * 3, 0, 1);
        scopeClusterRef.current.style.opacity = String(sIn * (1 - fadeForConverge));
        scopeClusterRef.current.style.transform = `translate(${-50 + 20}%, ${-50 + 12}%)`;
      }

      // Feature labels
      [
        { ref: labelReqRef, t: eyeT, threshold: 0.4 },
        { ref: labelRiskRef, t: patternT, threshold: 0.3 },
        { ref: labelClauseRef, t: structureT, threshold: 0.2 },
        { ref: labelScopeRef, t: structureT, threshold: 0.4 },
      ].forEach(({ ref, t: lt, threshold }) => {
        if (ref.current) {
          const lIn = clamp((lt - threshold) / 0.3, 0, 1);
          const fadeForConverge = clamp(convergeT * 2, 0, 1);
          ref.current.style.opacity = String(lIn * (1 - fadeForConverge));
        }
      });

      // ── Act 6: "The Convergence" text ──────────────────────────────────────
      if (convergeTextRef.current) {
        const cIn  = clamp(convergeT * 3, 0, 1);
        const cOut = clamp((convergeT - 0.5) / 0.3, 0, 1);
        convergeTextRef.current.style.opacity = String(cIn * (1 - cOut));
        convergeTextRef.current.style.transform = `translate(-50%,-50%) translateY(${-30 + cOut * -10}%)`;
      }

      // ── Act 8: The Proof ───────────────────────────────────────────────────
      if (proofRef.current) {
        proofRef.current.style.opacity = String(proofT);
        proofRef.current.style.transform = `translate(-50%, ${-50 + (1 - proofT) * 10}%)`;
      }

      // ── Act 9: The Invitation ──────────────────────────────────────────────
      if (ctaRef.current) {
        ctaRef.current.style.opacity = String(ctaT);
        ctaRef.current.style.transform = `translate(-50%, ${-50 + (1 - ctaT) * 15}%)`;
      }

      if (orbAmberRef.current) {
        const x = 50 + Math.sin(t) * 12;
        const y = 50 + Math.cos(t * 0.7) * 8;
        orbAmberRef.current.style.left    = `${x}%`;
        orbAmberRef.current.style.top     = `${y}%`;
        orbAmberRef.current.style.opacity = String(0.03 + fractureT * 0.05 + spreadT * 0.06);
      }
      if (orbVioletRef.current) {
        const x = 50 + Math.cos(t * 0.8) * 15;
        const y = 40 + Math.sin(t * 0.6) * 10;
        orbVioletRef.current.style.left = `${x}%`;
        orbVioletRef.current.style.top  = `${y}%`;
      }
      if (orbNeutralRef.current) {
        // static — no position update needed
        orbNeutralRef.current.style.opacity = String(0.02 + eyeT * 0.03 + revealT * 0.02);
      }
      if (orbBloomRef.current) {
        const size = 300 + easedScore * 400;
        orbBloomRef.current.style.width     = `${size}px`;
        orbBloomRef.current.style.height    = `${size}px`;
        orbBloomRef.current.style.marginLeft = `${-size / 2}px`;
        orbBloomRef.current.style.marginTop  = `${-size / 2}px`;
        orbBloomRef.current.style.opacity   = String(easedScore * 0.18 * (1 - scoreT * 0.3));
      }

      cardRefs.current.forEach((card, i) => {
        if (!card) return;

        const tx      = lerp(0, SPREAD_X[i], easedSpread);
        const foldedX = lerp(tx, 0, easedFold);
        const opacity = Math.max(0, revealT * (1 - easedFold * 0.8) * (1 - ctaT));
        const scale   = 0.92 + 0.08 * easedSpread - 0.04 * easedFold;

        const rotate = lerp(0, ROTATIONS[i], easedSpread) - lerp(0, ROTATIONS[i], easedFold);
        card.style.transform = `translateX(${foldedX}px) scale(${scale}) rotate(${rotate}deg)`;
        card.style.opacity   = String(opacity);

        // Trigger staggered content animation once per spread
        const threshold = 0.2 + i * 0.15;
        if (spreadT > threshold && !activeRef.current[i]) {
          activeRef.current[i] = true;
          card.classList.add("ch-active");
        }
        if (spreadT < 0.05 && activeRef.current[i]) {
          activeRef.current[i] = false;
          card.classList.remove("ch-active");
        }
      });

      if (arcRef.current)
        arcRef.current.style.strokeDashoffset = String(ARC_CIRC * (1 - easedScore * 0.94));
      if (countRef.current)
        countRef.current.textContent = String(Math.round(easedScore * 94));
      // ── Score/proof/CTA positioning — score shifts up for proof/CTA ────────
      if (scoreRef.current) {
        const shift = proofT * 18;
        scoreRef.current.style.opacity   = String(scoreT * (1 - ctaT * 0.7));
        scoreRef.current.style.transform = `translate(-50%,${-50 - shift}%) scale(${0.85 + 0.15 * scoreT - ctaT * 0.1})`;
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const ARC_CIRC = 2 * Math.PI * 76;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0a0908", overflow: "hidden" }}>
      {/* Keyframes */}
      <style>{`
        .ch-active .ch-row  { animation: ch-up  0.5s ease forwards; }
        .ch-active .ch-grid { animation: ch-up  0.4s ease forwards; }
        .ch-active .ch-arc  { animation: ch-arc 0.7s ease forwards; }
        .ch-active .ch-bar  { animation: ch-bar 0.6s ease forwards; }
        @keyframes ch-up  { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes ch-arc { from { opacity:0 } to { opacity:1 } }
        @keyframes ch-bar { from { transform:scaleX(0); opacity:0 } to { transform:scaleX(1); opacity:0.7 } }
      `}</style>

      {/* Ambient orbs */}
      <div ref={orbAmberRef} style={{
        position: "absolute", width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(232,121,59,0.14) 0%, transparent 70%)",
        filter: "blur(80px)", pointerEvents: "none",
        marginLeft: -300, marginTop: -300, opacity: 0.08,
        left: "50%", top: "50%",
      }} />
      <div ref={orbVioletRef} style={{
        position: "absolute", width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(120,80,200,0.10) 0%, transparent 70%)",
        filter: "blur(80px)", pointerEvents: "none",
        marginLeft: -250, marginTop: -250, opacity: 0.08,
        left: "50%", top: "40%",
      }} />
      <div ref={orbNeutralRef} style={{
        position: "absolute", width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)",
        filter: "blur(80px)", pointerEvents: "none",
        marginLeft: -200, marginTop: -200, opacity: 0.03,
        left: "50%", top: "15%",
      }} />
      <div ref={orbBloomRef} style={{
        position: "absolute", width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(232,121,59,0.20) 0%, transparent 70%)",
        filter: "blur(80px)", pointerEvents: "none",
        marginLeft: -150, marginTop: -150, opacity: 0,
        left: "50%", top: "50%",
      }} />

      {/* ── Act 1–2: Floating RFP fragments ── */}
      {FRAGMENTS.map((text, i) => (
        <div
          key={`frag-${i}`}
          ref={(el) => { fragmentRefs.current[i] = el; }}
          style={{
            position: "absolute", pointerEvents: "none", opacity: 0,
            left: `${FRAG_SEEDS[i].x}%`, top: "100%",
            fontSize: 10, color: "rgba(255,255,255,0.35)",
            fontFamily: "'Inter',sans-serif", letterSpacing: "0.03em",
            whiteSpace: "nowrap", willChange: "transform, opacity",
          }}
        >{text}</div>
      ))}

      {/* ── Act 1: Headline ── */}
      <div ref={headlineRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)", opacity: 0,
        textAlign: "center", pointerEvents: "none", zIndex: 5,
      }}>
        <h1 style={{
          fontSize: "clamp(28px, 5vw, 56px)", fontWeight: 800,
          color: "rgba(255,255,255,0.92)", letterSpacing: "-1.5px",
          lineHeight: 1.1, fontFamily: "'Inter',sans-serif",
        }}>Every RFP is a wall<br/>of demands.</h1>
      </div>

      {/* ── Act 2: Subtitle ── */}
      <div ref={subtitleRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)", opacity: 0,
        textAlign: "center", pointerEvents: "none", zIndex: 5,
        maxWidth: 600, padding: "0 24px",
      }}>
        <p style={{
          fontSize: "clamp(18px, 2.5vw, 28px)", fontWeight: 500,
          color: "rgba(255,255,255,0.75)", letterSpacing: "-0.5px",
          lineHeight: 1.4, fontFamily: "'Inter',sans-serif",
        }}>Buried in the fine print: the requirements that make or break your bid.</p>
      </div>

      {/* ── Scroll indicator ── */}
      <div ref={scrollHintRef} style={{
        position: "absolute", bottom: "5%", left: "50%",
        transform: "translateX(-50%)", pointerEvents: "none",
        zIndex: 10, display: "flex", flexDirection: "column",
        alignItems: "center", gap: 6,
      }}>
        <span style={{
          fontSize: 10, letterSpacing: "3px",
          color: "rgba(255,255,255,0.3)", fontFamily: "'Inter',sans-serif",
          textTransform: "uppercase",
        }}>Scroll</span>
        <div style={{
          width: 1, height: 40,
          background: "linear-gradient(to bottom, rgba(232,121,59,0.5), transparent)",
        }} />
      </div>

      {/* ── Act 3: Transition text ── */}
      <div ref={transTextRef} style={{
        position: "absolute", top: "38%", left: "50%",
        transform: "translate(-50%,-50%)", opacity: 0,
        textAlign: "center", pointerEvents: "none", zIndex: 5,
      }}>
        <p style={{
          fontSize: "clamp(18px, 2.5vw, 28px)", fontWeight: 500,
          color: "rgba(255,255,255,0.80)", fontFamily: "'Inter',sans-serif",
          letterSpacing: "-0.5px",
        }}>What if you could see through all of it?</p>
      </div>

      {/* ── Act 3: Scan line ── */}
      <div ref={scanLineRef} style={{
        position: "absolute", left: "15%", right: "15%",
        height: 1, top: "10%", opacity: 0, pointerEvents: "none",
        background: "linear-gradient(90deg, transparent, rgba(232,121,59,0.5), transparent)",
        boxShadow: "0 0 12px rgba(232,121,59,0.3)",
      }} />

      {/* ── Act 3: Requirements cluster (free-floating) ── */}
      <div ref={reqClusterRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)", opacity: 0,
        pointerEvents: "none", width: 180,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        {["Security certifications", "API compatibility", "SLA guarantees", "Data residency", "Audit logging"].map((label, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 6,
            opacity: 0.8 - i * 0.08,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: 2,
              border: "1px solid rgba(200,128,106,0.6)",
              background: i < 3 ? "rgba(200,128,106,0.25)" : "transparent",
            }} />
            <span style={{
              fontSize: 8, letterSpacing: "0.06em",
              color: "rgba(200,128,106,0.70)", fontFamily: "Inter,sans-serif",
              textTransform: "uppercase",
            }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Act 3: Requirements label ── */}
      <div ref={labelReqRef} style={{
        position: "absolute", bottom: "22%", left: "15%",
        opacity: 0, pointerEvents: "none",
      }}>
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "rgba(200,128,106,0.5)",
          fontFamily: "'Inter',sans-serif",
        }}>Requirements Extraction</span>
      </div>

      {/* ── Act 4: Risk cluster (free-floating) ── */}
      <div ref={riskClusterRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(calc(-50% + 22%),-50%)", opacity: 0,
        pointerEvents: "none", width: 160,
        display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
      }}>
        <svg width={70} height={70} viewBox="0 0 70 70">
          <circle cx={35} cy={35} r={28} fill="none" stroke="rgba(74,153,117,0.15)" strokeWidth={2.5} />
          <circle cx={35} cy={35} r={28} fill="none" stroke="#4A9975" strokeWidth={2.5}
            strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 28}`}
            strokeDashoffset={`${2 * Math.PI * 28 * 0.30}`}
            transform="rotate(-90 35 35)" />
          <text x={35} y={35} textAnchor="middle" dominantBaseline="central"
            fill="#4A9975" fontSize={12} fontWeight={700} fontFamily="Inter,sans-serif">70%</text>
        </svg>
        {[
          { label: "VENDOR LOCK-IN", sev: "HIGH", color: "#e07070" },
          { label: "COMPLIANCE GAP", sev: "MED",  color: "#e0b870" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{
              fontSize: 7, fontWeight: 700, letterSpacing: "0.1em",
              color: item.color, padding: "1px 4px", borderRadius: 2,
              border: `1px solid ${item.color}`,
            }}>{item.sev}</span>
            <span style={{
              fontSize: 7, letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.40)", fontFamily: "Inter,sans-serif",
            }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Act 4: Risk label ── */}
      <div ref={labelRiskRef} style={{
        position: "absolute", bottom: "22%", right: "15%",
        opacity: 0, pointerEvents: "none",
      }}>
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "rgba(74,153,117,0.5)",
          fontFamily: "'Inter',sans-serif",
        }}>Risk Analysis</span>
      </div>

      {/* ── Act 4: Connection lines (SVG) ── */}
      <svg ref={connLineRef} style={{
        position: "absolute", inset: 0, opacity: 0,
        pointerEvents: "none", zIndex: 3,
      }}>
        <line x1="38%" y1="45%" x2="58%" y2="42%" stroke="rgba(232,121,59,0.35)" strokeWidth={0.5} strokeDasharray="4 4" />
        <line x1="36%" y1="52%" x2="60%" y2="55%" stroke="rgba(232,121,59,0.25)" strokeWidth={0.5} strokeDasharray="4 4" />
      </svg>

      {/* ── Act 5: Clause cluster ── */}
      <div ref={clauseClusterRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(calc(-50% - 20%), calc(-50% + 12%))", opacity: 0,
        pointerEvents: "none", display: "flex", flexDirection: "column", gap: 5,
      }}>
        {["§1.2", "§3.1", "§5.4", "§7.2"].map((num, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "3px 6px", borderRadius: 3,
            background: (i === 1 || i === 3) ? "rgba(212,184,122,0.08)" : "transparent",
            border: (i === 1 || i === 3) ? "1px solid rgba(212,184,122,0.20)" : "1px solid transparent",
          }}>
            <span style={{
              fontSize: 8, fontWeight: 700, color: "#D4B87A",
              fontFamily: "Inter,sans-serif", letterSpacing: "0.05em",
            }}>{num}</span>
            <div style={{ width: 50 + (i * 13) % 30, height: 4, borderRadius: 2, background: "rgba(212,184,122,0.20)" }} />
            {(i === 1 || i === 3) && (
              <span style={{
                fontSize: 6, fontWeight: 700, color: "#D4B87A",
                padding: "1px 3px", borderRadius: 2,
                border: "1px solid rgba(212,184,122,0.35)", letterSpacing: "0.08em",
              }}>FLAG</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Act 5: Clause label ── */}
      <div ref={labelClauseRef} style={{
        position: "absolute", bottom: "18%", left: "22%",
        opacity: 0, pointerEvents: "none",
      }}>
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "rgba(212,184,122,0.5)",
          fontFamily: "'Inter',sans-serif",
        }}>Clause Analysis</span>
      </div>

      {/* ── Act 5: Scope cluster ── */}
      <div ref={scopeClusterRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(calc(-50% + 20%), calc(-50% + 12%))", opacity: 0,
        pointerEvents: "none",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, width: 100,
        }}>
          {[1,1,1,0, 1,1,2,0, 1,2,0,0, 2,0,0,0].map((s, i) => (
            <div key={i} style={{
              height: 16, borderRadius: 2,
              background: s === 1 ? "rgba(138,142,191,0.35)" : s === 2 ? "rgba(138,142,191,0.15)" : "rgba(255,255,255,0.04)",
              border: s === 2 ? "1px solid rgba(138,142,191,0.40)" : "1px solid rgba(255,255,255,0.04)",
            }} />
          ))}
        </div>
      </div>

      {/* ── Act 5: Scope label ── */}
      <div ref={labelScopeRef} style={{
        position: "absolute", bottom: "18%", right: "22%",
        opacity: 0, pointerEvents: "none",
      }}>
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "rgba(138,142,191,0.5)",
          fontFamily: "'Inter',sans-serif",
        }}>Scope Mapping</span>
      </div>

      {/* ── Act 6: Convergence text ── */}
      <div ref={convergeTextRef} style={{
        position: "absolute", top: "25%", left: "50%",
        transform: "translate(-50%,-50%)", opacity: 0,
        textAlign: "center", pointerEvents: "none", zIndex: 5,
      }}>
        <p style={{
          fontSize: "clamp(16px, 2vw, 24px)", fontWeight: 600,
          color: "rgba(255,255,255,0.70)", fontFamily: "'Inter',sans-serif",
          letterSpacing: "0.1em", textTransform: "uppercase",
        }}>Four dimensions. One assessment.</p>
      </div>

      {/* ── Act 8: Proof text ── */}
      <div ref={proofRef} style={{
        position: "absolute", top: "68%", left: "50%",
        transform: "translate(-50%,-50%)", opacity: 0,
        textAlign: "center", pointerEvents: "none", zIndex: 10,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {[
          { bold: "Reads the entire document", rest: " — requirements, risks, clauses, scope" },
          { bold: "Surfaces what matters", rest: " — flags, gaps, and opportunities" },
          { bold: "Delivers a verdict", rest: " — in under 60 seconds" },
        ].map((line, i) => (
          <p key={i} style={{
            fontSize: "clamp(12px, 1.4vw, 16px)", color: "rgba(255,255,255,0.55)",
            fontFamily: "'Inter',sans-serif", lineHeight: 1.5,
          }}>
            <strong style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{line.bold}</strong>
            {line.rest}
          </p>
        ))}
      </div>

      {/* ── Act 9: CTA ── */}
      <div ref={ctaRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)", opacity: 0,
        textAlign: "center", pointerEvents: "auto", zIndex: 20,
      }}>
        <h2 style={{
          fontSize: "clamp(28px, 4.5vw, 52px)", fontWeight: 800,
          color: "rgba(255,255,255,0.92)", letterSpacing: "-1.5px",
          lineHeight: 1.1, fontFamily: "'Inter',sans-serif",
          marginBottom: 24,
        }}>Try it with your RFP</h2>
        <a href="/upload" style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "16px 40px", fontSize: 15, fontWeight: 600,
          background: "#e8793b", color: "#fff", borderRadius: 0,
          textDecoration: "none", fontFamily: "'Inter',sans-serif",
          letterSpacing: "0.02em",
          boxShadow: "0 0 40px rgba(232,121,59,0.35)",
          transition: "background 0.2s",
        }}>Analyze your first RFP
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
        <p style={{
          marginTop: 16, fontSize: 13,
          color: "rgba(255,255,255,0.35)", fontFamily: "'Inter',sans-serif",
        }}>
          <a href="/pricing" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "underline", textUnderlineOffset: 3 }}>
            or see how it works
          </a>
        </p>
      </div>

      {/* Cards */}
      {CARDS.map((card, i) => (
        <div
          key={card.id}
          ref={(el) => { cardRefs.current[i] = el; }}
          style={{
            position: "absolute", top: "50%", left: "50%",
            width: CARD_W, height: CARD_H,
            marginLeft: -CARD_W / 2, marginTop: -CARD_H / 2,
            opacity: 0, willChange: "transform, opacity",
          }}
        >
          <div style={{
            width: "100%", height: "100%", borderRadius: 12,
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderTop: `3px solid ${card.accent}`,
            boxShadow: `0 0 0 1px rgba(${card.rgb},0.06), 0 24px 64px rgba(0,0,0,0.55), 0 0 48px rgba(${card.rgb},0.09), inset 0 1px 0 rgba(255,255,255,0.12), 0 -1px 12px rgba(${card.rgb},0.30)`,
            padding: 16, display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            {/* Card header */}
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.16em",
              textTransform: "uppercase", color: card.accent,
              marginBottom: 10, fontFamily: "'Inter',sans-serif",
            }}>{card.label}</div>
            <div style={{ height: 1, background: `rgba(${card.rgb},0.18)`, marginBottom: 12 }} />
            {/* Content */}
            {i === 0 && <RequirementsContent accent={card.accent} rgb={card.rgb} />}
            {i === 1 && <RiskContent         accent={card.accent} rgb={card.rgb} />}
            {i === 2 && <ClauseContent       accent={card.accent} rgb={card.rgb} />}
            {i === 3 && <ScopeContent        accent={card.accent} rgb={card.rgb} />}
          </div>
        </div>
      ))}

      {/* Score */}
      <div ref={scoreRef} style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%) scale(0.85)",
        opacity: 0, textAlign: "center", pointerEvents: "none", zIndex: 10,
      }}>
        <svg width={180} height={180} viewBox="0 0 180 180"
          style={{ filter: "drop-shadow(0 0 8px rgba(232,121,59,0.5))" }}>
          <circle cx={90} cy={90} r={76} fill="none" stroke="rgba(232,121,59,0.15)" strokeWidth={3} />
          <circle
            ref={arcRef}
            cx={90} cy={90} r={76} fill="none"
            stroke="#e8793b" strokeWidth={3} strokeLinecap="round"
            strokeDasharray={String(ARC_CIRC)}
            strokeDashoffset={String(ARC_CIRC)}
            transform="rotate(-90 90 90)"
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span ref={countRef} style={{
            fontSize: 52, fontWeight: 800, color: "#e8793b",
            fontFamily: "'Inter',sans-serif", letterSpacing: -2, lineHeight: 1,
            textShadow: "0 0 40px rgba(232,121,59,0.70)",
          }}>0</span>
          <span style={{
            fontSize: 8, fontWeight: 600, letterSpacing: "0.2em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.4)",
            marginTop: 5, fontFamily: "'Inter',sans-serif",
          }}>Fit Score</span>
        </div>
      </div>
    </div>
  );
}
