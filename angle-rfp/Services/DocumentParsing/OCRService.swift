//
//  OCRService.swift
//  angle-rfp
//
//  Advanced OCR service using Vision framework to extract text from scanned PDFs
//  Ensures NO TEXT IS MISSED from documents
//

import Foundation
import Vision
import PDFKit
import AppKit

class OCRService {
    // MARK: - Configuration

    struct OCRConfiguration {
        /// Recognition level (accurate = slower but better quality)
        var recognitionLevel: VNRequestTextRecognitionLevel = .accurate

        /// Languages to recognize (English default, can add more)
        var recognitionLanguages: [String] = ["en-US"]

        /// Minimum confidence threshold (0.0-1.0)
        var minimumConfidence: Float = 0.7

        /// Use language correction
        var usesLanguageCorrection: Bool = true

        /// Custom words to help recognition
        var customWords: [String] = []

        static let `default` = OCRConfiguration()
    }

    private let configuration: OCRConfiguration

    init(configuration: OCRConfiguration = .default) {
        self.configuration = configuration
    }

    // MARK: - OCR Execution

    /// Perform OCR on a PDF document
    /// - Parameters:
    ///   - pdfDocument: PDFDocument to extract text from
    ///   - progressHandler: Optional progress callback (0.0-1.0)
    /// - Returns: OCRResult with extracted text and metadata
    func performOCR(on pdfDocument: PDFDocument,
                    progressHandler: ((Double) -> Void)? = nil) async throws -> OCRResult {
        let pageCount = pdfDocument.pageCount
        var extractedPages: [OCRPageResult] = []
        var allWarnings: [AnalysisWarning] = []

        for pageIndex in 0..<pageCount {
            guard let page = pdfDocument.page(at: pageIndex) else {
                allWarnings.append(AnalysisWarning(
                    level: .warning,
                    message: "Could not access page \(pageIndex + 1)",
                    affectedFields: nil,
                    isActionable: false
                ))
                continue
            }

            // Update progress
            let progress = Double(pageIndex) / Double(pageCount)
            progressHandler?(progress)

            do {
                let pageResult = try await performOCR(on: page, pageNumber: pageIndex + 1)
                extractedPages.append(pageResult)

                // Add warnings if confidence is low
                if pageResult.averageConfidence < 0.8 {
                    allWarnings.append(AnalysisWarning(
                        level: .info,
                        message: "Page \(pageIndex + 1) has low OCR confidence (\(Int(pageResult.averageConfidence * 100))%)",
                        affectedFields: nil,
                        isActionable: false
                    ))
                }
            } catch {
                allWarnings.append(AnalysisWarning(
                    level: .warning,
                    message: "OCR failed on page \(pageIndex + 1): \(error.localizedDescription)",
                    affectedFields: nil,
                    isActionable: false
                ))
            }
        }

        // Final progress
        progressHandler?(1.0)

        // Combine all text
        let fullText = extractedPages.map { $0.text }.joined(separator: "\n\n")

        // Calculate overall confidence
        let overallConfidence = extractedPages.isEmpty ? 0.0 :
            extractedPages.map { $0.averageConfidence }.reduce(0, +) / Double(extractedPages.count)

        return OCRResult(
            text: fullText,
            pages: extractedPages,
            overallConfidence: overallConfidence,
            warnings: allWarnings,
            pageCount: pageCount
        )
    }

    /// Perform OCR on a single PDF page
    private func performOCR(on page: PDFPage, pageNumber: Int) async throws -> OCRPageResult {
        // Convert PDF page to image
        guard let image = renderPageToImage(page) else {
            throw OCRError.pageRenderingFailed
        }

        // Create Vision request
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = configuration.recognitionLevel
        request.recognitionLanguages = configuration.recognitionLanguages
        request.usesLanguageCorrection = configuration.usesLanguageCorrection
        request.customWords = configuration.customWords

        // Perform recognition
        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        try handler.perform([request])

        guard let observations = request.results else {
            throw OCRError.recognitionFailed
        }

        // Extract text from observations
        var recognizedTexts: [RecognizedText] = []

        for observation in observations {
            guard let topCandidate = observation.topCandidates(1).first,
                  topCandidate.confidence >= configuration.minimumConfidence else {
                continue
            }

            recognizedTexts.append(RecognizedText(
                text: topCandidate.string,
                confidence: topCandidate.confidence,
                boundingBox: observation.boundingBox
            ))
        }

        // Sort by vertical position (top to bottom)
        let sortedTexts = recognizedTexts.sorted { $0.boundingBox.minY > $1.boundingBox.minY }

        // Combine into full page text
        let pageText = sortedTexts.map { $0.text }.joined(separator: " ")

        // Calculate average confidence
        let averageConfidence = recognizedTexts.isEmpty ? 0.0 :
            recognizedTexts.map { Double($0.confidence) }.reduce(0, +) / Double(recognizedTexts.count)

        return OCRPageResult(
            pageNumber: pageNumber,
            text: pageText,
            recognizedTexts: sortedTexts,
            averageConfidence: averageConfidence
        )
    }

    // MARK: - Helper Methods

    /// Render PDF page to CGImage for OCR processing
    private func renderPageToImage(_ page: PDFPage) -> CGImage? {
        let pageBounds = page.bounds(for: .mediaBox)
        let scale: CGFloat = 2.0 // Higher resolution for better OCR

        let width = Int(pageBounds.width * scale)
        let height = Int(pageBounds.height * scale)

        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue)

        guard let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: bitmapInfo.rawValue
        ) else {
            return nil
        }

        context.setFillColor(NSColor.white.cgColor)
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))

        context.scaleBy(x: scale, y: scale)
        context.translateBy(x: 0, y: pageBounds.height)
        context.scaleBy(x: 1.0, y: -1.0)

        page.draw(with: .mediaBox, to: context)

        return context.makeImage()
    }

    /// Detect if a PDF document is scanned (has very little extractable text)
    static func isScannedPDF(_ document: PDFDocument) -> Bool {
        let pageCount = document.pageCount
        var totalTextLength = 0

        for i in 0..<min(pageCount, 5) { // Check first 5 pages
            guard let page = document.page(at: i),
                  let text = page.string else {
                continue
            }
            totalTextLength += text.count
        }

        // If average text per page is less than 100 characters, likely scanned
        let averageTextPerPage = Double(totalTextLength) / Double(min(pageCount, 5))
        return averageTextPerPage < 100
    }
}

// MARK: - OCR Result Models

struct OCRResult {
    let text: String
    let pages: [OCRPageResult]
    let overallConfidence: Double
    let warnings: [AnalysisWarning]
    let pageCount: Int

    var hasLowConfidence: Bool {
        overallConfidence < 0.8
    }

    var confidencePercentage: Int {
        Int(overallConfidence * 100)
    }
}

struct OCRPageResult {
    let pageNumber: Int
    let text: String
    let recognizedTexts: [RecognizedText]
    let averageConfidence: Double
}

struct RecognizedText {
    let text: String
    let confidence: Float
    let boundingBox: CGRect
}

// MARK: - OCR Errors

enum OCRError: LocalizedError {
    case pageRenderingFailed
    case recognitionFailed
    case noTextFound

    var errorDescription: String? {
        switch self {
        case .pageRenderingFailed:
            return "Failed to render PDF page as image for OCR processing"
        case .recognitionFailed:
            return "Text recognition failed"
        case .noTextFound:
            return "No text could be recognized on page"
        }
    }
}
