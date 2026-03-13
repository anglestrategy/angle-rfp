import { jsPDF } from "jspdf";

/* ── Types ── */
export interface CeoBriefInput {
  score: number;
  projectTitle: string;
  clientName: string;
  fileName: string;
  executiveSummary: string;
  budgetStr?: string;
  deadlineStr?: string;
  durationStr?: string;
  scopePct: number;
  fullMatches: number;
  partialMatches: number;
  gaps: number;
  riskLevel?: string;
  redFlags: { title?: string; severity?: string; description?: string }[];
  contractTerms: Record<string, any>;
  scopeMatches?: {
    requirement?: string;
    matchedService?: string;
    status?: string;
  }[];
  keyDates?: {
    date?: string;
    description?: string;
    name?: string;
    label?: string;
  }[];
  outputCounts?: Record<string, number>;
}

/* ── Helpers ── */

/** Strip ALL non-ASCII characters — jsPDF built-in fonts only support Latin-1 */
function ascii(str: string): string {
  if (!str) return "";
  return str
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2026]/g, "...")
    .replace(/[\u00A0]/g, " ")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "")
    .trim();
}

function trunc(str: string, max: number): string {
  const s = ascii(str);
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, "") + "...";
}

function safe(val: unknown): string {
  if (val === null || val === undefined) return "--";
  return ascii(String(val)) || "--";
}

function termVal(terms: Record<string, any>, key: string): string | null {
  const v = terms[key];
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    const s = v.description || v.value || v.details || null;
    return s ? ascii(String(s)) : null;
  }
  const s = ascii(String(v));
  return s || null;
}

/* ── Colour palette (matches Swiss Grid CSS vars) ── */
const INK: [number, number, number] = [26, 26, 26];
const MUTED: [number, number, number] = [128, 128, 128];
const PAPER: [number, number, number] = [244, 241, 234];
const CARD: [number, number, number] = [255, 255, 255];
const PRIMARY: [number, number, number] = [232, 115, 74];
const WHITE: [number, number, number] = [255, 255, 255];
const GREEN: [number, number, number] = [22, 163, 74];
const AMBER: [number, number, number] = [202, 138, 4];
const RED: [number, number, number] = [220, 38, 38];
const DIVIDER: [number, number, number] = [218, 216, 210];

function scoreColor(s: number): [number, number, number] {
  return s >= 70 ? GREEN : s >= 40 ? AMBER : RED;
}

/* ── Page constants ── */
const PW = 210;
const PH = 297;
const MX = 12;
const CW = PW - MX * 2; // 186mm

/* ══════════════════════════════════════════════════════
   PDF Generator
   ══════════════════════════════════════════════════════ */
export function generateCeoBriefPdf(input: CeoBriefInput): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Paper background
  doc.setFillColor(...PAPER);
  doc.rect(0, 0, PW, PH, "F");

  /* ── Drawing helpers ── */
  const P = 3.5; // card inner padding

  function cardRect(cx: number, cy: number, cw: number, ch: number) {
    doc.setFillColor(...CARD);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.2);
    doc.rect(cx, cy, cw, ch, "FD");
  }

  function mono(
    text: string,
    x: number,
    yy: number,
    size = 4.5,
    color: [number, number, number] = MUTED,
  ) {
    doc.setFont("courier", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text.toUpperCase(), x, yy);
  }

  function sansB(
    text: string,
    x: number,
    yy: number,
    size = 8,
    color: [number, number, number] = INK,
  ) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text, x, yy);
  }

  function sansN(
    text: string,
    x: number,
    yy: number,
    maxW: number,
    size = 6,
  ): number {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(60, 60, 60);
    const lines: string[] = doc.splitTextToSize(text, maxW);
    doc.text(lines, x, yy);
    return lines.length;
  }

  function divider(
    hx: number,
    hy: number,
    hw: number,
    color: [number, number, number] = DIVIDER,
  ) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.15);
    doc.line(hx, hy, hx + hw, hy);
  }

  /* ═══════════════════════════════════════
     1. BLACK HEADER BAR
     ═══════════════════════════════════════ */
  const headerH = 7.5;
  doc.setFillColor(...INK);
  doc.rect(0, 0, PW, headerH, "F");
  mono("RFP EXECUTIVE BRIEF", MX, 4.8, 5.5, WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.setTextColor(160, 160, 160);
  doc.text(dateStr, PW - MX, 4.8, { align: "right" });

  let y = headerH + 3;

  /* ═══════════════════════════════════════
     2. TITLE + SCORE (single card)
     ═══════════════════════════════════════ */
  const titleCardH = 18;
  cardRect(MX, y, CW, titleCardH);

  // Title left
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  const titleText = safe(input.projectTitle || input.fileName);
  const titleLines: string[] = doc.splitTextToSize(titleText, CW * 0.6);
  doc.text(titleLines[0] || "Untitled", MX + P, y + 6.5);
  if (titleLines[1]) {
    doc.setFontSize(8.5);
    doc.text(trunc(titleLines.slice(1).join(" "), 60), MX + P, y + 11);
  }

  // Client
  if (input.clientName) {
    mono(ascii(input.clientName), MX + P, y + titleCardH - 3.5, 4.5, MUTED);
  }

  // Score right
  const sc = scoreColor(input.score);
  const scoreStr = String(input.score);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...sc);
  const scoreNumW = doc.getTextWidth(scoreStr);
  const scoreRight = MX + CW - P;
  doc.text(scoreStr, scoreRight - scoreNumW - 12, y + 11);
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("/100", scoreRight - 10, y + 11);

  // Score bar
  const barW = 32;
  const barX = scoreRight - barW;
  doc.setFillColor(230, 228, 222);
  doc.rect(barX, y + 13.5, barW, 1.3, "F");
  doc.setFillColor(...sc);
  doc.rect(
    barX,
    y + 13.5,
    barW * (Math.min(input.score, 100) / 100),
    1.3,
    "F",
  );

  y += titleCardH + 2;

  /* ═══════════════════════════════════════
     3. METRICS ROW — 3 cards
     ═══════════════════════════════════════ */
  const mGap = 2;
  const mW = (CW - mGap * 2) / 3;
  const mH = 13;
  const mData = [
    { label: "DEADLINE", value: safe(input.deadlineStr), accent: true },
    { label: "BUDGET", value: safe(input.budgetStr), accent: false },
    { label: "DURATION", value: safe(input.durationStr), accent: false },
  ];
  mData.forEach((m, i) => {
    const mx = MX + i * (mW + mGap);
    cardRect(mx, y, mW, mH);
    mono(m.label, mx + P, y + 4, 4);
    sansB(trunc(m.value, 26), mx + P, y + 9.5, 7.5, m.accent ? PRIMARY : INK);
  });
  y += mH + 2;

  /* ═══════════════════════════════════════
     4. MAIN CONTENT — single wide card
        with internal 2-column layout
     ═══════════════════════════════════════ */
  const footerH = 6;
  const contentH = PH - y - footerH - 3; // fill remaining page
  cardRect(MX, y, CW, contentH);

  const innerP = 4;
  const colGap = 5;
  const innerW = CW - innerP * 2;
  const leftW = Math.floor(innerW * 0.55);
  const rightW = innerW - leftW - colGap;
  const leftX = MX + innerP;
  const rightX = leftX + leftW + colGap;

  // Vertical divider line between columns
  const divX = leftX + leftW + colGap / 2;
  doc.setDrawColor(...DIVIDER);
  doc.setLineWidth(0.15);
  doc.line(divX, y + innerP, divX, y + contentH - innerP);

  /* ─── LEFT COLUMN ─── */
  let ly = y + innerP + 1;

  // -- EXECUTIVE SUMMARY --
  mono("EXECUTIVE SUMMARY", leftX, ly, 4.5, INK);
  ly += 3.5;
  const summaryText = trunc(input.executiveSummary, 550);
  const sumLines = sansN(summaryText, leftX, ly, leftW, 6);
  ly += sumLines * 2.5 + 3;

  divider(leftX, ly, leftW);
  ly += 3.5;

  // -- SCOPE MATCH --
  mono("SCOPE MATCH", leftX, ly, 4.5, INK);
  const scopePctVal = Math.min(Math.round(input.scopePct), 100);
  // Right-aligned percentage
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PRIMARY);
  doc.text(scopePctVal + "%", leftX + leftW, ly, { align: "right" });
  ly += 3;

  // Tri-color bar
  const totalItems = input.fullMatches + input.partialMatches + input.gaps;
  const scopeBarW = leftW;
  if (totalItems > 0) {
    const fW = scopeBarW * (input.fullMatches / totalItems);
    const pW = scopeBarW * (input.partialMatches / totalItems);
    const gW = scopeBarW * (input.gaps / totalItems);
    let bx = leftX;
    doc.setFillColor(...GREEN);
    doc.rect(bx, ly, fW, 1.5, "F");
    bx += fW;
    doc.setFillColor(...AMBER);
    doc.rect(bx, ly, pW, 1.5, "F");
    bx += pW;
    doc.setFillColor(...RED);
    doc.rect(bx, ly, gW, 1.5, "F");
  } else {
    doc.setFillColor(230, 228, 222);
    doc.rect(leftX, ly, scopeBarW, 1.5, "F");
  }
  ly += 3;

  // Legend
  let lx = leftX;
  (
    [
      [GREEN, "FULL " + input.fullMatches],
      [AMBER, "PARTIAL " + input.partialMatches],
      [RED, "GAPS " + input.gaps],
    ] as [[number, number, number], string][]
  ).forEach(([c, t]) => {
    doc.setFillColor(...c);
    doc.rect(lx, ly - 0.6, 1.5, 1.5, "F");
    doc.setFont("courier", "bold");
    doc.setFontSize(3.8);
    doc.setTextColor(...INK);
    doc.text(t, lx + 2.2, ly + 0.3);
    lx += 19;
  });
  ly += 3;

  // Scope items
  const scopeItems = (input.scopeMatches || [])
    .filter((m) => m.requirement || m.matchedService)
    .slice(0, 8);
  if (scopeItems.length > 0) {
    scopeItems.forEach((item) => {
      const status = (item.status || "").toLowerCase();
      const dotCol: [number, number, number] = status.includes("full")
        ? GREEN
        : status.includes("partial")
          ? AMBER
          : RED;
      doc.setFillColor(...dotCol);
      doc.circle(leftX + 1, ly + 0.2, 0.7, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.2);
      doc.setTextColor(50, 50, 50);
      doc.text(
        trunc(item.requirement || item.matchedService || "", 60),
        leftX + 3.5,
        ly + 0.6,
      );
      ly += 2.8;
    });
  }
  ly += 2;

  divider(leftX, ly, leftW);
  ly += 3.5;

  // -- KEY DATES --
  const dates = (input.keyDates || [])
    .filter((d) => d.date || d.name || d.description)
    .slice(0, 5);
  if (dates.length > 0) {
    mono("KEY DATES", leftX, ly, 4.5, INK);
    ly += 3.5;
    dates.forEach((d) => {
      sansB(trunc(d.date || "", 16), leftX, ly, 5.2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.2);
      doc.setTextColor(80, 80, 80);
      doc.text(
        trunc(d.description || d.name || d.label || "", 48),
        leftX + 23,
        ly,
      );
      ly += 2.8;
    });
    ly += 2;
    divider(leftX, ly, leftW);
    ly += 3.5;
  }

  // -- DELIVERABLES --
  const oc = input.outputCounts || {};
  const ocEntries = Object.entries(oc)
    .filter(([, v]) => v > 0)
    .slice(0, 6);
  if (ocEntries.length > 0) {
    mono("DELIVERABLES", leftX, ly, 4.5, INK);
    ly += 3.5;
    const colW = leftW / 2;
    for (let i = 0; i < ocEntries.length; i++) {
      const [name, count] = ocEntries[i];
      const col = i % 2;
      const ox = leftX + col * colW;
      sansB(String(count), ox, ly, 8.5);
      const cW = doc.getTextWidth(String(count));
      mono(name, ox + cW + 1.5, ly, 4, MUTED);
      if (col === 1 || i === ocEntries.length - 1) ly += 4.5;
    }
  }

  /* ─── RIGHT COLUMN ─── */
  let ry = y + innerP + 1;

  // -- RISKS --
  const rl = (input.riskLevel || "UNKNOWN").toUpperCase();
  mono("RISKS", rightX, ry, 4.5, INK);

  // Risk level badge
  const rlColor: [number, number, number] =
    rl.includes("HIGH") || rl.includes("CRITICAL")
      ? RED
      : rl.includes("MED")
        ? AMBER
        : GREEN;
  doc.setFont("courier", "bold");
  doc.setFontSize(4);
  const rlTextW = doc.getTextWidth(rl) + 2;
  const badgeX = rightX + rightW - rlTextW;
  doc.setFillColor(...rlColor);
  doc.rect(badgeX, ry - 1.2, rlTextW, 2.8, "F");
  doc.setTextColor(...WHITE);
  doc.text(rl, badgeX + rlTextW / 2, ry, { align: "center" });
  ry += 3.5;

  const highRisks = input.redFlags
    .filter((r) => {
      const sev = (r.severity || "").toUpperCase();
      return sev.includes("HIGH") || sev.includes("CRITICAL");
    })
    .slice(0, 5);
  const risksToShow =
    highRisks.length > 0
      ? highRisks
      : input.redFlags
          .filter((r) => r.title)
          .slice(0, 4);

  if (risksToShow.length > 0) {
    risksToShow.forEach((risk) => {
      const sev = (risk.severity || "").toUpperCase();
      const sevCol: [number, number, number] = sev.includes("CRITICAL")
        ? RED
        : sev.includes("HIGH")
          ? PRIMARY
          : AMBER;

      // Left accent bar
      doc.setFillColor(...sevCol);
      doc.rect(rightX, ry - 1, 0.6, risk.description ? 6.5 : 3, "F");

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(...INK);
      doc.text(trunc(safe(risk.title), 48), rightX + 2.5, ry);
      ry += 2.5;

      // Description
      if (risk.description) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(4.8);
        doc.setTextColor(100, 100, 100);
        const desc = trunc(risk.description, 110);
        const dLines: string[] = doc.splitTextToSize(desc, rightW - 4);
        doc.text(dLines.slice(0, 3), rightX + 2.5, ry);
        ry += dLines.slice(0, 3).length * 2 + 1;
      }
      ry += 1.5;
    });
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(5.5);
    doc.setTextColor(...MUTED);
    doc.text("No significant risks identified", rightX + 2, ry);
    ry += 5;
  }

  ry += 1;
  divider(rightX, ry, rightW);
  ry += 3.5;

  // -- KEY TERMS --
  const termPairs: { label: string; value: string }[] = [];
  const termKeys: [string, string][] = [
    ["paymentTerms", "PAYMENT"],
    ["ipOwnership", "IP OWNERSHIP"],
    ["delayPenalties", "PENALTIES"],
    ["governingLaw", "GOV. LAW"],
    ["termination", "TERMINATION"],
    ["confidentiality", "CONFIDENTIAL"],
    ["liabilityLimitations", "LIABILITY"],
    ["warrantyRequirements", "WARRANTY"],
  ];
  for (const [key, lbl] of termKeys) {
    const v = termVal(input.contractTerms, key);
    if (v && termPairs.length < 6) {
      termPairs.push({ label: lbl, value: trunc(v, 75) });
    }
  }

  if (termPairs.length > 0) {
    mono("KEY TERMS", rightX, ry, 4.5, INK);
    ry += 3.5;

    termPairs.forEach((term, idx) => {
      if (idx > 0) {
        divider(rightX, ry - 0.5, rightW);
        ry += 1.5;
      }
      mono(term.label, rightX, ry, 3.8, MUTED);
      ry += 2.2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.2);
      doc.setTextColor(50, 50, 50);
      const tLines: string[] = doc.splitTextToSize(term.value, rightW);
      doc.text(tLines.slice(0, 2), rightX, ry);
      ry += Math.min(tLines.length, 2) * 2.2 + 1.5;
    });
  }

  /* ═══════════════════════════════════════
     5. FOOTER
     ═══════════════════════════════════════ */
  const footerY = PH - footerH;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.2);
  doc.line(MX, footerY, PW - MX, footerY);
  doc.setFont("courier", "normal");
  doc.setFontSize(4);
  doc.setTextColor(...MUTED);
  doc.text("Generated " + dateStr + "  |  angle/RFP", MX, footerY + 2.5);
  doc.text("Confidential", PW - MX, footerY + 2.5, { align: "right" });

  /* ═══════════════════════════════════════
     SAVE
     ═══════════════════════════════════════ */
  const safeName = (input.projectTitle || input.fileName || "RFP")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 40);
  doc.save("CEO-Brief_" + safeName + ".pdf");
}
