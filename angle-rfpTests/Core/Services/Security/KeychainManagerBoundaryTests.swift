//
//  KeychainManagerBoundaryTests.swift
//  angle-rfpTests
//
//  Boundary and edge case tests for KeychainManager
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class KeychainManagerBoundaryTests: XCTestCase {
    override class func setUp() {
        super.setUp()
        AppLogger.suppressConsoleOutput = true
    }

    override class func tearDown() {
        AppLogger.suppressConsoleOutput = false
        super.tearDown()
    }

    var manager: KeychainManager!

    override func setUp() {
        super.setUp()
        manager = KeychainManager.shared

        // Clean up test keys
        try? manager.delete(.claudeAPIKey)
        try? manager.delete(.braveAPIKey)
        try? manager.delete(.custom("test_key"))
    }

    override func tearDown() {
        try? manager.delete(.claudeAPIKey)
        try? manager.delete(.braveAPIKey)
        try? manager.delete(.custom("test_key"))
        super.tearDown()
    }

    // MARK: - Value Length Boundaries

    func testVeryLongValue() throws {
        // 1MB string
        let longValue = String(repeating: "x", count: 1024 * 1024)
        let key = KeychainManager.KeychainKey.custom("long_value_key")

        try manager.set(longValue, forKey: key)

        let retrieved = try manager.get(key)
        XCTAssertEqual(retrieved.count, 1024 * 1024)
    }

    func testEmptyStringValue() throws {
        let key = KeychainManager.KeychainKey.custom("empty_value")

        try manager.set("", forKey: key)

        let retrieved = try manager.get(key)
        XCTAssertEqual(retrieved, "")

        try manager.delete(key)
    }

    func testSingleCharacterValue() throws {
        let key = KeychainManager.KeychainKey.custom("single_char")

        try manager.set("x", forKey: key)

        let retrieved = try manager.get(key)
        XCTAssertEqual(retrieved, "x")

        try manager.delete(key)
    }

    func testUnicodeValue() throws {
        let unicodeValue = "🎯测试キー🔑 Привет مرحبا"
        let key = KeychainManager.KeychainKey.custom("unicode_value")

        try manager.set(unicodeValue, forKey: key)

        let retrieved = try manager.get(key)
        XCTAssertEqual(retrieved, unicodeValue)

        try manager.delete(key)
    }

    func testValueWithSpecialCharacters() throws {
        let specialValue = "value\nwith\ttabs\rand\nnewlines\0null"
        let key = KeychainManager.KeychainKey.custom("special_chars")

        try manager.set(specialValue, forKey: key)

        let retrieved = try manager.get(key)
        XCTAssertEqual(retrieved, specialValue)

        try manager.delete(key)
    }

    func testValueWithControlCharacters() throws {
        let controlChars = String(bytes: [0x00, 0x01, 0x02, 0x1F, 0x7F], encoding: .utf8) ?? ""
        let key = KeychainManager.KeychainKey.custom("control_chars")

        try manager.set("prefix" + controlChars + "suffix", forKey: key)

        let retrieved = try manager.get(key)
        XCTAssertTrue(retrieved.contains("prefix"))
        XCTAssertTrue(retrieved.contains("suffix"))

        try manager.delete(key)
    }

    // MARK: - Key Name Boundaries

    func testVeryLongCustomKey() throws {
        let longKeyName = String(repeating: "a", count: 1000)
        let key = KeychainManager.KeychainKey.custom(longKeyName)

        try manager.set("value", forKey: key)

        let retrieved = try manager.get(key)
        XCTAssertEqual(retrieved, "value")

        try manager.delete(key)
    }

    func testEmptyCustomKey() throws {
        let key = KeychainManager.KeychainKey.custom("")

        try manager.set("value", forKey: key)

        let retrieved = try manager.get(key)
        XCTAssertEqual(retrieved, "value")

        try manager.delete(key)
    }

    func testKeyWithSpecialCharacters() throws {
        let specialKey = "key/with\\special:chars@#$%^&*()"
        let key = KeychainManager.KeychainKey.custom(specialKey)

        try manager.set("value", forKey: key)

        let retrieved = try manager.get(key)
        XCTAssertEqual(retrieved, "value")

        try manager.delete(key)
    }

    // MARK: - Concurrent Access Boundaries

    func testMassiveConcurrentWrites() throws {
        let expectation = expectation(description: "500 concurrent writes")
        expectation.expectedFulfillmentCount = 500

        let queue = DispatchQueue(label: "test.massive.keychain", attributes: .concurrent)

        for i in 0..<500 {
            queue.async {
                let key = KeychainManager.KeychainKey.custom("concurrent_\(i)")
                do {
                    try self.manager.set("value_\(i)", forKey: key)
                    expectation.fulfill()
                } catch {
                    XCTFail("Write \(i) failed: \(error)")
                }
            }
        }

        wait(for: [expectation], timeout: 60.0)

        // Verify random sampling
        for _ in 0..<50 {
            let i = Int.random(in: 0..<500)
            let key = KeychainManager.KeychainKey.custom("concurrent_\(i)")
            let retrieved = try manager.get(key)
            XCTAssertEqual(retrieved, "value_\(i)")
        }

        // Cleanup
        for i in 0..<500 {
            try? manager.delete(.custom("concurrent_\(i)"))
        }
    }

    func testConcurrentReadAndWrite() {
        let key = KeychainManager.KeychainKey.custom("read_write_key")

        try? manager.set("initial", forKey: key)

        let expectation = expectation(description: "Concurrent read/write")
        expectation.expectedFulfillmentCount = 200

        let queue = DispatchQueue(label: "test.readwrite", attributes: .concurrent)

        // 100 writes
        for i in 0..<100 {
            queue.async {
                try? self.manager.set("value_\(i)", forKey: key)
                expectation.fulfill()
            }
        }

        // 100 reads
        for _ in 0..<100 {
            queue.async {
                _ = try? self.manager.get(key)
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 60.0)

        try? manager.delete(key)
    }

    // MARK: - Rapid Operations

    func testRapidSetAndDelete() throws {
        let key = KeychainManager.KeychainKey.custom("rapid_key")

        // Rapidly set and delete 1000 times
        for i in 0..<1000 {
            try manager.set("value_\(i)", forKey: key)
            try manager.delete(key)
        }

        // Key should not exist after final delete
        XCTAssertThrowsError(try manager.get(key))
    }

    func testRapidOverwrite() throws {
        let key = KeychainManager.KeychainKey.custom("overwrite_key")

        // Overwrite 1000 times
        for i in 0..<1000 {
            try manager.set("value_\(i)", forKey: key)
        }

        let final = try manager.get(key)
        XCTAssertEqual(final, "value_999")

        try manager.delete(key)
    }

    // MARK: - Error Scenarios

    func testGetNonExistentKey() {
        let key = KeychainManager.KeychainKey.custom("nonexistent")

        XCTAssertThrowsError(try manager.get(key)) { error in
            XCTAssertTrue(error is KeychainManager.KeychainError)
            if let keychainError = error as? KeychainManager.KeychainError {
                if case .itemNotFound = keychainError {
                    // Expected error type
                } else {
                    XCTFail("Wrong error type: \(keychainError)")
                }
            }
        }
    }

    func testDeleteNonExistentKey() {
        let key = KeychainManager.KeychainKey.custom("nonexistent_delete")

        // Delete should not throw for non-existent keys (or throw specific error)
        // Either is acceptable behavior
        do {
            try manager.delete(key)
        } catch {
            // If it throws, should be itemNotFound
            XCTAssertTrue(error is KeychainManager.KeychainError)
        }
    }

    func testMultipleDeletesSameKey() throws {
        let key = KeychainManager.KeychainKey.custom("multiple_delete")

        try manager.set("value", forKey: key)
        try manager.delete(key)

        // Second delete should either succeed silently or throw itemNotFound
        do {
            try manager.delete(key)
        } catch {
            XCTAssertTrue(error is KeychainManager.KeychainError)
        }
    }

    // MARK: - Predefined Keys

    func testClaudeAPIKeyBoundaries() throws {
        // Very long API key
        let longKey = "sk-ant-" + String(repeating: "0123456789abcdef", count: 100)

        try manager.setClaudeAPIKey(longKey)

        let retrieved = try manager.getClaudeAPIKey()
        XCTAssertEqual(retrieved, longKey)

        try manager.delete(.claudeAPIKey)
    }

    func testBraveSearchAPIKeyBoundaries() throws {
        // Empty API key
        try manager.set("", forKey: .braveAPIKey)

        let retrieved = try manager.get(.braveAPIKey)
        XCTAssertEqual(retrieved, "")

        try manager.delete(.braveAPIKey)
    }

    // MARK: - Data Types

    func testNumericStringValues() throws {
        let key = KeychainManager.KeychainKey.custom("numeric_string")

        let numericValues = ["0", "42", "-123", "3.14159", "1e10", "NaN", "Infinity"]

        for value in numericValues {
            try manager.set(value, forKey: key)
            let retrieved = try manager.get(key)
            XCTAssertEqual(retrieved, value)
        }

        try manager.delete(key)
    }

    func testBooleanStringValues() throws {
        let key = KeychainManager.KeychainKey.custom("bool_string")

        let boolValues = ["true", "false", "TRUE", "FALSE", "1", "0", "yes", "no"]

        for value in boolValues {
            try manager.set(value, forKey: key)
            let retrieved = try manager.get(key)
            XCTAssertEqual(retrieved, value)
        }

        try manager.delete(key)
    }

    func testJSONStringValues() throws {
        let key = KeychainManager.KeychainKey.custom("json_string")

        let jsonString = """
        {
            "name": "test",
            "value": 42,
            "nested": {
                "array": [1, 2, 3],
                "bool": true
            }
        }
        """

        try manager.set(jsonString, forKey: key)

        let retrieved = try manager.get(key)
        XCTAssertEqual(retrieved, jsonString)

        // Verify it's valid JSON
        XCTAssertNotNil(try? JSONSerialization.jsonObject(
            with: retrieved.data(using: .utf8)!
        ))

        try manager.delete(key)
    }

    // MARK: - Memory Stress

    func testManyDifferentKeys() throws {
        // Store 1000 different keys
        for i in 0..<1000 {
            let key = KeychainManager.KeychainKey.custom("stress_\(i)")
            try manager.set("value_\(i)", forKey: key)
        }

        // Verify random sampling
        for _ in 0..<100 {
            let i = Int.random(in: 0..<1000)
            let key = KeychainManager.KeychainKey.custom("stress_\(i)")
            let retrieved = try manager.get(key)
            XCTAssertEqual(retrieved, "value_\(i)")
        }

        // Cleanup
        for i in 0..<1000 {
            try? manager.delete(.custom("stress_\(i)"))
        }
    }

    // MARK: - Edge Cases

    func testWhitespaceOnlyValue() throws {
        let key = KeychainManager.KeychainKey.custom("whitespace_value")

        let whitespaceValues = ["   ", "\t\t\t", "\n\n\n", " \t\n \t\n "]

        for value in whitespaceValues {
            try manager.set(value, forKey: key)
            let retrieved = try manager.get(key)
            XCTAssertEqual(retrieved, value)
        }

        try manager.delete(key)
    }

    func testBase64EncodedValue() throws {
        let key = KeychainManager.KeychainKey.custom("base64_value")

        let originalData = Data(repeating: 0xFF, count: 1000)
        let base64String = originalData.base64EncodedString()

        try manager.set(base64String, forKey: key)

        let retrieved = try manager.get(key)
        XCTAssertEqual(retrieved, base64String)

        // Verify it decodes correctly
        let decodedData = Data(base64Encoded: retrieved)
        XCTAssertEqual(decodedData, originalData)

        try manager.delete(key)
    }
}
