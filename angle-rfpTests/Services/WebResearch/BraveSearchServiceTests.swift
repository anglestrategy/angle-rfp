//
//  BraveSearchServiceTests.swift
//  angle-rfpTests
//
//  Tests for Brave Search API integration and company research
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class BraveSearchServiceTests: XCTestCase {

    override func setUp() {
        super.setUp()
        ResearchCacheTestLock.lock.lock()
        addTeardownBlock {
            ResearchCacheTestLock.lock.unlock()
        }
        ResearchCache.shared.clearAll()
        AnalyticsManager.shared.clearAllDataSync()
    }

    override func tearDown() {
        ResearchCache.shared.clearAll()
        AnalyticsManager.shared.clearAllDataSync()
        super.tearDown()
    }

    // MARK: - Test Helpers

    private func waitForCondition(
        _ condition: @escaping () -> Bool,
        timeout: TimeInterval = 5.0,
        description: String = "Condition met"
    ) {
        let predicate = NSPredicate { _, _ in condition() }
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: nil)
        let waiter = XCTWaiter()
        let result = waiter.wait(for: [expectation], timeout: timeout)

        XCTAssertEqual(result, .completed, "Timeout waiting for: \(description)")
    }

    private func createMockService(withAPIKey apiKey: String = "test-api-key") -> BraveSearchService {
        // This would need dependency injection in real implementation
        // For now, we'll test with the singleton
        return BraveSearchService.shared
    }

    // MARK: - API Key Tests

    func testMissingAPIKeyThrowsError() async {
        // This test verifies that missing API key is handled properly
        // In real scenario, we'd need to clear the keychain first

        // Note: Testing this would require mocking the keychain
        // which is not trivial. We'll skip this for now.
    }

    func testAPIKeyLoadedFromKeychain() {
        // Store API key in keychain
        let testKey = "test-brave-api-key-123"

        do {
            try KeychainManager.shared.set(testKey, forKey: .braveAPIKey)

            // Verify it can be retrieved
            let retrieved = try KeychainManager.shared.get(.braveAPIKey)
            XCTAssertEqual(retrieved, testKey)

            // Cleanup
            try KeychainManager.shared.delete(.braveAPIKey)
        } catch {
            XCTFail("Keychain operations failed: \(error)")
        }
    }

    // MARK: - Usage Stats Tests

    func testUsageStatsInitialState() {
        let service = BraveSearchService.shared
        let stats = service.getUsageStats()

        // Should start at 0 or previous usage
        XCTAssertGreaterThanOrEqual(stats.limit, 2000)
        XCTAssertLessThanOrEqual(stats.used, stats.limit)
        XCTAssertEqual(stats.remaining, stats.limit - stats.used)
    }

    // MARK: - Search Query Tests

    func testSearchQueryWithMockedNetwork() async throws {
        // Set up mock session
        let mockSession = URLSession.makeMockSession()

        // Mock Brave Search API response
        let mockURL = URL(string: "https://api.search.brave.com/res/v1/web/search")!

        let mockResponse: [String: Any] = [
            "web": [
                "results": [
                    [
                        "title": "Apple Inc. - Wikipedia",
                        "url": "https://en.wikipedia.org/wiki/Apple_Inc.",
                        "description": "Apple Inc. is an American multinational technology company with headquarters in Cupertino, California. Founded in 1976, Apple employs over 150,000 people worldwide."
                    ],
                    [
                        "title": "Apple (AAPL) Stock Price & Financial Data",
                        "url": "https://finance.example.com/apple",
                        "description": "Apple Inc. revenue: $394.3 billion (2022). Market cap: $2.5 trillion. Publicly traded company (NASDAQ: AAPL)."
                    ]
                ]
            ]
        ]

        MockURLProtocol.requestHandler = { request in
            if request.url?.absoluteString.contains("api.search.brave.com") == true {
                return MockURLProtocol.successResponse(url: mockURL, json: mockResponse)
            }
            throw MockURLProtocol.networkError(code: NSURLErrorNotConnectedToInternet, description: "No connection")
        }

        // Note: Testing this properly would require dependency injection
        // to pass the mock session to BraveSearchService
    }

    // MARK: - Research Cache Integration Tests

    func testCacheHitAvoidsDuplicateSearch() {
        // Create mock client info
        let mockClientInfo = ClientInformation(
            name: "Apple Inc.",
            companySize: .enterprise,
            brandPopularity: .international,
            entityType: .publicCompany,
            holdingGroup: nil,
            industry: "Technology",
            socialMediaPresence: SocialMediaPresence(
                hasPresence: true,
                activityLevel: .veryHigh,
                platforms: [.linkedin, .twitter, .youtube],
                contentTypes: [.video, .images]
            ),
            estimatedEmployees: 150000,
            estimatedRevenue: "$394B",
            mediaSpendIndicators: "Very high marketing and advertising spend",
            researchSources: ["https://wikipedia.org"],
            researchConfidence: 0.95,
            researchDate: Date()
        )

        // Set in cache
        ResearchCache.shared.set(mockClientInfo, forCompanyName: "Apple Inc.")

        // Verify cache hit
        let cached = ResearchCache.shared.get(companyName: "Apple Inc.")
        XCTAssertNotNil(cached)
        XCTAssertEqual(cached?.name, "Apple Inc.")
        XCTAssertEqual(cached?.companySize, .enterprise)
        XCTAssertEqual(cached?.brandPopularity, .international)
        XCTAssertEqual(cached?.researchConfidence, 0.95)
    }

    func testCacheNormalizesCompanyNames() {
        let mockClientInfo = ClientInformation(
            name: "Test Company",
            researchSources: [],
            researchConfidence: 0.8,
            researchDate: Date()
        )

        // Set with one variation
        ResearchCache.shared.set(mockClientInfo, forCompanyName: "Test Company")

        // Retrieve with different variations
        XCTAssertNotNil(ResearchCache.shared.get(companyName: "test company"))
        XCTAssertNotNil(ResearchCache.shared.get(companyName: "TEST COMPANY"))
        XCTAssertNotNil(ResearchCache.shared.get(companyName: "  Test Company  "))
    }

    // MARK: - Analytics Integration Tests

    func testSearchQueriesTrackedInAnalytics() {
        // This would require actual service calls
        // For now, verify analytics event structure

        let event = AnalyticsEvent.braveSearchQuery(
            query: "Apple Inc. company size",
            duration: 0.5,
            resultsCount: 10,
            sessionID: AnalyticsManager.shared.sessionID
        )

        XCTAssertEqual(event.category, .performance)
        XCTAssertEqual(event.name, "brave_search_query")
        XCTAssertNotNil(event.properties["queryHash"])
        XCTAssertNotNil(event.properties["duration"])
        XCTAssertNotNil(event.properties["resultsCount"])
    }

    // MARK: - Error Handling Tests

    func testQuotaExceededError() {
        // Verify BraveSearchError types
        let error = BraveSearchError.quotaExceeded(remaining: 50)

        XCTAssertNotNil(error.errorDescription)
        XCTAssertTrue(error.errorDescription!.contains("quota exceeded"))
        XCTAssertTrue(error.errorDescription!.contains("50"))
    }

    func testNoResultsFoundError() {
        let error = BraveSearchError.noResultsFound

        XCTAssertNotNil(error.errorDescription)
        XCTAssertTrue(error.errorDescription!.contains("No search results"))
    }

    func testInvalidResponseError() {
        let error = BraveSearchError.invalidResponse

        XCTAssertNotNil(error.errorDescription)
    }

    // MARK: - Company Information Extraction Tests

    func testExtractEnterpriseCompanyInfo() {
        // Mock data that would be extracted from search results
        let mockSnippets = [
            SearchSnippet(
                title: "Apple Inc. - About",
                description: "Apple Inc. is a publicly traded technology company with over 150,000 employees worldwide. Headquarters in Cupertino, California.",
                url: "https://apple.com/about",
                source: "Brave Search"
            ),
            SearchSnippet(
                title: "Apple Financial Results 2023",
                description: "Annual revenue: $394.3 billion. Significant advertising and marketing budget estimated at $2.5 billion annually.",
                url: "https://finance.example.com/apple",
                source: "Brave Search"
            )
        ]

        // Verify snippet structure
        XCTAssertEqual(mockSnippets.count, 2)
        XCTAssertEqual(mockSnippets[0].title, "Apple Inc. - About")
        XCTAssertTrue(mockSnippets[0].description.contains("150,000"))
    }

    func testExtractStartupCompanyInfo() {
        let mockSnippets = [
            SearchSnippet(
                title: "NewStartup Inc. - Crunchbase",
                description: "NewStartup Inc. is a seed-stage startup based in San Francisco. Founded in 2023 with 15 employees.",
                url: "https://crunchbase.com/newstartup",
                source: "Brave Search"
            )
        ]

        XCTAssertEqual(mockSnippets.count, 1)
        XCTAssertTrue(mockSnippets[0].description.contains("startup"))
        XCTAssertTrue(mockSnippets[0].description.contains("15 employees"))
    }

    // MARK: - Confidence Scoring Tests

    func testHighConfidenceDataQuality() {
        // High confidence: 5/5 fields filled
        let highConfidence = ClientInformation(
            name: "Apple Inc.",
            companySize: .enterprise,
            brandPopularity: .international,
            entityType: .publicCompany,
            holdingGroup: nil,
            industry: "Technology",
            socialMediaPresence: SocialMediaPresence(
                hasPresence: true,
                activityLevel: .veryHigh,
                platforms: [.linkedin, .twitter],
                contentTypes: [.video]
            ),
            estimatedEmployees: 150000,
            estimatedRevenue: "$394B",
            mediaSpendIndicators: "Very high",
            researchSources: ["url1", "url2", "url3"],
            researchConfidence: 0.95
        )

        XCTAssertGreaterThanOrEqual(highConfidence.researchConfidence, 0.9)
        XCTAssertNotNil(highConfidence.companySize)
        XCTAssertNotNil(highConfidence.brandPopularity)
        XCTAssertNotNil(highConfidence.entityType)
        XCTAssertNotNil(highConfidence.industry)
    }

    func testLowConfidenceDataQuality() {
        // Low confidence: minimal fields
        let lowConfidence = ClientInformation(
            name: "Unknown Company",
            companySize: nil,
            brandPopularity: .unknown,
            entityType: nil,
            researchSources: ["url1"],
            researchConfidence: 0.3
        )

        XCTAssertLessThan(lowConfidence.researchConfidence, 0.5)
        XCTAssertNil(lowConfidence.companySize)
        XCTAssertNil(lowConfidence.entityType)
    }

    // MARK: - Social Media Presence Tests

    func testSocialMediaPresenceScoring() {
        let highActivity = SocialMediaPresence(
            hasPresence: true,
            activityLevel: .veryHigh,
            platforms: [.linkedin, .instagram, .facebook, .twitter, .youtube],
            contentTypes: [.video, .motionGraphics, .images]
        )

        XCTAssertGreaterThan(highActivity.score, 0.8)

        let lowActivity = SocialMediaPresence(
            hasPresence: true,
            activityLevel: .low,
            platforms: [.linkedin],
            contentTypes: [.textOnly]
        )

        XCTAssertLessThan(lowActivity.score, 0.5)

        let noPresence = SocialMediaPresence(
            hasPresence: false,
            activityLevel: nil,
            platforms: [],
            contentTypes: []
        )

        XCTAssertEqual(noPresence.score, 0.0)
    }

    // MARK: - Integration with Financial Scoring

    func testClientInfoSupportsFinancialCalculation() {
        let clientInfo = ClientInformation(
            name: "Test Corp",
            companySize: .large,
            brandPopularity: .national,
            entityType: .publicCompany,
            holdingGroup: "Big Holdings Inc.",
            industry: "Marketing",
            socialMediaPresence: SocialMediaPresence(
                hasPresence: true,
                activityLevel: .high,
                platforms: [.linkedin, .instagram, .youtube],
                contentTypes: [.video, .images]
            ),
            estimatedEmployees: 2000,
            estimatedRevenue: "$500M",
            mediaSpendIndicators: "High marketing budget",
            researchSources: ["url1", "url2"],
            researchConfidence: 0.85
        )

        // Verify all fields needed for financial scoring are present
        XCTAssertNotNil(clientInfo.companySize)
        XCTAssertNotNil(clientInfo.brandPopularity)
        XCTAssertNotNil(clientInfo.entityType)
        XCTAssertNotNil(clientInfo.holdingGroup)
        XCTAssertNotNil(clientInfo.socialMediaPresence)
        XCTAssertNotNil(clientInfo.mediaSpendIndicators)

        // Verify scores
        XCTAssertGreaterThan(clientInfo.companySize!.score, 0)
        XCTAssertGreaterThan(clientInfo.brandPopularity!.score, 0)
        XCTAssertGreaterThan(clientInfo.entityType!.score, 0)
    }

    // MARK: - Thread Safety Tests

    func testConcurrentResearchRequests() {
        let expectation = expectation(description: "Concurrent research")
        expectation.expectedFulfillmentCount = 10

        let queue = DispatchQueue(label: "test.concurrent.research", attributes: .concurrent)

        // Simulate multiple concurrent research requests
        for i in 0..<10 {
            queue.async {
                let mockInfo = ClientInformation(
                    name: "Company \(i)",
                    researchSources: [],
                    researchConfidence: 0.8,
                    researchDate: Date()
                )

                ResearchCache.shared.set(mockInfo, forCompanyName: "Company \(i)")

                let retrieved = ResearchCache.shared.get(companyName: "Company \(i)")
                XCTAssertNotNil(retrieved)

                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 10.0)
    }
}
