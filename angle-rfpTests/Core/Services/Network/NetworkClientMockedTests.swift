//
//  NetworkClientMockedTests.swift
//  angle-rfpTests
//
//  Comprehensive unit tests for NetworkClient using MockURLProtocol
//  No external dependencies - all tests run offline
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class NetworkClientMockedTests: XCTestCase {

    override class func setUp() {
        super.setUp()
        AppLogger.suppressConsoleOutput = true
    }

    override class func tearDown() {
        AppLogger.suppressConsoleOutput = false
        super.tearDown()
    }

    var client: NetworkClient!
    var testURL: URL!

    override func setUp() {
        super.setUp()

        // Create client with mock session
        let mockSession = URLSession.makeMockSession()
        client = NetworkClient(session: mockSession)

        testURL = URL(string: "https://api.test.com/endpoint")!

        // Clear analytics
        AnalyticsManager.shared.isEnabled = true
        AnalyticsManager.shared.clearAllDataSync()
    }

    override func tearDown() {
        MockURLProtocol.reset()
        AnalyticsManager.shared.isEnabled = true
        AnalyticsManager.shared.clearAllDataSync()
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

    // MARK: - Successful Requests

    func testSuccessfulGETRequest() async throws {
        // Configure mock
        MockURLProtocol.mockSuccessfulGET(
            url: testURL,
            json: ["message": "success", "value": 42]
        )

        // Make request
        let data = try await client.request(url: testURL, method: .get, retryPolicy: .none)

        // Verify response
        XCTAssertGreaterThan(data.count, 0)

        // Verify it's valid JSON
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertNotNil(json)
        XCTAssertEqual(json?["message"] as? String, "success")
        XCTAssertEqual(json?["value"] as? Int, 42)
    }

    func testSuccessfulPOSTRequest() async throws {
        // Configure mock to echo request
        MockURLProtocol.mockSuccessfulPOST(url: testURL)

        struct TestRequest: Codable {
            let message: String
            let value: Int
        }

        let requestBody = TestRequest(message: "test", value: 42)
        let bodyData = try JSONEncoder().encode(requestBody)

        // Make request
        let responseData = try await client.request(
            url: testURL,
            method: .post,
            body: bodyData,
            retryPolicy: .none
        )

        // Verify echoed response
        let json = try JSONSerialization.jsonObject(with: responseData) as? [String: Any]
        let echoedJSON = json?["json"] as? [String: Any]

        XCTAssertEqual(echoedJSON?["message"] as? String, "test")
        XCTAssertEqual(echoedJSON?["value"] as? Int, 42)
    }

    func testSuccessfulRequestWithCustomHeaders() async throws {
        var capturedRequest: URLRequest?

        MockURLProtocol.requestHandler = { request in
            capturedRequest = request
            return MockURLProtocol.successResponse(
                url: self.testURL,
                json: ["status": "ok"]
            )
        }

        // Make request with custom headers
        _ = try await client.request(
            url: testURL,
            method: .get,
            headers: ["X-Custom-Header": "test-value"],
            retryPolicy: .none
        )

        // Verify headers were sent
        XCTAssertNotNil(capturedRequest)
        XCTAssertEqual(capturedRequest?.value(forHTTPHeaderField: "X-Custom-Header"), "test-value")
        XCTAssertEqual(capturedRequest?.value(forHTTPHeaderField: "User-Agent"), "angle-rfp/1.0")
    }

    // MARK: - HTTP Errors

    func testHTTP404Error() async throws {
        MockURLProtocol.mockHTTPError(url: testURL, statusCode: 404, message: "Not found")

        do {
            _ = try await client.request(url: testURL, method: .get, retryPolicy: .none)
            XCTFail("Should have thrown error")
        } catch NetworkClient.NetworkError.httpError(let statusCode, _) {
            XCTAssertEqual(statusCode, 404)
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func testHTTP500Error() async throws {
        MockURLProtocol.mockHTTPError(url: testURL, statusCode: 500, message: "Server error")

        do {
            _ = try await client.request(url: testURL, method: .get, retryPolicy: .none)
            XCTFail("Should have thrown error")
        } catch NetworkClient.NetworkError.httpError(let statusCode, _) {
            XCTAssertEqual(statusCode, 500)
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func testHTTP401Unauthorized() async throws {
        MockURLProtocol.mockHTTPError(url: testURL, statusCode: 401, message: "Unauthorized")

        do {
            _ = try await client.request(url: testURL, method: .get, retryPolicy: .none)
            XCTFail("Should have thrown error")
        } catch NetworkClient.NetworkError.httpError(let statusCode, _) {
            XCTAssertEqual(statusCode, 401)
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func testHTTP429RateLimitError() async throws {
        MockURLProtocol.mockHTTPError(url: testURL, statusCode: 429, message: "Too many requests")

        do {
            _ = try await client.request(url: testURL, method: .get, retryPolicy: .none)
            XCTFail("Should have thrown error")
        } catch NetworkClient.NetworkError.httpError(let statusCode, _) {
            XCTAssertEqual(statusCode, 429)
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    // MARK: - Network Errors

    func testTimeoutError() async throws {
        MockURLProtocol.mockTimeout()

        do {
            _ = try await client.request(url: testURL, method: .get, retryPolicy: .none)
            XCTFail("Should have thrown error")
        } catch NetworkClient.NetworkError.timeout {
            // Expected
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func testNoConnectionError() async throws {
        MockURLProtocol.mockNoConnection()

        do {
            _ = try await client.request(url: testURL, method: .get, retryPolicy: .none)
            XCTFail("Should have thrown error")
        } catch NetworkClient.NetworkError.requestFailed {
            // Expected - no connection wrapped in requestFailed
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    // MARK: - Retry Logic

    func testExponentialBackoffRetry() async throws {
        var attemptCount = 0

        MockURLProtocol.requestHandler = { _ in
            attemptCount += 1

            if attemptCount < 3 {
                // Fail first 2 attempts
                return MockURLProtocol.errorResponse(
                    url: self.testURL,
                    statusCode: 500,
                    errorMessage: "Temporary error"
                )
            } else {
                // Succeed on 3rd attempt
                return MockURLProtocol.successResponse(
                    url: self.testURL,
                    json: ["status": "success"]
                )
            }
        }

        // Make request with retry policy
        let data = try await client.request(
            url: testURL,
            method: .get,
            retryPolicy: .exponential(maxAttempts: 3)
        )

        // Verify succeeded after retries
        XCTAssertGreaterThan(data.count, 0)
        XCTAssertEqual(attemptCount, 3, "Should have retried twice before succeeding")
    }

    func testCustomRetryPolicy() async throws {
        var attemptCount = 0

        MockURLProtocol.requestHandler = { _ in
            attemptCount += 1

            if attemptCount < 2 {
                // Fail first attempt
                return MockURLProtocol.errorResponse(
                    url: self.testURL,
                    statusCode: 503,
                    errorMessage: "Service unavailable"
                )
            } else {
                // Succeed on 2nd attempt
                return MockURLProtocol.successResponse(
                    url: self.testURL,
                    json: ["status": "recovered"]
                )
            }
        }

        // Make request with custom retry delays
        let data = try await client.request(
            url: testURL,
            method: .get,
            retryPolicy: .custom(delays: [0.1, 0.2])
        )

        XCTAssertGreaterThan(data.count, 0)
        XCTAssertEqual(attemptCount, 2)
    }

    func testNoRetryPolicy() async throws {
        var attemptCount = 0

        MockURLProtocol.requestHandler = { _ in
            attemptCount += 1
            return MockURLProtocol.errorResponse(
                url: self.testURL,
                statusCode: 500,
                errorMessage: "Error"
            )
        }

        do {
            _ = try await client.request(url: testURL, method: .get, retryPolicy: .none)
            XCTFail("Should have thrown error")
        } catch {
            // Verify only 1 attempt was made
            XCTAssertEqual(attemptCount, 1, "Should not retry with .none policy")
        }
    }

    func testRetryExhausted() async throws {
        // Always fail
        MockURLProtocol.mockHTTPError(url: testURL, statusCode: 500)

        do {
            _ = try await client.request(
                url: testURL,
                method: .get,
                retryPolicy: .exponential(maxAttempts: 3)
            )
            XCTFail("Should have thrown error after retries exhausted")
        } catch NetworkClient.NetworkError.httpError(let statusCode, _) {
            XCTAssertEqual(statusCode, 500)
        }
    }

    // MARK: - Codable Convenience Methods

    func testRequestWithCodableResponse() async throws {
        struct TestResponse: Codable {
            let id: Int
            let name: String
            let active: Bool
        }

        let expectedResponse = TestResponse(id: 123, name: "Test", active: true)
        let (response, data) = try MockURLProtocol.successResponse(
            url: testURL,
            object: expectedResponse
        )

        MockURLProtocol.requestHandler = { _ in (response, data) }

        let decoded: TestResponse = try await client.request(
            url: testURL,
            method: .get,
            body: nil as String?,
            retryPolicy: .none
        )

        XCTAssertEqual(decoded.id, 123)
        XCTAssertEqual(decoded.name, "Test")
        XCTAssertTrue(decoded.active)
    }

    func testRequestWithCodableBody() async throws {
        struct TestRequest: Codable {
            let userId: Int
            let action: String
        }

        var capturedRequest: URLRequest?

        MockURLProtocol.requestHandler = { request in
            capturedRequest = request
            return MockURLProtocol.successResponse(
                url: self.testURL,
                json: ["status": "received"]
            )
        }

        let requestBody = TestRequest(userId: 42, action: "create")

        struct TestResponse: Codable {
            let status: String
        }

        let _: TestResponse = try await client.request(
            url: testURL,
            method: .post,
            body: requestBody,
            retryPolicy: .none
        )

        // Verify request body was encoded correctly
        guard let request = capturedRequest, let httpBody = request.httpBody else {
            XCTFail("Request or HTTP body was not captured")
            return
        }
        let decodedBody = try JSONDecoder().decode(
            TestRequest.self,
            from: httpBody
        )
        XCTAssertEqual(decodedBody.userId, 42)
        XCTAssertEqual(decodedBody.action, "create")
    }

    // MARK: - Analytics Integration

    func testRequestCreatesPerformanceEvent() async throws {
        MockURLProtocol.mockSuccessfulGET(url: testURL, json: ["status": "ok"])

        _ = try await client.request(url: testURL, method: .get, retryPolicy: .none)

        // Wait for analytics to be tracked
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents(category: .performance)
            return events.contains { $0.name == "network_request" }
        }, description: "Network request analytics tracked")

        let events = AnalyticsManager.shared.getEvents(category: .performance)
        let networkEvent = events.first { $0.name == "network_request" }

        XCTAssertNotNil(networkEvent)
        XCTAssertNotNil(networkEvent?.properties["url"])
        XCTAssertNotNil(networkEvent?.properties["duration"])
        XCTAssertNotNil(networkEvent?.properties["statusCode"])
        XCTAssertEqual(networkEvent?.properties["success"], .bool(true))
    }

    func testFailedRequestCreatesAnalytics() async throws {
        MockURLProtocol.mockHTTPError(url: testURL, statusCode: 404)

        do {
            _ = try await client.request(url: testURL, method: .get, retryPolicy: .none)
        } catch {
            // Expected error
        }

        // Wait for analytics
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents(category: .performance)
            return events.contains { $0.name == "network_request" }
        }, description: "Failed request analytics tracked")

        let events = AnalyticsManager.shared.getEvents(category: .performance)
        let networkEvent = events.first { $0.name == "network_request" }

        XCTAssertNotNil(networkEvent)
        XCTAssertEqual(networkEvent?.properties["success"], .bool(false))
        XCTAssertEqual(networkEvent?.properties["statusCode"], .int(404))
    }

    // MARK: - Edge Cases

    func testEmptyResponseBody() async throws {
        MockURLProtocol.requestHandler = { _ in
            let response = HTTPURLResponse(
                url: self.testURL,
                statusCode: 204, // No Content
                httpVersion: "HTTP/1.1",
                headerFields: nil
            )!
            return (response, nil)
        }

        let data = try await client.request(url: testURL, method: .delete, retryPolicy: .none)

        XCTAssertEqual(data.count, 0)
    }

    func testLargeResponseBody() async throws {
        // Create 1MB response
        let largeString = String(repeating: "x", count: 1024 * 1024)
        let largeJSON = ["data": largeString]

        MockURLProtocol.mockSuccessfulGET(url: testURL, json: largeJSON)

        let data = try await client.request(url: testURL, method: .get, retryPolicy: .none)

        XCTAssertGreaterThan(data.count, 1_000_000)
    }

    func testConcurrentRequests() async throws {
        MockURLProtocol.mockSuccessfulGET(url: testURL, json: ["status": "ok"])

        // Make 10 concurrent requests
        await withTaskGroup(of: Result<Data, Error>.self) { group in
            for _ in 0..<10 {
                group.addTask {
                    do {
                        let data = try await self.client.request(
                            url: self.testURL,
                            method: .get,
                            retryPolicy: .none
                        )
                        return .success(data)
                    } catch {
                        return .failure(error)
                    }
                }
            }

            var successCount = 0
            for await result in group {
                if case .success = result {
                    successCount += 1
                }
            }

            XCTAssertEqual(successCount, 10, "All concurrent requests should succeed")
        }
    }

    // MARK: - Error Recovery Suggestions

    func testErrorRecoverySuggestions() {
        let rateLimitError = NetworkClient.NetworkError.httpError(statusCode: 429, data: nil)
        XCTAssertTrue(rateLimitError.recoverySuggestion?.contains("Wait") ?? false)

        let serverError = NetworkClient.NetworkError.httpError(statusCode: 500, data: nil)
        XCTAssertTrue(serverError.recoverySuggestion?.contains("later") ?? false)

        let timeoutError = NetworkClient.NetworkError.timeout
        XCTAssertTrue(timeoutError.recoverySuggestion?.contains("connection") ?? false)
    }
}
