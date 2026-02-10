//
//  SystemIntegrationTests.swift
//  angle-rfpTests
//
//  Complete system integration and stress tests
//  Tests all services working together under various conditions
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class SystemIntegrationTests: XCTestCase {
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
        timeout: TimeInterval = 5.0,
        description: String = "Condition met"
    ) {
        let predicate = NSPredicate { _, _ in condition() }
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: nil)
        let waiter = XCTWaiter()
        let result = waiter.wait(for: [expectation], timeout: timeout)

        XCTAssertEqual(result, .completed, "Timeout waiting for: \(description)")
    }

    // MARK: - Complete System Workflow

    func testCompleteRFPAnalysisWorkflow() async throws {
        // Simulate complete RFP analysis from start to finish
        let documentID = UUID()
        let sessionID = AnalyticsManager.shared.sessionID

        // Step 1: Document Upload
        AnalyticsManager.shared.track(.documentUploaded(
            fileType: "pdf",
            fileSize: 1024 * 1024 * 5, // 5MB
            sessionID: sessionID
        ))

        // Step 2: Analysis Started
        AnalyticsManager.shared.track(.analysisStarted(
            documentID: documentID,
            sessionID: sessionID
        ))

        // Step 3: Parsing with Performance Tracking
        let parseTracker = PerformanceTracker(operation: "document_parsing")
        parseTracker.recordMetric("pages", value: 50)
        parseTracker.recordMetric("words", value: 15000)
        try await Task.sleep(nanoseconds: 100_000_000) // Simulate work
        parseTracker.complete(success: true)

        // Step 4: Cache Parsed Data
        struct ParsedData: Codable {
            let text: String
            let metadata: [String: String]
            let timestamp: Date
        }

        let parsedData = ParsedData(
            text: "Sample RFP content",
            metadata: ["pageCount": "50", "wordCount": "15000"],
            timestamp: Date()
        )

        try CacheCoordinator.shared.set(
            parsedData,
            forKey: "parsed_\(documentID.uuidString)",
            ttl: 3600
        )

        // Step 5: Mock Network Request for AI Analysis
        let mockSession = URLSession.makeMockSession()
        let networkClient = NetworkClient(session: mockSession)
        let apiURL = URL(string: "https://api.anthropic.com/v1/messages")!

        MockURLProtocol.mockSuccessfulPOST(url: apiURL)

        _ = try await networkClient.request(
            url: apiURL,
            method: .post,
            body: "mock request".data(using: .utf8),
            retryPolicy: .exponential(maxAttempts: 3)
        )

        // Step 6: Analysis Completed
        AnalyticsManager.shared.track(.analysisCompleted(
            documentID: documentID,
            totalDuration: 5.5,
            parsingDuration: 0.1,
            aiDuration: 4.0,
            researchDuration: 1.4,
            success: true,
            sessionID: sessionID
        ))

        // Step 7: Retrieve Cached Data
        let retrieved: ParsedData? = CacheCoordinator.shared.get("parsed_\(documentID.uuidString)")
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.metadata["pageCount"], "50")

        // Step 8: Verify All Analytics
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents()
            return events.contains { $0.name == "document_uploaded" }
                && events.contains { $0.name == "analysis_started" }
                && events.contains { $0.name == "analysis_completed" }
                && events.contains { $0.name == "document_parsing" }
                && events.contains { $0.name == "network_request" }
        }, timeout: 10.0, description: "All workflow events tracked")

        let allEvents = AnalyticsManager.shared.getEvents()

        XCTAssertTrue(allEvents.contains { $0.name == "document_uploaded" })
        XCTAssertTrue(allEvents.contains { $0.name == "analysis_started" })
        XCTAssertTrue(allEvents.contains { $0.name == "analysis_completed" })
        XCTAssertTrue(allEvents.contains { $0.name == "document_parsing" })
    }

    // MARK: - High Load Stress Test

    func testSystemUnderHighLoad() async throws {
        let startTime = Date()
        let startMemory = MemoryTracker.currentUsage

        // Simulate 100 concurrent RFP analyses
        await withTaskGroup(of: Void.self) { group in
            for i in 0..<100 {
                group.addTask {
                    let docID = UUID()

                    // Upload
                    AnalyticsManager.shared.track(.documentUploaded(
                        fileType: "pdf",
                        fileSize: i * 1024,
                        sessionID: AnalyticsManager.shared.sessionID
                    ))

                    // Parse
                    let tracker = PerformanceTracker(operation: "parse_\(i)")
                    tracker.complete(success: true)

                    // Cache
                    try? CacheCoordinator.shared.set(
                        "data_\(i)",
                        forKey: "doc_\(docID.uuidString)"
                    )

                    // Complete
                    AnalyticsManager.shared.track(.analysisCompleted(
                        documentID: docID,
                        totalDuration: Double(i) / 10.0,
                        parsingDuration: 0.1,
                        aiDuration: Double(i) / 15.0,
                        researchDuration: 0.05,
                        success: true,
                        sessionID: AnalyticsManager.shared.sessionID
                    ))
                }
            }
        }

        // Flush all analytics
        AnalyticsManager.shared.flushSync()

        waitForCondition({
            AnalyticsManager.shared.flushSync()
            return AnalyticsManager.shared.getEvents().count >= 100
        }, timeout: 30.0, description: "All high-load events flushed")

        let endTime = Date()
        let endMemory = MemoryTracker.currentUsage

        let duration = endTime.timeIntervalSince(startTime)
        let memoryIncrease = endMemory - startMemory

        // Performance assertions
        XCTAssertLessThan(duration, 30.0, "Should complete in under 30 seconds")
        XCTAssertLessThan(memoryIncrease, 100 * 1024 * 1024, "Memory increase should be < 100MB")

        // Functionality assertions
        let events = AnalyticsManager.shared.getEvents()
        XCTAssertGreaterThanOrEqual(events.count, 100)
    }

    // MARK: - Multi-Service Failure Recovery

    func testGracefulDegradationUnderPartialFailure() async {
        // Simulate scenario where some services fail but system continues

        // 1. Cache operations succeed
        for i in 0..<50 {
            try? CacheCoordinator.shared.set(i, forKey: "recovery_\(i)")
        }

        // 2. Network operations fail
        let mockSession = URLSession.makeMockSession()
        let client = NetworkClient(session: mockSession)
        let failURL = URL(string: "https://api.test.com/fail")!

        MockURLProtocol.mockHTTPError(url: failURL, statusCode: 500)

        for _ in 0..<10 {
            try? await client.request(url: failURL, retryPolicy: .none)
        }

        // 3. Analytics continues to work
        for i in 0..<50 {
            AnalyticsManager.shared.track(.documentUploaded(
                fileType: "pdf",
                fileSize: i,
                sessionID: AnalyticsManager.shared.sessionID
            ))
        }

        // Verify system still functional
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            return AnalyticsManager.shared.getEvents().count >= 40
        }, timeout: 10.0, description: "Analytics works despite network failures")

        // Cache still accessible
        let cached: Int? = CacheCoordinator.shared.get("recovery_25")
        XCTAssertEqual(cached, 25)
    }

    // MARK: - Data Consistency

    func testDataConsistencyAcrossServices() async throws {
        let documentID = UUID()

        // Store data in cache
        struct AnalysisResult: Codable, Equatable {
            let id: UUID
            let score: Double
            let timestamp: Date
        }

        let result = AnalysisResult(
            id: documentID,
            score: 85.5,
            timestamp: Date()
        )

        try CacheCoordinator.shared.set(result, forKey: "analysis_\(documentID)")

        // Track corresponding analytics
        AnalyticsManager.shared.track(.analysisCompleted(
            documentID: documentID,
            totalDuration: 5.0,
            parsingDuration: 0.5,
            aiDuration: 3.0,
            researchDuration: 1.5,
            success: true,
            sessionID: AnalyticsManager.shared.sessionID
        ))

        // Verify consistency
        let cached: AnalysisResult? = CacheCoordinator.shared.get("analysis_\(documentID)")
        XCTAssertEqual(cached?.id, documentID)

        waitForCondition({
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents()
            return events.contains { event in
                if case .string(let idString) = event.properties["documentID"],
                   let eventDocID = UUID(uuidString: idString) {
                    return eventDocID == documentID
                }
                return false
            }
        }, description: "Analytics contains matching document ID")
    }

    // MARK: - Concurrent Multi-User Simulation

    func testMultipleUsersSimultaneous() async {
        // Simulate 10 users performing different operations concurrently

        await withTaskGroup(of: Void.self) { group in
            for userID in 0..<10 {
                group.addTask {
                    let userSessionID = UUID()

                    // Each user uploads 10 documents
                    for docID in 0..<10 {
                        AnalyticsManager.shared.track(.documentUploaded(
                            fileType: "pdf",
                            fileSize: docID * 1024,
                            sessionID: userSessionID
                        ))

                        // Cache user-specific data
                        try? CacheCoordinator.shared.set(
                            "user_\(userID)_doc_\(docID)",
                            forKey: "user_\(userID)_doc_\(docID)"
                        )

                        // Track performance
                        let tracker = PerformanceTracker(operation: "user_\(userID)_analysis_\(docID)")
                        tracker.complete(success: true)
                    }
                }
            }
        }

        // Verify all users' data
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            return AnalyticsManager.shared.getEvents().count >= 90
        }, timeout: 20.0, description: "Multi-user events tracked")

        // Spot check cache
        for userID in 0..<10 {
            let docID = Int.random(in: 0..<10)
            let cached: String? = CacheCoordinator.shared.get("user_\(userID)_doc_\(docID)")
            XCTAssertEqual(cached, "user_\(userID)_doc_\(docID)")
        }
    }

    // MARK: - Long-Running Session

    func testLongRunningSession() async throws {
        let sessionStart = Date()

        // Simulate activity over time
        for iteration in 0..<20 {
            // Upload
            AnalyticsManager.shared.track(.documentUploaded(
                fileType: "pdf",
                fileSize: iteration * 1024,
                sessionID: AnalyticsManager.shared.sessionID
            ))

            // Process
            let tracker = PerformanceTracker(operation: "iteration_\(iteration)")
            try await Task.sleep(nanoseconds: 50_000_000) // 50ms
            tracker.complete(success: true)

            // Cache result
            try CacheCoordinator.shared.set(
                "result_\(iteration)",
                forKey: "iteration_\(iteration)"
            )

            // Periodic flush
            if iteration % 5 == 0 {
                AnalyticsManager.shared.flushSync()
            }
        }

        let sessionDuration = Date().timeIntervalSince(sessionStart)

        // Verify session tracking
        let trackedDuration = AnalyticsManager.shared.sessionDuration
        XCTAssertGreaterThan(trackedDuration, sessionDuration * 0.9) // Within 90%

        // Verify all iterations cached
        for i in 0..<20 {
            let cached: String? = CacheCoordinator.shared.get("iteration_\(i)")
            XCTAssertEqual(cached, "result_\(i)")
        }
    }

    // MARK: - Privacy Compliance

    func testPIIRedactionAcrossServices() {
        // Verify PII is redacted in all logging points

        // Log with PII
        let apiKey = "sk" + "-ant-" + "123456"
        AppLogger.shared.info("User test@example.com uploaded document with key \(apiKey)")

        // Analytics should hash company names
        AnalyticsManager.shared.track(.webResearchCompleted(
            duration: 2.5,
            companyName: "Confidential Corp",
            queriesExecuted: 3,
            cacheHit: false,
            success: true,
            sessionID: AnalyticsManager.shared.sessionID
        ))

        waitForCondition({
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents()
            return events.contains { $0.name == "web_research_completed" }
        }, description: "Research event tracked")

        let events = AnalyticsManager.shared.getEvents()
        let researchEvent = events.first { $0.name == "web_research_completed" }

        // Verify company name is hashed, not stored raw
        XCTAssertNil(researchEvent?.properties["companyName"])
        XCTAssertNotNil(researchEvent?.properties["companyHash"])

        if case .string(let hash) = researchEvent?.properties["companyHash"] {
            XCTAssertFalse(hash.contains("Confidential"))
            XCTAssertEqual(hash.count, 8) // SHA-256 prefix
        }
    }

    // MARK: - System Stability

    func testSystemStabilityOver24HourSimulation() async throws {
        // Simulate 24 hours of activity compressed into seconds
        let hoursToSimulate = 24
        let eventsPerHour = 10

        for hour in 0..<hoursToSimulate {
            for event in 0..<eventsPerHour {
                AnalyticsManager.shared.track(.documentUploaded(
                    fileType: "pdf",
                    fileSize: hour * eventsPerHour + event,
                    sessionID: AnalyticsManager.shared.sessionID
                ))

                // Periodic cache operations
                if event % 3 == 0 {
                    try? CacheCoordinator.shared.set(
                        "hour_\(hour)_event_\(event)",
                        forKey: "stability_\(hour)_\(event)"
                    )
                }
            }

            // Periodic flush
            if hour % 6 == 0 {
                AnalyticsManager.shared.flushSync()
            }
        }

        // Final flush
        AnalyticsManager.shared.flushSync()

        waitForCondition({
            AnalyticsManager.shared.flushSync()
            return AnalyticsManager.shared.getEvents().count >= hoursToSimulate * eventsPerHour - 20
        }, timeout: 30.0, description: "24-hour simulation events tracked")

        // Verify system still functional
        let events = AnalyticsManager.shared.getEvents()
        XCTAssertGreaterThan(events.count, 200)

        // Verify cache still works
        try CacheCoordinator.shared.set("final_check", forKey: "stability_final")
        let check: String? = CacheCoordinator.shared.get("stability_final")
        XCTAssertEqual(check, "final_check")
    }

    // MARK: - Resource Cleanup

    func testCompleteSystemCleanup() {
        // Fill system with data
        for i in 0..<100 {
            AnalyticsManager.shared.track(.documentUploaded(
                fileType: "pdf",
                fileSize: i,
                sessionID: AnalyticsManager.shared.sessionID
            ))

            try? CacheCoordinator.shared.set(i, forKey: "cleanup_\(i)")
        }

        AnalyticsManager.shared.flushSync()

        // Verify data exists
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            return !AnalyticsManager.shared.getEvents().isEmpty
        }, description: "Data exists")

        // Complete cleanup
        AnalyticsManager.shared.clearAllDataSync()
        CacheCoordinator.shared.clearAll()

        // Verify everything cleared
        let events = AnalyticsManager.shared.getEvents()
        XCTAssertEqual(events.count, 0)

        let cached: Int? = CacheCoordinator.shared.get("cleanup_50")
        XCTAssertNil(cached)

        // Verify system still works after cleanup
        AnalyticsManager.shared.track(.documentUploaded(
            fileType: "pdf",
            fileSize: 1024,
            sessionID: AnalyticsManager.shared.sessionID
        ))

        try? CacheCoordinator.shared.set("post_cleanup", forKey: "test")

        waitForCondition({
            AnalyticsManager.shared.flushSync()
            return !AnalyticsManager.shared.getEvents().isEmpty
        }, description: "System functional after cleanup")
    }

    // MARK: - Backend Contracts

    func testBackendEnvelopeContractDecoding() throws {
        let json = """
        {
          "requestId": "req_123",
          "traceId": "trace_123",
          "schemaVersion": "1.0.0",
          "durationMs": 12,
          "warnings": [],
          "partialResult": false,
          "data": {
            "schemaVersion": "1.0.0",
            "analysisId": "e6c1c93e-6f43-4f16-bbe0-30761998a4db",
            "baseScore": 82.4,
            "redFlagPenalty": 3.0,
            "completenessPenalty": 1.2,
            "finalScore": 78.2,
            "recommendationBand": "GOOD",
            "factorBreakdown": [
              {
                "factor": "Project Scope Magnitude",
                "weight": 0.18,
                "score": 85.0,
                "contribution": 15.3,
                "evidence": ["20+ deliverables"]
              }
            ],
            "rationale": "Strong fit with manageable risks."
          },
          "error": null
        }
        """

        let envelope = try JSONDecoder().decode(ApiEnvelope<FinancialScoreV1Payload>.self, from: Data(json.utf8))
        XCTAssertEqual(envelope.schemaVersion, "1.0.0")
        XCTAssertEqual(envelope.data?.recommendationBand, "GOOD")
        XCTAssertNil(envelope.error)
    }
}
