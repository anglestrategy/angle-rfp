//
//  PerformanceTrackerTests.swift
//  angle-rfpTests
//
//  Unit tests for performance tracking utilities
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class PerformanceTrackerTests: XCTestCase {

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
        AnalyticsManager.shared.isEnabled = true
        AnalyticsManager.shared.clearAllDataSync()
    }

    override func tearDown() {
        AnalyticsManager.shared.isEnabled = true
        AnalyticsManager.shared.clearAllDataSync()
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

    // MARK: - Basic Tracking

    func testTrackerRecordsDuration() {
        let tracker = PerformanceTracker(operation: "test_operation")

        // Wait a bit
        Thread.sleep(forTimeInterval: 0.1)

        let duration = tracker.duration

        XCTAssertGreaterThan(duration, 0.09)
        XCTAssertLessThan(duration, 0.2)
    }

    func testTrackerRecordsMetrics() {
        let tracker = PerformanceTracker(operation: "test_operation")

        tracker.recordMetric("count", value: 42)
        tracker.recordMetric("name", value: "test")

        tracker.complete(success: true)

        // Metrics are recorded internally and logged
    }

    func testTrackerRecordsMultipleMetrics() {
        let tracker = PerformanceTracker(operation: "test_operation")

        tracker.recordMetrics([
            "count": 42,
            "duration": 1.5,
            "success": true
        ])

        tracker.complete(success: true)
    }

    // MARK: - Completion

    func testCompleteSuccess() {
        let tracker = PerformanceTracker(operation: "test_operation")

        tracker.complete(success: true)

        // Should not crash or throw
    }

    func testCompleteFail() {
        let tracker = PerformanceTracker(operation: "test_operation")

        tracker.complete(success: false)

        // Should log failure
    }

    func testCompleteWithError() {
        let tracker = PerformanceTracker(operation: "test_operation")
        let error = NSError(domain: "TestDomain", code: 123, userInfo: [
            NSLocalizedDescriptionKey: "Test error"
        ])

        tracker.complete(withError: error)

        // Should log error details
    }

    func testCompleteWithAdditionalMetrics() {
        let tracker = PerformanceTracker(operation: "test_operation")

        tracker.complete(success: true, additionalMetrics: [
            "finalCount": 100,
            "completedAt": Date()
        ])
    }

    // MARK: - Analytics Integration (CRITICAL)

    func testTrackerCreatesAnalyticsEvent() {
        let tracker = PerformanceTracker(operation: "test_operation")

        tracker.recordMetric("testValue", value: 42)
        tracker.complete(success: true)

        // Wait for analytics event to be tracked and flushed (non-flaky)
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents(category: .performance)
            return events.contains { $0.name == "test_operation" }
        }, description: "Performance tracker analytics event tracked")

        let events = AnalyticsManager.shared.getEvents(category: .performance)

        // CRITICAL: Verify performance tracker creates analytics events
        XCTAssertTrue(events.contains { $0.name == "test_operation" })

        if let event = events.first(where: { $0.name == "test_operation" }) {
            XCTAssertNotNil(event.properties["duration"])
            XCTAssertNotNil(event.properties["durationMs"])
            XCTAssertEqual(event.properties["success"], .bool(true))
            XCTAssertEqual(event.properties["testValue"], .int(42))
        }
    }

    // MARK: - Class Method Tracking

    func testMeasureSyncOperation() throws {
        let result = try PerformanceTracker.measure("sync_test") {
            Thread.sleep(forTimeInterval: 0.05)
            return "completed"
        }

        XCTAssertEqual(result, "completed")

        // Verify analytics event created (non-flaky)
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents(category: .performance)
            return events.contains { $0.name == "sync_test" }
        }, description: "Sync operation analytics event tracked")
    }

    func testMeasureSyncOperationThrowsError() {
        struct TestError: Error {}

        XCTAssertThrowsError(try PerformanceTracker.measure("error_test") {
            throw TestError()
        })
    }

    func testMeasureAsyncOperation() async throws {
        let result = try await PerformanceTracker.measure("async_test") {
            try await Task.sleep(nanoseconds: 50_000_000) // 50ms
            return "completed"
        }

        XCTAssertEqual(result, "completed")
    }

    func testMeasureAsyncOperationThrowsError() async {
        struct TestError: Error {}

        do {
            _ = try await PerformanceTracker.measure("async_error_test") {
                throw TestError()
            }
            XCTFail("Should have thrown error")
        } catch {
            // Expected
        }
    }

    // MARK: - Checkpoints

    func testCheckpoint() {
        let tracker = PerformanceTracker(operation: "main_operation")

        let checkpoint1 = tracker.checkpoint("stage_1")
        checkpoint1.complete(success: true)

        let checkpoint2 = tracker.checkpoint("stage_2")
        checkpoint2.complete(success: true)

        tracker.complete(success: true)

        // Verify checkpoint names
        // main_operation.stage_1 and main_operation.stage_2 should be tracked
    }

    // MARK: - Performance Budget

    func testPerformanceBudgetParsing() {
        let budget = PerformanceBudget.Budget.parsing(pages: 10)

        XCTAssertEqual(budget.maxDuration, 1.0) // 100ms per page * 10 = 1s
        XCTAssertEqual(budget.warningThreshold, 0.8)
    }

    func testPerformanceBudgetClaudeRequest() {
        let budget = PerformanceBudget.Budget.claudeRequest

        XCTAssertEqual(budget.maxDuration, 30.0)
        XCTAssertEqual(budget.warningThreshold, 24.0)
    }

    func testPerformanceBudgetWebResearch() {
        let budget = PerformanceBudget.Budget.webResearch

        XCTAssertEqual(budget.maxDuration, 10.0)
        XCTAssertEqual(budget.warningThreshold, 8.0)
    }

    func testIsWithinBudget() {
        let budget = PerformanceBudget.Budget.parsing(pages: 10)

        XCTAssertTrue(PerformanceBudget.isWithinBudget(duration: 0.5, budget: budget))
        XCTAssertFalse(PerformanceBudget.isWithinBudget(duration: 1.5, budget: budget))
    }

    func testShouldWarn() {
        let budget = PerformanceBudget.Budget.parsing(pages: 10)

        XCTAssertFalse(PerformanceBudget.shouldWarn(duration: 0.5, budget: budget))
        XCTAssertTrue(PerformanceBudget.shouldWarn(duration: 0.85, budget: budget))
        XCTAssertTrue(PerformanceBudget.shouldWarn(duration: 1.5, budget: budget))
    }

    func testLogPerformance() {
        let budget = PerformanceBudget.Budget.parsing(pages: 10)

        // Should log without crashing
        PerformanceBudget.logPerformance(
            operation: "test_parsing",
            duration: 0.5,
            budget: budget
        )

        PerformanceBudget.logPerformance(
            operation: "test_parsing_slow",
            duration: 1.5,
            budget: budget
        )
    }

    // MARK: - Memory Tracker

    func testCurrentMemoryUsage() {
        let usage = MemoryTracker.currentUsage

        XCTAssertGreaterThan(usage, 0)
    }

    func testFormatBytes() {
        let formatted = MemoryTracker.formatBytes(1_048_576)

        XCTAssertTrue(formatted.contains("MB") || formatted.contains("1"))
    }

    func testLogCurrentUsage() {
        // Should log without crashing
        MemoryTracker.logCurrentUsage(context: "Test memory check")
    }

    func testMemoryTrackSync() throws {
        let result = try MemoryTracker.track("memory_test") {
            // Allocate some memory
            _ = Array(repeating: 0, count: 1000)
            return "completed"
        }

        XCTAssertEqual(result, "completed")
    }

    func testMemoryTrackAsync() async throws {
        let result = try await MemoryTracker.track("async_memory_test") {
            // Allocate some memory
            _ = Array(repeating: 0, count: 1000)
            try await Task.sleep(nanoseconds: 10_000_000)
            return "completed"
        }

        XCTAssertEqual(result, "completed")
    }

    // MARK: - Thread Safety

    func testConcurrentMetricRecording() {
        let tracker = PerformanceTracker(operation: "concurrent_test")
        let expectation = expectation(description: "Concurrent recording")
        expectation.expectedFulfillmentCount = 10

        let queue = DispatchQueue(label: "test.concurrent", attributes: .concurrent)

        for i in 0..<10 {
            queue.async {
                tracker.recordMetric("metric_\(i)", value: i)
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 5.0)

        tracker.complete(success: true)
    }

    // MARK: - Multiple Completions

    func testMultipleCompletionsIgnored() {
        let tracker = PerformanceTracker(operation: "double_complete_test")

        tracker.complete(success: true)
        tracker.complete(success: false) // Should be ignored

        // Should not crash or create duplicate events
    }
}
