const arabicPattern = /[\u0600-\u06FF]/g;
const englishPattern = /[A-Za-z]/g;

export type PrimaryLanguage = "arabic" | "english" | "mixed";

export function detectPrimaryLanguage(text: string): PrimaryLanguage {
  const arabicCount = (text.match(arabicPattern) ?? []).length;
  const englishCount = (text.match(englishPattern) ?? []).length;

  if (arabicCount === 0 && englishCount === 0) {
    return "english";
  }

  if (arabicCount > 0 && englishCount > 0) {
    const ratio = Math.min(arabicCount, englishCount) / Math.max(arabicCount, englishCount);
    if (ratio >= 0.2) {
      return "mixed";
    }
  }

  return arabicCount > englishCount ? "arabic" : "english";
}

export function normalizeForMatching(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[ـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(input: string, maxChars: number): string {
  if (input.length <= maxChars) {
    return input;
  }

  return input.slice(0, maxChars);
}

export interface SectionSpan {
  name: string;
  startOffset: number;
  endOffset: number;
}

const sectionHeadingMatchers: Array<{ name: string; patterns: RegExp[] }> = [
  {
    name: "scope_of_work",
    patterns: [
      /^\s*(?:\d+[\.\)]\s*)?(scope\s+of\s+work|statement\s+of\s+work|core\s+scope\s+items|نطاق\s+العمل)\s*$/gimu,
      /^\s*(?:\d+[\.\)]\s*)?(program\s+phases?|phases?)\s*(?:\(.*\))?\s*$/gimu
    ]
  },
  {
    name: "evaluation_criteria",
    patterns: [
      /^\s*(?:\d+[\.\)]\s*)?(evaluation\s+criteria|technical\s+evaluation\s+criteria|evaluation\s+matrix|معايير\s+التقييم)\s*$/gimu,
      /^\s*(?:\d+[\.\)]\s*)?(technical\s+evaluation)\s*$/gimu
    ]
  },
  {
    name: "important_dates",
    patterns: [
      /^\s*(?:\d+[\.\)]\s*)?(important\s+dates?|timeline|milestones?|deadlines?|الجدول\s+الزمني|المواعيد)\s*$/gimu
    ]
  },
  {
    name: "submission_requirements",
    patterns: [
      /^\s*(?:\d+[\.\)]\s*)?(submission\s+format|submission\s+requirements?|proposal\s+requirements?|how\s+to\s+submit|متطلبات\s+التقديم)\s*$/gimu,
      /^\s*(?:\d+[\.\)]\s*)?(technical\s+proposals?\s+should\s+include|commercial\s+proposals?\s+should\s+include)\s*$/gimu
    ]
  }
];

function collectFirstHeadingOffset(text: string, patterns: RegExp[]): number | null {
  let bestOffset: number | null = null;
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (!match || match.index === undefined) {
      continue;
    }
    if (bestOffset === null || match.index < bestOffset) {
      bestOffset = match.index;
    }
  }
  return bestOffset;
}

export function detectSections(text: string): SectionSpan[] {
  const located = sectionHeadingMatchers
    .map((entry) => ({
      name: entry.name,
      startOffset: collectFirstHeadingOffset(text, entry.patterns)
    }))
    .filter((entry): entry is { name: string; startOffset: number } => entry.startOffset !== null)
    .sort((a, b) => a.startOffset - b.startOffset);

  if (located.length === 0) {
    return [];
  }

  const sections: SectionSpan[] = [];
  for (let index = 0; index < located.length; index += 1) {
    const current = located[index]!;
    const next = located[index + 1];
    const startOffset = Math.max(0, current.startOffset);
    const rawEnd = next ? next.startOffset : text.length;
    const endOffset = Math.max(startOffset + 1, Math.min(text.length, rawEnd));

    sections.push({
      name: current.name,
      startOffset,
      endOffset
    });
  }

  return sections;
}

export interface ExtractedTable {
  title: string;
  headers: string[];
  rows: string[][];
  pages: number[];
  confidence: number;
}

export function extractTables(text: string): ExtractedTable[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const tableCandidates = lines.filter((line) => line.includes("|") || line.includes("\t"));
  if (tableCandidates.length < 2) {
    return [];
  }

  const split = (line: string): string[] =>
    line
      .split(line.includes("|") ? "|" : "\t")
      .map((part) => part.trim())
      .filter(Boolean);

  const headers = split(tableCandidates[0]);
  const rows = tableCandidates.slice(1, 12).map(split).filter((row) => row.length > 0);

  if (headers.length === 0 || rows.length === 0) {
    return [];
  }

  return [
    {
      title: "Detected Table",
      headers,
      rows,
      pages: [1],
      confidence: 0.65
    }
  ];
}

export interface EvidenceEntry {
  page: number;
  charStart: number;
  charEnd: number;
  excerpt: string;
  sourceType: "pdf_text" | "ocr" | "docx" | "txt" | "table_cell" | "unstructured";
}

export function buildEvidenceMap(
  text: string,
  sections: SectionSpan[],
  sourceType: EvidenceEntry["sourceType"]
): EvidenceEntry[] {
  if (sections.length === 0) {
    const excerpt = text.slice(0, Math.min(120, text.length));
    return [
      {
        page: 1,
        charStart: 0,
        charEnd: excerpt.length,
        excerpt,
        sourceType
      }
    ];
  }

  return sections.map((section) => ({
    page: 1,
    charStart: section.startOffset,
    charEnd: section.endOffset,
    excerpt: text.slice(section.startOffset, section.endOffset),
    sourceType
  }));
}
