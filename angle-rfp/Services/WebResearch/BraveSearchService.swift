//
//  BraveSearchService.swift
//  angle-rfp
//
//  Automated company research using Brave Search API
//  Implements 3-query strategy with Claude extraction
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import Foundation

/// Protocol for web research services (enables testing/mocking)
public protocol WebResearchService: Sendable {
    func researchCompany(_ companyName: String) async throws -> ClientInformation
    func getUsageStats() -> (used: Int, limit: Int, remaining: Int)
}

/// Service for researching companies using Brave Search API
///
/// Strategy:
/// - Query 1: Company size, revenue, employees, headquarters
/// - Query 2: Media spend, advertising budget, marketing
/// - Query 3: Parent company, holding group, ownership
///
/// Free tier: 2,000 queries/month (666 RFPs capacity)
/// Usage: 3 queries per company
public final class BraveSearchService: WebResearchService, @unchecked Sendable {

    // MARK: - Singleton

    public static let shared = BraveSearchService()

    // MARK: - Properties

    private let networkClient: NetworkClient
    private let cache: ResearchCache
    private let apiKey: String?

    /// API endpoint
    private let baseURL = "https://api.search.brave.com/res/v1/web/search"

    /// Thread-safe access to mutable state
    private let usageQueue = DispatchQueue(label: "com.angle.rfp.brave.usage", qos: .utility)

    /// Rate limit tracking (protected by usageQueue)
    private var _queriesThisMonth: Int = 0
    private var _lastResetDate: Date?
    private let monthlyLimit = 2000

    /// Thread-safe accessor for queries this month
    private var queriesThisMonth: Int {
        get { usageQueue.sync { _queriesThisMonth } }
        set { usageQueue.sync { _queriesThisMonth = newValue } }
    }

    /// Thread-safe accessor for last reset date
    private var lastResetDate: Date? {
        get { usageQueue.sync { _lastResetDate } }
        set { usageQueue.sync { _lastResetDate = newValue } }
    }

    // MARK: - Initialization

    /// Internal initializer for dependency injection (enables testing)
    internal init(
        networkClient: NetworkClient,
        cache: ResearchCache,
        apiKey: String?
    ) {
        self.networkClient = networkClient
        self.cache = cache
        self.apiKey = apiKey

        // Load usage stats
        self.loadUsageStats()
    }

    /// Convenience initializer using shared dependencies
    private convenience init() {
        self.init(
            networkClient: .shared,
            cache: ResearchCache.shared,
            apiKey: try? KeychainManager.shared.get(.braveAPIKey)
        )
    }

    // MARK: - Public API

    /// Research company information using Brave Search + Claude extraction
    ///
    /// - Parameter companyName: Name of company to research
    /// - Returns: ClientInformation with research data and confidence score
    /// - Throws: BraveSearchError if research fails
    public func researchCompany(_ companyName: String) async throws -> ClientInformation {
        let normalizedName = companyName.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)

        // Check cache first
        if let cached = cache.get(companyName: normalizedName) {
            AppLogger.shared.info("Cache hit for company research: \(companyName)")
            return cached
        }

        // Verify API key
        guard let apiKey = apiKey, !apiKey.isEmpty else {
            throw BraveSearchError.missingAPIKey
        }

        // Check rate limit
        guard canMakeQueries(count: 3) else {
            throw BraveSearchError.quotaExceeded(remaining: monthlyLimit - queriesThisMonth)
        }

        AppLogger.shared.info("Starting company research for: \(companyName)")

        // Execute 3 parallel search queries
        async let query1 = searchQuery(
            "\(companyName) company size revenue employees headquarters",
            companyName: companyName
        )
        async let query2 = searchQuery(
            "\(companyName) media spend advertising budget marketing",
            companyName: companyName
        )
        async let query3 = searchQuery(
            "\(companyName) parent company holding group ownership",
            companyName: companyName
        )

        let (results1, results2, results3) = try await (query1, query2, query3)

        // Update usage
        incrementQueryCount(by: 3)

        // Combine all search results
        let allSnippets = results1 + results2 + results3

        guard !allSnippets.isEmpty else {
            throw BraveSearchError.noResultsFound
        }

        // Extract structured information using Claude
        let clientInfo = try await extractClientInformation(
            companyName: companyName,
            searchSnippets: allSnippets
        )

        // Cache result for 30 days
        cache.set(clientInfo, forCompanyName: normalizedName)

        AppLogger.shared.info("Research completed for \(companyName) - Confidence: \(String(format: "%.1f%%", clientInfo.researchConfidence * 100))")

        return clientInfo
    }

    /// Get current API usage statistics
    public func getUsageStats() -> (used: Int, limit: Int, remaining: Int) {
        resetMonthlyCountIfNeeded()
        let remaining = max(0, monthlyLimit - queriesThisMonth)
        return (queriesThisMonth, monthlyLimit, remaining)
    }

    // MARK: - Private Helpers

    /// Execute single search query
    private func searchQuery(_ query: String, companyName: String) async throws -> [SearchSnippet] {
        guard let apiKey = apiKey else {
            throw BraveSearchError.missingAPIKey
        }

        // Build URL with query parameter
        guard var urlComponents = URLComponents(string: baseURL) else {
            throw BraveSearchError.invalidURL
        }

        urlComponents.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "count", value: "10") // Get top 10 results
        ]

        guard let url = urlComponents.url else {
            throw BraveSearchError.invalidURL
        }

        // Create request with API key header
        var request = URLRequest(url: url)
        request.setValue(apiKey, forHTTPHeaderField: "X-Subscription-Token")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Execute request
        let startTime = Date()
        let data = try await networkClient.request(
            url: url,
            method: .get,
            headers: ["X-Subscription-Token": apiKey, "Accept": "application/json"],
            retryPolicy: .exponential(maxAttempts: 2)
        )
        let duration = Date().timeIntervalSince(startTime)

        // Track analytics
        AnalyticsManager.shared.track(.braveSearchQuery(
            query: query,
            duration: duration,
            resultsCount: 0, // Will update after parsing
            sessionID: AnalyticsManager.shared.sessionID
        ))

        // Parse response
        let response = try JSONDecoder().decode(BraveSearchResponse.self, from: data)

        // Extract snippets from web results
        var snippets: [SearchSnippet] = []

        if let webResults = response.web?.results {
            for result in webResults {
                snippets.append(SearchSnippet(
                    title: result.title,
                    description: result.description ?? "",
                    url: result.url,
                    source: "Brave Search"
                ))
            }
        }

        AppLogger.shared.debug("Search query '\(query)' returned \(snippets.count) results")

        return snippets
    }

    /// Extract ClientInformation from search snippets using Claude
    private func extractClientInformation(
        companyName: String,
        searchSnippets: [SearchSnippet]
    ) async throws -> ClientInformation {

        // Prepare prompt for Claude
        let snippetsText = searchSnippets.enumerated().map { index, snippet in
            """
            [\(index + 1)] \(snippet.title)
            \(snippet.description)
            Source: \(snippet.url)
            """
        }.joined(separator: "\n\n")

        let systemPrompt = """
        You are a research analyst extracting company information from web search results.

        Extract the following fields from the search results:
        - Company size (startup, small 1-50, medium 51-500, large 501-5000, enterprise 5000+)
        - Brand popularity (unknown, local, regional, national, international)
        - Entity type (private company, public company, governmental, non-profit)
        - Holding group (parent company name, or "Independent")
        - Industry
        - Social media presence (active platforms, activity level, content types)
        - Estimated employees (number)
        - Estimated revenue (e.g., "$50M", "$1.2B")
        - Media spend indicators (e.g., "High marketing budget", "Limited ad spend")

        Return ONLY a JSON object with this structure:
        {
          "companySize": "enterprise|large|medium|small|startup",
          "brandPopularity": "international|national|regional|local|unknown",
          "entityType": "privateCompany|publicCompany|governmental|nonprofit",
          "holdingGroup": "Parent Company Name or null",
          "industry": "Industry name",
          "socialMediaPresence": {
            "hasPresence": true,
            "activityLevel": "veryHigh|high|moderate|low|inactive",
            "platforms": ["linkedin", "instagram", "facebook", "twitter", "youtube", "tiktok"],
            "contentTypes": ["video", "motionGraphics", "images", "textOnly"]
          },
          "estimatedEmployees": 5000,
          "estimatedRevenue": "$100M",
          "mediaSpendIndicators": "Description of ad/marketing spend",
          "confidence": 0.85,
          "sources": ["url1", "url2"]
        }

        Set confidence (0.0-1.0) based on data quality:
        - 0.9-1.0: High confidence, multiple corroborating sources
        - 0.7-0.89: Good confidence, some data points verified
        - 0.5-0.69: Moderate confidence, limited information
        - 0.0-0.49: Low confidence, mostly assumptions

        If information is not found, use null for that field.
        """

        let userPrompt = """
        Company: \(companyName)

        Search Results:
        ---
        \(snippetsText)
        ---

        Extract company information from these search results.
        """

        // Call Claude API
        let jsonResponse = try await ClaudeAnalysisService.shared.callClaudeAPI(
            systemPrompt: systemPrompt,
            userPrompt: userPrompt
        )

        // Parse JSON response
        guard let jsonData = jsonResponse.data(using: String.Encoding.utf8) else {
            throw BraveSearchError.invalidResponse
        }

        let researchData = try JSONDecoder().decode(ResearchData.self, from: jsonData)

        // Convert to ClientInformation with validation logging
        let companySize = parseEnum(researchData.companySize, as: CompanySize.self, field: "companySize", company: companyName)
        let brandPopularity = parseEnum(researchData.brandPopularity, as: BrandPopularity.self, field: "brandPopularity", company: companyName)
        let entityType = parseEnum(researchData.entityType, as: EntityType.self, field: "entityType", company: companyName, capitalize: false)

        let socialMediaPresence: SocialMediaPresence? = researchData.socialMediaPresence.map { presence in
            let activityLevel = parseEnum(presence.activityLevel, as: ActivityLevel.self, field: "activityLevel", company: companyName)
            let platforms = presence.platforms.compactMap { raw -> SocialPlatform? in
                parseEnum(raw, as: SocialPlatform.self, field: "platform", company: companyName)
            }
            let contentTypes = presence.contentTypes.compactMap { raw -> ContentType? in
                parseEnum(raw, as: ContentType.self, field: "contentType", company: companyName)
            }

            return SocialMediaPresence(
                hasPresence: presence.hasPresence,
                activityLevel: activityLevel,
                platforms: platforms,
                contentTypes: contentTypes
            )
        }

        let clientInfo = ClientInformation(
            name: companyName,
            companySize: companySize,
            brandPopularity: brandPopularity,
            entityType: entityType,
            holdingGroup: researchData.holdingGroup,
            industry: researchData.industry,
            socialMediaPresence: socialMediaPresence,
            estimatedEmployees: researchData.estimatedEmployees,
            estimatedRevenue: researchData.estimatedRevenue,
            mediaSpendIndicators: researchData.mediaSpendIndicators,
            researchSources: researchData.sources ?? [],
            researchConfidence: researchData.confidence,
            researchDate: Date()
        )

        return clientInfo
    }

    // MARK: - Enum Parsing Helpers

    /// Safely parse string to enum with logging on failure
    private func parseEnum<T: RawRepresentable>(
        _ value: String?,
        as type: T.Type,
        field: String,
        company: String,
        capitalize: Bool = true
    ) -> T? where T.RawValue == String {
        guard let rawValue = value else { return nil }

        let normalizedValue = capitalize ? rawValue.capitalized : rawValue

        if let result = T(rawValue: normalizedValue) {
            return result
        }

        // Try lowercase as fallback
        if let result = T(rawValue: rawValue.lowercased()) {
            return result
        }

        // Log failed conversion for debugging
        AppLogger.shared.warning("Enum conversion failed", metadata: [
            "field": field,
            "value": rawValue,
            "expectedType": String(describing: type),
            "company": company
        ])

        return nil
    }

    // MARK: - Rate Limiting

    private func canMakeQueries(count: Int) -> Bool {
        resetMonthlyCountIfNeeded()
        return (queriesThisMonth + count) <= monthlyLimit
    }

    private func incrementQueryCount(by count: Int) {
        queriesThisMonth += count
        saveUsageStats()
    }

    private func resetMonthlyCountIfNeeded() {
        let calendar = Calendar.current
        let now = Date()

        if let lastReset = lastResetDate {
            let lastMonth = calendar.component(.month, from: lastReset)
            let currentMonth = calendar.component(.month, from: now)

            if lastMonth != currentMonth {
                queriesThisMonth = 0
                lastResetDate = now
                saveUsageStats()
            }
        } else {
            lastResetDate = now
            saveUsageStats()
        }
    }

    // MARK: - Persistence

    private func loadUsageStats() {
        if let data = UserDefaults.standard.data(forKey: "BraveSearchUsageStats"),
           let stats = try? JSONDecoder().decode(UsageStats.self, from: data) {
            // Use internal variables directly since we're in init (no concurrent access yet)
            _queriesThisMonth = stats.queriesThisMonth
            _lastResetDate = stats.lastResetDate
        }
    }

    private func saveUsageStats() {
        let stats = UsageStats(
            queriesThisMonth: queriesThisMonth,
            lastResetDate: lastResetDate ?? Date()
        )

        if let data = try? JSONEncoder().encode(stats) {
            UserDefaults.standard.set(data, forKey: "BraveSearchUsageStats")
        }
    }
}

// MARK: - Supporting Types

/// Brave Search API response structure
private struct BraveSearchResponse: Codable {
    let web: WebResults?
}

private struct WebResults: Codable {
    let results: [WebResult]?
}

private struct WebResult: Codable {
    let title: String
    let url: String
    let description: String?
}

/// Search snippet extracted from results
struct SearchSnippet: Codable {
    let title: String
    let description: String
    let url: String
    let source: String
}

/// Claude extraction response structure
private struct ResearchData: Codable {
    let companySize: String?
    let brandPopularity: String?
    let entityType: String?
    let holdingGroup: String?
    let industry: String?
    let socialMediaPresence: SocialMediaData?
    let estimatedEmployees: Int?
    let estimatedRevenue: String?
    let mediaSpendIndicators: String?
    let confidence: Double
    let sources: [String]?
}

private struct SocialMediaData: Codable {
    let hasPresence: Bool
    let activityLevel: String?
    let platforms: [String]
    let contentTypes: [String]
}

/// Usage statistics for persistence
private struct UsageStats: Codable {
    let queriesThisMonth: Int
    let lastResetDate: Date
}

// MARK: - Errors

public enum BraveSearchError: LocalizedError {
    case missingAPIKey
    case quotaExceeded(remaining: Int)
    case noResultsFound
    case invalidURL
    case invalidResponse
    case parsingFailed(String)

    public var errorDescription: String? {
        switch self {
        case .missingAPIKey:
            return "Brave Search API key not configured. Please add your API key in Settings."
        case .quotaExceeded(let remaining):
            return "Brave Search API quota exceeded. Remaining queries: \(remaining). Resets next month."
        case .noResultsFound:
            return "No search results found for this company."
        case .invalidURL:
            return "Invalid search URL constructed."
        case .invalidResponse:
            return "Invalid response from Brave Search API."
        case .parsingFailed(let message):
            return "Failed to parse search results: \(message)"
        }
    }
}

// MARK: - Analytics Extension

extension AnalyticsEvent {
    static func braveSearchQuery(
        query: String,
        duration: TimeInterval,
        resultsCount: Int,
        sessionID: UUID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .performance,
            name: "brave_search_query",
            properties: [
                "queryHash": .string(String(query.hashValue.description.prefix(8))), // Privacy: hash query
                "duration": .double(duration),
                "resultsCount": .int(resultsCount)
            ],
            sessionID: sessionID
        )
    }
}
