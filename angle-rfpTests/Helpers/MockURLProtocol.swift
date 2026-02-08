//
//  MockURLProtocol.swift
//  angle-rfpTests
//
//  Mock URLProtocol for testing network requests without external dependencies
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import Foundation

/// Mock URLProtocol for intercepting and mocking HTTP requests in tests
final class MockURLProtocol: URLProtocol {

    // MARK: - Mock Response Configuration

    /// Handler that provides mock responses for requests
    private static let handlerLock = NSLock()
    private static var _requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data?))?

    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data?))? {
        get { withHandlerLock { _requestHandler } }
        set { withHandlerLock { _requestHandler = newValue } }
    }

    /// Reset all mock configurations
    static func reset() {
        requestHandler = nil
    }

    private static func withHandlerLock<T>(_ operation: () -> T) -> T {
        handlerLock.lock()
        defer { handlerLock.unlock() }
        return operation()
    }

    /// URLSession can provide request body as a stream; normalize it to Data for tests.
    private static func materializedRequest(_ request: URLRequest) -> URLRequest {
        guard request.httpBody == nil, let bodyStream = request.httpBodyStream else {
            return request
        }

        var requestCopy = request
        if let bodyData = readAll(from: bodyStream) {
            requestCopy.httpBody = bodyData
        }
        return requestCopy
    }

    private static func readAll(from stream: InputStream) -> Data? {
        stream.open()
        defer { stream.close() }

        var data = Data()
        let bufferSize = 4096
        var buffer = [UInt8](repeating: 0, count: bufferSize)

        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: bufferSize)
            if read < 0 {
                return nil
            }
            if read == 0 {
                break
            }
            data.append(buffer, count: read)
        }

        return data.isEmpty ? nil : data
    }

    // MARK: - URLProtocol Overrides

    override class func canInit(with request: URLRequest) -> Bool {
        // Intercept all requests when handler is configured
        return true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        return request
    }

    override func startLoading() {
        guard let handler = MockURLProtocol.requestHandler else {
            // No handler configured - fail the request
            client?.urlProtocol(
                self,
                didFailWithError: NSError(
                    domain: NSURLErrorDomain,
                    code: NSURLErrorNotConnectedToInternet,
                    userInfo: [NSLocalizedDescriptionKey: "No mock handler configured"]
                )
            )
            return
        }

        do {
            // Get mock response from handler
            let normalizedRequest = Self.materializedRequest(request)
            let (response, data) = try handler(normalizedRequest)

            // Send response to client
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)

            // Send data if provided
            if let data = data {
                client?.urlProtocol(self, didLoad: data)
            }

            // Finish loading
            client?.urlProtocolDidFinishLoading(self)

        } catch {
            // Handler threw error - propagate to client
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {
        // Nothing to stop in mock
    }
}

// MARK: - Mock Response Builders

extension MockURLProtocol {

    /// Create a successful JSON response
    static func successResponse(
        url: URL,
        statusCode: Int = 200,
        json: [String: Any]
    ) -> (HTTPURLResponse, Data?) {
        let response = HTTPURLResponse(
            url: url,
            statusCode: statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!

        let data = try? JSONSerialization.data(withJSONObject: json)
        return (response, data)
    }

    /// Create a successful response with Codable object
    static func successResponse<T: Encodable>(
        url: URL,
        statusCode: Int = 200,
        object: T
    ) throws -> (HTTPURLResponse, Data?) {
        let response = HTTPURLResponse(
            url: url,
            statusCode: statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!

        let encoder = JSONEncoder()
        let data = try encoder.encode(object)
        return (response, data)
    }

    /// Create an error response (4xx or 5xx)
    static func errorResponse(
        url: URL,
        statusCode: Int,
        errorMessage: String? = nil
    ) -> (HTTPURLResponse, Data?) {
        let response = HTTPURLResponse(
            url: url,
            statusCode: statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!

        var data: Data?
        if let errorMessage = errorMessage {
            let errorJSON = ["error": errorMessage]
            data = try? JSONSerialization.data(withJSONObject: errorJSON)
        }

        return (response, data)
    }

    /// Create a network error (timeout, no connection, etc.)
    static func networkError(
        code: Int = NSURLErrorNotConnectedToInternet,
        description: String? = nil
    ) -> NSError {
        return NSError(
            domain: NSURLErrorDomain,
            code: code,
            userInfo: description.map { [NSLocalizedDescriptionKey: $0] }
        )
    }
}

// MARK: - Common Test Scenarios

extension MockURLProtocol {

    /// Configure mock to return successful GET response
    static func mockSuccessfulGET(url: URL, json: [String: Any]) {
        requestHandler = { request in
            guard request.url == url else {
                throw networkError(code: NSURLErrorBadURL, description: "Unexpected URL")
            }
            return successResponse(url: url, json: json)
        }
    }

    /// Configure mock to return successful POST response with request echo
    static func mockSuccessfulPOST(url: URL) {
        requestHandler = { request in
            guard request.url == url else {
                throw networkError(code: NSURLErrorBadURL, description: "Unexpected URL")
            }

            // Echo back the request body
            var json: [String: Any] = [:]
            if let body = request.httpBody,
               let requestJSON = try? JSONSerialization.jsonObject(with: body) as? [String: Any] {
                json["json"] = requestJSON
            }

            return successResponse(url: url, json: json)
        }
    }

    /// Configure mock to return HTTP error
    static func mockHTTPError(url: URL, statusCode: Int, message: String? = nil) {
        requestHandler = { request in
            guard request.url == url else {
                throw networkError(code: NSURLErrorBadURL, description: "Unexpected URL")
            }
            return errorResponse(url: url, statusCode: statusCode, errorMessage: message)
        }
    }

    /// Configure mock to return network timeout
    static func mockTimeout() {
        requestHandler = { _ in
            throw networkError(code: NSURLErrorTimedOut, description: "Request timed out")
        }
    }

    /// Configure mock to return no internet connection error
    static func mockNoConnection() {
        requestHandler = { _ in
            throw networkError(code: NSURLErrorNotConnectedToInternet, description: "No internet connection")
        }
    }

    /// Configure mock to succeed after N failures (for retry testing)
    static func mockSucceedAfterFailures(
        url: URL,
        failures: Int,
        json: [String: Any]
    ) {
        var attemptCount = 0

        requestHandler = { request in
            attemptCount += 1

            if attemptCount <= failures {
                // Return 500 error for first N attempts
                return errorResponse(url: url, statusCode: 500, errorMessage: "Temporary server error")
            } else {
                // Succeed on subsequent attempts
                return successResponse(url: url, json: json)
            }
        }
    }

    /// Configure mock to track request history
    static func mockWithRequestTracking(
        url: URL,
        json: [String: Any],
        onRequest: @escaping (URLRequest) -> Void
    ) {
        requestHandler = { request in
            onRequest(request)
            return successResponse(url: url, json: json)
        }
    }
}

// MARK: - URLSession Configuration Helper

extension URLSession {

    /// Create URLSession configured to use MockURLProtocol
    static func makeMockSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]

        // Disable caching for tests
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData

        return URLSession(configuration: configuration)
    }
}
