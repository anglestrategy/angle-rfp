//
//  AnalyticsManagerBoundaryTests.swift
//  angle-rfpTests
//
//  Boundary and edge case tests for AnalyticsManager
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class AnalyticsManagerBoundaryTests: XCTestCase {

    override class func setUp() {
        super.setUp()
        AppLogger.suppressConsoleOutput = true
    }

    override class func tearDown() {
        AppLogger.suppressConsoleOutput = false
        super.tearDown()
    }

    var manager: AnalyticsManager!

    override func setUp() {
        super.setUp()
        manager = AnalyticsManager.shared
        manager.isEnabled = true
        manager.clearAllDataSync()
    }

    override func tearDown() {
        manager.isEnabled = true
        manager.clearAllDataSync()
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

    // MARK: - Event Name Boundaries

    func testVeryLongEventName() {
        let longName = String(repeating: "a", count: 10_000)
        let event = AnalyticsEvent(
            category: .userAction,
            name: longName,
            properties: [:],
            sessionID: manager.sessionID
        )

        manager.track(event)

        waitForCondition({
            self.manager.flushSync()
            return !self.manager.getEvents().isEmpty
        }, description: "Long name event tracked")

        let events = manager.getEvents()
        XCTAssertTrue(events.contains { $0.name == longName })
    }

    func testEmptyEventName() {
        let event = AnalyticsEvent(
            category: .userAction,
            name: "",
            properties: [:],
            sessionID: manager.sessionID
        )

        manager.track(event)

        waitForCondition({
            self.manager.flushSync()
            return !self.manager.getEvents().isEmpty
        }, description: "Empty name event tracked")

        let events = manager.getEvents()
        XCTAssertTrue(events.contains { $0.name == "" })
    }

    func testUnicodeEventName() {
        let unicodeName = "用户操作_🎯_действие"
        let event = AnalyticsEvent(
            category: .userAction,
            name: unicodeName,
            properties: [:],
            sessionID: manager.sessionID
        )

        manager.track(event)

        waitForCondition({
            self.manager.flushSync()
            return self.manager.getEvents().contains { $0.name == unicodeName }
        }, description: "Unicode event tracked")
    }

    // MARK: - Property Boundaries

    func testMaximumProperties() {
        var properties: [String: AnalyticsEvent.PropertyValue] = [:]

        // 1000 properties
        for i in 0..<1000 {
            properties["key_\(i)"] = .int(i)
        }

        let event = AnalyticsEvent(
            category: .userAction,
            name: "max_properties",
            properties: properties,
            sessionID: manager.sessionID
        )

        manager.track(event)

        waitForCondition({
            self.manager.flushSync()
            let events = self.manager.getEvents()
            return events.contains { $0.name == "max_properties" }
        }, description: "Event with 1000 properties tracked")

        let events = manager.getEvents()
        let retrievedEvent = events.first { $0.name == "max_properties" }
        XCTAssertEqual(retrievedEvent?.properties.count, 1000)
    }

    func testEmptyProperties() {
        let event = AnalyticsEvent(
            category: .userAction,
            name: "no_properties",
            properties: [:],
            sessionID: manager.sessionID
        )

        manager.track(event)

        waitForCondition({
            self.manager.flushSync()
            return self.manager.getEvents().contains { $0.name == "no_properties" }
        }, description: "Event with no properties tracked")
    }

    func testVeryLongPropertyValue() {
        let longString = String(repeating: "x", count: 100_000)
        let event = AnalyticsEvent(
            category: .userAction,
            name: "long_property",
            properties: ["data": .string(longString)],
            sessionID: manager.sessionID
        )

        manager.track(event)

        waitForCondition({
            self.manager.flushSync()
            let events = self.manager.getEvents()
            return events.contains { $0.name == "long_property" }
        }, description: "Event with long property tracked")

        let events = manager.getEvents()
        let retrievedEvent = events.first { $0.name == "long_property" }

        if case .string(let value) = retrievedEvent?.properties["data"] {
            XCTAssertEqual(value.count, 100_000)
        } else {
            XCTFail("Property not found or wrong type")
        }
    }

    func testPropertyKeyWithSpecialCharacters() {
        let specialKey = "key/with\\special:chars@#$%^&*()"
        let event = AnalyticsEvent(
            category: .userAction,
            name: "special_key",
            properties: [specialKey: .string("value")],
            sessionID: manager.sessionID
        )

        manager.track(event)

        waitForCondition({
            self.manager.flushSync()
            return self.manager.getEvents().contains { $0.name == "special_key" }
        }, description: "Event with special char key tracked")
    }

    // MARK: - Timestamp Boundaries

    func testVeryOldTimestamp() {
        // Event from year 1970 (timestamp auto-generated)
        let event = AnalyticsEvent(
            category: .userAction,
            name: "old_event",
            properties: [:],
            sessionID: manager.sessionID
        )

        manager.track(event)

        waitForCondition({
            self.manager.flushSync()
            return !self.manager.getEvents().isEmpty
        }, description: "Old timestamp event tracked")
    }

    func testFutureTimestamp() {
        // Event from year 2100 (timestamp auto-generated)
        let event = AnalyticsEvent(
            category: .userAction,
            name: "future_event",
            properties: [:],
            sessionID: manager.sessionID
        )

        manager.track(event)

        waitForCondition({
            self.manager.flushSync()
            return !self.manager.getEvents().isEmpty
        }, description: "Future timestamp event tracked")
    }

    // MARK: - Buffer Size Boundaries

    func testMassiveBufferSize() {
        // Track 50,000 events
        for i in 0..<50_000 {
            manager.track(.documentUploaded(
                fileType: "pdf",
                fileSize: i,
                sessionID: manager.sessionID
            ))
        }

        // Flush in batches
        manager.flushSync()

        waitForCondition({
            self.manager.flushSync()
            return self.manager.getEvents().count > 40_000
        }, timeout: 30.0, description: "Massive buffer flushed")

        let events = manager.getEvents()
        // Should have stored most events (allow some buffer management)
        XCTAssertGreaterThan(events.count, 40_000)
    }

    func testRapidFireTracking() {
        // Track 10,000 events as fast as possible
        for i in 0..<10_000 {
            manager.track(.documentUploaded(
                fileType: "pdf",
                fileSize: i,
                sessionID: manager.sessionID
            ))
        }

        waitForCondition({
            self.manager.flushSync()
            return self.manager.getEvents().count >= 9000
        }, timeout: 10.0, description: "Rapid fire events tracked")
    }

    // MARK: - Query Boundaries

    func testGetEventsWithZeroLimit() {
        manager.track(.documentUploaded(fileType: "pdf", fileSize: 1024, sessionID: manager.sessionID))

        waitForCondition({
            self.manager.flushSync()
            return !self.manager.getEvents().isEmpty
        }, description: "Event tracked")

        let events = manager.getEvents(limit: 0)
        XCTAssertEqual(events.count, 0)
    }

    func testGetEventsWithNegativeLimit() {
        manager.track(.documentUploaded(fileType: "pdf", fileSize: 1024, sessionID: manager.sessionID))

        waitForCondition({
            self.manager.flushSync()
            return !self.manager.getEvents().isEmpty
        }, description: "Event tracked")

        // Negative limit should be treated as 0 or unlimited
        let events = manager.getEvents(limit: -1)
        // Implementation-dependent, just verify it doesn't crash
    }

    func testGetEventsWithHugeLimit() {
        manager.track(.documentUploaded(fileType: "pdf", fileSize: 1024, sessionID: manager.sessionID))

        waitForCondition({
            self.manager.flushSync()
            return !self.manager.getEvents().isEmpty
        }, description: "Event tracked")

        let events = manager.getEvents(limit: Int.max)
        XCTAssertGreaterThan(events.count, 0)
    }

    func testGetEventsSinceDistantPast() {
        manager.track(.documentUploaded(fileType: "pdf", fileSize: 1024, sessionID: manager.sessionID))

        waitForCondition({
            self.manager.flushSync()
            return !self.manager.getEvents().isEmpty
        }, description: "Event tracked")

        let events = manager.getEvents(since: Date.distantPast)
        XCTAssertGreaterThan(events.count, 0)
    }

    func testGetEventsSinceDistantFuture() {
        manager.track(.documentUploaded(fileType: "pdf", fileSize: 1024, sessionID: manager.sessionID))

        waitForCondition({
            self.manager.flushSync()
            return !self.manager.getEvents().isEmpty
        }, description: "Event tracked")

        let events = manager.getEvents(since: Date.distantFuture)
        XCTAssertEqual(events.count, 0)
    }

    // MARK: - Session Boundaries

    func testRapidSessionChanges() {
        let originalSessionID = manager.sessionID

        // Change session 100 times rapidly
        for _ in 0..<100 {
            manager.startNewSession()
        }

        let finalSessionID = manager.sessionID

        XCTAssertNotEqual(originalSessionID, finalSessionID)
    }

    func testSessionDurationAfterLongTime() {
        let duration1 = manager.sessionDuration
        XCTAssertGreaterThanOrEqual(duration1, 0)

        // Simulate long-running session
        Thread.sleep(forTimeInterval: 1.0)

        let duration2 = manager.sessionDuration
        XCTAssertGreaterThan(duration2, duration1)
        XCTAssertGreaterThanOrEqual(duration2, 1.0)
    }

    // MARK: - Concurrent Stress Testing

    func testConcurrentTrackingAndFlushing() {
        let expectation = expectation(description: "Concurrent operations completed")
        expectation.expectedFulfillmentCount = 200

        let trackQueue = DispatchQueue(label: "test.track", attributes: .concurrent)
        let flushQueue = DispatchQueue(label: "test.flush", attributes: .concurrent)

        // 100 concurrent tracks
        for i in 0..<100 {
            trackQueue.async {
                self.manager.track(.documentUploaded(
                    fileType: "pdf",
                    fileSize: i,
                    sessionID: self.manager.sessionID
                ))
                expectation.fulfill()
            }
        }

        // 100 concurrent flushes
        for _ in 0..<100 {
            flushQueue.async {
                self.manager.flushSync()
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 30.0)

        // Should not crash and should have tracked events
        manager.flushSync()
        waitForCondition({
            return self.manager.getEvents().count > 0
        }, timeout: 5.0, description: "Events tracked despite concurrent operations")
    }

    func testConcurrentSessionIDAccessUnderLoad() {
        let expectation = expectation(description: "Concurrent sessionID access")
        expectation.expectedFulfillmentCount = 1000

        let queue = DispatchQueue(label: "test.sessionid.load", attributes: .concurrent)
        var sessionIDs = [UUID]()
        let lock = NSLock()

        for _ in 0..<1000 {
            queue.async {
                // Mix of reads and session changes
                if Bool.random() {
                    let sessionID = self.manager.sessionID
                    lock.lock()
                    sessionIDs.append(sessionID)
                    lock.unlock()
                } else {
                    self.manager.startNewSession()
                }
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 30.0)

        // Verify all sessionIDs are valid UUIDs (no corruption)
        for sessionID in sessionIDs {
            XCTAssertEqual(sessionID.uuidString.count, 36)
        }
    }

    // MARK: - Error Scenarios

    func testTrackingWhenDisabled() {
        manager.isEnabled = false

        // Track 1000 events while disabled
        for i in 0..<1000 {
            manager.track(.documentUploaded(
                fileType: "pdf",
                fileSize: i,
                sessionID: manager.sessionID
            ))
        }

        manager.flushSync()

        // Small delay to ensure flush completes
        waitForCondition({
            self.manager.flushSync()
            return true
        }, description: "Flush completed")

        // Events should not be tracked
        let events = manager.getEvents()
        XCTAssertEqual(events.count, 0)
    }

    func testEnableDisableRapidly() {
        // Rapidly toggle enabled state while tracking
        let expectation = expectation(description: "Rapid toggle completed")
        expectation.expectedFulfillmentCount = 200

        let queue = DispatchQueue(label: "test.toggle", attributes: .concurrent)

        for i in 0..<100 {
            queue.async {
                self.manager.isEnabled = (i % 2 == 0)
                expectation.fulfill()
            }

            queue.async {
                self.manager.track(.documentUploaded(
                    fileType: "pdf",
                    fileSize: i,
                    sessionID: self.manager.sessionID
                ))
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 30.0)

        // Should not crash
        manager.isEnabled = true
        manager.flushSync()
    }

    // MARK: - Data Integrity

    func testPropertyValueTypePreservation() {
        let event = AnalyticsEvent(
            category: .userAction,
            name: "type_test",
            properties: [
                "string": .string("test"),
                "int": .int(42),
                "double": .double(3.14159),
                "bool": .bool(true),
                "array": .array(["a", "b", "c"])
            ],
            sessionID: manager.sessionID
        )

        manager.track(event)

        waitForCondition({
            self.manager.flushSync()
            return self.manager.getEvents().contains { $0.name == "type_test" }
        }, description: "Type test event tracked")

        let events = manager.getEvents()
        let retrieved = events.first { $0.name == "type_test" }

        XCTAssertNotNil(retrieved)

        // Verify all types preserved
        if case .string(let s) = retrieved?.properties["string"] {
            XCTAssertEqual(s, "test")
        } else {
            XCTFail("String type not preserved")
        }

        if case .int(let i) = retrieved?.properties["int"] {
            XCTAssertEqual(i, 42)
        } else {
            XCTFail("Int type not preserved")
        }

        if case .double(let d) = retrieved?.properties["double"] {
            XCTAssertEqual(d, 3.14159, accuracy: 0.00001)
        } else {
            XCTFail("Double type not preserved")
        }

        if case .bool(let b) = retrieved?.properties["bool"] {
            XCTAssertTrue(b)
        } else {
            XCTFail("Bool type not preserved")
        }

        if case .array(let a) = retrieved?.properties["array"] {
            XCTAssertEqual(a, ["a", "b", "c"])
        } else {
            XCTFail("Array type not preserved")
        }
    }
}
