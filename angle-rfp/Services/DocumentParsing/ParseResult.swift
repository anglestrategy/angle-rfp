//
//  ParseResult.swift
//  angle-rfp
//
//  Result model for document parsing operations
//

import Foundation

struct ParseResult {
    let text: String
    let warnings: [AnalysisWarning]
    let pageCount: Int?
    let ocrUsed: Bool

    init(text: String,
         warnings: [AnalysisWarning] = [],
         pageCount: Int? = nil,
         ocrUsed: Bool = false) {
        self.text = text
        self.warnings = warnings
        self.pageCount = pageCount
        self.ocrUsed = ocrUsed
    }

    var hasWarnings: Bool {
        !warnings.isEmpty
    }

    var criticalWarnings: [AnalysisWarning] {
        warnings.filter { $0.level == .critical }
    }
}
