//
//  PDFParsingService.swift
//  angle-rfp
//
//  Service for parsing PDF documents with automatic OCR fallback for scanned PDFs
//

import Foundation
import PDFKit

class PDFParsingService: DocumentParsingService {
    private let ocrService = OCRService()

    // MARK: - Parse Document

    func parseDocument(at url: URL, progressHandler: ((Double) -> Void)? = nil) async throws -> ParseResult {
        // Load PDF document
        guard let pdfDocument = PDFDocument(url: url) else {
            throw ParsingError.invalidDocument(reason: "Could not load PDF file")
        }

        let pageCount = pdfDocument.pageCount
        var warnings: [AnalysisWarning] = []

        // Check if PDF is encrypted/protected
        if pdfDocument.isEncrypted {
            throw ParsingError.documentEncrypted
        }

        // Try extracting text normally first
        progressHandler?(0.1)
        var extractedText = extractTextFromPDF(pdfDocument)

        // Detect if this is a scanned PDF (has very little text)
        let isScanned = OCRService.isScannedPDF(pdfDocument)
        var ocrUsed = false

        if isScanned || extractedText.trimmingCharacters(in: .whitespacesAndNewlines).count < 500 {
            // Use OCR for scanned or low-text PDFs
            warnings.append(AnalysisWarning(
                level: .info,
                message: "Document appears to be scanned. Using OCR to extract text...",
                isActionable: false
            ))

            do {
                progressHandler?(0.2)
                let ocrResult = try await ocrService.performOCR(on: pdfDocument) { ocrProgress in
                    // Map OCR progress to 0.2-0.9 range
                    progressHandler?(0.2 + (ocrProgress * 0.7))
                }

                extractedText = ocrResult.text
                ocrUsed = true

                // Add OCR-specific warnings
                warnings.append(contentsOf: ocrResult.warnings)

                if ocrResult.hasLowConfidence {
                    warnings.append(AnalysisWarning(
                        level: .warning,
                        message: "OCR confidence is low (\(ocrResult.confidencePercentage)%). Some text may be inaccurate.",
                        affectedFields: ["scopeOfWork", "evaluationCriteria"],
                        isActionable: true,
                        suggestedAction: "Please review extracted text carefully for accuracy"
                    ))
                }

            } catch {
                warnings.append(AnalysisWarning(
                    level: .critical,
                    message: "OCR processing failed: \(error.localizedDescription)",
                    isActionable: true,
                    suggestedAction: "Try converting PDF to text manually or uploading a different format"
                ))
                throw ParsingError.ocrFailed(underlying: error)
            }
        }

        progressHandler?(1.0)

        // Validate extracted text
        if extractedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            throw ParsingError.noTextFound
        }

        // Check for potentially corrupted pages
        if extractedText.count < 200 {
            warnings.append(AnalysisWarning(
                level: .warning,
                message: "Document contains very little text (\(extractedText.count) characters). File may be corrupted or incomplete.",
                isActionable: true,
                suggestedAction: "Verify this is the complete RFP document"
            ))
        }

        return ParseResult(
            text: extractedText,
            warnings: warnings,
            pageCount: pageCount,
            ocrUsed: ocrUsed
        )
    }

    // MARK: - Private Helpers

    /// Extract text from PDF using standard PDFKit methods
    private func extractTextFromPDF(_ document: PDFDocument) -> String {
        var allText = ""

        for i in 0..<document.pageCount {
            guard let page = document.page(at: i),
                  let pageText = page.string else {
                continue
            }

            allText += pageText
            allText += "\n\n" // Separate pages with double newline
        }

        // Clean PDF artifacts and metadata
        return cleanPDFText(allText)
    }

    /// Remove common PDF artifacts, metadata, and field codes
    private func cleanPDFText(_ text: String) -> String {
        var cleaned = text

        // Remove common PDF error messages and field codes
        let artifactPatterns = [
            "Error: bookmark not defined",
            "Error: Reference source not found",
            "Error!",
            "{ HYPERLINK",
            "{ REF",
            "{ PAGEREF",
            "{ TOC",
            "{ PAGE",
            "{ NUMPAGES",
            "{ DATE",
            "{ TIME",
            "\\* MERGEFORMAT"
        ]

        for pattern in artifactPatterns {
            cleaned = cleaned.replacingOccurrences(of: pattern, with: "", options: .caseInsensitive)
        }

        // Remove field code braces that might remain
        cleaned = cleaned.replacingOccurrences(of: "{ ", with: "")
        cleaned = cleaned.replacingOccurrences(of: " }", with: "")

        // Clean up excessive whitespace
        // Replace multiple spaces with single space
        cleaned = cleaned.replacingOccurrences(of: #" +"#, with: " ", options: .regularExpression)

        // Replace more than 2 consecutive newlines with just 2
        cleaned = cleaned.replacingOccurrences(of: #"\n{3,}"#, with: "\n\n", options: .regularExpression)

        // Remove leading/trailing whitespace from each line
        let lines = cleaned.components(separatedBy: .newlines)
        let trimmedLines = lines.map { $0.trimmingCharacters(in: .whitespaces) }
        cleaned = trimmedLines.joined(separator: "\n")

        return cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// MARK: - DocumentParsingService Protocol

protocol DocumentParsingService {
    func parseDocument(at url: URL, progressHandler: ((Double) -> Void)?) async throws -> ParseResult
}

// MARK: - Parsing Errors

enum ParsingError: LocalizedError {
    case invalidDocument(reason: String)
    case documentEncrypted
    case noTextFound
    case ocrFailed(underlying: Error)
    case unsupportedFormat(String)

    var errorDescription: String? {
        switch self {
        case .invalidDocument(let reason):
            return "Invalid document: \(reason)"
        case .documentEncrypted:
            return "Document is encrypted or password-protected. Please provide an unprotected version."
        case .noTextFound:
            return "No text could be extracted from the document. It may be corrupted or empty."
        case .ocrFailed(let error):
            return "OCR processing failed: \(error.localizedDescription)"
        case .unsupportedFormat(let format):
            return "Unsupported file format: \(format)"
        }
    }

    var failureReason: String? {
        switch self {
        case .invalidDocument:
            return "The PDF file could not be loaded or is corrupted"
        case .documentEncrypted:
            return "Document security settings prevent text extraction"
        case .noTextFound:
            return "No readable text content was found"
        case .ocrFailed:
            return "Optical character recognition failed"
        case .unsupportedFormat:
            return "File format is not supported"
        }
    }

    var recoverySuggestion: String? {
        switch self {
        case .invalidDocument:
            return "Try re-downloading or re-scanning the PDF file"
        case .documentEncrypted:
            return "Remove password protection or use an unprotected version"
        case .noTextFound:
            return "Verify the PDF contains text content and is not blank"
        case .ocrFailed:
            return "Try converting the PDF to text manually or use a different file format"
        case .unsupportedFormat:
            return "Convert the file to PDF, DOCX, or TXT format"
        }
    }
}
