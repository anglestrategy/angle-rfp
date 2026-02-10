# Benchmark Corpus Specification (Pilot)

## Purpose
Provide a repeatable bilingual corpus for validating extraction quality, latency, and score reproducibility before go-live.

## Minimum Corpus Composition
- 40 documents total.
- 10 English text PDFs.
- 10 Arabic text PDFs.
- 10 mixed bilingual PDFs.
- 5 scanned Arabic PDFs (OCR required).
- 3 DOCX.
- 2 TXT.

## Mandatory Edge Cases
- Missing budget details.
- Missing or conflicting dates.
- Conflicting evaluation weight totals.
- Critical information only inside tables.
- Scope with mixed `full`, `partial`, and `none` match classes.

## Annotation Requirements
- Gold labels for the 10 required extraction fields.
- Verbatim source spans for `scopeOfWork` and `evaluationCriteria`.
- Known expected recommendation band for each document.

## Naming Convention
- `rfp-<lang>-<format>-<id>.ext`
- Examples:
  - `rfp-ar-pdf-014.pdf`
  - `rfp-mixed-pdf-023.pdf`

## Storage Rules
- Corpus stays local/private.
- Do not commit sensitive customer documents.
- Use sanitized or synthetic replacements for production-like tests.

