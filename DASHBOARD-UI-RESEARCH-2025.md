# Premium Dashboard UI Design Trends: 2025-2026 Research Report

## Executive Summary

**Key Findings:**

1. **Glassmorphism has matured into "Liquid Glass"** -- Apple's 2025 introduction of Liquid Glass has propelled frosted-glass UI from trend to standard. The consensus across sources is: use `backdrop-filter: blur(8-16px)` with `rgba` backgrounds at 5-15% opacity, constrained to 1-3 key panels per view rather than applied universally.

2. **Score/metric displays are moving beyond arc gauges** -- Leading dashboards now use CSS `conic-gradient` rings, oversized typographic numbers with radial glow backdrops, and SVG-animated stroke-dasharray circles. The dominant pattern is a large, bold number (40-72px) centered inside a thin ring or sitting on a subtle gradient wash, not a skeuomorphic gauge.

3. **Card borders have shifted from shadows to 1px `ring` patterns** -- Premium dashboards in 2025 use `ring-1 ring-white/10` (Tailwind) or `border: 1px solid rgba(255,255,255,0.1)` rather than `box-shadow`. Depth is achieved through background-color layering (e.g., cards at `bg-white/5` on a `bg-zinc-950` surface) rather than elevation shadows.

4. **Editorial typography drives hierarchy** -- Linear, Vercel (Geist), Stripe, and Raycast all use a single font family (Inter or Geist) with aggressive weight/size differentiation. KPI numbers are 36-72px bold/black weight; labels are 12-14px regular/light weight. Monospace variants (Geist Mono, JetBrains Mono) are used exclusively for numerical data to provide tabular alignment.

5. **KPI rows use the "hero number" pattern** -- The dominant metric is displayed 2-4x larger than surrounding context, with secondary metrics at 40-60% of the hero size. Color is applied to the number itself (not the container) to create focus. Trend indicators (up/down arrows, sparklines) are placed inline at smaller scale.

---

## 1. Glassmorphism / Frosted Glass Dashboard Designs

### Sources and Best Examples

**Awwwards/CSS Design Awards caliber work:**
- Apple macOS Big Sur / Sequoia Control Center panels -- the gold standard for frosted glass that balances blur with legibility [EverydayUX, 2025]
- Linear.app sidebar -- subtle transparency that feels intentional, not decorative [LinkedIn/Zirva Zahid, 2025]
- Microsoft Fluent Design System -- enterprise-grade glass panels [Contra, 2025]
- Spotify Wrapped 2024/2025 -- glass-like overlays on interactive music stats [Onyx8, 2025]

**Dribbble top-performing glassmorphism dashboards** (by engagement):
- "Glassmorphism Dashboard" by Atem Design Lab (83 saves, 58k views)
- "Glassmorphism Dashboard - UI Design" by Leon Abramovic (80 saves, 50.8k views)
- "Fitness Tracker Dashboard" by Ewelina Adamczak (136 saves, 26.1k views)
- "HR Management Dashboard" by Paperpillar (192 saves, 55.6k views)

### Specific CSS Techniques

**The canonical glassmorphism card (2025 consensus values):**

```css
.glass-card {
  background: rgba(255, 255, 255, 0.08);      /* dark theme: 5-15% white */
  /* background: rgba(255, 255, 255, 0.15);   /* light theme: 10-20% white */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12); /* subtle edge definition */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);  /* optional soft elevation */
}
```

**Tailwind CSS equivalent:**

```html
<div class="bg-white/[0.08] backdrop-blur-xl rounded-2xl border border-white/[0.12] shadow-lg">
  <!-- content -->
</div>
```

**Recommended blur values from multiple sources [UXPilot, LayersPilot, 7KC, 2025]:**
- **5-8px** -- subtle separation, good for navigation bars and sidebars
- **10-16px** -- the sweet spot for dashboard cards and modals
- **20px+** -- heavy glass, GPU-intensive, use sparingly (hero sections only)
- Most designers settle on **blur(12px)** as the universal default

**Opacity ranges for dark-theme glass [LayersPilot, 2025]:**
- **rgba(255,255,255, 0.05-0.08)** -- barely visible, elegant, for background panels
- **rgba(255,255,255, 0.10-0.15)** -- the sweet spot for cards on dark backgrounds
- **rgba(255,255,255, 0.20-0.30)** -- buttons and interactive hover states

**Critical requirements for glass to "work" [UXPilot, 2025]:**
1. The background MUST have visual content (gradients, shapes, soft color orbs) -- glass on flat color is invisible
2. Limit glass panels to highest-priority cards only; secondary cards use solid backgrounds
3. Trigger GPU compositing with `transform: translateZ(0)` for performance
4. Provide a fallback for browsers without `backdrop-filter` support

**Apple's "Liquid Glass" evolution (2025) [EverydayUX, 2025]:**
- Real-time lensing and refraction (not just blur)
- Adapts to device motion
- Built-in accessibility: automatic contrast adjustment
- This represents the direction glass UI is heading, though full lensing is native-only for now

### Performance Optimization

```css
.glass-card {
  will-change: backdrop-filter;
  transform: translateZ(0);  /* forces GPU compositing */
  contain: layout paint;      /* limits repaint scope */
}

/* Feature detection fallback */
@supports not (backdrop-filter: blur(12px)) {
  .glass-card {
    background: rgba(15, 15, 20, 0.92); /* opaque fallback */
  }
}
```

---

## 2. Score / Health Metric Display Alternatives

### Beyond the Arc Gauge: What Premium Dashboards Actually Use

The research shows that skeuomorphic dial/speedometer gauges are declining in premium dashboard design. Here are the patterns replacing them:

### Pattern A: Conic-Gradient Score Ring (Pure CSS)

The most common modern approach uses `conic-gradient` to create a thin ring that fills proportionally to a score value.

```css
.score-ring {
  --score: 78;           /* 0-100 */
  --ring-color: #10b981; /* emerald-500 */
  --track-color: rgba(255, 255, 255, 0.08);

  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: grid;
  place-items: center;

  background: conic-gradient(
    var(--ring-color) calc(var(--score) * 3.6deg),
    var(--track-color) calc(var(--score) * 3.6deg)
  );

  /* Inner cutout to create ring effect */
  mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 6px),  /* ring thickness = 6px */
    #000 calc(100% - 6px)
  );
}

/* Center number overlay */
.score-ring::after {
  content: attr(data-score);
  font-size: 2rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
}
```

**Tailwind approach:**

```html
<div class="relative h-28 w-28">
  <svg class="h-full w-full -rotate-90" viewBox="0 0 36 36">
    <!-- Track -->
    <circle cx="18" cy="18" r="16" fill="none"
            stroke="currentColor" stroke-width="2"
            class="text-white/10" />
    <!-- Progress -->
    <circle cx="18" cy="18" r="16" fill="none"
            stroke="currentColor" stroke-width="2"
            stroke-dasharray="100" stroke-dashoffset="22"
            stroke-linecap="round"
            class="text-emerald-500 transition-all duration-1000" />
  </svg>
  <!-- Center number -->
  <div class="absolute inset-0 flex items-center justify-center">
    <span class="text-3xl font-bold tabular-nums text-white">78</span>
  </div>
</div>
```

### Pattern B: Glowing Hero Number (No Ring)

Used by Stripe, Vercel, and modern SaaS dashboards. The score is a massive number with a subtle radial gradient glow behind it.

```css
.hero-score {
  position: relative;
  font-size: 4.5rem;       /* 72px */
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: #fff;
  text-align: center;
}

/* Radial glow behind number */
.hero-score::before {
  content: '';
  position: absolute;
  inset: -40%;
  background: radial-gradient(
    50% 50% at 50% 50%,
    rgba(16, 185, 129, 0.20) 0%,   /* emerald glow */
    rgba(16, 185, 129, 0.00) 100%
  );
  z-index: -1;
  filter: blur(20px);
}
```

**Tailwind:**

```html
<div class="relative flex items-center justify-center">
  <!-- Glow backdrop -->
  <div class="absolute -inset-10 bg-emerald-500/20 blur-3xl rounded-full" />
  <!-- Number -->
  <span class="relative text-7xl font-extrabold tabular-nums text-white">
    78
  </span>
  <span class="relative ml-1 text-lg text-emerald-400 font-medium">/100</span>
</div>
```

### Pattern C: Animated SVG Stroke Ring

The approach used by Preline UI and modern component libraries. An SVG circle with `stroke-dasharray` and `stroke-dashoffset` animated on mount.

```html
<svg class="h-32 w-32 -rotate-90" viewBox="0 0 36 36">
  <circle cx="18" cy="18" r="16" fill="none"
          class="stroke-current text-zinc-800"
          stroke-width="1.5" />
  <circle cx="18" cy="18" r="16" fill="none"
          class="stroke-current text-emerald-500"
          stroke-width="2"
          stroke-linecap="round"
          stroke-dasharray="100"
          stroke-dashoffset="22"
          style="transition: stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1);" />
</svg>
```

Key values:
- `stroke-dasharray="100"` -- full circumference
- `stroke-dashoffset` = `100 - score` (so 78% = dashoffset of 22)
- Track ring: `stroke-width: 1.5`, slightly thinner than progress ring
- Progress ring: `stroke-width: 2-3`
- `stroke-linecap: round` -- critical for the premium rounded-end look

### Pattern D: Color-Coded Number with Context Bar

Instead of any circular element, display the number large with a thin horizontal bar below it showing the range.

```html
<div class="space-y-2">
  <div class="flex items-baseline gap-2">
    <span class="text-5xl font-bold tabular-nums text-emerald-400">78</span>
    <span class="text-sm text-zinc-500">/100</span>
  </div>
  <!-- Thin range bar -->
  <div class="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
    <div class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
         style="width: 78%;" />
  </div>
  <span class="text-xs text-zinc-500">Strong fit</span>
</div>
```

### Score Color Mapping (common across premium dashboards):

| Range | Label | Color (Tailwind) | Hex |
|-------|-------|-------------------|-----|
| 90-100 | Excellent | emerald-400 | #34d399 |
| 75-89 | Strong | emerald-500 | #10b981 |
| 60-74 | Moderate | amber-400 | #fbbf24 |
| 40-59 | Weak | orange-500 | #f97316 |
| 0-39 | Critical | red-500 | #ef4444 |

---

## 3. Card Design Patterns for Data Dashboards

### Borders vs. No Borders

**The 2025 consensus [multiple sources]:**

Premium dashboards have largely abandoned `box-shadow` for card separation. The dominant patterns:

**Level 1 -- Subtle ring border (most common):**
```css
.card {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
}
```

Tailwind: `border border-white/[0.06] rounded-xl bg-white/[0.03]`

**Level 2 -- Background differentiation only (no visible border):**
```css
.card {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
}
```

Tailwind: `rounded-xl bg-white/[0.04]`

This relies entirely on the contrast between the card surface (e.g., `bg-white/4`) and the page background (`bg-zinc-950` / `#09090b`) to create separation.

**Level 3 -- Focused highlight border (for primary cards only):**
```css
.card-primary {
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05);
}
```

**What the best dashboards do [Medium/William Bengtsson, 2025]:**
- Use border-lines to differentiate card types, not just for decoration
- A dotted or lighter border indicates secondary/different-flow cards
- Primary action cards get a filled border + slight background boost
- Never use heavy `box-shadow` -- it looks dated in 2025

### Backdrop-Blur and Opacity: Specific Values

**The research-backed "sweet spot" values for frosted glass cards:**

| Context | backdrop-filter | Background | Border |
|---------|----------------|------------|--------|
| Dark theme card | `blur(12px)` | `rgba(255,255,255, 0.08)` | `1px solid rgba(255,255,255, 0.12)` |
| Dark theme nav | `blur(8px)` | `rgba(255,255,255, 0.05)` | `1px solid rgba(255,255,255, 0.08)` |
| Light theme card | `blur(12px)` | `rgba(255,255,255, 0.60)` | `1px solid rgba(255,255,255, 0.30)` |
| Modal overlay | `blur(16px)` | `rgba(255,255,255, 0.10)` | `1px solid rgba(255,255,255, 0.15)` |
| Button/hover state | `blur(5px)` | `rgba(255,255,255, 0.20)` | `1px solid rgba(255,255,255, 0.30)` |

**Tailwind utility mapping:**

| CSS | Tailwind Class |
|-----|---------------|
| `backdrop-filter: blur(4px)` | `backdrop-blur-sm` |
| `backdrop-filter: blur(8px)` | `backdrop-blur` |
| `backdrop-filter: blur(12px)` | `backdrop-blur-lg` |
| `backdrop-filter: blur(16px)` | `backdrop-blur-xl` |
| `backdrop-filter: blur(24px)` | `backdrop-blur-2xl` |

### Achieving Depth Without Heavy Shadows

**Technique 1: Layered background opacity**

The primary technique in 2025 dashboards. Create depth through stacked surfaces with increasing opacity:

```css
:root {
  --surface-0: #09090b;                      /* page background: zinc-950 */
  --surface-1: rgba(255, 255, 255, 0.03);    /* first layer: sidebar, sections */
  --surface-2: rgba(255, 255, 255, 0.05);    /* second layer: cards */
  --surface-3: rgba(255, 255, 255, 0.08);    /* third layer: hover, popover */
  --surface-4: rgba(255, 255, 255, 0.12);    /* fourth layer: active, modal */
}
```

Tailwind:
```
Page:      bg-zinc-950
Section:   bg-white/[0.03]
Card:      bg-white/[0.05]
Hover:     bg-white/[0.08]
Active:    bg-white/[0.12]
```

**Technique 2: Inner glow / subtle inset highlight**

A top-edge highlight that simulates light catching the edge of a glass panel:

```css
.card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  /* Inner glow at top edge */
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
}
```

**Technique 3: Gradient borders using mask-composite**

For a premium edge glow without thick borders:

```css
.gradient-border-card {
  position: relative;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
}

.gradient-border-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0.02) 100%
  );
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: xor;
  pointer-events: none;
}
```

This creates a border that fades from visible at the top to near-invisible at the bottom, simulating light source from above.

---

## 4. Editorial Typography in Dashboards

### How Premium Apps Blend Typography with Data

**Linear [Linear.app redesign blog, 2025]:**
- Primary font: **Inter** for body text, **Inter Display** for headings
- Dark mode palette: near-black background with high-contrast off-white text
- Redesign focused on increasing contrast, making text/icons darker in light mode and lighter in dark mode
- Sidebar labels, icons, and buttons are all pixel-aligned for visual precision
- Design philosophy from founder Karri Saarinen: "professional to engineers" -- modeled after dark coding environments
- Uses Radix UI as the component foundation
- Color usage: extremely restrained. Recent 2025 redesign moved from monochrome blue to almost purely black/white with minimal accent color

**Vercel / Geist Design System [Vercel, Basement Studio, 2025]:**
- Custom typeface: **Geist Sans** (UI, headlines) + **Geist Mono** (numbers, code)
- Inspired by Swiss design movement (Univers, Helvetica tradition)
- Variable font: single file, weights 100-900
- Typography scale (from Geist docs):
  - `text-heading-72` -- Marketing heroes (72px)
  - `text-heading-48` -- Section titles
  - `text-heading-32` -- Dashboard headings (with "Subtle" variant)
  - `text-heading-24` -- Card headings
  - `text-heading-14` -- Smallest heading
- Key practice: **Geist Mono is reserved for displaying numbers** -- this gives KPI values a distinct, tabular-aligned appearance
- Color tokens: `primary`, `secondary`, `disabled`, `info`, `success`, `attention`, `critical`
- The Geist system explicitly uses `font-variant-numeric: tabular-nums` for aligned numerical columns

**Stripe:**
- Uses a clean sans-serif with extremely clear number-first hierarchy
- Dashboard headings are large and bold; supporting text is light and secondary
- Design tokens separate text into `primary`, `secondary`, `disabled`, `critical` roles
- The `font` property system supports: `heading`, `subheading`, `body`, `caption`, `label`
- Weight scale: `normal`, `semibold`, `bold`

**Raycast:**
- Dark-first aesthetic with high-contrast accent colors
- Shining/glowing accent colors against dark backgrounds
- Linear-style design: clean, minimal, fast-feeling
- Uses motion and micro-interactions to create life in minimal interfaces

### Practical Typography System for a Dashboard

```css
/* Font stack */
:root {
  --font-sans: 'Inter', 'Geist Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', 'SF Mono', monospace;
}

/* Type scale for dashboards */
.heading-page    { font-size: 1.5rem;  font-weight: 700; letter-spacing: -0.025em; }  /* 24px */
.heading-section { font-size: 1.125rem; font-weight: 600; letter-spacing: -0.015em; }  /* 18px */
.heading-card    { font-size: 0.875rem; font-weight: 500; letter-spacing: 0; }          /* 14px */

/* KPI / metric numbers -- use mono */
.kpi-hero        { font-family: var(--font-mono); font-size: 3rem;    font-weight: 700;
                   font-variant-numeric: tabular-nums; letter-spacing: -0.04em; }        /* 48px */
.kpi-large       { font-family: var(--font-mono); font-size: 2rem;    font-weight: 600;
                   font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }        /* 32px */
.kpi-medium      { font-family: var(--font-mono); font-size: 1.25rem; font-weight: 600;
                   font-variant-numeric: tabular-nums; }                                  /* 20px */

/* Labels */
.label-primary   { font-size: 0.8125rem; font-weight: 500; color: rgba(255,255,255,0.70); } /* 13px */
.label-secondary { font-size: 0.75rem;   font-weight: 400; color: rgba(255,255,255,0.45); } /* 12px */
.label-caption   { font-size: 0.6875rem; font-weight: 400; color: rgba(255,255,255,0.35);
                   text-transform: uppercase; letter-spacing: 0.05em; }                     /* 11px */
```

**Tailwind implementation:**

```html
<!-- KPI Hero Number -->
<span class="font-mono text-5xl font-bold tabular-nums tracking-tight text-white">
  78
</span>

<!-- Section Label -->
<span class="text-sm font-medium text-zinc-400 tracking-wide">
  Overall Score
</span>

<!-- Micro Label -->
<span class="text-xs text-zinc-500 uppercase tracking-wider">
  Last updated 2h ago
</span>
```

### Key Rules from the Research:

1. **One font family, many weights** -- Linear, Vercel, Stripe all use a single family. Differentiation comes from weight (300-800) and size, not from mixing families.
2. **Monospace for numbers** -- Always use a mono or tabular-nums font for KPI values. This prevents layout shift and creates visual alignment.
3. **Negative letter-spacing on large numbers** -- Headlines and KPI numbers at 32px+ should use `letter-spacing: -0.02em` to `-0.04em` for tighter, more editorial feel.
4. **Color as hierarchy** -- Full white (#fff) for primary numbers, zinc-400 for labels, zinc-500/600 for secondary metadata.
5. **Inter Display for headings** -- If using Inter, switch to Inter Display at 20px+ for better optical sizing.

---

## 5. Command Strip / KPI Row Best Practices

### What is a "Command Strip"?

The horizontal row of 3-6 key metrics typically positioned at the top of a dashboard, below the header. Also called: "KPI strip", "metric bar", "scorecard row", "hero metrics".

### The F-Pattern Principle [5of10, Julius.ai, 2025]

Eye-tracking research confirms dashboards are scanned in an F-pattern:
- **Top-left**: Most critical KPI or status indicator
- **Top-row**: Primary metrics (3-5 key numbers)
- **Middle section**: Trend charts and time-series data
- **Bottom section**: Detailed breakdowns and tables

### Making the Primary Metric Visually Dominant

**Technique 1: Size differentiation (2-4x)**

The hero metric is displayed at 2-4x the size of surrounding secondary metrics:

```html
<div class="flex items-start gap-8">
  <!-- Hero metric: primary score -->
  <div class="flex flex-col items-center">
    <span class="font-mono text-6xl font-bold tabular-nums text-white">78</span>
    <span class="text-xs text-zinc-500 uppercase tracking-wider mt-1">Score</span>
  </div>

  <!-- Secondary metrics: smaller -->
  <div class="grid grid-cols-3 gap-6 pt-2">
    <div>
      <span class="font-mono text-xl font-semibold tabular-nums text-zinc-300">12</span>
      <span class="block text-xs text-zinc-500">Risks</span>
    </div>
    <div>
      <span class="font-mono text-xl font-semibold tabular-nums text-zinc-300">4</span>
      <span class="block text-xs text-zinc-500">Questions</span>
    </div>
    <div>
      <span class="font-mono text-xl font-semibold tabular-nums text-zinc-300">89%</span>
      <span class="block text-xs text-zinc-500">Completeness</span>
    </div>
  </div>
</div>
```

**Technique 2: Color accent on the hero number**

Apply color to the primary metric; keep all others in neutral tones:

```html
<!-- Hero: colored -->
<span class="text-5xl font-bold text-emerald-400">78</span>

<!-- Secondary: neutral -->
<span class="text-xl font-semibold text-zinc-400">12</span>
```

**Technique 3: Background card for the hero only**

Give the primary metric its own glass card while secondary metrics are flat:

```html
<div class="flex gap-4">
  <!-- Hero: has card treatment -->
  <div class="bg-white/[0.06] border border-white/10 rounded-xl px-6 py-4 flex flex-col items-center">
    <span class="text-5xl font-bold tabular-nums text-emerald-400">78</span>
    <span class="text-xs text-zinc-500 mt-1">RFP Score</span>
  </div>

  <!-- Secondary: no card, just text -->
  <div class="flex items-center gap-6 px-4">
    <div>
      <span class="text-lg font-semibold tabular-nums text-zinc-300">12</span>
      <span class="block text-xs text-zinc-500">Risks</span>
    </div>
    <!-- more metrics... -->
  </div>
</div>
```

**Technique 4: Trend indicator integration**

Each metric gets an inline trend arrow + sparkline:

```html
<div class="flex items-baseline gap-2">
  <span class="font-mono text-2xl font-bold tabular-nums text-white">$142K</span>
  <span class="flex items-center gap-0.5 text-xs text-emerald-400">
    <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 12 12">
      <path d="M6 2l4 5H2l4-5z"/>
    </svg>
    12.3%
  </span>
</div>
```

### Layout Pattern: The KPI Row Grid

**Recommended structure from dashboard best practices [Domo, 5of10, Statsig, 2025]:**

```
Row 1: KPI Strip (3-5 metrics, hero metric largest)
  [HERO METRIC]  [Metric 2]  [Metric 3]  [Metric 4]  [Metric 5]

Row 2: Primary charts (trend lines, time series)
  [Main Chart -------- spanning 2/3 width]  [Supporting Chart]

Row 3: Detail breakdowns (tables, lists)
```

**Specific layout guidance:**
- **3-5 KPIs** per strip (never more than 7) [Domo, 2025]
- Each KPI card contains: large number + clear label + comparison context (vs. last period) + optional sparkline
- Hero metric gets 2x-3x the visual weight through size, color, or container treatment
- Use `font-variant-numeric: tabular-nums` on all numbers for alignment
- Maintain consistent vertical rhythm: number on one line, label below

### Example Row Layout (Tailwind):

```html
<section class="grid grid-cols-5 gap-4">
  <!-- Hero KPI: col-span-2 or just larger text -->
  <div class="col-span-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-5">
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">RFP Score</p>
    <div class="flex items-baseline gap-2">
      <span class="font-mono text-4xl font-bold tabular-nums text-emerald-400">78</span>
      <span class="text-sm text-zinc-500">/100</span>
    </div>
    <div class="flex items-center gap-1 mt-2 text-xs text-emerald-400">
      <!-- up arrow -->
      <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 12 12"><path d="M6 2l4 5H2l4-5z"/></svg>
      <span>+5 from last analysis</span>
    </div>
  </div>

  <!-- Secondary KPIs -->
  <div class="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5">
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Risks</p>
    <span class="font-mono text-2xl font-semibold tabular-nums text-amber-400">12</span>
    <p class="text-xs text-zinc-500 mt-1">3 critical</p>
  </div>

  <div class="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5">
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Completeness</p>
    <span class="font-mono text-2xl font-semibold tabular-nums text-zinc-200">89%</span>
    <p class="text-xs text-zinc-500 mt-1">High coverage</p>
  </div>

  <div class="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5">
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Deadline</p>
    <span class="font-mono text-2xl font-semibold tabular-nums text-zinc-200">Mar 15</span>
    <p class="text-xs text-zinc-500 mt-1">21 days left</p>
  </div>

  <div class="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5">
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Questions</p>
    <span class="font-mono text-2xl font-semibold tabular-nums text-zinc-200">7</span>
    <p class="text-xs text-zinc-500 mt-1">To clarify</p>
  </div>
</section>
```

---

## 6. Consolidated Design Token Reference

### Dark Theme Color System

```css
:root {
  /* Backgrounds */
  --bg-page:        #09090b;                      /* zinc-950 */
  --bg-surface-1:   rgba(255, 255, 255, 0.03);    /* subtle sections */
  --bg-surface-2:   rgba(255, 255, 255, 0.05);    /* cards */
  --bg-surface-3:   rgba(255, 255, 255, 0.08);    /* hover / interactive */
  --bg-glass:       rgba(255, 255, 255, 0.08);    /* glass panels */

  /* Borders */
  --border-subtle:  rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.10);
  --border-glass:   rgba(255, 255, 255, 0.12);
  --border-strong:  rgba(255, 255, 255, 0.20);

  /* Text */
  --text-primary:   rgba(255, 255, 255, 1.00);
  --text-secondary: rgba(255, 255, 255, 0.70);
  --text-tertiary:  rgba(255, 255, 255, 0.45);
  --text-muted:     rgba(255, 255, 255, 0.35);

  /* Semantic colors */
  --color-success:  #34d399;   /* emerald-400 */
  --color-warning:  #fbbf24;   /* amber-400 */
  --color-danger:   #ef4444;   /* red-500 */
  --color-info:     #60a5fa;   /* blue-400 */
  --color-accent:   #a78bfa;   /* violet-400 */

  /* Glass effect */
  --glass-blur:     12px;
  --glass-bg:       rgba(255, 255, 255, 0.08);
  --glass-border:   rgba(255, 255, 255, 0.12);

  /* Typography */
  --font-sans:      'Inter', 'Geist Sans', system-ui, sans-serif;
  --font-mono:      'Geist Mono', 'JetBrains Mono', monospace;
}
```

### Tailwind Config Extension

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#09090b',
          1: 'rgba(255, 255, 255, 0.03)',
          2: 'rgba(255, 255, 255, 0.05)',
          3: 'rgba(255, 255, 255, 0.08)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(var(--tw-gradient-stops))',
      },
      fontFamily: {
        sans: ['Inter', 'Geist Sans', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'SF Mono', 'monospace'],
      },
      borderRadius: {
        'card': '12px',
      },
    },
  },
};
```

---

## Bibliography

1. EverydayUX. "Glassmorphism in 2025: How Apple's Liquid Glass is reshaping interface design." Jess Eddy, 2025.
2. UXPilot. "12 Glassmorphism UI Features, Best Practices, and Examples." Khanh Linh Le, November 2025.
3. LayersPilot. "Next Level Glass Effect CSS: 3 Stunning Examples." Ali Muslim, November 2025.
4. 7KC. "15 Web Design Trends Dominating 2025." December 2025.
5. Onyx8 Agency. "10 Mind-Blowing Glassmorphism Examples For 2026." May 2024.
6. Contra. "Design Trends 2025: Glassmorphism, Neumorphism & Styles You Need to Know." 2025.
7. Linear. "How we redesigned the Linear UI (part II)." 2024-2025.
8. Vercel. "Geist Design System." https://vercel.com/geist. 2025.
9. Basement Studio. "The Birth of Geist: A Typeface Crafted for the Web." November 2024.
10. Arlene Xu / Medium. "The rise of Linear style design: origins, trends, and techniques." May 2023.
11. LogRocket. "Linear design: The SaaS design trend that's boring and bettering UI." 2025.
12. Zirva Zahid / LinkedIn. "How to Apply 2025-2026 Design Trends in Dashboards and SaaS Products." 2025.
13. 5of10. "Dashboard Design Best Practices: The Complete 2025 Guide." 2025.
14. Domo. "What Is a KPI Dashboard? Benefits, Best Practices." 2025.
15. Julius.ai. "26 Business Intelligence Dashboard Design Best Practices 2025." October 2025.
16. ParallelHQ. "Improving Visual Hierarchy: Techniques Guide." 2026.
17. Cluster Design. "How to Organize Large Numbers of KPIs Inside a Dashboard." 2025.
18. Datafloq. "Typography Basics for Data Dashboards." 2025.
19. YellowfinBI. "Language, Fonts and Typography." Dashboard Design Best Practices.
20. Preline UI. "Progress Components." Including circular/gauge SVG patterns.
21. CSS-Tricks. "conic-gradient() Almanac." 2025.
22. Smashing Magazine. "A Deep CSS Dive Into Radial And Conic Gradients." 2022 (still authoritative).
23. William Bengtsson / Medium. "8 Practical Design Learnings from Building Dashboards." 2024.
24. FreeFrontend. "185 CSS Cards." Updated 2025.
25. TestMuAI. "An Intuitive Guide To CSS Glassmorphism." January 2026.
26. FlyonUI. "Implement Liquid Glass Effects in Tailwind CSS." 2025.
27. Mockplus. "Liquid Glass Effect Design 2025: 20 Inspiring Examples." 2025.
