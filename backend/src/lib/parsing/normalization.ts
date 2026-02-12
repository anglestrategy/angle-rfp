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

const sectionPatterns: Array<{ name: string; patterns: RegExp[] }> = [
  {
    name: "scope_of_work",
    patterns: [/\bscope\b/i, /\bdeliverables\b/i, /نطاق\s+العمل/]
  },
  {
    name: "evaluation_criteria",
    patterns: [/evaluation\s+criteria/i, /scoring/i, /معايير\s+التقييم/]
  },
  {
    name: "important_dates",
    patterns: [/timeline/i, /deadline/i, /dates?/i, /الجدول\s+الزمني/, /المواعيد/]
  },
  {
    name: "submission_requirements",
    patterns: [/submission/i, /format/i, /how to submit/i, /متطلبات\s+التقديم/]
  }
];

export function detectSections(text: string): SectionSpan[] {
  const sections: SectionSpan[] = [];
  const normalized = text;

  for (const entry of sectionPatterns) {
    let bestIndex = -1;
    for (const pattern of entry.patterns) {
      const match = normalized.match(pattern);
      if (match?.index !== undefined) {
        if (bestIndex === -1 || match.index < bestIndex) {
          bestIndex = match.index;
        }
      }
    }

    if (bestIndex >= 0) {
      sections.push({
        name: entry.name,
        startOffset: bestIndex,
        endOffset: Math.min(bestIndex + 400, normalized.length)
      });
    }
  }

  return sections.sort((a, b) => a.startOffset - b.startOffset);
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
