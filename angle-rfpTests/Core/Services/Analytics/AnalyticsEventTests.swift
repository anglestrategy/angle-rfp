//
//  AnalyticsEventTests.swift
//  angle-rfpTests
//
//  Unit tests for analytics event tracking
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class AnalyticsEventTests: XCTestCase {

    let testSessionID = UUID()

    // MARK: - PropertyValue Tests

    func testPropertyValueString() throws {
        let value = AnalyticsEvent.PropertyValue.string("test")

        let encoder = JSONEncoder()
        let data = try encoder.encode(value)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(AnalyticsEvent.PropertyValue.self, from: data)

        XCTAssertEqual(value, decoded)
        XCTAssertEqual(decoded, .string("test"))
    }

    func testPropertyValueInt() throws {
        let value = AnalyticsEvent.PropertyValue.int(42)

        let encoder = JSONEncoder()
        let data = try encoder.encode(value)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(AnalyticsEvent.PropertyValue.self, from: data)

        XCTAssertEqual(value, decoded)
        XCTAssertEqual(decoded, .int(42))
    }

    func testPropertyValueDouble() throws {
        let value = AnalyticsEvent.PropertyValue.double(3.14)

        let encoder = JSONEncoder()
        let data = try encoder.encode(value)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(AnalyticsEvent.PropertyValue.self, from: data)

        XCTAssertEqual(value, decoded)
        XCTAssertEqual(decoded, .double(3.14))
    }

    func testPropertyValueBool() throws {
        let value = AnalyticsEvent.PropertyValue.bool(true)

        let encoder = JSONEncoder()
        let data = try encoder.encode(value)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(AnalyticsEvent.PropertyValue.self, from: data)

        XCTAssertEqual(value, decoded)
        XCTAssertEqual(decoded, .bool(true))
    }

    func testPropertyValueArray() throws {
        let value = AnalyticsEvent.PropertyValue.array(["a", "b", "c"])

        let encoder = JSONEncoder()
        let data = try encoder.encode(value)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(AnalyticsEvent.PropertyValue.self, from: data)

        XCTAssertEqual(value, decoded)
        XCTAssertEqual(decoded, .array(["a", "b", "c"]))
    }

    func testPropertyValueFromAny() {
        XCTAssertEqual(AnalyticsEvent.PropertyValue.from("test"), .string("test"))
        XCTAssertEqual(AnalyticsEvent.PropertyValue.from(42), .int(42))
        XCTAssertEqual(AnalyticsEvent.PropertyValue.from(3.14), .double(3.14))
        XCTAssertEqual(AnalyticsEvent.PropertyValue.from(true), .bool(true))
        XCTAssertEqual(AnalyticsEvent.PropertyValue.from(["a", "b"]), .array(["a", "b"]))
    }

    func testPropertyValueAnyValue() {
        XCTAssertEqual(AnalyticsEvent.PropertyValue.string("test").anyValue as? String, "test")
        XCTAssertEqual(AnalyticsEvent.PropertyValue.int(42).anyValue as? Int, 42)
        XCTAssertEqual(AnalyticsEvent.PropertyValue.double(3.14).anyValue as? Double, 3.14)
        XCTAssertEqual(AnalyticsEvent.PropertyValue.bool(true).anyValue as? Bool, true)
        XCTAssertEqual(AnalyticsEvent.PropertyValue.array(["a"]).anyValue as? [String], ["a"])
    }

    // MARK: - Event Creation Tests

    func testDocumentUploadedEvent() {
        let event = AnalyticsEvent.documentUploaded(
            fileType: "pdf",
            fileSize: 1024000,
            pageCount: 45,
            sessionID: testSessionID
        )

        XCTAssertEqual(event.category, .userAction)
        XCTAssertEqual(event.name, "document_uploaded")
        XCTAssertEqual(event.sessionID, testSessionID)
        XCTAssertEqual(event.properties["fileType"], .string("pdf"))
        XCTAssertEqual(event.properties["fileSize"], .int(1024000))
        XCTAssertEqual(event.properties["pageCount"], .int(45))
    }

    func testAnalysisStartedEvent() {
        let documentID = UUID()
        let event = AnalyticsEvent.analysisStarted(
            documentID: documentID,
            sessionID: testSessionID
        )

        XCTAssertEqual(event.category, .userAction)
        XCTAssertEqual(event.name, "analysis_started")
        XCTAssertEqual(event.properties["documentID"], .string(documentID.uuidString))
    }

    func testParsingCompletedEvent() {
        let documentID = UUID()
        let event = AnalyticsEvent.parsingCompleted(
            documentID: documentID,
            duration: 2.5,
            fileType: "pdf",
            pageCount: 30,
            success: true,
            sessionID: testSessionID
        )

        XCTAssertEqual(event.category, .performance)
        XCTAssertEqual(event.name, "parsing_completed")
        XCTAssertEqual(event.properties["duration"], .double(2.5))
        XCTAssertEqual(event.properties["durationMs"], .int(2500))
        XCTAssertEqual(event.properties["fileType"], .string("pdf"))
        XCTAssertEqual(event.properties["pageCount"], .int(30))
        XCTAssertEqual(event.properties["success"], .bool(true))
    }

    func testClaudeRequestCompletedEvent() {
        let event = AnalyticsEvent.claudeRequestCompleted(
            duration: 5.2,
            model: "claude-sonnet-4-5",
            inputTokens: 1500,
            outputTokens: 800,
            success: true,
            sessionID: testSessionID
        )

        XCTAssertEqual(event.category, .performance)
        XCTAssertEqual(event.name, "claude_request_completed")
        XCTAssertEqual(event.properties["model"], .string("claude-sonnet-4-5"))
        XCTAssertEqual(event.properties["inputTokens"], .int(1500))
        XCTAssertEqual(event.properties["outputTokens"], .int(800))
        XCTAssertEqual(event.properties["totalTokens"], .int(2300))
    }

    // MARK: - Privacy Tests (CRITICAL)

    func testWebResearchCompletedHashesCompanyName() {
        let event = AnalyticsEvent.webResearchCompleted(
            duration: 3.5,
            companyName: "Apple Inc",
            queriesExecuted: 3,
            cacheHit: false,
            success: true,
            sessionID: testSessionID
        )

        // CRITICAL: Verify company name is NOT stored raw
        XCTAssertNil(event.properties["company"])
        XCTAssertNil(event.properties["companyName"])

        // Verify hash is stored
        XCTAssertNotNil(event.properties["companyHash"])

        if case .string(let hash) = event.properties["companyHash"] {
            XCTAssertFalse(hash.contains("Apple"))
            XCTAssertEqual(hash.count, 8) // First 8 chars of SHA-256
        } else {
            XCTFail("companyHash should be a string")
        }
    }

    func testBraveQueryExecutedHashesCompanyName() {
        let event = AnalyticsEvent.braveQueryExecuted(
            companyName: "Google LLC",
            queryType: "company_info",
            resultsCount: 10,
            sessionID: testSessionID
        )

        // CRITICAL: Verify company name is NOT stored raw
        XCTAssertNil(event.properties["company"])
        XCTAssertNil(event.properties["companyName"])
        XCTAssertNotNil(event.properties["companyHash"])

        if case .string(let hash) = event.properties["companyHash"] {
            XCTAssertFalse(hash.contains("Google"))
        } else {
            XCTFail("companyHash should be a string")
        }
    }

    func testResearchCacheHitHashesCompanyName() {
        let event = AnalyticsEvent.researchCacheHit(
            companyName: "Microsoft",
            cacheAge: 86400,
            sessionID: testSessionID
        )

        // CRITICAL: Verify company name is NOT stored raw
        XCTAssertNil(event.properties["company"])
        XCTAssertNil(event.properties["companyName"])
        XCTAssertNotNil(event.properties["companyHash"])
    }

    func testSameCompanyNameProducesSameHash() {
        let event1 = AnalyticsEvent.braveQueryExecuted(
            companyName: "Apple Inc",
            queryType: "test",
            resultsCount: 5,
            sessionID: testSessionID
        )

        let event2 = AnalyticsEvent.braveQueryExecuted(
            companyName: "Apple Inc",
            queryType: "test",
            resultsCount: 5,
            sessionID: testSessionID
        )

        XCTAssertEqual(event1.properties["companyHash"], event2.properties["companyHash"])
    }

    func testDifferentCompanyNamesProduceDifferentHashes() {
        let event1 = AnalyticsEvent.braveQueryExecuted(
            companyName: "Apple Inc",
            queryType: "test",
            resultsCount: 5,
            sessionID: testSessionID
        )

        let event2 = AnalyticsEvent.braveQueryExecuted(
            companyName: "Google LLC",
            queryType: "test",
            resultsCount: 5,
            sessionID: testSessionID
        )

        XCTAssertNotEqual(event1.properties["companyHash"], event2.properties["companyHash"])
    }

    // MARK: - Error Event Tests

    func testErrorOccurredEvent() {
        let error = NSError(domain: "TestDomain", code: 123, userInfo: [
            NSLocalizedDescriptionKey: "Test error"
        ])

        let event = AnalyticsEvent.errorOccurred(
            error: error,
            context: "file_upload",
            severity: .error,
            sessionID: testSessionID
        )

        XCTAssertEqual(event.category, .error)
        XCTAssertEqual(event.name, "error_occurred")
        XCTAssertEqual(event.properties["context"], .string("file_upload"))
        XCTAssertEqual(event.properties["severity"], .string("error"))

        if case .string(let errorType) = event.properties["errorType"] {
            XCTAssertTrue(errorType.contains("NSError"))
        }

        if case .string(let errorDesc) = event.properties["errorDescription"] {
            XCTAssertEqual(errorDesc, "Test error")
        }
    }

    // MARK: - Codable Tests (CRITICAL - verify no data loss)

    func testEventCodableRoundTrip() throws {
        let originalEvent = AnalyticsEvent.claudeRequestCompleted(
            duration: 5.5,
            model: "claude-sonnet-4-5",
            inputTokens: 1000,
            outputTokens: 500,
            success: true,
            sessionID: testSessionID
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(originalEvent)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decodedEvent = try decoder.decode(AnalyticsEvent.self, from: data)

        // Verify all fields preserved
        XCTAssertEqual(originalEvent.id, decodedEvent.id)
        XCTAssertEqual(originalEvent.category, decodedEvent.category)
        XCTAssertEqual(originalEvent.name, decodedEvent.name)
        XCTAssertEqual(originalEvent.sessionID, decodedEvent.sessionID)

        // CRITICAL: Verify properties are preserved with correct types
        XCTAssertEqual(decodedEvent.properties["duration"], .double(5.5))
        XCTAssertEqual(decodedEvent.properties["durationMs"], .int(5500))
        XCTAssertEqual(decodedEvent.properties["model"], .string("claude-sonnet-4-5"))
        XCTAssertEqual(decodedEvent.properties["inputTokens"], .int(1000))
        XCTAssertEqual(decodedEvent.properties["outputTokens"], .int(500))
        XCTAssertEqual(decodedEvent.properties["totalTokens"], .int(1500))
        XCTAssertEqual(decodedEvent.properties["success"], .bool(true))
    }

    func testEventArrayCodable() throws {
        let events = [
            AnalyticsEvent.documentUploaded(
                fileType: "pdf",
                fileSize: 1024,
                sessionID: testSessionID
            ),
            AnalyticsEvent.analysisStarted(
                documentID: UUID(),
                sessionID: testSessionID
            )
        ]

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(events)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode([AnalyticsEvent].self, from: data)

        XCTAssertEqual(decoded.count, 2)
        XCTAssertEqual(decoded[0].name, "document_uploaded")
        XCTAssertEqual(decoded[1].name, "analysis_started")
    }

    func testPropertyValueTypesPreservedThroughCodable() throws {
        let event = AnalyticsEvent.financialScoringCompleted(
            documentID: UUID(),
            finalScore: 85.5,
            factorBreakdown: [
                "companySize": 15.0,
                "brandPopularity": 10.5,
                "scopeMagnitude": 20.0
            ],
            sessionID: testSessionID
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(event)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(AnalyticsEvent.self, from: data)

        // CRITICAL: Verify Double values are not converted to strings
        XCTAssertEqual(decoded.properties["finalScore"], .double(85.5))
        XCTAssertEqual(decoded.properties["companySize"], .double(15.0))
        XCTAssertEqual(decoded.properties["brandPopularity"], .double(10.5))
        XCTAssertEqual(decoded.properties["scopeMagnitude"], .double(20.0))
    }

    // MARK: - Timestamp Tests

    func testEventHasTimestamp() {
        let beforeCreation = Date()
        let event = AnalyticsEvent.appLaunched(isFirstLaunch: true, sessionID: testSessionID)
        let afterCreation = Date()

        XCTAssertTrue(event.timestamp >= beforeCreation)
        XCTAssertTrue(event.timestamp <= afterCreation)
    }

    func testEventsHaveUniqueIDs() {
        let event1 = AnalyticsEvent.appLaunched(isFirstLaunch: true, sessionID: testSessionID)
        let event2 = AnalyticsEvent.appLaunched(isFirstLaunch: true, sessionID: testSessionID)

        XCTAssertNotEqual(event1.id, event2.id)
    }

    // MARK: - Sendable Conformance (Thread Safety)

    func testEventIsSendable() {
        // This test verifies the event can be passed across threads safely
        let expectation = expectation(description: "Event sent across threads")

        let event = AnalyticsEvent.documentUploaded(
            fileType: "pdf",
            fileSize: 1024,
            sessionID: testSessionID
        )

        DispatchQueue.global().async {
            // Access event properties on background thread
            XCTAssertEqual(event.category, .userAction)
            XCTAssertEqual(event.name, "document_uploaded")

            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 1.0)
    }
}
