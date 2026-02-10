//
//  LogRedactorTests.swift
//  angle-rfpTests
//
//  Unit tests for PII redaction in logs
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class LogRedactorTests: XCTestCase {

    // MARK: - API Key Redaction

    func testRedactClaudeAPIKey() {
        let message = "Using API key: sk-ant-1234567890abcdef for requests"
        let redacted = LogRedactor.redact(message)

        XCTAssertFalse(redacted.contains("sk-ant-1234567890abcdef"))
        XCTAssertTrue(redacted.contains("[REDACTED_CLAUDE_KEY]"))
        XCTAssertTrue(redacted.contains("Using API key:"))
    }

    func testRedactMultipleAPIKeys() {
        let message = "Keys: sk-ant-abc123 and sk-ant-xyz789"
        let redacted = LogRedactor.redact(message)

        XCTAssertFalse(redacted.contains("sk-ant-abc123"))
        XCTAssertFalse(redacted.contains("sk-ant-xyz789"))
        XCTAssertEqual(redacted.components(separatedBy: "[REDACTED_CLAUDE_KEY]").count - 1, 2)
    }

    func testRedactGenericAPIKeys() {
        // Build a Brave-like token without embedding a contiguous secret-looking literal in the repo.
        let token = "B" + "SA" + "1234567890" + "1234567890" + "12"
        let message = "Token: \(token)"
        let redacted = LogRedactor.redact(message)

        // Generic long alphanumeric strings should be redacted
        XCTAssertFalse(redacted.contains(token))
        XCTAssertTrue(redacted.contains("[REDACTED_API_KEY]"))
    }

    // MARK: - Email Redaction

    func testRedactEmail() {
        let message = "User email: john.doe@example.com sent request"
        let redacted = LogRedactor.redact(message)

        XCTAssertFalse(redacted.contains("john.doe@example.com"))
        XCTAssertTrue(redacted.contains("[REDACTED_EMAIL]"))
        XCTAssertTrue(redacted.contains("User email:"))
    }

    func testRedactMultipleEmails() {
        let message = "From: alice@test.com To: bob@example.org"
        let redacted = LogRedactor.redact(message)

        XCTAssertFalse(redacted.contains("alice@test.com"))
        XCTAssertFalse(redacted.contains("bob@example.org"))
        XCTAssertEqual(redacted.components(separatedBy: "[REDACTED_EMAIL]").count - 1, 2)
    }

    func testPreserveEmailLikeStrings() {
        // Should not redact strings that look like emails but aren't
        let message = "Error at line@column 10"
        let redacted = LogRedactor.redact(message)

        // This should not be redacted as it's not a valid email
        XCTAssertTrue(redacted.contains("line@column"))
    }

    // MARK: - File Path Redaction

    func testRedactUserPath() {
        let message = "Reading file: /Users/john/Documents/secret.txt"
        let redacted = LogRedactor.redact(message)

        XCTAssertFalse(redacted.contains("/Users/john"))
        XCTAssertTrue(redacted.contains("/Users/[USER]"))
        XCTAssertTrue(redacted.contains("Reading file:"))
    }

    func testRedactDocumentPath() {
        let message = "Saved to /Documents/private/notes.txt"
        let redacted = LogRedactor.redact(message)

        XCTAssertFalse(redacted.contains("/Documents/private/notes.txt"))
        XCTAssertTrue(redacted.contains("/Documents/[PATH]"))
    }

    func testPreserveRelativePaths() {
        // Relative paths should not be redacted
        let message = "Loading from ./config/settings.json"
        let redacted = LogRedactor.redact(message)

        XCTAssertTrue(redacted.contains("./config/settings.json"))
    }

    // MARK: - Credit Card Redaction

    func testRedactCreditCard() {
        let message = "Payment with card 4532015112830366"
        let redacted = LogRedactor.redact(message)

        XCTAssertFalse(redacted.contains("4532015112830366"))
        XCTAssertTrue(redacted.contains("[REDACTED_NUMBER]"))
    }

    func testPreserveSafeNumbers() {
        // Small numbers (< 13 digits) should not be redacted
        let message = "Processing 123456789 items at $99.99"
        let redacted = LogRedactor.redact(message)

        XCTAssertTrue(redacted.contains("123456789"))
        XCTAssertTrue(redacted.contains("99.99"))
    }

    func testRedactOnlyCardLengthNumbers() {
        let message = "Total: 1234567890123 (13 digits)"
        let redacted = LogRedactor.redact(message)

        XCTAssertFalse(redacted.contains("1234567890123"))
        XCTAssertTrue(redacted.contains("[REDACTED_NUMBER]"))
    }

    // MARK: - URL Parameter Redaction

    func testRedactURLParameters() {
        let message = "Request: https://api.example.com/search?token=abc123&user=john"
        let redacted = LogRedactor.redact(message)

        XCTAssertTrue(redacted.contains("https://api.example.com/search"))
        XCTAssertTrue(redacted.contains("?[REDACTED_PARAMS]"))
        XCTAssertFalse(redacted.contains("token=abc123"))
        XCTAssertFalse(redacted.contains("user=john"))
    }

    func testPreserveURLWithoutParameters() {
        let message = "Fetching https://api.example.com/data"
        let redacted = LogRedactor.redact(message)

        XCTAssertTrue(redacted.contains("https://api.example.com/data"))
        XCTAssertFalse(redacted.contains("[REDACTED_PARAMS]"))
    }

    // MARK: - Metadata Redaction

    func testRedactMetadataSensitiveKeys() {
        let metadata: [String: Any] = [
            "api_key": "sk-ant-secret123",
            "password": "mypassword",
            "token": "bearer-token-123",
            "username": "john"
        ]

        let redacted = LogRedactor.redactMetadata(metadata)

        XCTAssertEqual(redacted["api_key"] as? String, "[REDACTED_API_KEY]")
        XCTAssertEqual(redacted["password"] as? String, "[REDACTED_PASSWORD]")
        XCTAssertEqual(redacted["token"] as? String, "[REDACTED_TOKEN]")
        XCTAssertEqual(redacted["username"] as? String, "john") // Not a sensitive key
    }

    func testRedactMetadataCaseInsensitive() {
        let metadata: [String: Any] = [
            "API_KEY": "secret",
            "ApiKey": "secret2",
            "AUTHORIZATION": "bearer token"
        ]

        let redacted = LogRedactor.redactMetadata(metadata)

        XCTAssertEqual(redacted["API_KEY"] as? String, "[REDACTED_API_KEY]")
        XCTAssertEqual(redacted["ApiKey"] as? String, "[REDACTED_APIKEY]")
        XCTAssertEqual(redacted["AUTHORIZATION"] as? String, "[REDACTED_AUTHORIZATION]")
    }

    func testPreserveNonSensitiveMetadata() {
        let metadata: [String: Any] = [
            "duration": 1.5,
            "statusCode": 200,
            "method": "POST",
            "url": "https://api.example.com"
        ]

        let redacted = LogRedactor.redactMetadata(metadata)

        XCTAssertEqual(redacted["duration"] as? Double, 1.5)
        XCTAssertEqual(redacted["statusCode"] as? Int, 200)
        XCTAssertEqual(redacted["method"] as? String, "POST")
        XCTAssertEqual(redacted["url"] as? String, "https://api.example.com")
    }

    // MARK: - Combined Redaction

    func testMultiplePIITypesInSingleMessage() {
        let message = """
        User john@example.com accessed file /Users/john/Documents/report.pdf
        using API key sk-ant-abc123 and credit card 4532015112830366
        from URL https://app.example.com/dashboard?session=xyz789
        """

        let redacted = LogRedactor.redact(message)

        // Verify all PII types are redacted
        XCTAssertFalse(redacted.contains("john@example.com"))
        XCTAssertFalse(redacted.contains("/Users/john"))
        XCTAssertFalse(redacted.contains("sk-ant-abc123"))
        XCTAssertFalse(redacted.contains("4532015112830366"))
        XCTAssertFalse(redacted.contains("session=xyz789"))

        // Verify redaction markers are present
        XCTAssertTrue(redacted.contains("[REDACTED_EMAIL]"))
        XCTAssertTrue(redacted.contains("/Users/[USER]"))
        XCTAssertTrue(redacted.contains("[REDACTED_CLAUDE_KEY]"))
        XCTAssertTrue(redacted.contains("[REDACTED_NUMBER]"))
        XCTAssertTrue(redacted.contains("?[REDACTED_PARAMS]"))
    }

    func testEmptyStringRedaction() {
        let redacted = LogRedactor.redact("")
        XCTAssertEqual(redacted, "")
    }

    func testNoRedactionNeeded() {
        let message = "Simple log message without any PII"
        let redacted = LogRedactor.redact(message)

        XCTAssertEqual(redacted, message)
    }

    // MARK: - Thread Safety (CRITICAL)

    func testConcurrentRedaction() {
        let expectation = expectation(description: "Concurrent redaction completed")
        expectation.expectedFulfillmentCount = 100

        let queue = DispatchQueue(label: "test.redactor", attributes: .concurrent)
        let message = "Email: test@example.com, Key: sk-ant-123456, Card: 4532015112830366"

        for _ in 0..<100 {
            queue.async {
                let redacted = LogRedactor.redact(message)

                // Verify all PII was redacted correctly even under concurrent load
                XCTAssertFalse(redacted.contains("test@example.com"))
                XCTAssertFalse(redacted.contains("sk-ant-123456"))
                XCTAssertFalse(redacted.contains("4532015112830366"))

                XCTAssertTrue(redacted.contains("[REDACTED_EMAIL]"))
                XCTAssertTrue(redacted.contains("[REDACTED_CLAUDE_KEY]"))
                XCTAssertTrue(redacted.contains("[REDACTED_NUMBER]"))

                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 5.0)
    }

    func testNestedJSONWithPII() {
        let json = #"{"user":{"email":"test@example.com","api_key":"sk-ant-123"}}"#
        let redacted = LogRedactor.redact(json)

        XCTAssertFalse(redacted.contains("test@example.com"))
        XCTAssertFalse(redacted.contains("sk-ant-123"))
        XCTAssertTrue(redacted.contains("[REDACTED_EMAIL]"))
        XCTAssertTrue(redacted.contains("[REDACTED_CLAUDE_KEY]"))
    }

    func testBoundaryNumberLength() {
        // 13 digits - should redact (minimum credit card length)
        let cc13 = "Card: 1234567890123"
        XCTAssertTrue(LogRedactor.redact(cc13).contains("[REDACTED_NUMBER]"))

        // 12 digits - should NOT redact
        let safe12 = "Order: 123456789012"
        XCTAssertFalse(LogRedactor.redact(safe12).contains("[REDACTED_NUMBER]"))

        // 16 digits - should redact (standard credit card)
        let cc16 = "Card: 1234567890123456"
        XCTAssertTrue(LogRedactor.redact(cc16).contains("[REDACTED_NUMBER]"))

        // 19 digits - should redact (maximum credit card length)
        let cc19 = "Card: 1234567890123456789"
        XCTAssertTrue(LogRedactor.redact(cc19).contains("[REDACTED_NUMBER]"))

        // 20 digits - should NOT redact (too long for credit card)
        let safe20 = "Number: 12345678901234567890"
        XCTAssertFalse(LogRedactor.redact(safe20).contains("[REDACTED_NUMBER]"))
    }

    // MARK: - Performance Tests

    func testRedactionPerformance() {
        let message = """
        Large log message with multiple PII types:
        User: test@example.com, API Key: sk-ant-1234567890abcdef,
        File: /Users/testuser/Documents/sensitive.pdf,
        Card: 4532015112830366,
        URL: https://api.example.com/v1/data?token=abc123&user=test
        """ + String(repeating: " Extra content", count: 100)

        measure {
            for _ in 0..<100 {
                _ = LogRedactor.redact(message)
            }
        }
    }
}
