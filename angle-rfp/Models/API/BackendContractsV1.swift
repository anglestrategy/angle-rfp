//
//  BackendContractsV1.swift
//  angle-rfp
//
//  Codable contracts for backend V1 APIs.
//

import Foundation

struct ParsedSectionV1: Codable {
    let name: String
    let startOffset: Int
    let endOffset: Int
}

struct ParsedTableV1: Codable {
    let title: String
    let headers: [String]
    let rows: [[String]]
    let pages: [Int]
    let confidence: Double
}

struct EvidenceMapItemV1: Codable {
    let page: Int
    let charStart: Int
    let charEnd: Int
    let excerpt: String
    let sourceType: String
}

struct OcrStatsV1: Codable {
    let used: Bool
    let pagesOcred: Int
}

struct ParsedDocumentV1: Codable {
    let schemaVersion: String
    let analysisId: String
    let detectedFormat: String
    let primaryLanguage: String
    let rawText: String
    let sections: [ParsedSectionV1]
    let tables: [ParsedTableV1]
    let evidenceMap: [EvidenceMapItemV1]
    let parseConfidence: Double
    let ocrStats: OcrStatsV1?
    let warnings: [String]
}

struct ImportantDateV1: Codable {
    let title: String
    let date: String
    let type: String
    let isCritical: Bool
}

struct SubmissionRequirementsV1: Codable {
    let method: String
    let email: String?
    let physicalAddress: String?
    let format: String
    let copies: Int?
    let otherRequirements: [String]
}

struct RedFlagV1: Codable {
    let type: String
    let severity: String
    let title: String
    let description: String
    let sourceText: String
    let recommendation: String
}

struct MissingInformationV1: Codable {
    let field: String
    let suggestedQuestion: String
}

struct ExtractedEvidenceV1: Codable {
    let field: String
    let page: Int
    let excerpt: String
}

// MARK: - Beautified Text (AI-powered formatting from backend)

struct TextSectionV1: Codable {
    let type: String
    let content: String
    let items: [String]?
}

struct BeautifiedTextV1: Codable {
    let formatted: String
    let sections: [TextSectionV1]
}

struct BeautifiedFieldsV1: Codable {
    let projectDescription: BeautifiedTextV1?
    let scopeOfWork: BeautifiedTextV1?
    let evaluationCriteria: BeautifiedTextV1?
}

/// Deliverable item with source tagging - supports both legacy (String) and new (object) formats
struct DeliverableV1: Codable {
    let item: String
    let source: String // "verbatim" or "inferred"

    init(from decoder: Decoder) throws {
        // Try to decode as object first
        if let container = try? decoder.container(keyedBy: CodingKeys.self) {
            item = try container.decode(String.self, forKey: .item)
            source = try container.decodeIfPresent(String.self, forKey: .source) ?? "verbatim"
        } else {
            // Fall back to decoding as String (legacy format)
            let container = try decoder.singleValueContainer()
            item = try container.decode(String.self)
            source = "verbatim"
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(item, forKey: .item)
        try container.encode(source, forKey: .source)
    }

    private enum CodingKeys: String, CodingKey {
        case item, source
    }
}

struct DeliverableRequirementItemV1: Codable {
    let title: String
    let description: String
    let source: String
}

struct DeliverableRequirementsV1: Codable {
    let technical: [DeliverableRequirementItemV1]
    let commercial: [DeliverableRequirementItemV1]
    let strategicCreative: [DeliverableRequirementItemV1]
}

struct ExtractedRFPDataV1Payload: Codable {
    let schemaVersion: String
    let analysisId: String
    let extractionDate: String
    let clientName: String
    let clientNameArabic: String?
    let projectName: String
    let projectNameOriginal: String?
    let projectDescription: String
    let scopeOfWork: String
    let evaluationCriteria: String
    let requiredDeliverables: [DeliverableV1]
    let deliverableRequirements: DeliverableRequirementsV1?
    let importantDates: [ImportantDateV1]
    let submissionRequirements: SubmissionRequirementsV1
    let redFlags: [RedFlagV1]
    let missingInformation: [MissingInformationV1]
    let confidenceScores: [String: Double]
    let completenessScore: Double
    let warnings: [String]
    let evidence: [ExtractedEvidenceV1]
    let beautifiedText: BeautifiedFieldsV1?
}

struct ScopeMatchV1: Codable {
    let scopeItem: String
    let service: String
    let `class`: String
    let confidence: Double
}

struct OutputQuantitiesV1: Codable {
    let videoProduction: Int?
    let motionGraphics: Int?
    let visualDesign: Int?
    let contentOnly: Int?
}

struct ScopeAnalysisV1Payload: Codable {
    let schemaVersion: String
    let analysisId: String
    let scopeItems: [String]
    let matches: [ScopeMatchV1]
    let agencyServicePercentage: Double
    let outsourcingPercentage: Double
    let outputQuantities: OutputQuantitiesV1
    let outputTypes: [String]
    let warnings: [String]
}

struct CompanyProfileV1: Codable {
    let entityType: String
    let industry: String
    let confidence: Double
    let sources: [String]
}

struct FinancialIndicatorsV1: Codable {
    let marketingBudgetIndicator: String
    let confidence: Double
}

struct DigitalPresenceV1: Codable {
    let bilingual: Bool
    let confidence: Double
}

struct AdvertisingActivityV1: Codable {
    let confidence: Double
    let estimatedMonthlySpend: String?
}

struct ResearchMetadataV1: Codable {
    let sourcesUsed: Int
    let englishSources: Int
    let arabicSources: Int
    let overallConfidence: Double
    let researchDate: String
}

struct ResearchEvidenceV1: Codable {
    let claim: String
    let source: String
    let tier: Int
}

struct ClientResearchV1Payload: Codable {
    let schemaVersion: String
    let analysisId: String
    let companyName: String
    let companyNameArabic: String?
    let companyProfile: CompanyProfileV1
    let financialIndicators: FinancialIndicatorsV1
    let digitalPresence: DigitalPresenceV1
    let advertisingActivity: AdvertisingActivityV1
    let positiveSignals: [String]
    let redFlags: [String]?
    let researchMetadata: ResearchMetadataV1
    let confidence: Double
    let evidence: [ResearchEvidenceV1]
    let warnings: [String]?
}

struct FactorBreakdownV1: Codable {
    let factor: String
    let weight: Double
    let score: Double
    let contribution: Double
    let evidence: [String]
    let identified: Bool?  // false when data unavailable, factor excluded from weighted average
}

struct FinancialScoreV1Payload: Codable {
    let schemaVersion: String
    let analysisId: String
    let baseScore: Double
    let redFlagPenalty: Double
    let completenessPenalty: Double
    let finalScore: Double
    let recommendationBand: String
    let factorBreakdown: [FactorBreakdownV1]
    let rationale: String
}

struct AnalysisSummaryV1: Codable {
    let headline: String
    let recommendation: String
    let score: Double
}

struct AnalysisReportV1Payload: Codable {
    let schemaVersion: String
    let analysisId: String
    let summary: AnalysisSummaryV1
    let extractedRfp: ExtractedRFPDataV1Payload
    let scopeAnalysis: ScopeAnalysisV1Payload
    let clientResearch: ClientResearchV1Payload
    let financialScore: FinancialScoreV1Payload
    let warnings: [String]
    let generatedAt: String
}

struct AnalyzeRfpRequestV1: Codable {
    let analysisId: String
    let parsedDocument: ParsedDocumentV1
}

struct AnalyzeScopeRequestV1: Codable {
    let analysisId: String
    let scopeOfWork: String
    let language: String
}

struct RFPContextV1: Codable {
    let projectName: String?
    let projectDescription: String?
    let scopeOfWork: String?
    let industry: String?
}

struct ResearchClientRequestV1: Codable {
    let analysisId: String
    let clientName: String
    let clientNameArabic: String?
    let country: String
    let rfpContext: RFPContextV1?
}

struct CalculateScoreRequestV1: Codable {
    let analysisId: String
    let extractedRfp: ExtractedRFPDataV1Payload
    let scopeAnalysis: ScopeAnalysisV1Payload
    let clientResearch: ClientResearchV1Payload
}

struct ExportRequestV1: Codable {
    let analysisId: String
    let report: AnalysisReportV1Payload
    let format: String
}
