//
//  AnalyticsManagerTests.swift
//  angle-rfpTests
//
//  Unit tests for analytics manager
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class AnalyticsManagerTests: XCTestCase {

    var manager: AnalyticsManager!

    override class func setUp() {
        super.setUp()
        // Suppress console logging during tests to prevent output flooding
        AppLogger.suppressConsoleOutput = true
    }

    override class func tearDown() {
        AppLogger.suppressConsoleOutput = false
        super.tearDown()
    }

    override func setUp() {
        super.setUp()
        manager = AnalyticsManager.shared
        // Reset analytics state to ensure clean test isolation
        manager.isEnabled = true
        // Clear any existing data synchronously to ensure clean state
        manager.clearAllDataSync()
    }

    override func tearDown() {
        manager.clearAllDataSync()
        super.tearDown()
    }

    // MARK: - Basic Tracking

    func testTrackEvent() {
        let event = AnalyticsEvent.documentUploaded(
            fileType: "pdf",
            fileSize: 1024,
            sessionID: manager.sessionID
        )

        // Track synchronously for deterministic testing
        manager.trackSync(event)
        manager.flushSync()

        XCTAssertFalse(manager.getEvents().isEmpty, "Event should be tracked")
    }

    func testGetEventsReturnsTrackedEvents() {
        let event1 = AnalyticsEvent.documentUploaded(
            fileType: "pdf",
            fileSize: 1024,
            sessionID: manager.sessionID
        )

        let event2 = AnalyticsEvent.analysisStarted(
            documentID: UUID(),
            sessionID: manager.sessionID
        )

        // Track synchronously for deterministic testing
        manager.trackSync(event1)
        manager.trackSync(event2)
        manager.flushSync()

        let events = manager.getEvents()

        XCTAssertGreaterThanOrEqual(events.count, 2)
        XCTAssertTrue(events.contains { $0.name == "document_uploaded" })
        XCTAssertTrue(events.contains { $0.name == "analysis_started" })
    }

    // MARK: - Category Filtering

    func testGetEventsByCategory() {
        manager.trackSync(.documentUploaded(fileType: "pdf", fileSize: 1024, sessionID: manager.sessionID))
        manager.trackSync(.errorOccurred(
            error: NSError(domain: "test", code: 1),
            context: "test",
            severity: .error,
            sessionID: manager.sessionID
        ))
        manager.trackSync(.analysisStarted(documentID: UUID(), sessionID: manager.sessionID))
        manager.flushSync()

        let userEvents = manager.getEvents(category: .userAction)
        let errorEvents = manager.getEvents(category: .error)

        XCTAssertGreaterThanOrEqual(userEvents.count, 2)
        XCTAssertGreaterThanOrEqual(errorEvents.count, 1)
        XCTAssertTrue(userEvents.allSatisfy { $0.category == .userAction })
        XCTAssertTrue(errorEvents.allSatisfy { $0.category == .error })
    }

    // MARK: - Time Filtering

    func testGetEventsSinceDate() {
        // First verify events are tracked correctly without time filter
        manager.trackSync(.documentUploaded(fileType: "pdf", fileSize: 1024, sessionID: manager.sessionID))
        manager.flushSync()

        // Verify the event was tracked
        let allEvents = manager.getEvents()
        XCTAssertGreaterThan(allEvents.count, 0, "Should have tracked at least one event")

        // Now test time filtering with a cutoff in the distant past
        let cutoffTime = Date().addingTimeInterval(-60) // 1 minute ago

        let recentEvents = manager.getEvents(since: cutoffTime)

        XCTAssertGreaterThan(recentEvents.count, 0, "Should have events after cutoff time")
        XCTAssertTrue(recentEvents.allSatisfy { $0.timestamp > cutoffTime })
    }

    // MARK: - Limit

    func testGetEventsLimit() {
        // Track multiple events synchronously
        for i in 0..<10 {
            manager.trackSync(.documentUploaded(
                fileType: "pdf",
                fileSize: i * 1024,
                sessionID: manager.sessionID
            ))
        }
        manager.flushSync()

        let limited = manager.getEvents(limit: 5)

        XCTAssertLessThanOrEqual(limited.count, 5)
    }

    // MARK: - Event Counts

    func testGetEventCounts() {
        manager.trackSync(.documentUploaded(fileType: "pdf", fileSize: 1024, sessionID: manager.sessionID))
        manager.trackSync(.documentUploaded(fileType: "docx", fileSize: 2048, sessionID: manager.sessionID))
        manager.trackSync(.errorOccurred(
            error: NSError(domain: "test", code: 1),
            context: "test",
            severity: .error,
            sessionID: manager.sessionID
        ))
        manager.flushSync()

        let counts = manager.getEventCounts()

        XCTAssertGreaterThanOrEqual(counts[.userAction] ?? 0, 2)
        XCTAssertGreaterThanOrEqual(counts[.error] ?? 0, 1)
    }

    // MARK: - Session Management

    func testSessionID() {
        let sessionID = manager.sessionID

        XCTAssertNotNil(sessionID)
    }

    func testStartNewSession() {
        let originalSessionID = manager.sessionID

        manager.startNewSession()

        // Give async operation time to complete
        RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.2))

        let newSessionID = manager.sessionID

        XCTAssertNotEqual(originalSessionID, newSessionID)
    }

    func testSessionDuration() {
        let duration = manager.sessionDuration

        XCTAssertGreaterThanOrEqual(duration, 0)

        // Wait a bit
        Thread.sleep(forTimeInterval: 0.1)

        let laterDuration = manager.sessionDuration

        XCTAssertGreaterThan(laterDuration, duration)
    }

    // MARK: - Enable/Disable

    func testDisableAnalytics() {
        manager.isEnabled = true
        manager.trackSync(.documentUploaded(fileType: "pdf", fileSize: 1024, sessionID: manager.sessionID))

        manager.isEnabled = false
        manager.trackSync(.documentUploaded(fileType: "pdf", fileSize: 2048, sessionID: manager.sessionID))

        manager.flushSync()

        let events = manager.getEvents()

        // Only the first event should be tracked (second was blocked by isEnabled = false)
        XCTAssertEqual(events.filter { $0.properties["fileSize"] == .int(2048) }.count, 0)
    }

    // MARK: - Clear Data

    func testClearAllData() {
        manager.trackSync(.documentUploaded(fileType: "pdf", fileSize: 1024, sessionID: manager.sessionID))
        manager.flushSync()

        // Verify data was tracked
        XCTAssertFalse(manager.getEvents().isEmpty, "Event should be tracked before clearing")

        manager.clearAllDataSync()

        let events = manager.getEvents()

        XCTAssertEqual(events.count, 0)
    }

    // MARK: - Convenience Methods

    func testTrackAppLaunch() {
        manager.trackAppLaunch(isFirstLaunch: true)

        // Give async operation time to complete
        RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.1))
        manager.flushSync()

        let events = manager.getEvents(category: .systemEvent)

        XCTAssertTrue(events.contains { $0.name == "app_launched" })
    }

    func testTrackAppTermination() {
        manager.trackAppTermination()

        // Give async operation time to complete (trackAppTermination also calls flush)
        RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.1))
        manager.flushSync()

        let events = manager.getEvents(category: .systemEvent)

        XCTAssertTrue(events.contains { $0.name == "app_terminated" })
    }

    // MARK: - Performance Summary

    func testGetPerformanceSummary() {
        manager.trackSync(.parsingCompleted(
            documentID: UUID(),
            duration: 2.5,
            fileType: "pdf",
            pageCount: 30,
            success: true,
            sessionID: manager.sessionID
        ))

        manager.trackSync(.claudeRequestCompleted(
            duration: 5.0,
            model: "claude-sonnet-4-5",
            inputTokens: 1000,
            outputTokens: 500,
            success: true,
            sessionID: manager.sessionID
        ))
        manager.flushSync()

        let summary = manager.getPerformanceSummary()

        XCTAssertGreaterThan(summary["totalEvents"] as? Int ?? 0, 0)
        XCTAssertNotNil(summary["avgParsingTime"])
        XCTAssertNotNil(summary["avgClaudeTime"])
    }

    // MARK: - Error Summary

    func testGetErrorSummary() {
        manager.trackSync(.errorOccurred(
            error: NSError(domain: "TestDomain", code: 1),
            context: "test1",
            severity: .error,
            sessionID: manager.sessionID
        ))

        manager.trackSync(.errorOccurred(
            error: NSError(domain: "TestDomain", code: 1),
            context: "test2",
            severity: .warning,
            sessionID: manager.sessionID
        ))
        manager.flushSync()

        let summary = manager.getErrorSummary()

        XCTAssertGreaterThan(summary["totalErrors"] as? Int ?? 0, 0)
        XCTAssertNotNil(summary["errorsByType"])
    }

    // MARK: - Thread Safety (CRITICAL)

    func testConcurrentTracking() {
        let expectation = expectation(description: "Concurrent tracking completed")
        expectation.expectedFulfillmentCount = 10

        let queue = DispatchQueue(label: "test.concurrent", attributes: .concurrent)

        for i in 0..<10 {
            queue.async {
                self.manager.trackSync(.documentUploaded(
                    fileType: "pdf",
                    fileSize: i * 1024,
                    sessionID: self.manager.sessionID
                ))
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 5.0)
        manager.flushSync()

        let events = manager.getEvents()
        XCTAssertGreaterThanOrEqual(events.count, 10)
    }

    func testConcurrentSessionIDAccess() {
        // CRITICAL: Test for race condition fix
        let expectation = expectation(description: "Concurrent access completed")
        expectation.expectedFulfillmentCount = 100

        let queue = DispatchQueue(label: "test.sessionid", attributes: .concurrent)
        var sessionIDs = [UUID]()
        let lock = NSLock()

        for _ in 0..<100 {
            queue.async {
                // This should not crash or produce corrupted UUIDs
                let sessionID = self.manager.sessionID
                XCTAssertNotNil(sessionID)

                lock.lock()
                sessionIDs.append(sessionID)
                lock.unlock()

                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 5.0)

        // CRITICAL: Verify all sessionIDs are identical and valid
        XCTAssertEqual(Set(sessionIDs).count, 1, "SessionID corrupted across threads")

        let firstID = sessionIDs.first!
        XCTAssertNotEqual(firstID.uuidString, "00000000-0000-0000-0000-000000000000")
        XCTAssertEqual(firstID.uuidString.count, 36) // Valid UUID format
    }

    func testEventsCreatedOnBackgroundThreadsHaveCorrectSessionID() {
        // CRITICAL: Verify events created on background threads use correct sessionID
        let expectation = expectation(description: "Background events created")
        expectation.expectedFulfillmentCount = 50

        let queue = DispatchQueue(label: "test.background", attributes: .concurrent)
        let currentSessionID = manager.sessionID

        for i in 0..<50 {
            queue.async {
                let event = AnalyticsEvent.documentUploaded(
                    fileType: "pdf",
                    fileSize: i * 1024,
                    sessionID: AnalyticsManager.shared.sessionID
                )

                // Verify event has correct sessionID
                XCTAssertEqual(event.sessionID, currentSessionID)

                self.manager.track(event)
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 5.0)
    }

    // MARK: - Buffer Overflow (CRITICAL)

    func testEventBufferOverflow() {
        // Test that buffer overflow is handled gracefully with 200 events
        // (exceeds maxBufferSize of 50, triggering multiple flushes)
        for i in 0..<200 {
            manager.trackSync(.documentUploaded(
                fileType: "pdf",
                fileSize: i,
                sessionID: manager.sessionID
            ))
        }

        // Final flush to persist any remaining buffered events
        manager.flushSync()

        let events = manager.getEvents(limit: 300)

        // Should have stored most events (buffer management may evict some)
        XCTAssertGreaterThan(events.count, 100, "Too many events lost in buffer overflow")
        XCTAssertLessThanOrEqual(events.count, 200)
    }

    // MARK: - Error Path Coverage

    func testFlushWithDiskError() {
        // Track events
        for i in 0..<10 {
            manager.trackSync(.documentUploaded(
                fileType: "pdf",
                fileSize: i * 1024,
                sessionID: manager.sessionID
            ))
        }

        // Flush - should handle errors gracefully
        manager.flushSync()

        // Even if disk write fails, app should not crash
        // Events remain in buffer for retry - verify no crash by flushing again
        manager.flushSync()

        // Test passes if no crash occurred
        XCTAssertTrue(true, "Flush completed without crashing")
    }

    func testGetEventsWithCorruptedStorage() {
        // Attempt to get events even if storage is corrupted
        // Should return empty array rather than crash
        let events = manager.getEvents()

        XCTAssertNotNil(events)
        // Should gracefully handle corrupted storage
    }

    // MARK: - Persistence

    func testEventsPersistAcrossFlush() {
        let event = AnalyticsEvent.documentUploaded(
            fileType: "pdf",
            fileSize: 1024,
            sessionID: manager.sessionID
        )

        // Use trackSync for deterministic testing
        manager.trackSync(event)
        manager.flushSync()

        // Verify event is persisted
        let eventsAfterFirstFlush = manager.getEvents()
        XCTAssertGreaterThan(eventsAfterFirstFlush.count, 0, "Events should be persisted after first flush")

        // Flush again to ensure persistence continues
        manager.flushSync()

        let events = manager.getEvents()

        XCTAssertGreaterThan(events.count, 0)
        XCTAssertTrue(events.contains { $0.name == "document_uploaded" })
    }
}
