//
//  NetworkClientTests.swift
//  angle-rfpTests
//
//  Unit tests for HTTP networking with retry logic
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class NetworkClientTests: XCTestCase {

    var client: NetworkClient!
    private static var cachedLiveNetworkAvailability: Bool?

    private func isConnectivityIssue(_ error: Error) -> Bool {
        if case NetworkClient.NetworkError.timeout = error {
            return true
        }

        if case NetworkClient.NetworkError.requestFailed(let underlyingError) = error {
            let underlying = underlyingError as NSError
            if underlying.domain == NSURLErrorDomain {
                return true
            }
        }

        let nsError = error as NSError
        return nsError.domain == NSURLErrorDomain
    }

    private func requireLiveNetwork() async throws {
        if let available = Self.cachedLiveNetworkAvailability {
            if !available {
                throw XCTSkip("No internet connection available")
            }
            return
        }

        guard let probeURL = URL(string: "https://httpbin.org/status/200") else {
            throw XCTSkip("No internet connection available")
        }

        var request = URLRequest(url: probeURL)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 2.0

        let configuration = URLSessionConfiguration.ephemeral
        configuration.waitsForConnectivity = false
        configuration.timeoutIntervalForRequest = 2.0
        configuration.timeoutIntervalForResource = 2.0
        let session = URLSession(configuration: configuration)

        do {
            let (_, response) = try await session.data(for: request)
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            let available = (200...499).contains(statusCode)
            Self.cachedLiveNetworkAvailability = available

            if !available {
                throw XCTSkip("No internet connection available")
            }
        } catch {
            Self.cachedLiveNetworkAvailability = false
            throw XCTSkip("No internet connection available")
        }
    }

    override func setUp() {
        super.setUp()
        client = NetworkClient.shared
    }

    // MARK: - HTTP Method Tests

    func testHTTPMethodRawValues() {
        XCTAssertEqual(NetworkClient.HTTPMethod.get.rawValue, "GET")
        XCTAssertEqual(NetworkClient.HTTPMethod.post.rawValue, "POST")
        XCTAssertEqual(NetworkClient.HTTPMethod.put.rawValue, "PUT")
        XCTAssertEqual(NetworkClient.HTTPMethod.delete.rawValue, "DELETE")
        XCTAssertEqual(NetworkClient.HTTPMethod.patch.rawValue, "PATCH")
    }

    // MARK: - Retry Policy Tests

    func testRetryPolicyNone() {
        let policy = NetworkClient.RetryPolicy.none

        XCTAssertEqual(policy.maxAttempts, 1)
        XCTAssertNil(policy.delay(forAttempt: 1))
        XCTAssertNil(policy.delay(forAttempt: 2))
    }

    func testRetryPolicyExponential() {
        let policy = NetworkClient.RetryPolicy.exponential(maxAttempts: 3)

        XCTAssertEqual(policy.maxAttempts, 3)
        XCTAssertEqual(policy.delay(forAttempt: 1), nil) // No delay for first attempt
        XCTAssertEqual(policy.delay(forAttempt: 2), 1.0) // 2^0 = 1s
        XCTAssertEqual(policy.delay(forAttempt: 3), 2.0) // 2^1 = 2s
        XCTAssertEqual(policy.delay(forAttempt: 4), 4.0) // 2^2 = 4s
    }

    func testRetryPolicyCustom() {
        let policy = NetworkClient.RetryPolicy.custom(delays: [0.5, 1.0, 2.0])

        XCTAssertEqual(policy.maxAttempts, 4) // 1 initial + 3 retries
        XCTAssertEqual(policy.delay(forAttempt: 1), nil)
        XCTAssertEqual(policy.delay(forAttempt: 2), 0.5)
        XCTAssertEqual(policy.delay(forAttempt: 3), 1.0)
        XCTAssertEqual(policy.delay(forAttempt: 4), 2.0)
    }

    // MARK: - Error Tests

    func testNetworkErrorDescriptions() {
        let invalidURLError = NetworkClient.NetworkError.invalidURL
        XCTAssertNotNil(invalidURLError.errorDescription)

        let httpError = NetworkClient.NetworkError.httpError(statusCode: 404, data: nil)
        XCTAssertTrue(httpError.errorDescription?.contains("404") ?? false)

        let timeoutError = NetworkClient.NetworkError.timeout
        XCTAssertNotNil(timeoutError.errorDescription)

        let circuitBreakerError = NetworkClient.NetworkError.circuitBreakerOpen
        XCTAssertNotNil(circuitBreakerError.errorDescription)
    }

    func testHTTPErrorRecoverySuggestions() {
        let rateLimitError = NetworkClient.NetworkError.httpError(statusCode: 429, data: nil)
        XCTAssertTrue(rateLimitError.recoverySuggestion?.contains("Wait") ?? false)

        let serverError = NetworkClient.NetworkError.httpError(statusCode: 500, data: nil)
        XCTAssertTrue(serverError.recoverySuggestion?.contains("later") ?? false)

        let timeoutError = NetworkClient.NetworkError.timeout
        XCTAssertTrue(timeoutError.recoverySuggestion?.contains("connection") ?? false)
    }

    // MARK: - Live Network Tests (Optional - requires internet)

    // Note: These tests require internet connection and may fail in CI environments
    // Consider using a mock server or URLProtocol for more reliable tests

    func testSuccessfulGETRequest() async throws {
        // Using httpbin.org as a reliable test endpoint
        guard let url = URL(string: "https://httpbin.org/get") else {
            XCTFail("Invalid URL")
            return
        }
        try await requireLiveNetwork()

        do {
            let data = try await client.request(
                url: url,
                method: .get,
                retryPolicy: .none
            )

            XCTAssertGreaterThan(data.count, 0)

            // Verify it's valid JSON
            let json = try JSONSerialization.jsonObject(with: data)
            XCTAssertNotNil(json)
        } catch {
            // Skip test if no internet connection
            if isConnectivityIssue(error) {
                throw XCTSkip("No internet connection available")
            }
            throw error
        }
    }

    func testSuccessfulPOSTRequest() async throws {
        guard let url = URL(string: "https://httpbin.org/post") else {
            XCTFail("Invalid URL")
            return
        }
        try await requireLiveNetwork()

        struct TestRequest: Codable {
            let message: String
            let value: Int
        }

        struct TestResponse: Codable {
            let json: TestRequest
        }

        let requestBody = TestRequest(message: "test", value: 42)

        do {
            let response: TestResponse = try await client.request(
                url: url,
                method: .post,
                body: requestBody,
                retryPolicy: .none
            )

            XCTAssertEqual(response.json.message, "test")
            XCTAssertEqual(response.json.value, 42)
        } catch {
            if isConnectivityIssue(error) {
                throw XCTSkip("No internet connection available")
            }
            throw error
        }
    }

    func testHTTP404Error() async throws {
        guard let url = URL(string: "https://httpbin.org/status/404") else {
            XCTFail("Invalid URL")
            return
        }
        try await requireLiveNetwork()

        do {
            _ = try await client.request(
                url: url,
                method: .get,
                retryPolicy: .none
            )
            XCTFail("Should have thrown error")
        } catch NetworkClient.NetworkError.httpError(let statusCode, _) {
            XCTAssertEqual(statusCode, 404)
        } catch {
            if isConnectivityIssue(error) {
                throw XCTSkip("No internet connection available")
            }
            throw error
        }
    }

    func testRetryOn500Error() async throws {
        // This test would need a mock server that returns 500 then 200
        // Skipping for now as httpbin doesn't support this scenario
        throw XCTSkip("Requires mock server for reliable testing")
    }

    func testJSONDecodingSuccess() async throws {
        guard let url = URL(string: "https://httpbin.org/json") else {
            XCTFail("Invalid URL")
            return
        }
        try await requireLiveNetwork()

        struct SlideShow: Codable {
            let author: String?
            let title: String?
        }

        struct Response: Codable {
            let slideshow: SlideShow?
        }

        do {
            let response: Response = try await client.request(
                url: url,
                method: .get,
                body: nil as String?,
                retryPolicy: .none
            )

            XCTAssertNotNil(response.slideshow)
        } catch {
            if isConnectivityIssue(error) {
                throw XCTSkip("No internet connection available")
            }
            throw error
        }
    }

    // MARK: - Performance Tests

    func testRequestPerformance() async throws {
        guard let url = URL(string: "https://httpbin.org/get") else {
            XCTFail("Invalid URL")
            return
        }
        try await requireLiveNetwork()

        measure {
            let expectation = expectation(description: "Request completed")

            Task {
                do {
                    _ = try await client.request(url: url, retryPolicy: .none)
                    expectation.fulfill()
                } catch {
                    // Ignore errors in performance test
                    expectation.fulfill()
                }
            }

            wait(for: [expectation], timeout: 10.0)
        }
    }

    // MARK: - Custom Headers

    func testCustomHeaders() async throws {
        guard let url = URL(string: "https://httpbin.org/headers") else {
            XCTFail("Invalid URL")
            return
        }
        try await requireLiveNetwork()

        struct Response: Codable {
            let headers: [String: String]
        }

        do {
            let response: Response = try await client.request(
                url: url,
                method: .get,
                headers: ["X-Custom-Header": "test-value"],
                body: nil as String?,
                retryPolicy: .none
            )

            XCTAssertEqual(response.headers["X-Custom-Header"], "test-value")
        } catch {
            if isConnectivityIssue(error) {
                throw XCTSkip("No internet connection available")
            }
            throw error
        }
    }

    func testUserAgentHeader() async throws {
        guard let url = URL(string: "https://httpbin.org/user-agent") else {
            XCTFail("Invalid URL")
            return
        }
        try await requireLiveNetwork()

        struct Response: Codable {
            let userAgent: String

            enum CodingKeys: String, CodingKey {
                case userAgent = "user-agent"
            }
        }

        do {
            let response: Response = try await client.request(
                url: url,
                method: .get,
                body: nil as String?,
                retryPolicy: .none
            )

            XCTAssertTrue(response.userAgent.contains("angle-rfp"))
        } catch {
            if isConnectivityIssue(error) {
                throw XCTSkip("No internet connection available")
            }
            throw error
        }
    }

    // MARK: - Analytics Integration

    func testRequestCreatesPerformanceEvent() async throws {
        // Clear analytics first
        AnalyticsManager.shared.clearAllDataSync()

        guard let url = URL(string: "https://httpbin.org/get") else {
            XCTFail("Invalid URL")
            return
        }
        try await requireLiveNetwork()

        do {
            _ = try await client.request(url: url, retryPolicy: .none)

            // Wait for analytics to be tracked
            try await Task.sleep(nanoseconds: 500_000_000) // 500ms

            AnalyticsManager.shared.flushSync()

            try await Task.sleep(nanoseconds: 500_000_000)

            let events = AnalyticsManager.shared.getEvents(category: .performance)

            // Verify network request performance is tracked
            XCTAssertTrue(events.contains { $0.name == "network_request" })
        } catch {
            if isConnectivityIssue(error) {
                throw XCTSkip("No internet connection available")
            }
            throw error
        }
    }
}
