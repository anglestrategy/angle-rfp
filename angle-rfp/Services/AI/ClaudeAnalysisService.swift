//
//  ClaudeAnalysisService.swift
//  angle-rfp
//
//  Core AI service for RFP analysis using Claude API
//  Extracts all 10 required fields from RFP documents
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import Foundation

/// Protocol for AI analysis services (enables testing/mocking)
public protocol AIAnalysisService: Sendable {
    func analyzeRFP(
        documentText: String,
        documentID: UUID,
        agencyServices: [String],
        clientResearch: ClientInformation?
    ) async throws -> ExtractedRFPData
}

/// Service for analyzing RFP documents using Claude API
///
/// Extracts all 10 required fields:
/// 1. Who is the client?
/// 2. What is the project name?
/// 3. Very short description
/// 4. Scope of work (preserving exact terminology)
/// 5. Agency service alignment
/// 6. Financial potential
/// 7. Evaluation criteria
/// 8. Required deliverables
/// 9. Important dates
/// 10. Submission method/requirements
public final class ClaudeAnalysisService: AIAnalysisService {

    // MARK: - Singleton

    public static let shared = ClaudeAnalysisService()

    // MARK: - Properties

    private let networkClient: NetworkClient
    private let keychainManager: KeychainManager
    private let promptTemplates: PromptTemplates

    // Claude API configuration
    private let apiBaseURL = "https://api.anthropic.com/v1"
    private let model = "claude-opus-4-5-20251101" // Most accurate model
    private let maxTokens = 16000 // Sufficient for detailed extraction

    // MARK: - Initialization

    /// Internal initializer for dependency injection (enables testing)
    internal init(
        networkClient: NetworkClient,
        keychainManager: KeychainManager,
        promptTemplates: PromptTemplates
    ) {
        self.networkClient = networkClient
        self.keychainManager = keychainManager
        self.promptTemplates = promptTemplates

        AppLogger.shared.info("ClaudeAnalysisService initialized with model: \(model)")
    }

    /// Convenience initializer using shared dependencies
    private convenience init() {
        self.init(
            networkClient: .shared,
            keychainManager: .shared,
            promptTemplates: .shared
        )
    }


    // MARK: - Public API

    /// Analyze RFP document and extract all required fields
    /// - Parameters:
    ///   - documentText: Full text extracted from RFP document
    ///   - documentID: Document identifier
    ///   - agencyServices: List of agency services for matching
    ///   - clientResearch: Optional client research data for financial analysis
    /// - Returns: Extracted RFP data with all 10 fields
    /// - Throws: AnalysisError if extraction fails
    public func analyzeRFP(
        documentText: String,
        documentID: UUID,
        agencyServices: [String],
        clientResearch: ClientInformation? = nil
    ) async throws -> ExtractedRFPData {

        let tracker = PerformanceTracker(operation: "claude_rfp_analysis")
        tracker.recordMetric("documentLength", value: documentText.count)

        do {
            // Step 1: Extract core fields (1-10)
            AppLogger.shared.info("Starting RFP extraction for document: \(documentID)")

            let extractionResult = try await extractCoreFields(
                documentText: documentText,
                agencyServices: agencyServices
            )

            // Step 2: Perform financial analysis if client research available
            var financialPotential: FinancialPotential?
            if let clientInfo = clientResearch {
                financialPotential = try await calculateFinancialPotential(
                    clientInfo: clientInfo,
                    scopeAnalysis: extractionResult.scopeAnalysis ?? ScopeAnalysis(
                        agencyServices: [],
                        nonAgencyServices: [],
                        agencyServicePercentage: 0,
                        outputTypes: []
                    ),
                    outputQuantities: extractionResult.scopeAnalysis?.outputQuantities
                )
            }

            // Step 3: Assemble final result
            var finalResult = extractionResult
            if let financial = financialPotential {
                finalResult.financialPotential = financial
            }

            // Calculate completeness
            finalResult.calculateCompleteness()

            tracker.recordMetric("completeness", value: finalResult.completeness)
            tracker.recordMetric("fieldCount", value: countFilledFields(finalResult))
            tracker.complete(success: true)

            AppLogger.shared.info("RFP extraction completed successfully", metadata: [
                "documentID": documentID.uuidString,
                "completeness": String(finalResult.completeness)
            ])

            return finalResult

        } catch {
            tracker.complete(success: false)

            AppLogger.shared.error("RFP extraction failed", error: error, metadata: [
                "documentID": documentID.uuidString
            ])

            throw AnalysisError.extractionFailed(underlying: error)
        }
    }

    // MARK: - Private Methods - Core Extraction

    private func extractCoreFields(
        documentText: String,
        agencyServices: [String]
    ) async throws -> ExtractedRFPData {

        // Build extraction prompt
        let systemPrompt = promptTemplates.systemPrompt
        let extractionPrompt = promptTemplates.extractionPrompt(
            documentText: documentText,
            agencyServices: agencyServices
        )

        // Call Claude API
        let response = try await callClaudeAPI(
            systemPrompt: systemPrompt,
            userPrompt: extractionPrompt
        )

        // Parse JSON response
        let extractedData = try parseExtractionResponse(response)

        return extractedData
    }

    // MARK: - Financial Analysis

    /// Scoring factor configuration for data-driven calculation
    private struct ScoringConfig {
        let name: String
        let weight: Double
        let maxScore: Double
    }

    /// All scoring configurations (weights must sum to 1.0)
    private static let scoringConfigs: [ScoringConfig] = [
        ScoringConfig(name: "Company Size & Popularity", weight: 0.15, maxScore: 15),
        ScoringConfig(name: "Project Scope Magnitude", weight: 0.20, maxScore: 20),
        ScoringConfig(name: "Social Media Activity", weight: 0.08, maxScore: 8),
        ScoringConfig(name: "Content Types", weight: 0.12, maxScore: 12),
        ScoringConfig(name: "Holding Group", weight: 0.08, maxScore: 8),
        ScoringConfig(name: "Entity Type", weight: 0.07, maxScore: 7),
        ScoringConfig(name: "Media/Ad Spend", weight: 0.10, maxScore: 10),
        ScoringConfig(name: "Agency Service Alignment", weight: 0.05, maxScore: 5),
        ScoringConfig(name: "Output Quantities", weight: 0.03, maxScore: 3),
        ScoringConfig(name: "Output Types", weight: 0.02, maxScore: 2)
    ]

    private func calculateFinancialPotential(
        clientInfo: ClientInformation,
        scopeAnalysis: ScopeAnalysis,
        outputQuantities: OutputQuantities?
    ) async throws -> FinancialPotential {

        let tracker = PerformanceTracker(operation: "financial_analysis")

        // Calculate all scores using data-driven approach
        let scores = calculateAllScores(
            clientInfo: clientInfo,
            scopeAnalysis: scopeAnalysis,
            outputQuantities: outputQuantities
        )

        // Build factors from configs and scores
        let factors = zip(Self.scoringConfigs, scores).map { config, scoreData in
            ScoringFactor(
                name: config.name,
                weight: config.weight,
                score: scoreData.score,
                maxScore: config.maxScore,
                reasoning: scoreData.reasoning
            )
        }

        // Calculate total score
        let totalScore = factors.reduce(0.0) { $0 + $1.weightedScore }

        // Generate recommendation based on score thresholds
        let recommendation = generateRecommendation(score: totalScore)

        // Generate formula explanation from factors (eliminates duplication)
        let formulaExplanation = generateFormulaExplanation(factors: factors, totalScore: totalScore)

        tracker.recordMetric("totalScore", value: totalScore)
        tracker.complete(success: true)

        return FinancialPotential(
            totalScore: totalScore,
            recommendation: recommendation,
            factors: factors,
            formulaExplanation: formulaExplanation
        )
    }

    /// Calculate all scores in order matching scoringConfigs
    private func calculateAllScores(
        clientInfo: ClientInformation,
        scopeAnalysis: ScopeAnalysis,
        outputQuantities: OutputQuantities?
    ) -> [(score: Double, reasoning: String)] {
        [
            (calculateCompanySizeScore(clientInfo),
             "Based on company size: \(clientInfo.companySize?.rawValue ?? "Unknown"), brand popularity: \(clientInfo.brandPopularity?.rawValue ?? "Unknown")"),

            (calculateScopeMagnitudeScore(scopeAnalysis),
             "Based on scope complexity and agency service match: \(String(format: "%.0f%%", scopeAnalysis.agencyServicePercentage * 100))"),

            (calculateSocialMediaScore(clientInfo),
             "Social media activity level: \(clientInfo.socialMediaPresence?.activityLevel?.rawValue ?? "Unknown")"),

            (calculateContentTypesScore(clientInfo),
             "Content types: \(clientInfo.socialMediaPresence?.contentTypes.map { $0.rawValue }.joined(separator: ", ") ?? "Unknown")"),

            (calculateHoldingGroupScore(clientInfo),
             clientInfo.holdingGroup.map { "Part of holding group: \($0)" } ?? "No holding group identified"),

            (calculateEntityTypeScore(clientInfo),
             "Entity type: \(clientInfo.entityType?.rawValue ?? "Unknown")"),

            (calculateMediaSpendScore(clientInfo),
             "Media spend level: \(clientInfo.mediaSpendIndicators ?? "Unknown")"),

            (scopeAnalysis.agencyServicePercentage * 5,
             "Agency alignment: \(String(format: "%.0f%%", scopeAnalysis.agencyServicePercentage * 100))"),

            (calculateOutputQuantityScore(outputQuantities),
             "Total outputs: \(outputQuantities?.totalCount ?? 0)"),

            (calculateOutputTypeScore(scopeAnalysis.outputTypes),
             "Primary output types: \(scopeAnalysis.outputTypes.map { $0.rawValue }.joined(separator: ", "))")
        ]
    }

    /// Generate recommendation based on score thresholds
    private func generateRecommendation(score: Double) -> String {
        switch score {
        case 0..<40:
            return "Low financial potential - high risk. Consider passing on this opportunity."
        case 40..<66:
            return "Moderate financial potential - proceed with caution. Requires careful evaluation."
        case 66..<86:
            return "Good financial potential - recommended. Strong opportunity worth pursuing."
        default:
            return "Excellent financial potential - high priority. Exceptional opportunity."
        }
    }

    /// Generate formula explanation from factors (eliminates duplication with factor list)
    private func generateFormulaExplanation(factors: [ScoringFactor], totalScore: Double) -> String {
        let factorLines = factors.map { factor in
            "• \(factor.name) (\(Int(factor.weight * 100))%): \(String(format: "%.1f", factor.score))"
        }.joined(separator: "\n")

        return """
        Financial potential calculated using \(factors.count)-factor weighted formula:
        \(factorLines)

        Total Score: \(String(format: "%.1f%%", totalScore))
        """
    }

    // MARK: - Scoring Helper Methods

    private func calculateCompanySizeScore(_ clientInfo: ClientInformation) -> Double {
        // Combined score: Company Size (10 points) + Brand Popularity (5 points) = 15 points total

        // Company Size component (0-10 points)
        let sizeScore: Double
        if let companySize = clientInfo.companySize {
            switch companySize {
            case .enterprise: sizeScore = 10.0
            case .large: sizeScore = 8.0
            case .medium: sizeScore = 5.0
            case .small: sizeScore = 3.0
            case .startup: sizeScore = 1.0
            }
        } else {
            sizeScore = 0.0
        }

        // Brand Popularity component (0-5 points)
        let popularityScore: Double
        if let brandPopularity = clientInfo.brandPopularity {
            switch brandPopularity {
            case .international: popularityScore = 5.0
            case .national: popularityScore = 4.0
            case .regional: popularityScore = 3.0
            case .local: popularityScore = 2.0
            case .unknown: popularityScore = 0.0
            }
        } else {
            popularityScore = 0.0
        }

        return sizeScore + popularityScore // Total: 0-15 points
    }

    private func calculateScopeMagnitudeScore(_ scopeAnalysis: ScopeAnalysis) -> Double {
        // Higher alignment = more complex scope we can handle
        return scopeAnalysis.agencyServicePercentage * 20.0
    }

    private func calculateSocialMediaScore(_ clientInfo: ClientInformation) -> Double {
        guard let social = clientInfo.socialMediaPresence,
              let activityLevel = social.activityLevel else { return 0.0 }

        switch activityLevel {
        case .veryHigh: return 8.0
        case .high: return 6.0
        case .moderate: return 4.0
        case .low: return 2.0
        case .inactive: return 0.0
        }
    }

    private func calculateContentTypesScore(_ clientInfo: ClientInformation) -> Double {
        guard let social = clientInfo.socialMediaPresence else { return 0.0 }

        // Video > Motion Graphics > Images > Text
        var score = 0.0
        for contentType in social.contentTypes {
            switch contentType {
            case .video: score += 4.0
            case .motionGraphics: score += 3.0
            case .images: score += 2.5
            case .textOnly: score += 1.0
            }
        }
        return min(score, 12.0) // Cap at max
    }

    private func calculateHoldingGroupScore(_ clientInfo: ClientInformation) -> Double {
        return clientInfo.holdingGroup != nil ? 8.0 : 0.0
    }

    private func calculateEntityTypeScore(_ clientInfo: ClientInformation) -> Double {
        guard let entityType = clientInfo.entityType else { return 0.0 }

        switch entityType {
        case .publicCompany: return 7.0
        case .privateCompany: return 5.0
        case .governmental: return 3.0 // Lower due to complexity
        case .nonprofit: return 2.0
        }
    }

    private func calculateMediaSpendScore(_ clientInfo: ClientInformation) -> Double {
        guard let indicators = clientInfo.mediaSpendIndicators?.lowercased() else { return 0.0 }

        // Heuristic parsing of media spend indicators
        if indicators.contains("very high") || indicators.contains("extremely high") || indicators.contains("massive") {
            return 10.0
        } else if indicators.contains("high") || indicators.contains("significant") || indicators.contains("substantial") {
            return 7.5
        } else if indicators.contains("moderate") || indicators.contains("medium") || indicators.contains("average") {
            return 5.0
        } else if indicators.contains("low") || indicators.contains("limited") || indicators.contains("minimal") {
            return 2.5
        } else {
            return 5.0 // Default to moderate if unclear
        }
    }

    private func calculateOutputQuantityScore(_ quantities: OutputQuantities?) -> Double {
        guard let quantities = quantities else { return 0.0 }

        let total = quantities.totalCount
        switch total {
        case 0: return 0.0
        case 1...5: return 1.0
        case 6...20: return 2.0
        case 21...: return 3.0
        default: return 0.0
        }
    }

    private func calculateOutputTypeScore(_ outputTypes: [OutputType]) -> Double {
        // Video = highest value
        if outputTypes.contains(.video) { return 2.0 }
        if outputTypes.contains(.motionGraphics) { return 1.5 }
        if outputTypes.contains(.visuals) { return 1.0 }
        if outputTypes.contains(.content) { return 0.5 }
        return 0.0
    }

    // MARK: - API Communication

    internal func callClaudeAPI(
        systemPrompt: String,
        userPrompt: String
    ) async throws -> String {

        let tracker = PerformanceTracker(operation: "claude_api_request")

        // Get API key from keychain
        let apiKey: String
        do {
            apiKey = try keychainManager.getClaudeAPIKey()
        } catch {
            throw AnalysisError.missingAPIKey
        }

        // Build request
        guard let url = URL(string: "\(apiBaseURL)/messages") else {
            throw AnalysisError.invalidAPIConfiguration
        }

        let requestBody: [String: Any] = [
            "model": model,
            "max_tokens": maxTokens,
            "system": systemPrompt,
            "messages": [
                [
                    "role": "user",
                    "content": userPrompt
                ]
            ]
        ]

        let bodyData = try JSONSerialization.data(withJSONObject: requestBody)

        // Make request
        tracker.recordMetric("inputTokens", value: (systemPrompt.count + userPrompt.count) / 4)

        let responseData = try await networkClient.request(
            url: url,
            method: .post,
            headers: [
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            ],
            body: bodyData,
            retryPolicy: .exponential(maxAttempts: 3)
        )

        // Parse response
        guard let response = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
              let content = response["content"] as? [[String: Any]],
              let firstContent = content.first,
              let text = firstContent["text"] as? String else {
            throw AnalysisError.invalidAPIResponse
        }

        // Track usage
        if let usage = response["usage"] as? [String: Any],
           let inputTokens = usage["input_tokens"] as? Int,
           let outputTokens = usage["output_tokens"] as? Int {
            tracker.recordMetric("actualInputTokens", value: inputTokens)
            tracker.recordMetric("outputTokens", value: outputTokens)
        }

        tracker.complete(success: true)

        return text
    }

    private func parseExtractionResponse(_ response: String) throws -> ExtractedRFPData {
        // Extract JSON from response (Claude might wrap it in markdown)
        let jsonString: String
        if response.contains("```json") {
            // Extract from code block
            let components = response.components(separatedBy: "```json")
            if components.count > 1 {
                let afterStart = components[1]
                let jsonComponents = afterStart.components(separatedBy: "```")
                jsonString = jsonComponents.first ?? response
            } else {
                jsonString = response
            }
        } else if response.contains("```") {
            // Generic code block
            let components = response.components(separatedBy: "```")
            jsonString = components.count > 1 ? components[1] : response
        } else {
            jsonString = response
        }

        // Parse JSON
        guard let data = jsonString.data(using: .utf8) else {
            throw AnalysisError.invalidJSONResponse
        }

        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let extractedData = try decoder.decode(ExtractedRFPData.self, from: data)
            return extractedData
        } catch {
            AppLogger.shared.error("JSON parsing failed", error: error, metadata: [
                "response": jsonString.prefix(500).description
            ])
            throw AnalysisError.invalidJSONResponse
        }
    }

    // MARK: - Helper Methods

    private func countFilledFields(_ data: ExtractedRFPData) -> Int {
        var count = 0
        if data.clientName?.isEmpty == false { count += 1 }
        if data.projectName?.isEmpty == false { count += 1 }
        if data.projectDescription?.isEmpty == false { count += 1 }
        if data.scopeOfWork?.isEmpty == false { count += 1 }
        if data.scopeAnalysis != nil { count += 1 }
        if data.financialPotential != nil { count += 1 }
        if data.evaluationCriteria?.isEmpty == false { count += 1 }
        if data.requiredDeliverables?.isEmpty == false { count += 1 }
        if data.importantDates?.isEmpty == false { count += 1 }
        if data.submissionMethodRequirements?.isEmpty == false { count += 1 }
        return count
    }
}

// MARK: - Analysis Error

public enum AnalysisError: Error, LocalizedError {
    case missingAPIKey
    case extractionFailed(underlying: Error)
    case invalidAPIResponse
    case invalidJSONResponse
    case invalidAPIConfiguration
    case networkError(NetworkClient.NetworkError)

    public var errorDescription: String? {
        switch self {
        case .missingAPIKey:
            return "Claude API key not found. Please configure in settings."
        case .extractionFailed(let error):
            return "RFP extraction failed: \(error.localizedDescription)"
        case .invalidAPIResponse:
            return "Invalid response from Claude API"
        case .invalidJSONResponse:
            return "Could not parse extraction results"
        case .invalidAPIConfiguration:
            return "Invalid API configuration"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }

    public var recoverySuggestion: String? {
        switch self {
        case .missingAPIKey:
            return "Add your Claude API key in the app settings"
        case .extractionFailed:
            return "Try again or check document format"
        case .invalidAPIResponse, .invalidJSONResponse, .invalidAPIConfiguration:
            return "Contact support if this persists"
        case .networkError:
            return "Check your internet connection and try again"
        }
    }
}
