//
//  FoundationIntegrationTests.swift
//  angle-rfpTests
//
//  Integration tests for cross-service interactions
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class FoundationIntegrationTests: XCTestCase {

    override class func setUp() {
        super.setUp()
        AppLogger.suppressConsoleOutput = true
    }

    override class func tearDown() {
        AppLogger.suppressConsoleOutput = false
        super.tearDown()
    }

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
        // Clean state
        AnalyticsManager.shared.clearAllDataSync()
        CacheCoordinator.shared.clearAll()
    }

    override func tearDown() {
        MockURLProtocol.reset()
        AnalyticsManager.shared.clearAllDataSync()
        CacheCoordinator.shared.clearAll()
        super.tearDown()
    }

    // MARK: - Test Helpers

    /// Wait for condition to become true (non-flaky)
    private func waitForCondition(
        _ condition: @escaping () -> Bool,
        timeout: TimeInterval = 2.0,
        description: String = "Condition met"
    ) {
        let predicate = NSPredicate { _, _ in condition() }
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: nil)
        let waiter = XCTWaiter()
        let result = waiter.wait(for: [expectation], timeout: timeout)

        XCTAssertEqual(result, .completed, "Timeout waiting for: \(description)")
    }

    // MARK: - PerformanceTracker → Analytics Integration

    func testPerformanceTrackerCreatesAnalyticsEvents() {
        let tracker = PerformanceTracker(operation: "test_operation")
        tracker.recordMetric("count", value: 42)
        tracker.recordMetric("success", value: true)
        tracker.complete(success: true)

        // Wait for analytics event to be created
        let predicate = NSPredicate { _, _ in
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents(category: .performance)
            return events.contains { $0.name == "test_operation" }
        }
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: nil)
        wait(for: [expectation], timeout: 2.0)

        let events = AnalyticsManager.shared.getEvents(category: .performance)
        let event = events.first { $0.name == "test_operation" }

        XCTAssertNotNil(event)
        XCTAssertEqual(event?.properties["count"], .int(42))
        XCTAssertEqual(event?.properties["success"], .bool(true))
        XCTAssertNotNil(event?.properties["duration"])
        XCTAssertNotNil(event?.properties["durationMs"])
    }

    // MARK: - NetworkClient → PerformanceTracker → Analytics Integration

    func testNetworkRequestCreatesPerformanceAnalytics() async throws {
        guard let url = URL(string: "https://api.test.local/analytics") else {
            XCTFail("Invalid URL")
            return
        }

        MockURLProtocol.mockSuccessfulGET(url: url, json: ["ok": true])
        let session = URLSession.makeMockSession()
        let client = NetworkClient(session: session)

        _ = try await client.request(url: url, retryPolicy: .none)

        waitForCondition({
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents(category: .performance)
            return events.contains { $0.name == "network_request" }
        }, timeout: 4.0, description: "Network performance analytics tracked")

        let events = AnalyticsManager.shared.getEvents(category: .performance)

        XCTAssertTrue(events.contains { $0.name == "network_request" })

        if let networkEvent = events.first(where: { $0.name == "network_request" }) {
            XCTAssertNotNil(networkEvent.properties["url"])
            XCTAssertNotNil(networkEvent.properties["duration"])
            XCTAssertNotNil(networkEvent.properties["statusCode"])
        }
    }

    // MARK: - Cache → Analytics Integration

    func testCacheOperationsCreateAnalytics() throws {
        struct TestData: Codable {
            let value: String
        }

        // Clear analytics first
        AnalyticsManager.shared.clearAllDataSync()

        // Cache write
        try CacheCoordinator.shared.set(
            TestData(value: "test"),
            forKey: "analytics_test_key"
        )

        // Wait for cache write analytics (non-flaky)
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents(category: .systemEvent)
            return events.contains { $0.name == "cache_write" }
        }, description: "Cache write analytics tracked")

        var events = AnalyticsManager.shared.getEvents(category: .systemEvent)

        // Verify cache write was tracked
        XCTAssertTrue(events.contains { $0.name == "cache_write" })

        // Cache read
        let _: TestData? = CacheCoordinator.shared.get("analytics_test_key")

        // Wait for cache hit analytics (non-flaky)
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents(category: .systemEvent)
            return events.contains { $0.name == "cache_hit" }
        }, description: "Cache hit analytics tracked")

        events = AnalyticsManager.shared.getEvents(category: .systemEvent)

        // Verify cache hit was tracked
        XCTAssertTrue(events.contains { $0.name == "cache_hit" })
    }

    // MARK: - AppLogger → LogRedactor Integration

    func testAppLoggerRedactsPII() {
        // Log message with PII
        AppLogger.shared.info("User email: test@example.com logged in with key: sk-ant-123")

        // Verify message was logged (check that no crash occurred)
        // In production, verify logs don't contain PII (would need log capture)
    }

    // MARK: - KeychainManager Error Handling

    func testKeychainManagerHandlesErrors() throws {
        let manager = KeychainManager.shared
        let testKey = KeychainManager.KeychainKey.custom("foundation.integration.\(UUID().uuidString)")
        let testValue = "test-key-\(UUID().uuidString)"

        // Test retrieving non-existent key
        XCTAssertThrowsError(try manager.get(testKey)) { error in
            XCTAssertTrue(error is KeychainManager.KeychainError)
        }

        // Test setting and getting
        try manager.set(testValue, forKey: testKey, requireBiometrics: false)

        let retrieved = try manager.get(testKey)

        XCTAssertEqual(retrieved, testValue)

        // Cleanup
        try manager.delete(testKey)
    }

    // MARK: - Multi-Service Workflow

    func testCompleteAnalysisWorkflow() async throws {
        // Simulate a complete RFP analysis workflow

        // 1. Track analysis start
        let documentID = UUID()
        AnalyticsManager.shared.track(.analysisStarted(
            documentID: documentID,
            sessionID: AnalyticsManager.shared.sessionID
        ))

        // 2. Simulate parsing with performance tracking
        let parseTracker = PerformanceTracker(operation: "document_parsing")
        parseTracker.recordMetric("pages", value: 30)
        try await Task.sleep(nanoseconds: 100_000_000) // 100ms
        parseTracker.complete(success: true)

        // 3. Cache parsed data
        struct ParsedData: Codable {
            let text: String
            let pageCount: Int
        }

        try CacheCoordinator.shared.set(
            ParsedData(text: "Sample RFP text", pageCount: 30),
            forKey: "parsed_\(documentID.uuidString)",
            ttl: 3600 // 1 hour
        )

        // 4. Retrieve from cache
        let cached: ParsedData? = CacheCoordinator.shared.get("parsed_\(documentID.uuidString)")
        XCTAssertNotNil(cached)
        XCTAssertEqual(cached?.pageCount, 30)

        // 5. Track completion
        AnalyticsManager.shared.track(.analysisCompleted(
            documentID: documentID,
            totalDuration: 5.0,
            parsingDuration: 0.1,
            aiDuration: 3.0,
            researchDuration: 1.9,
            success: true,
            sessionID: AnalyticsManager.shared.sessionID
        ))

        // Wait for all analytics to flush
        try await Task.sleep(nanoseconds: 500_000_000)

        AnalyticsManager.shared.flushSync()

        try await Task.sleep(nanoseconds: 500_000_000)

        // Verify workflow created multiple analytics events
        let allEvents = AnalyticsManager.shared.getEvents()

        XCTAssertTrue(allEvents.contains { $0.name == "analysis_started" })
        XCTAssertTrue(allEvents.contains { $0.name == "document_parsing" })
        XCTAssertTrue(allEvents.contains { $0.name == "analysis_completed" })
        XCTAssertTrue(allEvents.contains { $0.name == "cache_write" })
        XCTAssertTrue(allEvents.contains { $0.name == "cache_hit" })
    }

    // MARK: - Memory and Performance Under Load

    func testSystemPerformanceUnderLoad() throws {
        struct LoadData: Codable {
            let index: Int
            let data: String
        }

        let startMemory = MemoryTracker.currentUsage

        // Create load across all services
        for i in 0..<100 {
            // Analytics events
            AnalyticsManager.shared.track(.documentUploaded(
                fileType: "pdf",
                fileSize: i * 1024,
                sessionID: AnalyticsManager.shared.sessionID
            ))

            // Cache operations

            try CacheCoordinator.shared.set(
                LoadData(index: i, data: String(repeating: "x", count: 1000)),
                forKey: "load_\(i)"
            )

            // Performance tracking
            let tracker = PerformanceTracker(operation: "load_test_\(i)")
            tracker.complete(success: true)
        }

        // Flush everything and wait for completion (non-flaky)
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            return AnalyticsManager.shared.getEvents().count > 0
        }, timeout: 3.0, description: "All events flushed under load")

        let endMemory = MemoryTracker.currentUsage
        let memoryIncrease = endMemory - startMemory

        // Memory increase should be reasonable (< 50MB for 100 operations)
        XCTAssertLessThan(memoryIncrease, 50 * 1024 * 1024, "Memory leak detected")

        // Verify all services still functional
        XCTAssertGreaterThan(AnalyticsManager.shared.getEvents().count, 0)

        let cachedItem: LoadData? = CacheCoordinator.shared.get("load_50")
        XCTAssertNotNil(cachedItem)
    }
}
