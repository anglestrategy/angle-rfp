//
//  ExtractedRFPData.swift
//  angle-rfp
//
//  Core data model for extracted RFP information
//  Contains all 10 required result fields from iloverfp.md
//

import Foundation

// MARK: - Main Extracted Data Model

public struct ExtractedRFPData: Identifiable, Codable {
    public let id: UUID
    let extractionDate: Date

    // MARK: - Required Result Content Fields (10 fields from iloverfp.md)

    /// 1. Who is the client?
    var clientName: String?

    /// 2. What is the project name?
    var projectName: String?

    /// 3. Very short description of the project
    var projectDescription: String?

    /// 4. What is the scope of work? (Preserve exact client terminology)
    var scopeOfWork: String?

    /// 5. What parts of the scope align with agency services?
    var scopeAnalysis: ScopeAnalysis?

    /// 6. What is the financial potential of the project?
    var financialPotential: FinancialPotential?

    /// 7. Evaluation Criteria (exact text from RFP)
    var evaluationCriteria: String?

    /// 8. What deliverables need to be submitted for this RFP?
    var requiredDeliverables: [String]?

    /// 9. Important Dates (deadlines, Q&A windows, submission dates)
    var importantDates: [ImportantDate]?

    /// 10. Submission Method/Requirements (how and where to submit)
    var submissionMethodRequirements: String?

    // MARK: - Metadata

    /// Warnings from document parsing (e.g., "3 pages could not be parsed")
    var parsingWarnings: [AnalysisWarning]

    /// Extraction completeness score (0.0-1.0)
    var completeness: Double

    /// Confidence scores for each field (0.0-1.0)
    var confidenceScores: [String: Double]

    public init(id: UUID = UUID(),
         extractionDate: Date = Date(),
         clientName: String? = nil,
         projectName: String? = nil,
         projectDescription: String? = nil,
         scopeOfWork: String? = nil,
         scopeAnalysis: ScopeAnalysis? = nil,
         financialPotential: FinancialPotential? = nil,
         evaluationCriteria: String? = nil,
         requiredDeliverables: [String]? = nil,
         importantDates: [ImportantDate]? = nil,
         submissionMethodRequirements: String? = nil,
         parsingWarnings: [AnalysisWarning] = [],
         completeness: Double = 0.0,
         confidenceScores: [String: Double] = [:]) {
        self.id = id
        self.extractionDate = extractionDate
        self.clientName = clientName
        self.projectName = projectName
        self.projectDescription = projectDescription
        self.scopeOfWork = scopeOfWork
        self.scopeAnalysis = scopeAnalysis
        self.financialPotential = financialPotential
        self.evaluationCriteria = evaluationCriteria
        self.requiredDeliverables = requiredDeliverables
        self.importantDates = importantDates
        self.submissionMethodRequirements = submissionMethodRequirements
        self.parsingWarnings = parsingWarnings
        self.completeness = completeness
        self.confidenceScores = confidenceScores
    }

    /// Calculate completeness based on filled fields (checks for non-empty content)
    mutating func calculateCompleteness() {
        var filledCount = 0

        // Check each field carefully (non-nil AND non-empty)
        if clientName?.isEmpty == false { filledCount += 1 }
        if projectName?.isEmpty == false { filledCount += 1 }
        if projectDescription?.isEmpty == false { filledCount += 1 }
        if scopeOfWork?.isEmpty == false { filledCount += 1 }
        if scopeAnalysis != nil { filledCount += 1 }
        if financialPotential != nil { filledCount += 1 }
        if evaluationCriteria?.isEmpty == false { filledCount += 1 }
        if requiredDeliverables?.isEmpty == false { filledCount += 1 }
        if importantDates?.isEmpty == false { filledCount += 1 }
        if submissionMethodRequirements?.isEmpty == false { filledCount += 1 }

        self.completeness = Double(filledCount) / 10.0
    }
}

// MARK: - Scope Analysis

public struct ScopeAnalysis: Codable {
    /// Services matched from agency services list
    var agencyServices: [String]

    /// Services requiring outsourcing/third-party
    var nonAgencyServices: [String]

    /// Percentage of agency services (0.0-1.0)
    var agencyServicePercentage: Double

    /// Output quantities identified
    var outputQuantities: OutputQuantities?

    /// Types of outputs identified
    var outputTypes: [OutputType]

    var agencyServicePercentageDisplay: String {
        String(format: "%.0f%%", agencyServicePercentage * 100)
    }

    var outsourcingPercentageDisplay: String {
        String(format: "%.0f%%", (1.0 - agencyServicePercentage) * 100)
    }
}

public struct OutputQuantities: Codable {
    var videoProduction: Int?
    var motionGraphics: Int?
    var visualDesign: Int?
    var contentOnly: Int?

    var totalCount: Int {
        (videoProduction ?? 0) + (motionGraphics ?? 0) + (visualDesign ?? 0) + (contentOnly ?? 0)
    }
}

public enum OutputType: String, Codable, CaseIterable {
    case video = "Video Production"
    case motionGraphics = "Motion Graphics"
    case visuals = "Visual Design"
    case content = "Content Only"

    /// Value score for financial calculation (higher = more valuable)
    var valueScore: Double {
        switch self {
        case .video: return 1.0
        case .motionGraphics: return 0.75
        case .visuals: return 0.5
        case .content: return 0.25
        }
    }
}

// MARK: - Financial Potential

public struct FinancialPotential: Codable {
    /// Overall score (0-100)
    var totalScore: Double

    /// Recommendation text
    var recommendation: String

    /// Breakdown of scoring factors
    var factors: [ScoringFactor]

    /// Documented formula explanation
    var formulaExplanation: String

    var scoreColor: String {
        switch totalScore {
        case 0..<40: return "red"
        case 40..<66: return "yellow"
        case 66..<86: return "orange"
        default: return "green"
        }
    }

    var recommendationLevel: String {
        switch totalScore {
        case 0..<40: return "Low Financial Potential - High Risk"
        case 40..<66: return "Moderate Financial Potential - Proceed with Caution"
        case 66..<86: return "Good Financial Potential - Recommended"
        default: return "Excellent Financial Potential - High Priority"
        }
    }
}

public struct ScoringFactor: Identifiable, Codable {
    public let id: UUID
    let name: String
    let weight: Double // 0.0-1.0 (e.g., 0.20 for 20%)
    let score: Double // Actual score achieved
    let maxScore: Double // Maximum possible score
    let reasoning: String

    public init(id: UUID = UUID(),
         name: String,
         weight: Double,
         score: Double,
         maxScore: Double,
         reasoning: String) {
        self.id = id
        self.name = name
        self.weight = weight
        self.score = score
        self.maxScore = maxScore
        self.reasoning = reasoning
    }

    var percentage: Double {
        score / maxScore
    }

    var weightedScore: Double {
        weight * percentage * 100
    }
}

// MARK: - Important Date

public struct ImportantDate: Identifiable, Codable {
    public let id: UUID
    let title: String
    let date: Date
    let dateType: DateType
    let isCritical: Bool
    let description: String?

    public init(id: UUID = UUID(),
         title: String,
         date: Date,
         dateType: DateType,
         isCritical: Bool = false,
         description: String? = nil) {
        self.id = id
        self.title = title
        self.date = date
        self.dateType = dateType
        self.isCritical = isCritical
        self.description = description
    }
}

public enum DateType: String, Codable {
    case questionsDeadline = "Questions Deadline"
    case proposalDeadline = "Proposal Deadline"
    case presentationDate = "Presentation Date"
    case projectStartDate = "Project Start Date"
    case other = "Other"
}

// MARK: - Analysis Warning

public struct AnalysisWarning: Identifiable, Codable {
    public let id: UUID
    let level: WarningLevel
    let message: String
    let affectedFields: [String]?
    let isActionable: Bool
    let suggestedAction: String?

    public init(id: UUID = UUID(),
         level: WarningLevel,
         message: String,
         affectedFields: [String]? = nil,
         isActionable: Bool = false,
         suggestedAction: String? = nil) {
        self.id = id
        self.level = level
        self.message = message
        self.affectedFields = affectedFields
        self.isActionable = isActionable
        self.suggestedAction = suggestedAction
    }
}

public enum WarningLevel: String, Codable {
    case info = "Info"
    case warning = "Warning"
    case critical = "Critical"

    var icon: String {
        switch self {
        case .info: return "ℹ️"
        case .warning: return "⚠️"
        case .critical: return "❌"
        }
    }
}
