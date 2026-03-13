import puppeteer from "puppeteer";

/* ──────────────────────────────────────────────────────────
   Server-side PDF generation using Puppeteer
   Renders a Swiss-grid styled HTML page to PDF
   ────────────────────────────────────────────────────────── */

interface PdfData {
  projectTitle: string;
  clientName: string;
  fileName: string;
  score: number;
  executiveSummary: string;
  deadlineStr?: string;
  durationStr?: string;
  scopePct: number;
  fullMatches: number;
  partialMatches: number;
  gaps: number;
  riskLevel?: string;
  risks: { title: string; severity: string; description: string }[];
  contractTerms: { label: string; value: string }[];
  scopeMatches: { requirement: string; status: string }[];
  keyDates: { date: string; description: string }[];
  deliverables: { name: string; count: number }[];
}

/** Extract clean PDF data from a raw analysis DB record */
export function extractPdfData(analysis: any): PdfData {
  const extracted = analysis.extractedData ?? {};
  const core = extracted?.coreExtraction ?? {};
  const scope = analysis.scopeAnalysis ?? {};
  const clientProfile = (analysis.clientResearch as any)?.clientProfile ?? analysis.clientResearch ?? {};

  // Red flags
  let redFlagList: any[] = [];
  const rf = analysis.redFlags ?? {};
  if (Array.isArray(rf)) redFlagList = rf;
  else if (Array.isArray(rf?.redFlags)) redFlagList = rf.redFlags;
  else if (Array.isArray(rf?.flags)) redFlagList = rf.flags;
  if (redFlagList.length === 0 && extracted?.redFlagAnalysis) {
    const rfa = extracted.redFlagAnalysis;
    if (Array.isArray(rfa?.redFlags)) redFlagList = rfa.redFlags;
    else if (Array.isArray(rfa?.flags)) redFlagList = rfa.flags;
    else if (Array.isArray(rfa)) redFlagList = rfa;
  }
  const riskSummary = extracted?.redFlagAnalysis?.riskSummary || null;
  const riskLevel =
    riskSummary?.overallRiskLevel ||
    (redFlagList.length > 3 ? "HIGH" : redFlagList.length > 0 ? "MEDIUM" : "LOW");

  // Filter to HIGH/CRITICAL only
  const highRisks = redFlagList
    .filter((r: any) => {
      const sev = (r.severity || r.level || "").toUpperCase();
      return sev.includes("HIGH") || sev.includes("CRITICAL");
    })
    .slice(0, 5);
  const risksToShow = highRisks.length > 0 ? highRisks : redFlagList.filter((r: any) => r.title).slice(0, 4);

  // Contract terms
  const ct = core?.contractTerms || {};
  const termKeys: [string, string][] = [
    ["paymentTerms", "Payment Terms"],
    ["ipOwnership", "IP Ownership"],
    ["delayPenalties", "Penalties"],
    ["governingLaw", "Governing Law"],
    ["terminationClause", "Termination"],
    ["confidentiality", "Confidentiality"],
    ["liabilityLimitations", "Liability"],
  ];
  const terms: { label: string; value: string }[] = [];
  for (const [key, lbl] of termKeys) {
    const v = ct[key];
    if (v === null || v === undefined) continue;
    const s = typeof v === "object" ? (v.description || v.value || v.details || "") : String(v);
    if (s.trim() && terms.length < 5) {
      terms.push({ label: lbl, value: s.trim() });
    }
  }

  // Scope matches
  const rawMatches = Array.isArray(scope?.matches) ? scope.matches : [];
  const scopeMatches = rawMatches
    .filter((m: any) => m.scopeItem || m.requirement || m.rfpRequirement)
    .slice(0, 10)
    .map((m: any) => ({
      requirement: m.scopeItem || m.requirement || m.rfpRequirement || "",
      status: m.status || m.matchType || "gap",
    }));

  // Key dates
  let dates: any[] = [];
  if (Array.isArray(core?.keyDates)) dates = core.keyDates;
  else if (Array.isArray(core?.dates)) dates = core.dates;
  if (core?.timeline?.keyMilestones && Array.isArray(core.timeline.keyMilestones)) {
    dates = [...dates, ...core.timeline.keyMilestones];
  }
  const keyDates = dates
    .filter((d: any) => d.date || d.deadline || d.description || d.name)
    .slice(0, 6)
    .map((d: any) => ({
      date: d.date || d.deadline || "",
      description: d.description || d.name || d.milestone || d.label || "",
    }));

  // Deliverables / output counts
  const oc = scope?.outputCounts ?? scope?.deliverableCounts ?? {};
  const deliverables = Object.entries(oc)
    .filter(([, v]) => (v as number) > 0)
    .slice(0, 8)
    .map(([name, count]) => ({ name, count: count as number }));

  // Submission
  const submission = core?.submissionRequirements || {};

  return {
    projectTitle: core?.projectTitle || core?.title || analysis.fileName || "Untitled RFP",
    clientName: core?.clientName || clientProfile?.companyName || "",
    fileName: analysis.fileName || "",
    score: analysis.overallScore ?? 0,
    executiveSummary: core?.executiveSummary || "",
    deadlineStr: submission?.deadline || core?.submissionDeadline || undefined,
    durationStr: core?.timeline?.overallDuration ||
      (core?.timeline?.durationMonths ? `${core.timeline.durationMonths} months` : undefined),
    scopePct: scope?.agencyServicePercentage ?? scope?.matchPercentage ?? 0,
    fullMatches: scope?.fullMatchCount ?? scope?.fullMatches ?? 0,
    partialMatches: scope?.partialMatchCount ?? scope?.partialMatches ?? 0,
    gaps: scope?.gapCount ?? scope?.gaps ?? 0,
    riskLevel,
    risks: risksToShow.map((r: any) => ({
      title: r.title || r.flag || r.name || "",
      severity: r.severity || r.level || "",
      description: r.description || r.details || "",
    })),
    contractTerms: terms,
    scopeMatches,
    keyDates,
    deliverables,
  };
}

/* ── Score colour helper ── */
function scoreCol(s: number): string {
  return s >= 70 ? "#16a34a" : s >= 40 ? "#ca8a04" : "#dc2626";
}

function riskBadgeCol(level: string): string {
  const l = level.toUpperCase();
  if (l.includes("HIGH") || l.includes("CRITICAL")) return "#dc2626";
  if (l.includes("MED")) return "#ca8a04";
  return "#16a34a";
}

function statusDot(status: string): { color: string; label: string } {
  const s = status.toLowerCase();
  if (s.includes("full")) return { color: "#16a34a", label: "Full" };
  if (s.includes("partial")) return { color: "#ca8a04", label: "Partial" };
  return { color: "#dc2626", label: "Gap" };
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── HTML Template ── */
function buildHtml(d: PdfData): string {
  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const scopeTotal = d.fullMatches + d.partialMatches + d.gaps;
  const scopePct = Math.min(Math.round(d.scopePct), 100);

  // Build scope bar percentages
  const fullPct = scopeTotal > 0 ? (d.fullMatches / scopeTotal) * 100 : 0;
  const partialPct = scopeTotal > 0 ? (d.partialMatches / scopeTotal) * 100 : 0;
  const gapPct = scopeTotal > 0 ? (d.gaps / scopeTotal) * 100 : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --ink: #1a1a1a;
    --muted: #808080;
    --paper: hsl(40, 15%, 95%);
    --card: #ffffff;
    --primary: hsl(14, 75%, 60%);
    --green: #16a34a;
    --amber: #ca8a04;
    --red: #dc2626;
    --border: #1a1a1a;
    --divider: #dad8d2;
    --font-sans: 'Inter', 'Helvetica Neue', Arial, system-ui, -apple-system, sans-serif;
    --font-mono: 'SFMono-Regular', 'Menlo', 'Monaco', 'Courier New', monospace;
  }

  @page {
    size: A4 portrait;
    margin: 0;
  }

  body {
    font-family: var(--font-sans);
    background: var(--paper);
    color: var(--ink);
    width: 210mm;
    min-height: 297mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Typography ── */
  .mono-label {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
  }

  .mono-label-dark {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink);
  }

  .section-title {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink);
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--ink);
  }

  /* ── Header ── */
  .header {
    background: var(--ink);
    padding: 10px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header-title {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #ffffff;
    text-transform: uppercase;
  }
  .header-date {
    font-family: var(--font-sans);
    font-size: 9px;
    color: #999;
  }

  /* ── Title Card ── */
  .title-card {
    margin: 12px 20px 0;
    background: var(--card);
    border: 1px solid var(--border);
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }
  .title-left { flex: 1; min-width: 0; }
  .project-name {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.15;
    color: var(--ink);
  }
  .client-name {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin-top: 6px;
  }
  .score-block { text-align: right; flex-shrink: 0; }
  .score-number {
    font-size: 42px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.03em;
  }
  .score-suffix {
    font-size: 14px;
    font-weight: 700;
    color: var(--muted);
    margin-left: 1px;
  }
  .score-bar {
    height: 4px;
    background: #e5e5e0;
    margin-top: 6px;
    width: 100px;
    margin-left: auto;
  }
  .score-bar-fill { height: 100%; }

  /* ── Metric Strip ── */
  .metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 8px 20px 0;
  }
  .metric-card {
    background: var(--card);
    border: 1px solid var(--border);
    padding: 10px 14px;
  }
  .metric-card.accent {
    background: var(--primary);
    border-color: var(--primary);
  }
  .metric-card.accent .mono-label { color: rgba(255,255,255,0.65); }
  .metric-card.accent .metric-val { color: #fff; }
  .metric-val {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.01em;
    margin-top: 2px;
    color: var(--ink);
  }

  /* ── Content Grid ── */
  .content-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 8px 20px 0;
  }

  /* ── Panel (card in content grid) ── */
  .panel {
    background: var(--card);
    border: 1px solid var(--border);
    padding: 14px 16px;
  }
  .panel.span-2 { grid-column: span 2; }

  /* ── Summary text ── */
  .summary-text {
    font-size: 11px;
    line-height: 1.6;
    color: #404040;
  }

  /* ── Scope Bar ── */
  .scope-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .scope-pct {
    font-size: 18px;
    font-weight: 800;
    color: var(--primary);
  }
  .scope-bar {
    display: flex;
    height: 6px;
    gap: 1px;
    margin-bottom: 6px;
  }
  .scope-bar div { height: 100%; }
  .legend {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 3px;
    font-family: var(--font-mono);
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink);
  }
  .legend-dot {
    width: 6px;
    height: 6px;
    flex-shrink: 0;
  }

  /* ── Scope Items ── */
  .scope-list { list-style: none; }
  .scope-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0;
    font-size: 9.5px;
    color: var(--ink);
    border-bottom: 1px solid #f0eeea;
  }
  .scope-item:last-child { border-bottom: none; }
  .scope-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ── Risk Items ── */
  .risk-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .risk-badge {
    font-family: var(--font-mono);
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #fff;
    padding: 2px 8px;
    display: inline-block;
  }
  .risk-item {
    margin-bottom: 8px;
    padding-left: 8px;
    border-left: 2px solid;
  }
  .risk-title {
    font-size: 10px;
    font-weight: 700;
    color: var(--ink);
    margin-bottom: 2px;
  }
  .risk-desc {
    font-size: 9px;
    line-height: 1.45;
    color: #666;
  }

  /* ── Term Row ── */
  .term-row {
    padding: 5px 0;
    border-bottom: 1px solid #f0eeea;
  }
  .term-row:last-child { border-bottom: none; }
  .term-label {
    font-family: var(--font-mono);
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 1px;
  }
  .term-value {
    font-size: 9.5px;
    color: var(--ink);
    line-height: 1.4;
  }

  /* ── Key Dates ── */
  .date-row {
    display: flex;
    gap: 10px;
    padding: 3px 0;
    border-bottom: 1px solid #f0eeea;
    font-size: 9.5px;
  }
  .date-row:last-child { border-bottom: none; }
  .date-val {
    font-weight: 700;
    color: var(--ink);
    min-width: 80px;
    flex-shrink: 0;
  }
  .date-desc { color: #555; }

  /* ── Deliverables Grid ── */
  .del-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
    gap: 6px;
  }
  .del-item { text-align: left; }
  .del-count {
    font-size: 20px;
    font-weight: 800;
    color: var(--ink);
    line-height: 1;
  }
  .del-name {
    font-family: var(--font-mono);
    font-size: 7px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin-top: 1px;
  }

  /* ── Footer ── */
  .footer {
    margin: 0 20px;
    padding: 8px 0;
    border-top: 1px solid var(--ink);
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 8px;
    color: var(--muted);
    position: fixed;
    bottom: 12px;
    left: 20px;
    right: 20px;
  }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <span class="header-title">RFP Executive Brief</span>
  <span class="header-date">${esc(dateStr)}</span>
</div>

<!-- TITLE + SCORE -->
<div class="title-card">
  <div class="title-left">
    <div class="project-name">${esc(d.projectTitle)}</div>
    ${d.clientName ? `<div class="client-name">${esc(d.clientName)}</div>` : ""}
  </div>
  <div class="score-block">
    <span class="score-number" style="color: ${scoreCol(d.score)}">${d.score}</span><span class="score-suffix">/100</span>
    <div class="score-bar">
      <div class="score-bar-fill" style="width: ${Math.min(d.score, 100)}%; background: ${scoreCol(d.score)}"></div>
    </div>
  </div>
</div>

<!-- METRICS -->
<div class="metrics">
  <div class="metric-card accent">
    <div class="mono-label">Deadline</div>
    <div class="metric-val">${esc(d.deadlineStr || "--")}</div>
  </div>
  <div class="metric-card">
    <div class="mono-label">Duration</div>
    <div class="metric-val">${esc(d.durationStr || "--")}</div>
  </div>
</div>

<!-- CONTENT GRID -->
<div class="content-grid">

  <!-- EXECUTIVE SUMMARY (full width) -->
  <div class="panel span-2">
    <div class="section-title">Executive Summary</div>
    <p class="summary-text">${esc(d.executiveSummary)}</p>
  </div>

  <!-- SCOPE ANALYSIS (left) -->
  <div class="panel">
    <div class="scope-header">
      <div class="section-title" style="border: none; margin: 0; padding: 0;">Scope Match</div>
      <span class="scope-pct">${scopePct}%</span>
    </div>
    <div class="scope-bar">
      <div style="width: ${fullPct}%; background: var(--green);"></div>
      <div style="width: ${partialPct}%; background: var(--amber);"></div>
      <div style="width: ${gapPct}%; background: var(--red);"></div>
    </div>
    <div class="legend">
      <span class="legend-item"><span class="legend-dot" style="background: var(--green)"></span>Full ${d.fullMatches}</span>
      <span class="legend-item"><span class="legend-dot" style="background: var(--amber)"></span>Partial ${d.partialMatches}</span>
      <span class="legend-item"><span class="legend-dot" style="background: var(--red)"></span>Gaps ${d.gaps}</span>
    </div>
    ${d.scopeMatches.length > 0 ? `
    <ul class="scope-list">
      ${d.scopeMatches.map((m) => {
        const s = statusDot(m.status);
        return `<li class="scope-item">
          <span class="scope-dot" style="background: ${s.color}"></span>
          ${esc(m.requirement)}
        </li>`;
      }).join("")}
    </ul>` : ""}
  </div>

  <!-- RISKS (right) -->
  <div class="panel">
    <div class="risk-header">
      <div class="section-title" style="border: none; margin: 0; padding: 0;">Risks</div>
      <span class="risk-badge" style="background: ${riskBadgeCol(d.riskLevel || "")}">${esc((d.riskLevel || "UNKNOWN").toUpperCase())}</span>
    </div>
    ${d.risks.length > 0 ? d.risks.map((r) => {
      const sev = r.severity.toUpperCase();
      const col = sev.includes("CRITICAL") ? "var(--red)" : sev.includes("HIGH") ? "var(--primary)" : "var(--amber)";
      return `<div class="risk-item" style="border-color: ${col}">
        <div class="risk-title">${esc(r.title)}</div>
        ${r.description ? `<div class="risk-desc">${esc(r.description)}</div>` : ""}
      </div>`;
    }).join("") : `<p style="font-size: 10px; color: var(--muted); font-style: italic;">No significant risks identified</p>`}
  </div>

  <!-- KEY DATES (left) -->
  ${d.keyDates.length > 0 ? `
  <div class="panel">
    <div class="section-title">Key Dates</div>
    ${d.keyDates.map((dt) => `
      <div class="date-row">
        <span class="date-val">${esc(dt.date)}</span>
        <span class="date-desc">${esc(dt.description)}</span>
      </div>
    `).join("")}
  </div>` : ""}

  <!-- CONTRACT TERMS (right) -->
  ${d.contractTerms.length > 0 ? `
  <div class="panel">
    <div class="section-title">Key Terms</div>
    ${d.contractTerms.map((t) => `
      <div class="term-row">
        <div class="term-label">${esc(t.label)}</div>
        <div class="term-value">${esc(t.value)}</div>
      </div>
    `).join("")}
  </div>` : ""}

  <!-- DELIVERABLES (full width if exists) -->
  ${d.deliverables.length > 0 ? `
  <div class="panel span-2">
    <div class="section-title">Deliverables</div>
    <div class="del-grid">
      ${d.deliverables.map((dl) => `
        <div class="del-item">
          <div class="del-count">${dl.count}</div>
          <div class="del-name">${esc(dl.name)}</div>
        </div>
      `).join("")}
    </div>
  </div>` : ""}

</div>

<!-- FOOTER -->
<div class="footer">
  <span>Generated ${esc(dateStr)} &nbsp;|&nbsp; angle/RFP</span>
  <span>Confidential</span>
</div>

</body>
</html>`;
}

function getLaunchOptions() {
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_BIN ||
    process.env.CHROMIUM_PATH ||
    (() => {
      try {
        return puppeteer.executablePath();
      } catch {
        return undefined;
      }
    })();

  return {
    headless: true as const,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
  };
}

/* ── PDF Generation ── */
export async function generatePdf(analysis: any): Promise<Buffer> {
  const data = extractPdfData(analysis);
  const html = buildHtml(data);

  const browser = await puppeteer.launch(getLaunchOptions());

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.emulateMediaType("screen");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
