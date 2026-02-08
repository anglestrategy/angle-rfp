//
//  TXTParsingService.swift
//  angle-rfp
//
//  Service for parsing plain text (.txt) documents
//

import Foundation

class TXTParsingService: DocumentParsingService {

    // MARK: - Parse Document

    func parseDocument(at url: URL, progressHandler: ((Double) -> Void)? = nil) async throws -> ParseResult {
        progressHandler?(0.1)

        // Read text file with UTF-8 encoding
        let text: String
        do {
            text = try String(contentsOf: url, encoding: .utf8)
        } catch {
            // Try other encodings if UTF-8 fails
            do {
                text = try String(contentsOf: url, encoding: .ascii)
            } catch {
                throw ParsingError.invalidDocument(reason: "Could not read text file. File may be corrupted or use an unsupported encoding.")
            }
        }

        progressHandler?(0.5)

        var warnings: [AnalysisWarning] = []

        // Validate content
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)

        if trimmedText.isEmpty {
            throw ParsingError.noTextFound
        }

        // Warn if content is very short
        if trimmedText.count < 200 {
            warnings.append(AnalysisWarning(
                level: .warning,
                message: "Text file contains very little content (\(trimmedText.count) characters). This may not be a complete RFP document.",
                isActionable: true,
                suggestedAction: "Verify this is the complete RFP document"
            ))
        }

        progressHandler?(1.0)

        return ParseResult(
            text: text,
            warnings: warnings,
            pageCount: nil, // TXT files don't have pages
            ocrUsed: false
        )
    }
}
