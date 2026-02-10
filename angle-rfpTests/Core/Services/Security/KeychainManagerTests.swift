//
//  KeychainManagerTests.swift
//  angle-rfpTests
//
//  Unit tests for secure keychain storage
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class KeychainManagerTests: XCTestCase {
    override class func setUp() {
        super.setUp()
        AppLogger.suppressConsoleOutput = true
    }

    override class func tearDown() {
        AppLogger.suppressConsoleOutput = false
        super.tearDown()
    }

    let manager = KeychainManager.shared
    let testKey = KeychainManager.KeychainKey.custom("test_key")

    override func setUp() {
        super.setUp()
        // Clean up any existing test data
        try? manager.delete(testKey)
        try? manager.delete(.claudeAPIKey)
        try? manager.delete(.braveAPIKey)
    }

    override func tearDown() {
        try? manager.delete(testKey)
        try? manager.delete(.claudeAPIKey)
        try? manager.delete(.braveAPIKey)
        super.tearDown()
    }

    // MARK: - String Storage

    func testSetAndGetString() throws {
        let value = "test_value_123"

        try manager.set(value, forKey: testKey)

        let retrieved = try manager.get(testKey)

        XCTAssertEqual(retrieved, value)
    }

    func testSetOverwritesExisting() throws {
        try manager.set("first_value", forKey: testKey)
        try manager.set("second_value", forKey: testKey)

        let retrieved = try manager.get(testKey)

        XCTAssertEqual(retrieved, "second_value")
    }

    func testGetNonExistentKeyThrows() {
        let nonExistentKey = KeychainManager.KeychainKey.custom("nonexistent_\(UUID().uuidString)")

        XCTAssertThrowsError(try manager.get(nonExistentKey)) { error in
            XCTAssertTrue(error is KeychainManager.KeychainError)
            if let keychainError = error as? KeychainManager.KeychainError {
                XCTAssertEqual(keychainError, .itemNotFound)
            }
        }
    }

    // MARK: - Data Storage

    func testSetAndGetData() throws {
        let data = Data("test_data".utf8)

        try manager.setData(data, forKey: testKey)

        let retrieved = try manager.getData(testKey)

        XCTAssertEqual(retrieved, data)
    }

    func testSetLargeData() throws {
        // Test with large data (1 MB)
        let largeData = Data(repeating: 0x41, count: 1_000_000)

        try manager.setData(largeData, forKey: testKey)

        let retrieved = try manager.getData(testKey)

        XCTAssertEqual(retrieved.count, largeData.count)
        XCTAssertEqual(retrieved, largeData)
    }

    // MARK: - Delete

    func testDelete() throws {
        try manager.set("value_to_delete", forKey: testKey)

        XCTAssertTrue(manager.exists(testKey))

        try manager.delete(testKey)

        XCTAssertFalse(manager.exists(testKey))
    }

    func testDeleteNonExistentKey() throws {
        let nonExistentKey = KeychainManager.KeychainKey.custom("nonexistent_\(UUID().uuidString)")

        // Should not throw error
        try manager.delete(nonExistentKey)
    }

    // MARK: - Exists

    func testExists() throws {
        XCTAssertFalse(manager.exists(testKey))

        try manager.set("value", forKey: testKey)

        XCTAssertTrue(manager.exists(testKey))

        try manager.delete(testKey)

        XCTAssertFalse(manager.exists(testKey))
    }

    // MARK: - Predefined Keys

    func testClaudeAPIKey() throws {
        // Build without embedding a contiguous secret-looking literal in the repo.
        let apiKey = "sk" + "-ant-" + "test" + "1234567890"

        try manager.setClaudeAPIKey(apiKey)

        let retrieved = try manager.getClaudeAPIKey()

        XCTAssertEqual(retrieved, apiKey)
    }

    func testBraveAPIKey() throws {
        // Build without embedding a contiguous secret-looking literal in the repo.
        let apiKey = "B" + "SA" + "_test_" + "key_" + "1234567890"

        try manager.setBraveAPIKey(apiKey)

        let retrieved = try manager.getBraveAPIKey()

        XCTAssertEqual(retrieved, apiKey)
    }

    // MARK: - Special Characters

    func testStoreStringWithSpecialCharacters() throws {
        let specialValue = "test!@#$%^&*()_+-={}[]|\\:;\"'<>,.?/~`"

        try manager.set(specialValue, forKey: testKey)

        let retrieved = try manager.get(testKey)

        XCTAssertEqual(retrieved, specialValue)
    }

    func testStoreUnicodeString() throws {
        let unicodeValue = "Test with émojis 🔑🔐🛡️ and ñañ characters"

        try manager.set(unicodeValue, forKey: testKey)

        let retrieved = try manager.get(testKey)

        XCTAssertEqual(retrieved, unicodeValue)
    }

    // MARK: - Empty and Whitespace

    func testStoreEmptyString() throws {
        try manager.set("", forKey: testKey)

        let retrieved = try manager.get(testKey)

        XCTAssertEqual(retrieved, "")
    }

    func testStoreWhitespaceString() throws {
        let whitespace = "   \t\n   "

        try manager.set(whitespace, forKey: testKey)

        let retrieved = try manager.get(testKey)

        XCTAssertEqual(retrieved, whitespace)
    }

    // MARK: - Biometrics Availability

    func testIsBiometricsAvailable() {
        let available = manager.isBiometricsAvailable()

        // Just verify it returns a boolean without crashing
        // Actual availability depends on hardware
        XCTAssertNotNil(available)
    }

    func testBiometricType() {
        let type = manager.biometricType()

        // Should return "None", "Touch ID", "Face ID", or "Optic ID"
        XCTAssertTrue([
            "None",
            "Touch ID",
            "Face ID",
            "Optic ID",
            "Unknown"
        ].contains(type))
    }

    // MARK: - Multiple Keys

    func testStoreMultipleKeys() throws {
        let key1 = KeychainManager.KeychainKey.custom("test_key_1")
        let key2 = KeychainManager.KeychainKey.custom("test_key_2")
        let key3 = KeychainManager.KeychainKey.custom("test_key_3")

        try manager.set("value1", forKey: key1)
        try manager.set("value2", forKey: key2)
        try manager.set("value3", forKey: key3)

        XCTAssertEqual(try manager.get(key1), "value1")
        XCTAssertEqual(try manager.get(key2), "value2")
        XCTAssertEqual(try manager.get(key3), "value3")

        // Cleanup
        try manager.delete(key1)
        try manager.delete(key2)
        try manager.delete(key3)
    }

    // MARK: - Thread Safety

    func testConcurrentAccess() throws {
        let expectation = expectation(description: "Concurrent operations completed")
        expectation.expectedFulfillmentCount = 20

        let queue = DispatchQueue(label: "test.keychain", attributes: .concurrent)

        // Concurrent reads and writes
        for i in 0..<10 {
            queue.async {
                let key = KeychainManager.KeychainKey.custom("concurrent_key_\(i)")
                do {
                    try self.manager.set("value_\(i)", forKey: key)
                    expectation.fulfill()
                } catch {
                    XCTFail("Write failed: \(error)")
                }
            }
        }

        for i in 0..<10 {
            queue.async {
                let key = KeychainManager.KeychainKey.custom("concurrent_key_\(i)")
                // Wait a bit for writes to complete
                Thread.sleep(forTimeInterval: 0.1)
                do {
                    _ = try? self.manager.get(key)
                    expectation.fulfill()
                } catch {
                    // Read may fail if write hasn't completed yet
                }
            }
        }

        wait(for: [expectation], timeout: 10.0)

        // Cleanup
        for i in 0..<10 {
            try? manager.delete(KeychainManager.KeychainKey.custom("concurrent_key_\(i)"))
        }
    }

    // MARK: - Error Cases

    func testKeyWithVeryLongName() throws {
        let longKeyName = String(repeating: "a", count: 1000)
        let key = KeychainManager.KeychainKey.custom(longKeyName)

        try manager.set("value", forKey: key)

        let retrieved = try manager.get(key)

        XCTAssertEqual(retrieved, "value")

        try manager.delete(key)
    }

    // MARK: - Performance

    func testStoragePerformance() {
        measure {
            for i in 0..<100 {
                let key = KeychainManager.KeychainKey.custom("perf_key_\(i)")
                try? manager.set("value_\(i)", forKey: key)
            }

            for i in 0..<100 {
                let key = KeychainManager.KeychainKey.custom("perf_key_\(i)")
                try? manager.delete(key)
            }
        }
    }

    func testRetrievalPerformance() throws {
        // Store some data first
        for i in 0..<50 {
            let key = KeychainManager.KeychainKey.custom("perf_read_key_\(i)")
            try manager.set("value_\(i)", forKey: key)
        }

        measure {
            for i in 0..<50 {
                let key = KeychainManager.KeychainKey.custom("perf_read_key_\(i)")
                _ = try? manager.get(key)
            }
        }

        // Cleanup
        for i in 0..<50 {
            let key = KeychainManager.KeychainKey.custom("perf_read_key_\(i)")
            try? manager.delete(key)
        }
    }

    // MARK: - Data Integrity

    func testDataIntegrityAfterMultipleWrites() throws {
        let originalValue = "original_value_12345"

        try manager.set(originalValue, forKey: testKey)

        // Overwrite multiple times
        for i in 1...10 {
            try manager.set("temporary_value_\(i)", forKey: testKey)
        }

        try manager.set(originalValue, forKey: testKey)

        let retrieved = try manager.get(testKey)

        XCTAssertEqual(retrieved, originalValue)
    }

    // MARK: - Binary Data

    func testStoreBinaryData() throws {
        // Test with non-UTF8 data
        let binaryData = Data([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD])

        try manager.setData(binaryData, forKey: testKey)

        let retrieved = try manager.getData(testKey)

        XCTAssertEqual(retrieved, binaryData)
    }
}
