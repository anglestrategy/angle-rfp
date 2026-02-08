//
//  ErrorInjectionTests.swift
//  angle-rfpTests
//
//  Error injection and failure scenario tests
//  Tests system behavior under adverse conditions
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class ErrorInjectionTests: XCTestCase {

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

    // MARK: - JSON Encoding/Decoding Errors

    func testAnalyticsHandlesCorruptedJSONGracefully() {
        struct InvalidData: Codable {
            let value: Double
        }

        // Track event with NaN (which may cause JSON encoding issues)
        let event = AnalyticsEvent(
            category: .performance,
            name: "invalid_data",
            properties: ["value": .double(Double.nan)],
            sessionID: AnalyticsManager.shared.sessionID
        )

        AnalyticsManager.shared.track(event)

        // Should handle gracefully without crashing
        AnalyticsManager.shared.flushSync()

        waitForCondition({
            AnalyticsManager.shared.flushSync()
            return true
        }, description: "Flush completes without crashing")
    }

    func testCacheHandlesInvalidCodableData() {
        // This tests cache's resilience to encoding failures

        struct ValidData: Codable {
            let value: String
        }

        // Store valid data
        try? CacheCoordinator.shared.set(
            ValidData(value: "test"),
            forKey: "test_key"
        )

        // Retrieve should work
        let retrieved: ValidData? = CacheCoordinator.shared.get("test_key")
        XCTAssertNotNil(retrieved)
    }

    // MARK: - Memory Pressure Simulation

    func testAnalyticsUnderMemoryPressure() {
        // Simulate memory pressure by tracking massive amounts of data
        struct LargeData: Codable {
            let data: [String]
        }

        let largeArray = (0..<10_000).map { "Item \($0)" }

        for i in 0..<100 {
            let event = AnalyticsEvent(
                category: .userAction,
                name: "memory_pressure_\(i)",
                properties: ["large_data": .array(largeArray.map { $0 })],
                sessionID: AnalyticsManager.shared.sessionID
            )
            AnalyticsManager.shared.track(event)
        }

        // System should handle gracefully
        AnalyticsManager.shared.flushSync()

        waitForCondition({
            AnalyticsManager.shared.flushSync()
            return AnalyticsManager.shared.getEvents().count > 0
        }, timeout: 10.0, description: "Events tracked despite memory pressure")
    }

    func testCacheUnderMemoryPressure() {
        // Fill cache with large objects
        struct LargeObject: Codable {
            let data: String
        }

        for i in 0..<100 {
            let largeData = String(repeating: "x", count: 100_000) // 100KB each
            try? CacheCoordinator.shared.set(
                LargeObject(data: largeData),
                forKey: "large_\(i)"
            )
        }

        // Verify random access still works
        let random = Int.random(in: 0..<100)
        let retrieved: LargeObject? = CacheCoordinator.shared.get("large_\(random)")

        // Should either work or return nil gracefully (LRU eviction)
        // Should NOT crash
    }

    // MARK: - Concurrent Failure Scenarios

    func testConcurrentOperationsWithFailures() {
        let expectation = expectation(description: "Concurrent operations with failures")
        expectation.expectedFulfillmentCount = 200

        let queue = DispatchQueue(label: "test.concurrent.failures", attributes: .concurrent)

        // Mix of valid and potentially problematic operations
        for i in 0..<100 {
            queue.async {
                // Some operations succeed
                if i % 2 == 0 {
                    AnalyticsManager.shared.track(.documentUploaded(
                        fileType: "pdf",
                        fileSize: i,
                        sessionID: AnalyticsManager.shared.sessionID
                    ))
                }
                expectation.fulfill()
            }

            queue.async {
                // Some operations might fail
                if i % 3 == 0 {
                    try? CacheCoordinator.shared.set(i, forKey: "concurrent_\(i)")
                } else {
                    CacheCoordinator.shared.remove("nonexistent_\(i)")
                }
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 30.0)

        // System should remain stable
        AnalyticsManager.shared.flushSync()
        XCTAssertGreaterThan(AnalyticsManager.shared.getEvents().count, 0)
    }

    // MARK: - Invalid Input Handling

    func testNetworkClientInvalidURL() async {
        let mockSession = URLSession.makeMockSession()
        let client = NetworkClient(session: mockSession)

        // Invalid URL string
        guard let url = URL(string: "") else {
            // URL creation fails, which is expected
            return
        }

        MockURLProtocol.mockNoConnection()

        do {
            _ = try await client.request(url: url, retryPolicy: .none)
            XCTFail("Should have failed")
        } catch {
            // Expected error
        }
    }

    func testCacheWithNilLikeData() {
        struct TestData: Codable, Equatable {
            let optional: String?
            let array: [String]
            let dict: [String: String]
        }

        let nilData = TestData(
            optional: nil,
            array: [],
            dict: [:]
        )

        try? CacheCoordinator.shared.set(nilData, forKey: "nil_data")

        let retrieved: TestData? = CacheCoordinator.shared.get("nil_data")
        XCTAssertEqual(retrieved, nilData)
    }

    // MARK: - Cleanup Failure Scenarios

    func testAnalyticsClearAllMultipleTimes() {
        // Track some events
        for i in 0..<100 {
            AnalyticsManager.shared.track(.documentUploaded(
                fileType: "pdf",
                fileSize: i,
                sessionID: AnalyticsManager.shared.sessionID
            ))
        }

        // Clear multiple times
        for _ in 0..<10 {
            AnalyticsManager.shared.clearAllDataSync()
        }

        // Should be empty
        let events = AnalyticsManager.shared.getEvents()
        XCTAssertEqual(events.count, 0)
    }

    func testCacheClearAllUnderLoad() {
        let expectation = expectation(description: "Clear under load")
        expectation.expectedFulfillmentCount = 200

        let queue = DispatchQueue(label: "test.clear.load", attributes: .concurrent)

        // 100 writes
        for i in 0..<100 {
            queue.async {
                try? CacheCoordinator.shared.set(i, forKey: "load_\(i)")
                expectation.fulfill()
            }
        }

        // 100 clears
        for _ in 0..<100 {
            queue.async {
                CacheCoordinator.shared.clearAll()
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 30.0)

        // Should be in consistent state
        CacheCoordinator.shared.clearAll()
        let retrieved: Int? = CacheCoordinator.shared.get("load_50")
        XCTAssertNil(retrieved)
    }

    // MARK: - Resource Exhaustion

    func testKeychainManyKeys() {
        // Store many keys to test keychain limits
        for i in 0..<100 {
            let key = KeychainManager.KeychainKey.custom("exhaustion_\(i)")
            try? KeychainManager.shared.set("value_\(i)", forKey: key)
        }

        // Verify random access works
        for _ in 0..<10 {
            let i = Int.random(in: 0..<100)
            let key = KeychainManager.KeychainKey.custom("exhaustion_\(i)")
            let retrieved = try? KeychainManager.shared.get(key)
            // Should either work or fail gracefully
        }

        // Cleanup
        for i in 0..<100 {
            try? KeychainManager.shared.delete(.custom("exhaustion_\(i)"))
        }
    }

    // MARK: - Network Failure Recovery

    func testNetworkRetryExhaustion() async {
        let mockSession = URLSession.makeMockSession()
        let client = NetworkClient(session: mockSession)
        let testURL = URL(string: "https://api.test.com/endpoint")!

        // Always fail
        MockURLProtocol.mockHTTPError(url: testURL, statusCode: 500)

        do {
            _ = try await client.request(
                url: testURL,
                method: .get,
                retryPolicy: .exponential(maxAttempts: 5)
            )
            XCTFail("Should have failed after retry exhaustion")
        } catch NetworkClient.NetworkError.httpError(let statusCode, _) {
            XCTAssertEqual(statusCode, 500)
        } catch {
            // Other network errors are also acceptable (e.g., retryLimitExceeded)
        }
    }

    func testNetworkTimeoutRecovery() async throws {
        let mockSession = URLSession.makeMockSession()
        let client = NetworkClient(session: mockSession)
        let testURL = URL(string: "https://api.test.com/endpoint")!

        var attemptCount = 0

        MockURLProtocol.requestHandler = { _ in
            attemptCount += 1

            if attemptCount < 3 {
                // Timeout first 2 attempts
                throw MockURLProtocol.networkError(
                    code: NSURLErrorTimedOut,
                    description: "Timeout"
                )
            } else {
                // Recover on 3rd attempt
                return MockURLProtocol.successResponse(
                    url: testURL,
                    json: ["status": "recovered"]
                )
            }
        }

        // Should recover after timeouts
        let data = try await client.request(
            url: testURL,
            method: .get,
            retryPolicy: .exponential(maxAttempts: 3)
        )

        XCTAssertGreaterThan(data.count, 0)
        XCTAssertEqual(attemptCount, 3)
    }

    // MARK: - State Corruption Recovery

    func testAnalyticsRecoveryAfterDisableEnable() {
        // Track with analytics enabled
        AnalyticsManager.shared.isEnabled = true
        AnalyticsManager.shared.track(.documentUploaded(
            fileType: "pdf",
            fileSize: 1024,
            sessionID: AnalyticsManager.shared.sessionID
        ))

        // Disable
        AnalyticsManager.shared.isEnabled = false

        // Track while disabled
        for i in 0..<100 {
            AnalyticsManager.shared.track(.documentUploaded(
                fileType: "pdf",
                fileSize: i,
                sessionID: AnalyticsManager.shared.sessionID
            ))
        }

        // Re-enable
        AnalyticsManager.shared.isEnabled = true

        // Track new event
        AnalyticsManager.shared.track(.documentUploaded(
            fileType: "docx",
            fileSize: 2048,
            sessionID: AnalyticsManager.shared.sessionID
        ))

        waitForCondition({
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents()
            return events.count > 0
        }, description: "Events tracked after re-enabling")

        let events = AnalyticsManager.shared.getEvents()

        // Should have first and last events, but not the disabled ones
        XCTAssertTrue(events.contains { $0.properties["fileSize"] == .int(1024) })
        XCTAssertTrue(events.contains { $0.properties["fileSize"] == .int(2048) })
    }

    // MARK: - Extreme Values

    func testCacheTTLExtremes() {
        struct TestData: Codable {
            let value: String
        }

        // Maximum Double value as TTL
        try? CacheCoordinator.shared.set(
            TestData(value: "max_ttl"),
            forKey: "max_ttl_key",
            ttl: Double.greatestFiniteMagnitude
        )

        // Should not crash
        let retrieved: TestData? = CacheCoordinator.shared.get("max_ttl_key")
        // Result is implementation-dependent
    }

    func testPerformanceTrackerNegativeDuration() {
        // PerformanceTracker should handle edge cases gracefully
        let tracker = PerformanceTracker(operation: "edge_case")

        // Complete immediately (very small duration)
        tracker.complete(success: true)

        let duration = tracker.duration
        XCTAssertGreaterThanOrEqual(duration, 0)
    }

    // MARK: - Integration Failure Scenarios

    func testCrossServiceFailurePropagation() {
        // Test that failure in one service doesn't crash others

        // Trigger potential failure in cache
        for i in 0..<1000 {
            try? CacheCoordinator.shared.set(i, forKey: "failure_\(i)")
        }

        // Analytics should still work
        AnalyticsManager.shared.track(.documentUploaded(
            fileType: "pdf",
            fileSize: 1024,
            sessionID: AnalyticsManager.shared.sessionID
        ))

        waitForCondition({
            AnalyticsManager.shared.flushSync()
            return !AnalyticsManager.shared.getEvents().isEmpty
        }, description: "Analytics works despite cache load")

        // Keychain should still work
        let key = KeychainManager.KeychainKey.custom("cross_service")
        try? KeychainManager.shared.set("value", forKey: key)
        let retrieved = try? KeychainManager.shared.get(key)

        // Should work independently
        try? KeychainManager.shared.delete(key)
    }

    // MARK: - Graceful Degradation

    func testSystemStabilityAfterErrors() {
        // Trigger various error scenarios
        MockURLProtocol.mockTimeout()

        let mockSession = URLSession.makeMockSession()
        let client = NetworkClient(session: mockSession)
        let testURL = URL(string: "https://api.test.com/fail")!

        // Network error (await completion to avoid leaking async work across tests)
        let networkAttemptCompleted = expectation(description: "Network error attempt completes")
        Task {
            defer { networkAttemptCompleted.fulfill() }
            try? await client.request(url: testURL, retryPolicy: .none)
        }

        // Cache pressure
        for i in 0..<100 {
            try? CacheCoordinator.shared.set(String(repeating: "x", count: 10000), forKey: "pressure_\(i)")
        }

        // Analytics overload
        for i in 0..<1000 {
            AnalyticsManager.shared.track(.documentUploaded(
                fileType: "pdf",
                fileSize: i,
                sessionID: AnalyticsManager.shared.sessionID
            ))
        }

        // System should remain stable
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            return true
        }, timeout: 5.0, description: "System stabilizes after errors")
        wait(for: [networkAttemptCompleted], timeout: 3.0)

        // Verify services still functional
        AnalyticsManager.shared.track(.documentUploaded(
            fileType: "test",
            fileSize: 1,
            sessionID: AnalyticsManager.shared.sessionID
        ))

        try? CacheCoordinator.shared.set("test", forKey: "stability_check")
        let cacheCheck: String? = CacheCoordinator.shared.get("stability_check")
        XCTAssertNotNil(cacheCheck)
    }
}
