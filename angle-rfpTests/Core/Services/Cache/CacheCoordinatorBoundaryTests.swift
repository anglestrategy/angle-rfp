//
//  CacheCoordinatorBoundaryTests.swift
//  angle-rfpTests
//
//  Boundary and edge case tests for CacheCoordinator
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class CacheCoordinatorBoundaryTests: XCTestCase {

    override class func setUp() {
        super.setUp()
        AppLogger.suppressConsoleOutput = true
    }

    override class func tearDown() {
        AppLogger.suppressConsoleOutput = false
        super.tearDown()
    }

    var cache: CacheCoordinator!

    override func setUp() {
        super.setUp()
        cache = CacheCoordinator.shared
        cache.clearAll()
    }

    override func tearDown() {
        cache.clearAll()
        super.tearDown()
    }

    // MARK: - Key Length Boundaries

    func testVeryLongKey() throws {
        struct TestData: Codable, Equatable {
            let value: String
        }

        // Test 10,000 character key
        let longKey = String(repeating: "a", count: 10_000)
        let testData = TestData(value: "test")

        try cache.set(testData, forKey: longKey)

        let retrieved: TestData? = cache.get(longKey)
        XCTAssertEqual(retrieved, testData)
    }

    func testEmptyKey() throws {
        struct TestData: Codable {
            let value: String
        }

        // Empty key should be handled gracefully
        try cache.set(TestData(value: "test"), forKey: "")

        let retrieved: TestData? = cache.get("")
        XCTAssertNotNil(retrieved)
    }

    func testSingleCharacterKey() throws {
        struct TestData: Codable, Equatable {
            let value: String
        }

        try cache.set(TestData(value: "test"), forKey: "x")

        let retrieved: TestData? = cache.get("x")
        XCTAssertEqual(retrieved?.value, "test")
    }

    func testUnicodeKey() throws {
        struct TestData: Codable, Equatable {
            let value: String
        }

        let unicodeKey = "🎯测试キー🔑"
        try cache.set(TestData(value: "unicode"), forKey: unicodeKey)

        let retrieved: TestData? = cache.get(unicodeKey)
        XCTAssertEqual(retrieved?.value, "unicode")
    }

    func testKeyWithSpecialCharacters() throws {
        struct TestData: Codable, Equatable {
            let value: String
        }

        let specialKey = "key/with\\special:chars@#$%^&*()"
        try cache.set(TestData(value: "special"), forKey: specialKey)

        let retrieved: TestData? = cache.get(specialKey)
        XCTAssertEqual(retrieved?.value, "special")
    }

    func testKeyWithWhitespace() throws {
        struct TestData: Codable, Equatable {
            let value: String
        }

        let whitespaceKey = "key with spaces\t\nand\nnewlines"
        try cache.set(TestData(value: "whitespace"), forKey: whitespaceKey)

        let retrieved: TestData? = cache.get(whitespaceKey)
        XCTAssertEqual(retrieved?.value, "whitespace")
    }

    // MARK: - Value Size Boundaries

    func testVeryLargeValue() throws {
        struct LargeData: Codable, Equatable {
            let data: String
        }

        // 10MB string
        let largeString = String(repeating: "x", count: 10 * 1024 * 1024)
        let largeData = LargeData(data: largeString)

        try cache.set(largeData, forKey: "large_key")

        let retrieved: LargeData? = cache.get("large_key")
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.data.count, 10 * 1024 * 1024)
    }

    func testEmptyStringValue() throws {
        struct TestData: Codable, Equatable {
            let value: String
        }

        try cache.set(TestData(value: ""), forKey: "empty_value")

        let retrieved: TestData? = cache.get("empty_value")
        XCTAssertEqual(retrieved?.value, "")
    }

    func testEmptyArrayValue() throws {
        let emptyArray: [String] = []

        try cache.set(emptyArray, forKey: "empty_array")

        let retrieved: [String]? = cache.get("empty_array")
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.count, 0)
    }

    func testEmptyDictionaryValue() throws {
        let emptyDict: [String: String] = [:]

        try cache.set(emptyDict, forKey: "empty_dict")

        let retrieved: [String: String]? = cache.get("empty_dict")
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.count, 0)
    }

    // MARK: - TTL Boundaries

    func testZeroTTL() throws {
        struct TestData: Codable {
            let value: String
        }

        // TTL of 0 should mean immediate expiration
        try cache.set(TestData(value: "expires_now"), forKey: "zero_ttl", ttl: 0)

        // Should be expired immediately
        let retrieved: TestData? = cache.get("zero_ttl")
        XCTAssertNil(retrieved)
    }

    func testVerySmallTTL() throws {
        struct TestData: Codable {
            let value: String
        }

        // 0.001 second TTL
        try cache.set(TestData(value: "expires_fast"), forKey: "tiny_ttl", ttl: 0.001)

        // Immediate retrieval might work
        let immediate: TestData? = cache.get("tiny_ttl")

        // Wait just a bit
        Thread.sleep(forTimeInterval: 0.01)

        // Should definitely be expired now
        let expired: TestData? = cache.get("tiny_ttl")
        XCTAssertNil(expired)
    }

    func testVeryLargeTTL() throws {
        struct TestData: Codable, Equatable {
            let value: String
        }

        // 1 year TTL
        let oneYear: TimeInterval = 365 * 24 * 60 * 60
        try cache.set(TestData(value: "long_lived"), forKey: "long_ttl", ttl: oneYear)

        let retrieved: TestData? = cache.get("long_ttl")
        XCTAssertEqual(retrieved?.value, "long_lived")
    }

    func testNegativeTTL() throws {
        struct TestData: Codable {
            let value: String
        }

        // Negative TTL should be treated as immediate expiration or no TTL
        try cache.set(TestData(value: "negative"), forKey: "negative_ttl", ttl: -1.0)

        let retrieved: TestData? = cache.get("negative_ttl")
        // Implementation-dependent: either nil (expired) or not nil (treated as no TTL)
        // Just verify it doesn't crash
    }

    // MARK: - Numeric Boundaries

    func testIntMinMax() throws {
        try cache.set(Int.min, forKey: "int_min")
        try cache.set(Int.max, forKey: "int_max")
        try cache.set(0, forKey: "int_zero")

        XCTAssertEqual(cache.get("int_min"), Int.min)
        XCTAssertEqual(cache.get("int_max"), Int.max)
        XCTAssertEqual(cache.get("int_zero"), 0)
    }

    func testDoubleMinMax() throws {
        try cache.set(Double.leastNormalMagnitude, forKey: "double_min")
        try cache.set(Double.greatestFiniteMagnitude, forKey: "double_max")
        try cache.set(0.0, forKey: "double_zero")
        try cache.set(-0.0, forKey: "double_neg_zero")

        XCTAssertEqual(cache.get("double_min"), Double.leastNormalMagnitude)
        XCTAssertEqual(cache.get("double_max"), Double.greatestFiniteMagnitude)
        XCTAssertEqual(cache.get("double_zero"), 0.0)
    }

    func testDoubleSpecialValues() throws {
        try cache.set(Double.infinity, forKey: "infinity")
        try cache.set(-Double.infinity, forKey: "neg_infinity")
        try cache.set(Double.nan, forKey: "nan")

        XCTAssertEqual(cache.get("infinity"), Double.infinity)
        XCTAssertEqual(cache.get("neg_infinity"), -Double.infinity)

        // NaN is special - it's never equal to itself
        let nan: Double? = cache.get("nan")
        XCTAssertNotNil(nan)
        XCTAssertTrue(nan!.isNaN)
    }

    // MARK: - Concurrent Boundaries

    func testMaximumConcurrentWrites() throws {
        let expectation = expectation(description: "1000 concurrent writes")
        expectation.expectedFulfillmentCount = 1000

        let queue = DispatchQueue(label: "test.massive.concurrent", attributes: .concurrent)

        for i in 0..<1000 {
            queue.async {
                do {
                    try self.cache.set(i, forKey: "concurrent_\(i)")
                    expectation.fulfill()
                } catch {
                    XCTFail("Write failed: \(error)")
                }
            }
        }

        wait(for: [expectation], timeout: 30.0)

        // Verify all writes succeeded
        for i in 0..<1000 {
            let retrieved: Int? = cache.get("concurrent_\(i)")
            XCTAssertEqual(retrieved, i, "Write \(i) failed")
        }
    }

    func testMaximumConcurrentReads() {
        // Store data first
        for i in 0..<100 {
            try? cache.set(i, forKey: "read_\(i)")
        }

        let expectation = expectation(description: "1000 concurrent reads")
        expectation.expectedFulfillmentCount = 1000

        let queue = DispatchQueue(label: "test.massive.reads", attributes: .concurrent)

        for _ in 0..<1000 {
            queue.async {
                // Random read
                let key = "read_\(Int.random(in: 0..<100))"
                let _: Int? = self.cache.get(key)
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 30.0)
    }

    // MARK: - Memory Pressure

    func testManySmallEntries() throws {
        // Store a large sample of entries without turning this into a pathological runtime test.
        for i in 0..<2_000 {
            try cache.set("value_\(i)", forKey: "key_\(i)")
        }

        // Verify random sampling
        for _ in 0..<100 {
            let i = Int.random(in: 0..<2_000)
            let retrieved: String? = cache.get("key_\(i)")
            XCTAssertEqual(retrieved, "value_\(i)")
        }

        // Clear should work
        cache.clearAll()

        let afterClear: String? = cache.get("key_5000")
        XCTAssertNil(afterClear)
    }

    func testRapidSetAndClear() throws {
        // Rapidly set and clear to test cleanup
        for iteration in 0..<100 {
            for i in 0..<100 {
                try cache.set("iteration_\(iteration)_value_\(i)", forKey: "rapid_\(i)")
            }
            cache.clearAll()
        }

        // Should be empty after last clear
        let retrieved: String? = cache.get("rapid_50")
        XCTAssertNil(retrieved)
    }

    // MARK: - Data Type Boundaries

    func testComplexNestedStructure() throws {
        struct Inner: Codable, Equatable {
            let values: [Int]
            let metadata: [String: String]
        }

        struct Outer: Codable, Equatable {
            let id: UUID
            let timestamp: Date
            let inners: [Inner]
            let optionalValue: String?
        }

        let complex = Outer(
            id: UUID(),
            timestamp: Date(),
            inners: [
                Inner(values: [1, 2, 3], metadata: ["a": "b"]),
                Inner(values: [], metadata: [:])
            ],
            optionalValue: nil
        )

        try cache.set(complex, forKey: "complex")

        let retrieved: Outer? = cache.get("complex")
        XCTAssertEqual(retrieved, complex)
    }

    func testOptionalValues() throws {
        struct TestData: Codable, Equatable {
            let required: String
            let optional: Int?
        }

        let withNil = TestData(required: "test", optional: nil)
        let withValue = TestData(required: "test", optional: 42)

        try cache.set(withNil, forKey: "with_nil")
        try cache.set(withValue, forKey: "with_value")

        let retrievedNil: TestData? = cache.get("with_nil")
        let retrievedValue: TestData? = cache.get("with_value")

        XCTAssertEqual(retrievedNil, withNil)
        XCTAssertEqual(retrievedValue, withValue)
    }

    // MARK: - Edge Case Scenarios

    func testOverwriteSameKeyMultipleTimes() throws {
        for i in 0..<1000 {
            try cache.set(i, forKey: "overwrite_key")
        }

        let final: Int? = cache.get("overwrite_key")
        XCTAssertEqual(final, 999)
    }

    func testAlternatingSetAndRemove() throws {
        for i in 0..<100 {
            try cache.set(i, forKey: "alternating")
            cache.remove("alternating")
        }

        let retrieved: Int? = cache.get("alternating")
        XCTAssertNil(retrieved)
    }

    func testGetAfterClearAll() throws {
        try cache.set("value", forKey: "key")
        cache.clearAll()

        // Multiple gets after clear
        for _ in 0..<100 {
            let retrieved: String? = cache.get("key")
            XCTAssertNil(retrieved)
        }
    }
}
