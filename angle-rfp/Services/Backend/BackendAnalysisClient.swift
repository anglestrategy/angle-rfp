//
//  BackendAnalysisClient.swift
//  angle-rfp
//
//  Stage-wise backend orchestration client for parse -> extract -> scope -> research -> score -> render -> export.
//

import Foundation

enum BackendPipelineStage {
    case parse
    case extract
    case scope
    case research
    case score
    case render
    case export
}

struct BackendStageUpdate {
    let stage: BackendPipelineStage
    let progress: Double
    let warnings: [String]
}

struct BackendAnalysisResult {
    let extractedData: ExtractedRFPData
    let clientInfo: ClientInformation?
    let warnings: [String]
}

enum BackendAnalysisClientError: LocalizedError {
    case invalidBaseURL
    case invalidResponse
    case httpError(statusCode: Int, message: String)
    case malformedResponse
    case localFileAccessFailed

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL:
            return "Backend base URL is invalid."
        case .invalidResponse:
            return "Backend returned an invalid response."
        case .httpError(let code, let message):
            return "Backend request failed (\(code)): \(message)"
        case .malformedResponse:
            return "Backend response payload was malformed."
        case .localFileAccessFailed:
            return "Unable to read the selected local file."
        }
    }
}

final class BackendAnalysisClient {
    static let shared = BackendAnalysisClient()

    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    private enum Config {
        static let baseURLDefaultsKey = "backend.baseURL"
        static let defaultBaseURL = "http://localhost:3000"
        static let defaultToken = "dev-angle-rfp-token"
    }

    init(session: URLSession = .shared) {
        self.session = session
        self.encoder = JSONEncoder()
        self.decoder = JSONDecoder()
        self.encoder.outputFormatting = .withoutEscapingSlashes
    }

    func analyze(
        documentURL: URL,
        onStageUpdate: @escaping (BackendStageUpdate) -> Void
    ) async throws -> BackendAnalysisResult {
        let analysisId = UUID().uuidString.lowercased()
        let traceId = UUID().uuidString.lowercased()
        var allWarnings: [String] = []

        onStageUpdate(BackendStageUpdate(stage: .parse, progress: 0.12, warnings: []))
        let parsed = try await parseDocument(
            analysisId: analysisId,
            traceId: traceId,
            documentURL: documentURL
        )
        allWarnings.append(contentsOf: parsed.warnings)
        onStageUpdate(BackendStageUpdate(stage: .parse, progress: 0.22, warnings: parsed.warnings))

        onStageUpdate(BackendStageUpdate(stage: .extract, progress: 0.28, warnings: []))
        let extractedEnvelope: ApiEnvelope<ExtractedRFPDataV1Payload> = try await postJSON(
            path: "/api/analyze-rfp",
            traceId: traceId,
            body: AnalyzeRfpRequestV1(analysisId: analysisId, parsedDocument: parsed)
        )
        let extracted = try extractedEnvelope.requireData()
        allWarnings.append(contentsOf: extractedEnvelope.warnings + extracted.warnings)
        onStageUpdate(BackendStageUpdate(stage: .extract, progress: 0.42, warnings: extracted.warnings))

        onStageUpdate(BackendStageUpdate(stage: .scope, progress: 0.48, warnings: []))
        let scopeEnvelope: ApiEnvelope<ScopeAnalysisV1Payload> = try await postJSON(
            path: "/api/analyze-scope",
            traceId: traceId,
            body: AnalyzeScopeRequestV1(
                analysisId: analysisId,
                scopeOfWork: extracted.scopeOfWork,
                language: parsed.primaryLanguage
            )
        )
        let scope = try scopeEnvelope.requireData()
        allWarnings.append(contentsOf: scopeEnvelope.warnings + scope.warnings)
        onStageUpdate(BackendStageUpdate(stage: .scope, progress: 0.58, warnings: scope.warnings))

        onStageUpdate(BackendStageUpdate(stage: .research, progress: 0.64, warnings: []))
        let research: ClientResearchV1Payload
        do {
            let researchEnvelope: ApiEnvelope<ClientResearchV1Payload> = try await postJSON(
                path: "/api/research-client",
                traceId: traceId,
                body: ResearchClientRequestV1(
                    analysisId: analysisId,
                    clientName: extracted.clientName,
                    clientNameArabic: extracted.clientNameArabic,
                    country: "SA"
                )
            )
            research = try researchEnvelope.requireData()
            allWarnings.append(contentsOf: researchEnvelope.warnings + (research.warnings ?? []))
            onStageUpdate(BackendStageUpdate(stage: .research, progress: 0.74, warnings: research.warnings ?? []))
        } catch {
            let fallback = fallbackResearch(analysisId: analysisId, companyName: extracted.clientName)
            research = fallback
            let fallbackWarning = "Research stage degraded: \(error.localizedDescription)"
            allWarnings.append(fallbackWarning)
            onStageUpdate(BackendStageUpdate(stage: .research, progress: 0.74, warnings: [fallbackWarning]))
        }

        onStageUpdate(BackendStageUpdate(stage: .score, progress: 0.80, warnings: []))
        let scoreEnvelope: ApiEnvelope<FinancialScoreV1Payload> = try await postJSON(
            path: "/api/calculate-score",
            traceId: traceId,
            body: CalculateScoreRequestV1(
                analysisId: analysisId,
                extractedRfp: extracted,
                scopeAnalysis: scope,
                clientResearch: research
            )
        )
        let score = try scoreEnvelope.requireData()
        allWarnings.append(contentsOf: scoreEnvelope.warnings)
        onStageUpdate(BackendStageUpdate(stage: .score, progress: 0.88, warnings: scoreEnvelope.warnings))

        onStageUpdate(BackendStageUpdate(stage: .render, progress: 0.93, warnings: []))
        let report = AnalysisReportV1Payload(
            schemaVersion: "1.0.0",
            analysisId: analysisId,
            summary: AnalysisSummaryV1(
                headline: "\(extracted.projectName) opportunity",
                recommendation: score.recommendationBand,
                score: score.finalScore
            ),
            extractedRfp: extracted,
            scopeAnalysis: scope,
            clientResearch: research,
            financialScore: score,
            warnings: allWarnings,
            generatedAt: ISO8601DateFormatter().string(from: Date())
        )

        onStageUpdate(BackendStageUpdate(stage: .export, progress: 0.97, warnings: []))
        do {
            let exportEnvelope: ApiEnvelope<[String: JSONValue]> = try await postJSON(
                path: "/api/export",
                traceId: traceId,
                body: ExportRequestV1(analysisId: analysisId, report: report, format: "link")
            )
            allWarnings.append(contentsOf: exportEnvelope.warnings)
        } catch {
            allWarnings.append("Export stage degraded: \(error.localizedDescription)")
        }
        onStageUpdate(BackendStageUpdate(stage: .export, progress: 1.0, warnings: allWarnings))

        let mappedExtracted = mapExtractedData(
            extracted: extracted,
            scope: scope,
            score: score,
            warnings: allWarnings
        )

        let clientInfo = mapClientInformation(from: research)
        return BackendAnalysisResult(
            extractedData: mappedExtracted,
            clientInfo: clientInfo,
            warnings: allWarnings
        )
    }

    private func parseDocument(
        analysisId: String,
        traceId: String,
        documentURL: URL
    ) async throws -> ParsedDocumentV1 {
        guard let baseURL = resolvedBaseURL() else {
            throw BackendAnalysisClientError.invalidBaseURL
        }
        let endpoint = baseURL.appendingPathComponent("api/parse-document")

        let accessGranted = documentURL.startAccessingSecurityScopedResource()
        defer {
            if accessGranted {
                documentURL.stopAccessingSecurityScopedResource()
            }
        }

        let fileData: Data
        do {
            fileData = try Data(contentsOf: documentURL)
        } catch {
            throw BackendAnalysisClientError.localFileAccessFailed
        }

        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 120
        request.addValue("Bearer \(resolvedToken())", forHTTPHeaderField: "Authorization")
        request.addValue(traceId, forHTTPHeaderField: "X-Trace-Id")
        request.addValue(UUID().uuidString.lowercased(), forHTTPHeaderField: "Idempotency-Key")
        request.addValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = multipartBody(
            boundary: boundary,
            analysisId: analysisId,
            fileName: documentURL.lastPathComponent,
            fileData: fileData
        )

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw BackendAnalysisClientError.invalidResponse
        }

        let envelope = try decoder.decode(ApiEnvelope<ParsedDocumentV1>.self, from: data)
        if let apiError = envelope.error {
            throw BackendAnalysisClientError.httpError(statusCode: httpResponse.statusCode, message: apiError.message)
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            throw BackendAnalysisClientError.httpError(statusCode: httpResponse.statusCode, message: "Parse request failed")
        }
        return try envelope.requireData()
    }

    private func postJSON<Body: Encodable, Output: Decodable>(
        path: String,
        traceId: String,
        body: Body
    ) async throws -> ApiEnvelope<Output> {
        guard let baseURL = resolvedBaseURL() else {
            throw BackendAnalysisClientError.invalidBaseURL
        }
        let cleanedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let endpoint = baseURL.appendingPathComponent(cleanedPath)
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 120
        request.addValue("Bearer \(resolvedToken())", forHTTPHeaderField: "Authorization")
        request.addValue(traceId, forHTTPHeaderField: "X-Trace-Id")
        request.addValue(UUID().uuidString.lowercased(), forHTTPHeaderField: "Idempotency-Key")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw BackendAnalysisClientError.invalidResponse
        }

        let envelope = try decoder.decode(ApiEnvelope<Output>.self, from: data)
        if let apiError = envelope.error {
            throw BackendAnalysisClientError.httpError(statusCode: httpResponse.statusCode, message: apiError.message)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw BackendAnalysisClientError.httpError(
                statusCode: httpResponse.statusCode,
                message: HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode)
            )
        }

        return envelope
    }

    private func multipartBody(
        boundary: String,
        analysisId: String,
        fileName: String,
        fileData: Data
    ) -> Data {
        var body = Data()
        let lineBreak = "\r\n"

        body.append("--\(boundary)\(lineBreak)".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"analysisId\"\(lineBreak)\(lineBreak)".data(using: .utf8)!)
        body.append("\(analysisId)\(lineBreak)".data(using: .utf8)!)

        let mimeType = inferredMimeType(fileName: fileName)
        body.append("--\(boundary)\(lineBreak)".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\(lineBreak)".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\(lineBreak)\(lineBreak)".data(using: .utf8)!)
        body.append(fileData)
        body.append(lineBreak.data(using: .utf8)!)

        body.append("--\(boundary)--\(lineBreak)".data(using: .utf8)!)
        return body
    }

    private func inferredMimeType(fileName: String) -> String {
        switch fileName.lowercased().split(separator: ".").last {
        case "pdf":
            return "application/pdf"
        case "docx":
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        case "txt":
            return "text/plain"
        default:
            return "application/octet-stream"
        }
    }

    private func resolvedBaseURL() -> URL? {
        let defaults = UserDefaults.standard
        let base = defaults.string(forKey: Config.baseURLDefaultsKey)
            ?? ProcessInfo.processInfo.environment["BACKEND_BASE_URL"]
            ?? Config.defaultBaseURL
        return URL(string: base)
    }

    private func resolvedToken() -> String {
        if let token = try? KeychainManager.shared.get(.backendAPIKey), !token.isEmpty {
            return token
        }
        if let token = ProcessInfo.processInfo.environment["BACKEND_APP_TOKEN"], !token.isEmpty {
            return token
        }
        return Config.defaultToken
    }

    private func mapExtractedData(
        extracted: ExtractedRFPDataV1Payload,
        scope: ScopeAnalysisV1Payload,
        score: FinancialScoreV1Payload,
        warnings: [String]
    ) -> ExtractedRFPData {
        let scopeAnalysis = ScopeAnalysis(
            agencyServices: scope.matches
                .filter { $0.class == "full" || $0.class == "partial" }
                .map { $0.service },
            nonAgencyServices: scope.matches
                .filter { $0.class == "none" }
                .map { $0.service },
            agencyServicePercentage: scope.agencyServicePercentage,
            outputQuantities: OutputQuantities(
                videoProduction: scope.outputQuantities.videoProduction,
                motionGraphics: scope.outputQuantities.motionGraphics,
                visualDesign: scope.outputQuantities.visualDesign,
                contentOnly: scope.outputQuantities.contentOnly
            ),
            outputTypes: scope.outputTypes.compactMap { outputType(from: $0) }
        )

        let financialPotential = FinancialPotential(
            totalScore: score.finalScore,
            recommendation: score.rationale,
            factors: score.factorBreakdown.map { item in
                ScoringFactor(
                    name: item.factor,
                    weight: item.weight,
                    score: item.score,
                    maxScore: 100,
                    reasoning: item.evidence.joined(separator: " | ")
                )
            },
            formulaExplanation: "Deterministic 11-factor weighted model with red-flag and completeness penalties."
        )

        return ExtractedRFPData(
            id: UUID(uuidString: extracted.analysisId) ?? UUID(),
            extractionDate: parseISODateTime(extracted.extractionDate),
            clientName: extracted.clientName,
            projectName: extracted.projectName,
            projectDescription: extracted.projectDescription,
            scopeOfWork: extracted.scopeOfWork,
            scopeAnalysis: scopeAnalysis,
            financialPotential: financialPotential,
            evaluationCriteria: extracted.evaluationCriteria,
            requiredDeliverables: extracted.requiredDeliverables,
            importantDates: extracted.importantDates.map { item in
                ImportantDate(
                    title: item.title,
                    date: parseDate(item.date),
                    dateType: dateType(from: item.type),
                    isCritical: item.isCritical
                )
            },
            submissionMethodRequirements: submissionDescription(from: extracted.submissionRequirements),
            parsingWarnings: warnings.map {
                AnalysisWarning(level: .warning, message: $0, isActionable: true)
            },
            completeness: extracted.completenessScore,
            confidenceScores: extracted.confidenceScores
        )
    }

    private func mapClientInformation(from research: ClientResearchV1Payload) -> ClientInformation {
        let companySize = companySizeFromResearch(research)
        let brandPopularity = brandPopularityFromResearch(research)
        let entityType = entityType(from: research.companyProfile.entityType)

        return ClientInformation(
            name: research.companyName,
            companySize: companySize,
            brandPopularity: brandPopularity,
            entityType: entityType,
            holdingGroup: nil,
            industry: research.companyProfile.industry,
            socialMediaPresence: SocialMediaPresence(
                hasPresence: research.digitalPresence.bilingual || research.advertisingActivity.confidence > 0.2,
                activityLevel: activityLevel(from: research.advertisingActivity.confidence),
                platforms: [.linkedin, .instagram, .youtube],
                contentTypes: contentTypesFromEvidence(research.evidence)
            ),
            estimatedEmployees: nil,
            estimatedRevenue: nil,
            mediaSpendIndicators: research.financialIndicators.marketingBudgetIndicator,
            researchSources: research.companyProfile.sources,
            researchConfidence: research.confidence,
            researchDate: parseDate(research.researchMetadata.researchDate)
        )
    }

    private func outputType(from value: String) -> OutputType? {
        switch value {
        case "videoProduction":
            return .video
        case "motionGraphics":
            return .motionGraphics
        case "visualDesign":
            return .visuals
        case "contentOnly":
            return .content
        default:
            return nil
        }
    }

    private func dateType(from value: String) -> DateType {
        switch value {
        case "qa_deadline":
            return .questionsDeadline
        case "submission_deadline":
            return .proposalDeadline
        case "presentation":
            return .presentationDate
        case "project_start":
            return .projectStartDate
        default:
            return .other
        }
    }

    private func submissionDescription(from submission: SubmissionRequirementsV1) -> String {
        var lines: [String] = []
        lines.append("Method: \(submission.method)")
        lines.append("Format: \(submission.format)")
        if let email = submission.email, !email.isEmpty {
            lines.append("Email: \(email)")
        }
        if let address = submission.physicalAddress, !address.isEmpty {
            lines.append("Address: \(address)")
        }
        if let copies = submission.copies {
            lines.append("Copies: \(copies)")
        }
        if !submission.otherRequirements.isEmpty {
            lines.append("Other: \(submission.otherRequirements.joined(separator: ", "))")
        }
        return lines.joined(separator: "\n")
    }

    private func parseISODateTime(_ value: String) -> Date {
        let formatter = ISO8601DateFormatter()
        return formatter.date(from: value) ?? Date()
    }

    private func parseDate(_ value: String) -> Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.date(from: value) ?? Date()
    }

    private func companySizeFromResearch(_ research: ClientResearchV1Payload) -> CompanySize? {
        let indicator = research.financialIndicators.marketingBudgetIndicator.lowercased()
        if indicator.contains("very_high") || indicator.contains("high") {
            return .enterprise
        }
        if indicator.contains("medium") {
            return .large
        }
        if indicator.contains("low") {
            return .small
        }
        return nil
    }

    private func brandPopularityFromResearch(_ research: ClientResearchV1Payload) -> BrandPopularity? {
        if research.researchMetadata.sourcesUsed >= 12 {
            return .international
        }
        if research.researchMetadata.sourcesUsed >= 7 {
            return .national
        }
        if research.researchMetadata.sourcesUsed >= 4 {
            return .regional
        }
        if research.researchMetadata.sourcesUsed >= 1 {
            return .local
        }
        return .unknown
    }

    private func entityType(from value: String) -> EntityType? {
        let normalized = value.lowercased()
        if normalized.contains("private") {
            return .privateCompany
        }
        if normalized.contains("public") {
            return .publicCompany
        }
        if normalized.contains("government") {
            return .governmental
        }
        return nil
    }

    private func activityLevel(from confidence: Double) -> ActivityLevel? {
        switch confidence {
        case 0.85...:
            return .veryHigh
        case 0.7..<0.85:
            return .high
        case 0.45..<0.7:
            return .moderate
        case 0.2..<0.45:
            return .low
        default:
            return .inactive
        }
    }

    private func contentTypesFromEvidence(_ evidence: [ResearchEvidenceV1]) -> [ContentType] {
        let text = evidence.map(\.claim).joined(separator: " ").lowercased()
        var output: [ContentType] = []

        if text.contains("video") {
            output.append(.video)
        }
        if text.contains("motion") {
            output.append(.motionGraphics)
        }
        if text.contains("image") || text.contains("visual") {
            output.append(.images)
        }
        if output.isEmpty {
            output.append(.textOnly)
        }
        return output
    }

    private func fallbackResearch(analysisId: String, companyName: String) -> ClientResearchV1Payload {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")

        return ClientResearchV1Payload(
            schemaVersion: "1.0.0",
            analysisId: analysisId,
            companyName: companyName,
            companyNameArabic: nil,
            companyProfile: CompanyProfileV1(entityType: "unknown", industry: "unknown", confidence: 0.4, sources: []),
            financialIndicators: FinancialIndicatorsV1(marketingBudgetIndicator: "UNKNOWN", confidence: 0.4),
            digitalPresence: DigitalPresenceV1(bilingual: false, confidence: 0.4),
            advertisingActivity: AdvertisingActivityV1(confidence: 0.3, estimatedMonthlySpend: nil),
            positiveSignals: [],
            redFlags: ["Research unavailable"],
            researchMetadata: ResearchMetadataV1(
                sourcesUsed: 0,
                englishSources: 0,
                arabicSources: 0,
                overallConfidence: 0.3,
                researchDate: dateFormatter.string(from: Date())
            ),
            confidence: 0.3,
            evidence: [],
            warnings: ["Fallback research profile used"]
        )
    }
}
