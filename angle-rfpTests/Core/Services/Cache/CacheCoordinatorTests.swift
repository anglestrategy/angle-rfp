//
//  CacheCoordinatorTests.swift
//  angle-rfpTests
//
//  Unit tests for multi-layer caching system
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class CacheCoordinatorTests: XCTestCase {

    var cache: CacheCoordinator!

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
        cache = CacheCoordinator.shared
        cache.clearAll()
        AnalyticsManager.shared.clearAllDataSync()
    }

    override func tearDown() {
        cache.clearAll()
        AnalyticsManager.shared.clearAllDataSync()
        super.tearDown()
    }

    // MARK: - Test Helpers

    /// Wait for condition to become true (non-flaky)
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

    // MARK: - Basic Storage and Retrieval

    func testSetAndGetString() throws {
        struct TestData: Codable, Equatable {
            let message: String
            let value: Int
        }

        let testData = TestData(message: "test", value: 42)

        try cache.set(testData, forKey: "test_key")

        let retrieved: TestData? = cache.get("test_key")

        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved, testData)
    }

    func testGetNonExistentKey() {
        struct TestData: Codable {
            let value: String
        }

        let result: TestData? = cache.get("nonexistent_key")

        XCTAssertNil(result)
    }

    func testOverwriteExistingKey() throws {
        struct TestData: Codable, Equatable {
            let value: Int
        }

        try cache.set(TestData(value: 1), forKey: "key")
        try cache.set(TestData(value: 2), forKey: "key")

        let retrieved: TestData? = cache.get("key")

        XCTAssertEqual(retrieved?.value, 2)
    }

    // MARK: - TTL (Time To Live)

    func testTTLExpiration() throws {
        struct TestData: Codable {
            let value: String
        }

        let testData = TestData(value: "expires_soon")

        // Set with 0.2 second TTL
        try cache.set(testData, forKey: "ttl_key", ttl: 0.2)

        // Immediately retrieve - should exist
        let immediate: TestData? = cache.get("ttl_key")
        XCTAssertNotNil(immediate)

        // Wait for expiration
        Thread.sleep(forTimeInterval: 0.3)

        // Should be expired now
        let expired: TestData? = cache.get("ttl_key")
        XCTAssertNil(expired)
    }

    func testNoTTL() throws {
        struct TestData: Codable {
            let value: String
        }

        let testData = TestData(value: "never_expires")

        // Set without TTL
        try cache.set(testData, forKey: "no_ttl_key")

        // Wait a bit
        Thread.sleep(forTimeInterval: 0.5)

        // Should still exist
        let retrieved: TestData? = cache.get("no_ttl_key")
        XCTAssertNotNil(retrieved)
    }

    // MARK: - Memory Cache Promotion

    func testDiskCachePromotedToMemory() throws {
        struct TestData: Codable, Equatable {
            let value: String
        }

        let testData = TestData(value: "disk_to_memory")

        // Store in cache
        try cache.set(testData, forKey: "promote_key")

        // Force flush to ensure it's on disk
        Thread.sleep(forTimeInterval: 0.1)

        // First retrieval should be from disk
        let first: TestData? = cache.get("promote_key")
        XCTAssertEqual(first, testData)

        // Second retrieval should be from memory (faster)
        let second: TestData? = cache.get("promote_key")
        XCTAssertEqual(second, testData)
    }

    // MARK: - Remove

    func testRemove() throws {
        struct TestData: Codable {
            let value: String
        }

        try cache.set(TestData(value: "test"), forKey: "remove_key")

        let before: TestData? = cache.get("remove_key")
        XCTAssertNotNil(before)

        cache.remove("remove_key")

        let after: TestData? = cache.get("remove_key")
        XCTAssertNil(after)
    }

    func testRemoveNonExistentKey() {
        // Should not crash
        cache.remove("nonexistent_key")
    }

    // MARK: - Clear All

    func testClearAll() throws {
        struct TestData: Codable {
            let value: String
        }

        try cache.set(TestData(value: "data1"), forKey: "key1")
        try cache.set(TestData(value: "data2"), forKey: "key2")
        try cache.set(TestData(value: "data3"), forKey: "key3")

        cache.clearAll()

        let result1: TestData? = cache.get("key1")
        let result2: TestData? = cache.get("key2")
        let result3: TestData? = cache.get("key3")

        XCTAssertNil(result1)
        XCTAssertNil(result2)
        XCTAssertNil(result3)
    }

    // MARK: - Cache Statistics

    func testCacheStats() throws {
        struct TestData: Codable {
            let value: String
        }

        // Clear stats
        cache.clearAll()

        // Store data
        try cache.set(TestData(value: "test"), forKey: "stats_key")

        // Memory hit
        let _: TestData? = cache.get("stats_key")

        // Verify stats are updated (should be immediate for sync operations)
        let stats = cache.getStats()

        XCTAssertGreaterThan(stats.memoryHits, 0)
        XCTAssertGreaterThan(stats.hitRate, 0)
    }

    func testCacheMiss() {
        struct TestData: Codable {
            let value: String
        }

        // Clear stats
        cache.clearAll()

        // Try to get nonexistent key
        let _: TestData? = cache.get("missing_key")

        // Verify stats are updated (should be immediate for sync operations)
        let stats = cache.getStats()

        XCTAssertGreaterThan(stats.misses, 0)
    }

    // MARK: - Different Data Types

    func testStoreInt() throws {
        try cache.set(42, forKey: "int_key")

        let retrieved: Int? = cache.get("int_key")

        XCTAssertEqual(retrieved, 42)
    }

    func testStoreDouble() throws {
        try cache.set(3.14159, forKey: "double_key")

        let retrieved: Double? = cache.get("double_key")

        XCTAssertEqual(retrieved, 3.14159)
    }

    func testStoreBool() throws {
        try cache.set(true, forKey: "bool_key")

        let retrieved: Bool? = cache.get("bool_key")

        XCTAssertEqual(retrieved, true)
    }

    func testStoreArray() throws {
        let array = ["one", "two", "three"]

        try cache.set(array, forKey: "array_key")

        let retrieved: [String]? = cache.get("array_key")

        XCTAssertEqual(retrieved, array)
    }

    func testStoreDictionary() throws {
        let dict = ["key1": "value1", "key2": "value2"]

        try cache.set(dict, forKey: "dict_key")

        let retrieved: [String: String]? = cache.get("dict_key")

        XCTAssertEqual(retrieved, dict)
    }

    func testStoreComplexStruct() throws {
        struct ComplexData: Codable, Equatable {
            let id: UUID
            let name: String
            let values: [Int]
            let metadata: [String: String]
            let timestamp: Date
        }

        let complexData = ComplexData(
            id: UUID(),
            name: "Test",
            values: [1, 2, 3, 4, 5],
            metadata: ["key": "value"],
            timestamp: Date()
        )

        try cache.set(complexData, forKey: "complex_key")

        let retrieved: ComplexData? = cache.get("complex_key")

        XCTAssertEqual(retrieved, complexData)
    }

    // MARK: - Large Data

    func testStoreLargeData() throws {
        struct LargeData: Codable, Equatable {
            let data: [String]
        }

        // Create large array (10,000 strings)
        let largeArray = (0..<10_000).map { "Item \($0)" }
        let largeData = LargeData(data: largeArray)

        try cache.set(largeData, forKey: "large_key")

        let retrieved: LargeData? = cache.get("large_key")

        XCTAssertEqual(retrieved?.data.count, 10_000)
    }

    // MARK: - Multiple Keys

    func testStoreMultipleKeys() throws {
        struct TestData: Codable, Equatable {
            let value: String
        }

        for i in 0..<20 {
            try cache.set(TestData(value: "data_\(i)"), forKey: "key_\(i)")
        }

        for i in 0..<20 {
            let retrieved: TestData? = cache.get("key_\(i)")
            XCTAssertEqual(retrieved?.value, "data_\(i)")
        }
    }

    // MARK: - TTL Race Conditions (CRITICAL)

    func testTTLRaceCondition() throws {
        struct TestData: Codable {
            let value: String
        }

        let testData = TestData(value: "race_test")

        // Set with 0.5 second TTL
        try cache.set(testData, forKey: "race_key", ttl: 0.5)

        let expectation = expectation(description: "Race condition handling")
        expectation.expectedFulfillmentCount = 100

        let queue = DispatchQueue(label: "test.race", attributes: .concurrent)

        // Multiple threads trying to read near expiry time
        for _ in 0..<100 {
            queue.asyncAfter(deadline: .now() + 0.45) {
                // Should either return data or nil, never crash
                let _: TestData? = self.cache.get("race_key")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 5.0)
    }

    // MARK: - Thread Safety

    func testConcurrentWrites() throws {
        struct TestData: Codable {
            let value: Int
        }

        let expectation = expectation(description: "Concurrent writes")
        expectation.expectedFulfillmentCount = 20

        let queue = DispatchQueue(label: "test.cache", attributes: .concurrent)

        for i in 0..<20 {
            queue.async {
                do {
                    try self.cache.set(TestData(value: i), forKey: "concurrent_\(i)")
                    expectation.fulfill()
                } catch {
                    XCTFail("Write failed: \(error)")
                }
            }
        }

        wait(for: [expectation], timeout: 10.0)

        // Verify all writes succeeded
        for i in 0..<20 {
            let retrieved: TestData? = cache.get("concurrent_\(i)")
            XCTAssertEqual(retrieved?.value, i)
        }
    }

    func testConcurrentReads() throws {
        struct TestData: Codable {
            let value: String
        }

        // Store data first
        try cache.set(TestData(value: "concurrent_read"), forKey: "read_key")

        let expectation = expectation(description: "Concurrent reads")
        expectation.expectedFulfillmentCount = 50

        let queue = DispatchQueue(label: "test.cache.read", attributes: .concurrent)

        for _ in 0..<50 {
            queue.async {
                let retrieved: TestData? = self.cache.get("read_key")
                XCTAssertNotNil(retrieved)
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 10.0)
    }

    // MARK: - Performance

    func testWritePerformance() {
        struct TestData: Codable {
            let value: String
        }

        measure {
            for i in 0..<100 {
                try? cache.set(TestData(value: "perf_\(i)"), forKey: "perf_key_\(i)")
            }
        }
    }

    func testReadPerformance() throws {
        struct TestData: Codable {
            let value: String
        }

        // Populate cache first
        for i in 0..<100 {
            try cache.set(TestData(value: "perf_\(i)"), forKey: "perf_read_\(i)")
        }

        measure {
            for i in 0..<100 {
                let _: TestData? = cache.get("perf_read_\(i)")
            }
        }
    }

    // MARK: - Analytics Integration

    func testCacheWriteCreatesAnalyticsEvent() throws {
        struct TestData: Codable {
            let value: String
        }

        // Clear analytics
        AnalyticsManager.shared.clearAllDataSync()

        try cache.set(TestData(value: "analytics_test"), forKey: "analytics_key")

        // Wait for analytics to be tracked and flushed (non-flaky)
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents(category: .systemEvent)
            return events.contains { $0.name == "cache_write" }
        }, description: "Cache write analytics tracked")

        let events = AnalyticsManager.shared.getEvents(category: .systemEvent)

        // Verify cache write is tracked
        XCTAssertTrue(events.contains { $0.name == "cache_write" })
    }

    func testCacheHitCreatesAnalyticsEvent() throws {
        struct TestData: Codable {
            let value: String
        }

        // Clear analytics
        AnalyticsManager.shared.clearAllDataSync()

        try cache.set(TestData(value: "test"), forKey: "hit_key")

        // Retrieve to trigger cache hit
        let _: TestData? = cache.get("hit_key")

        // Wait for analytics to be tracked and flushed (non-flaky)
        waitForCondition({
            AnalyticsManager.shared.flushSync()
            let events = AnalyticsManager.shared.getEvents(category: .systemEvent)
            return events.contains { $0.name == "cache_hit" }
        }, description: "Cache hit analytics tracked")

        let events = AnalyticsManager.shared.getEvents(category: .systemEvent)

        // Verify cache hit is tracked
        XCTAssertTrue(events.contains { $0.name == "cache_hit" })
    }

    // MARK: - Error Handling

    func testInvalidKeyHandling() {
        struct TestData: Codable {
            let value: String
        }

        // Very long key
        let longKey = String(repeating: "a", count: 10_000)

        // Should not crash
        try? cache.set(TestData(value: "test"), forKey: longKey)
        let _: TestData? = cache.get(longKey)
    }

    func testEmptyKeyHandling() {
        struct TestData: Codable {
            let value: String
        }

        // Empty key - should handle gracefully
        try? cache.set(TestData(value: "test"), forKey: "")
        let _: TestData? = cache.get("")
    }
}
