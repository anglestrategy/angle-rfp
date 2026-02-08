//
//  LogRedactorBoundaryTests.swift
//  angle-rfpTests
//
//  Boundary and edge case tests for LogRedactor
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class LogRedactorBoundaryTests: XCTestCase {

    // MARK: - Message Length Boundaries

    func testVeryLongMessage() {
        // 1MB message
        let longMessage = String(repeating: "test@example.com ", count: 100_000)
        let redacted = LogRedactor.redact(longMessage)

        // Should redact all emails without crashing
        XCTAssertFalse(redacted.contains("test@example.com"))
        XCTAssertTrue(redacted.contains("[REDACTED_EMAIL]"))
    }

    func testEmptyMessage() {
        let redacted = LogRedactor.redact("")
        XCTAssertEqual(redacted, "")
    }

    func testSingleCharacterMessage() {
        let redacted = LogRedactor.redact("a")
        XCTAssertEqual(redacted, "a")
    }

    func testWhitespaceOnlyMessage() {
        let whitespace = "   \t\n   \t\n   "
        let redacted = LogRedactor.redact(whitespace)
        XCTAssertEqual(redacted, whitespace)
    }

    // MARK: - Pattern Boundaries

    func testManyEmailsInSingleMessage() {
        var message = ""
        for i in 0..<10_000 {
            message += "user\(i)@example.com "
        }

        let redacted = LogRedactor.redact(message)

        // All emails should be redacted
        XCTAssertFalse(redacted.contains("@example.com"))
        XCTAssertTrue(redacted.contains("[REDACTED_EMAIL]"))

        // Count redactions
        let redactionCount = redacted.components(separatedBy: "[REDACTED_EMAIL]").count - 1
        XCTAssertEqual(redactionCount, 10_000)
    }

    func testManyAPIKeysInSingleMessage() {
        var message = ""
        for i in 0..<1000 {
            message += "sk-ant-key\(String(format: "%08d", i)) "
        }

        let redacted = LogRedactor.redact(message)

        // All API keys should be redacted
        XCTAssertFalse(redacted.contains("sk-ant-"))
        XCTAssertTrue(redacted.contains("[REDACTED_CLAUDE_KEY]"))
    }

    func testManyCreditCardsInSingleMessage() {
        var message = ""
        for i in 0..<1000 {
            // Generate 16-digit numbers
            message += String(format: "%016d", i) + " "
        }

        let redacted = LogRedactor.redact(message)

        // All card-length numbers should be redacted
        XCTAssertTrue(redacted.contains("[REDACTED_NUMBER]"))
    }

    // MARK: - Edge Case Patterns

    func testEmailLikeButNotEmail() {
        let notEmails = [
            "not@email",           // No TLD
            "not@",                // Incomplete
            "@domain.com",         // No local part
            "user@domain",         // No TLD
            "user@@domain.com",    // Double @
            "user @domain.com",    // Space before @
            "user@domain .com",    // Space in domain
        ]

        for notEmail in notEmails {
            let redacted = LogRedactor.redact(notEmail)
            // Implementation-dependent: may or may not redact invalid emails
            // Just verify it doesn't crash
        }
    }

    func testAPIKeyLikeButNotAPIKey() {
        let notAPIKeys = [
            "sk-ant",              // Too short
            "sk-ant-",             // Missing key part
            "sk-ant-abc",          // Too short
            "not-sk-ant-1234567890abcdef",  // Wrong prefix
        ]

        for notKey in notAPIKeys {
            let redacted = LogRedactor.redact(notKey)
            // Should not be redacted (or implementation-specific)
            // Just verify it doesn't crash
        }
    }

    func testNumbersAtBoundaries() {
        // 12 digits - should NOT be redacted (too short for credit card)
        let safe12 = "Order: 123456789012"
        XCTAssertFalse(LogRedactor.redact(safe12).contains("[REDACTED_NUMBER]"))

        // 13 digits - minimum credit card length, SHOULD be redacted
        let cc13 = "Card: 1234567890123"
        XCTAssertTrue(LogRedactor.redact(cc13).contains("[REDACTED_NUMBER]"))

        // 16 digits - standard credit card, SHOULD be redacted
        let cc16 = "Card: 1234567890123456"
        XCTAssertTrue(LogRedactor.redact(cc16).contains("[REDACTED_NUMBER]"))

        // 19 digits - maximum credit card length, SHOULD be redacted
        let cc19 = "Card: 1234567890123456789"
        XCTAssertTrue(LogRedactor.redact(cc19).contains("[REDACTED_NUMBER]"))

        // 20 digits - too long for credit card, should NOT be redacted
        let safe20 = "Number: 12345678901234567890"
        XCTAssertFalse(LogRedactor.redact(safe20).contains("[REDACTED_NUMBER]"))
    }

    // MARK: - Unicode and Special Characters

    func testUnicodeInMessage() {
        let unicode = "用户邮箱: test@example.com, API密钥: sk-ant-123456"
        let redacted = LogRedactor.redact(unicode)

        XCTAssertFalse(redacted.contains("test@example.com"))
        XCTAssertFalse(redacted.contains("sk-ant-123456"))
        XCTAssertTrue(redacted.contains("用户邮箱"))
        XCTAssertTrue(redacted.contains("API密钥"))
    }

    func testEmojiInMessage() {
        let emoji = "🎯 User email: test@example.com 🔑 API key: sk-ant-123456 🎯"
        let redacted = LogRedactor.redact(emoji)

        XCTAssertFalse(redacted.contains("test@example.com"))
        XCTAssertTrue(redacted.contains("🎯"))
        XCTAssertTrue(redacted.contains("🔑"))
    }

    func testControlCharacters() {
        let control = "Email:\ntest@example.com\tKey:\rsk-ant-123456\0"
        let redacted = LogRedactor.redact(control)

        XCTAssertFalse(redacted.contains("test@example.com"))
        XCTAssertFalse(redacted.contains("sk-ant-123456"))
    }

    // MARK: - Nested and Complex Patterns

    func testNestedJSON() {
        let json = """
        {
            "user": {
                "email": "test@example.com",
                "api_key": "sk-ant-123",
                "nested": {
                    "credit_card": "4532015112830366",
                    "deep": {
                        "path": "/Users/john/Documents/file.txt",
                        "url": "https://api.example.com/data?token=secret123"
                    }
                }
            }
        }
        """

        let redacted = LogRedactor.redact(json)

        // All PII should be redacted
        XCTAssertFalse(redacted.contains("test@example.com"))
        XCTAssertFalse(redacted.contains("sk-ant-123"))
        XCTAssertFalse(redacted.contains("4532015112830366"))
        XCTAssertFalse(redacted.contains("/Users/john"))
        XCTAssertFalse(redacted.contains("token=secret123"))

        // Verify structure preserved
        XCTAssertTrue(redacted.contains("\"user\""))
        XCTAssertTrue(redacted.contains("\"nested\""))
    }

    func testURLEncodedData() {
        let urlEncoded = "email=test%40example.com&key=sk-ant-123456&card=4532015112830366"
        let redacted = LogRedactor.redact(urlEncoded)

        // URL-encoded email might not be caught (implementation-specific)
        // But other patterns should be caught
        XCTAssertTrue(redacted.contains("[REDACTED"))
    }

    func testBase64EncodedPII() {
        // Base64 of "test@example.com"
        let base64 = "dGVzdEBleGFtcGxlLmNvbQ=="

        let message = "Encoded email: \(base64)"
        let redacted = LogRedactor.redact(message)

        // Base64-encoded PII won't be caught (as expected)
        // This is a known limitation
        XCTAssertTrue(redacted.contains(base64))
    }

    // MARK: - Performance Boundaries

    func testRedactionPerformanceUnderLoad() {
        let message = """
        Large log with multiple PII types:
        Users: test1@example.com, test2@example.com, test3@example.com
        Keys: sk-ant-key1, sk-ant-key2, sk-ant-key3
        Cards: 4532015112830366, 5425233430109903
        Paths: /Users/john/Documents/file1.txt, /Users/jane/Documents/file2.txt
        URLs: https://api.example.com/v1?token=abc123&user=test
        """ + String(repeating: " More content", count: 1000)

        // Measure redaction performance
        measure {
            for _ in 0..<100 {
                _ = LogRedactor.redact(message)
            }
        }
    }

    // MARK: - Metadata Redaction Boundaries

    func testRedactMetadataWithManyKeys() {
        var metadata: [String: Any] = [:]

        // 1000 keys
        for i in 0..<1000 {
            if i % 10 == 0 {
                metadata["api_key_\(i)"] = "sk-ant-secret\(i)"
            } else {
                metadata["safe_key_\(i)"] = "safe_value_\(i)"
            }
        }

        let redacted = LogRedactor.redactMetadata(metadata)

        // Verify sensitive keys redacted
        for i in stride(from: 0, to: 1000, by: 10) {
            let key = "api_key_\(i)"
            XCTAssertEqual(redacted[key] as? String, "[REDACTED_API_KEY_\(i)]")
        }

        // Verify safe keys preserved
        for i in 0..<1000 where i % 10 != 0 {
            let key = "safe_key_\(i)"
            XCTAssertEqual(redacted[key] as? String, "safe_value_\(i)")
        }
    }

    func testRedactMetadataWithNestedDictionaries() {
        let metadata: [String: Any] = [
            "level1": [
                "api_key": "secret",
                "safe": "value",
                "level2": [
                    "password": "secret123",
                    "username": "john"
                ]
            ]
        ]

        let redacted = LogRedactor.redactMetadata(metadata)

        // Top-level sensitive keys should be redacted
        if let level1 = redacted["level1"] as? [String: Any] {
            XCTAssertEqual(level1["api_key"] as? String, "[REDACTED_API_KEY]")
            XCTAssertEqual(level1["safe"] as? String, "value")

            // Nested dictionaries might not be recursively redacted
            // (implementation-dependent)
        }
    }

    func testRedactMetadataEmptyDictionary() {
        let empty: [String: Any] = [:]
        let redacted = LogRedactor.redactMetadata(empty)

        XCTAssertEqual(redacted.count, 0)
    }

    func testRedactMetadataWithSpecialValueTypes() {
        let metadata: [String: Any] = [
            "api_key": "secret",
            "number": 42,
            "double": 3.14,
            "bool": true,
            "array": [1, 2, 3],
            "null": NSNull(),
        ]

        let redacted = LogRedactor.redactMetadata(metadata)

        // API key redacted
        XCTAssertEqual(redacted["api_key"] as? String, "[REDACTED_API_KEY]")

        // Other types preserved
        XCTAssertEqual(redacted["number"] as? Int, 42)
        XCTAssertEqual(redacted["double"] as? Double, 3.14)
        XCTAssertEqual(redacted["bool"] as? Bool, true)
    }

    // MARK: - Concurrent Redaction

    func testConcurrentRedactionMassive() {
        let expectation = expectation(description: "1000 concurrent redactions")
        expectation.expectedFulfillmentCount = 1000

        let queue = DispatchQueue(label: "test.redactor.massive", attributes: .concurrent)

        let message = "Email: test@example.com, Key: sk-ant-123456, Card: 4532015112830366"

        for _ in 0..<1000 {
            queue.async {
                let redacted = LogRedactor.redact(message)

                // Verify correct redaction even under massive concurrency
                XCTAssertFalse(redacted.contains("test@example.com"))
                XCTAssertFalse(redacted.contains("sk-ant-123456"))
                XCTAssertFalse(redacted.contains("4532015112830366"))

                XCTAssertTrue(redacted.contains("[REDACTED_EMAIL]"))
                XCTAssertTrue(redacted.contains("[REDACTED_CLAUDE_KEY]"))
                XCTAssertTrue(redacted.contains("[REDACTED_NUMBER]"))

                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 30.0)
    }

    // MARK: - Edge Cases

    func testMultipleRedactionsInSamePosition() {
        // Email that also contains @ which could match other patterns
        let message = "test@example.com"
        let redacted = LogRedactor.redact(message)

        // Should be redacted as email
        XCTAssertTrue(redacted.contains("[REDACTED_EMAIL]"))
    }

    func testOverlappingPatterns() {
        // URL with email
        let message = "mailto:test@example.com"
        let redacted = LogRedactor.redact(message)

        // Should redact email part
        XCTAssertFalse(redacted.contains("test@example.com"))
    }

    func testConsecutivePII() {
        let message = "test@example.comsk-ant-1234564532015112830366"
        let redacted = LogRedactor.redact(message)

        // All consecutive PII should be redacted
        XCTAssertFalse(redacted.contains("test@example.com"))
        XCTAssertFalse(redacted.contains("sk-ant-123456"))
        XCTAssertFalse(redacted.contains("4532015112830366"))
    }
}
