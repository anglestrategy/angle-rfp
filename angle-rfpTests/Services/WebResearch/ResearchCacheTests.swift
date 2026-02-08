//
//  ResearchCacheTests.swift
//  angle-rfpTests
//
//  Tests for 30-day company research caching
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class ResearchCacheTests: XCTestCase {

    override func setUp() {
        super.setUp()
        ResearchCacheTestLock.lock.lock()
        addTeardownBlock {
            ResearchCacheTestLock.lock.unlock()
        }
        ResearchCache.shared.clearAll()
    }

    override func tearDown() {
        ResearchCache.shared.clearAll()
        super.tearDown()
    }

    // MARK: - Basic Operations

    func testSetAndGetClientInformation() {
        let clientInfo = ClientInformation(
            name: "Apple Inc.",
            companySize: .enterprise,
            brandPopularity: .international,
            researchSources: ["https://wikipedia.org"],
            researchConfidence: 0.95,
            researchDate: Date()
        )

        // Set in cache
        ResearchCache.shared.set(clientInfo, forCompanyName: "Apple Inc.")

        // Retrieve from cache
        let retrieved = ResearchCache.shared.get(companyName: "Apple Inc.")

        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.name, "Apple Inc.")
        XCTAssertEqual(retrieved?.companySize, .enterprise)
        XCTAssertEqual(retrieved?.brandPopularity, .international)
        XCTAssertEqual(retrieved?.researchConfidence, 0.95)
    }

    func testGetNonExistentCompany() {
        let retrieved = ResearchCache.shared.get(companyName: "NonExistent Company")
        XCTAssertNil(retrieved)
    }

    func testRemoveCompany() {
        let clientInfo = ClientInformation(
            name: "Test Company",
            researchSources: [],
            researchConfidence: 0.8,
            researchDate: Date()
        )

        ResearchCache.shared.set(clientInfo, forCompanyName: "Test Company")

        // Verify it exists
        XCTAssertNotNil(ResearchCache.shared.get(companyName: "Test Company"))

        // Remove it
        ResearchCache.shared.remove(companyName: "Test Company")

        // Verify it's gone
        XCTAssertNil(ResearchCache.shared.get(companyName: "Test Company"))
    }

    func testClearAll() {
        // Add multiple companies
        for i in 0..<10 {
            let clientInfo = ClientInformation(
                name: "Company \(i)",
                researchSources: [],
                researchConfidence: 0.8,
                researchDate: Date()
            )
            ResearchCache.shared.set(clientInfo, forCompanyName: "Company \(i)")
        }

        // Verify they exist
        for i in 0..<10 {
            XCTAssertNotNil(ResearchCache.shared.get(companyName: "Company \(i)"))
        }

        // Clear all
        ResearchCache.shared.clearAll()

        // Verify all gone
        for i in 0..<10 {
            XCTAssertNil(ResearchCache.shared.get(companyName: "Company \(i)"))
        }
    }

    // MARK: - Key Normalization

    func testKeyNormalizationLowercase() {
        let clientInfo = ClientInformation(
            name: "Apple Inc.",
            researchSources: [],
            researchConfidence: 0.9,
            researchDate: Date()
        )

        ResearchCache.shared.set(clientInfo, forCompanyName: "Apple Inc.")

        // All these should return the same cached data
        XCTAssertNotNil(ResearchCache.shared.get(companyName: "apple inc."))
        XCTAssertNotNil(ResearchCache.shared.get(companyName: "APPLE INC."))
        XCTAssertNotNil(ResearchCache.shared.get(companyName: "ApPlE iNc."))
    }

    func testKeyNormalizationWhitespace() {
        let clientInfo = ClientInformation(
            name: "Test Company",
            researchSources: [],
            researchConfidence: 0.8,
            researchDate: Date()
        )

        ResearchCache.shared.set(clientInfo, forCompanyName: "Test Company")

        // Whitespace variations should work
        XCTAssertNotNil(ResearchCache.shared.get(companyName: "  Test Company  "))
        XCTAssertNotNil(ResearchCache.shared.get(companyName: "Test Company"))
    }

    func testKeyNormalizationSpecialCharacters() {
        let clientInfo = ClientInformation(
            name: "Tech/Corp",
            researchSources: [],
            researchConfidence: 0.8,
            researchDate: Date()
        )

        ResearchCache.shared.set(clientInfo, forCompanyName: "Tech/Corp")

        // Should handle special characters
        let retrieved = ResearchCache.shared.get(companyName: "Tech/Corp")
        XCTAssertNotNil(retrieved)
    }

    // MARK: - TTL Tests

    func testDefaultTTL30Days() {
        let clientInfo = ClientInformation(
            name: "Test Company",
            researchSources: [],
            researchConfidence: 0.8,
            researchDate: Date()
        )

        ResearchCache.shared.set(clientInfo, forCompanyName: "Test Company")

        // Should still be available immediately
        XCTAssertNotNil(ResearchCache.shared.get(companyName: "Test Company"))

        // Note: Testing 30-day expiration would require time manipulation
        // which is not practical in unit tests
    }

    func testCustomTTL() {
        let clientInfo = ClientInformation(
            name: "Short TTL Company",
            researchSources: [],
            researchConfidence: 0.8,
            researchDate: Date()
        )

        // Set with 1-second TTL
        ResearchCache.shared.set(clientInfo, forCompanyName: "Short TTL Company", ttl: 1.0)

        // Should be available immediately
        XCTAssertNotNil(ResearchCache.shared.get(companyName: "Short TTL Company"))

        // Wait 2 seconds
        Thread.sleep(forTimeInterval: 2.0)

        // Should be expired
        XCTAssertNil(ResearchCache.shared.get(companyName: "Short TTL Company"))
    }

    func testExpiredEntriesAutomaticallyRemoved() {
        // Set entry with very short TTL
        let clientInfo = ClientInformation(
            name: "Expired Company",
            researchSources: [],
            researchConfidence: 0.8,
            researchDate: Date()
        )

        ResearchCache.shared.set(clientInfo, forCompanyName: "Expired Company", ttl: 0.5)

        // Verify it exists
        XCTAssertNotNil(ResearchCache.shared.get(companyName: "Expired Company"))

        // Wait for expiration
        Thread.sleep(forTimeInterval: 1.0)

        // Should be nil (automatically removed on access)
        XCTAssertNil(ResearchCache.shared.get(companyName: "Expired Company"))
    }

    // MARK: - Statistics

    func testGetStatistics() {
        // Add some entries
        for i in 0..<5 {
            let clientInfo = ClientInformation(
                name: "Company \(i)",
                researchSources: [],
                researchConfidence: 0.8,
                researchDate: Date()
            )
            ResearchCache.shared.set(clientInfo, forCompanyName: "Company \(i)")
        }

        let stats = ResearchCache.shared.getStatistics()

        XCTAssertGreaterThan(stats.total, 0)
        XCTAssertGreaterThan(stats.size, 0)
    }

    func testStatisticsAfterClear() {
        // Add entries
        for i in 0..<3 {
            let clientInfo = ClientInformation(
                name: "Company \(i)",
                researchSources: [],
                researchConfidence: 0.8,
                researchDate: Date()
            )
            ResearchCache.shared.set(clientInfo, forCompanyName: "Company \(i)")
        }

        // Clear
        ResearchCache.shared.clearAll()

        // Check stats
        let stats = ResearchCache.shared.getStatistics()
        XCTAssertEqual(stats.total, 0)
        XCTAssertEqual(stats.size, 0)
    }

    // MARK: - Cleanup Tests

    func testCleanupExpiredEntries() {
        // Add mix of expired and valid entries
        for i in 0..<5 {
            let clientInfo = ClientInformation(
                name: "Valid Company \(i)",
                researchSources: [],
                researchConfidence: 0.8,
                researchDate: Date()
            )
            ResearchCache.shared.set(clientInfo, forCompanyName: "Valid Company \(i)")
        }

        for i in 0..<3 {
            let clientInfo = ClientInformation(
                name: "Expired Company \(i)",
                researchSources: [],
                researchConfidence: 0.8,
                researchDate: Date()
            )
            ResearchCache.shared.set(clientInfo, forCompanyName: "Expired Company \(i)", ttl: 0.5)
        }

        // Wait for expiration
        Thread.sleep(forTimeInterval: 1.0)

        // Run cleanup
        ResearchCache.shared.cleanupExpiredEntries()

        // Valid entries should still exist
        for i in 0..<5 {
            XCTAssertNotNil(ResearchCache.shared.get(companyName: "Valid Company \(i)"))
        }

        // Expired entries should be gone
        for i in 0..<3 {
            XCTAssertNil(ResearchCache.shared.get(companyName: "Expired Company \(i)"))
        }
    }

    // MARK: - Disk Persistence

    func testDiskPersistence() {
        let clientInfo = ClientInformation(
            name: "Persistent Company",
            companySize: .large,
            brandPopularity: .national,
            entityType: .publicCompany,
            researchSources: ["url1", "url2"],
            researchConfidence: 0.9,
            researchDate: Date()
        )

        ResearchCache.shared.set(clientInfo, forCompanyName: "Persistent Company")

        // Verify it's in cache
        let retrieved = ResearchCache.shared.get(companyName: "Persistent Company")
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.companySize, .large)

        // Note: Testing actual disk persistence across app launches
        // would require integration tests or app lifecycle simulation
    }

    // MARK: - Complex Data Structures

    func testFullClientInformationPersistence() {
        let fullClientInfo = ClientInformation(
            name: "Complete Corp",
            companySize: .enterprise,
            brandPopularity: .international,
            entityType: .publicCompany,
            holdingGroup: "Mega Holdings Inc.",
            industry: "Technology & Marketing",
            socialMediaPresence: SocialMediaPresence(
                hasPresence: true,
                activityLevel: .veryHigh,
                platforms: [.linkedin, .instagram, .facebook, .twitter, .youtube, .tiktok],
                contentTypes: [.video, .motionGraphics, .images]
            ),
            estimatedEmployees: 250000,
            estimatedRevenue: "$850 billion",
            mediaSpendIndicators: "Extremely high marketing budget, top 10 global advertiser",
            researchSources: [
                "https://wikipedia.org/wiki/complete-corp",
                "https://finance.yahoo.com/complete-corp",
                "https://crunchbase.com/complete-corp"
            ],
            researchConfidence: 0.98,
            researchDate: Date()
        )

        ResearchCache.shared.set(fullClientInfo, forCompanyName: "Complete Corp")

        let retrieved = ResearchCache.shared.get(companyName: "Complete Corp")

        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.name, "Complete Corp")
        XCTAssertEqual(retrieved?.companySize, .enterprise)
        XCTAssertEqual(retrieved?.brandPopularity, .international)
        XCTAssertEqual(retrieved?.entityType, .publicCompany)
        XCTAssertEqual(retrieved?.holdingGroup, "Mega Holdings Inc.")
        XCTAssertEqual(retrieved?.industry, "Technology & Marketing")
        XCTAssertEqual(retrieved?.estimatedEmployees, 250000)
        XCTAssertEqual(retrieved?.estimatedRevenue, "$850 billion")
        XCTAssertEqual(retrieved?.researchSources.count, 3)
        XCTAssertEqual(retrieved?.researchConfidence, 0.98)

        // Verify social media presence
        XCTAssertEqual(retrieved?.socialMediaPresence?.hasPresence, true)
        XCTAssertEqual(retrieved?.socialMediaPresence?.activityLevel, .veryHigh)
        XCTAssertEqual(retrieved?.socialMediaPresence?.platforms.count, 6)
        XCTAssertEqual(retrieved?.socialMediaPresence?.contentTypes.count, 3)
    }

    // MARK: - Thread Safety

    func testConcurrentWrites() {
        let expectation = expectation(description: "Concurrent writes")
        expectation.expectedFulfillmentCount = 100

        let queue = DispatchQueue(label: "test.cache.concurrent", attributes: .concurrent)

        for i in 0..<100 {
            queue.async {
                let clientInfo = ClientInformation(
                    name: "Company \(i)",
                    researchSources: ["url\(i)"],
                    researchConfidence: Double(i) / 100.0,
                    researchDate: Date()
                )

                ResearchCache.shared.set(clientInfo, forCompanyName: "Company \(i)")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 10.0)

        // Verify all entries were stored
        for i in 0..<100 {
            let retrieved = ResearchCache.shared.get(companyName: "Company \(i)")
            XCTAssertNotNil(retrieved, "Company \(i) should be in cache")
        }
    }

    func testConcurrentReadsAndWrites() {
        let expectation = expectation(description: "Concurrent reads and writes")
        expectation.expectedFulfillmentCount = 200

        let queue = DispatchQueue(label: "test.cache.rw", attributes: .concurrent)

        // Pre-populate some data
        for i in 0..<50 {
            let clientInfo = ClientInformation(
                name: "Initial \(i)",
                researchSources: [],
                researchConfidence: 0.8,
                researchDate: Date()
            )
            ResearchCache.shared.set(clientInfo, forCompanyName: "Initial \(i)")
        }

        // 100 writes
        for i in 0..<100 {
            queue.async {
                let clientInfo = ClientInformation(
                    name: "New \(i)",
                    researchSources: [],
                    researchConfidence: 0.7,
                    researchDate: Date()
                )
                ResearchCache.shared.set(clientInfo, forCompanyName: "New \(i)")
                expectation.fulfill()
            }
        }

        // 100 reads
        for i in 0..<100 {
            queue.async {
                _ = ResearchCache.shared.get(companyName: "Initial \(i % 50)")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 15.0)
    }

    // MARK: - Memory Management

    func testLargeDatasetHandling() {
        // Add many entries to test memory limits
        for i in 0..<150 {
            let clientInfo = ClientInformation(
                name: "Company \(i)",
                companySize: .large,
                brandPopularity: .national,
                entityType: .publicCompany,
                holdingGroup: "Holdings \(i)",
                industry: "Industry \(i)",
                socialMediaPresence: SocialMediaPresence(
                    hasPresence: true,
                    activityLevel: .high,
                    platforms: [.linkedin, .facebook],
                    contentTypes: [.video, .images]
                ),
                researchSources: ["url1", "url2", "url3"],
                researchConfidence: 0.85,
                researchDate: Date()
            )

            ResearchCache.shared.set(clientInfo, forCompanyName: "Company \(i)")
        }

        // NSCache may evict some entries due to memory limit
        // But disk persistence should keep all entries
        let stats = ResearchCache.shared.getStatistics()
        XCTAssertGreaterThan(stats.total, 100)
    }

    // MARK: - Edge Cases

    func testEmptyCompanyName() {
        let clientInfo = ClientInformation(
            name: "",
            researchSources: [],
            researchConfidence: 0.5,
            researchDate: Date()
        )

        ResearchCache.shared.set(clientInfo, forCompanyName: "")

        let retrieved = ResearchCache.shared.get(companyName: "")
        XCTAssertNotNil(retrieved)
    }

    func testVeryLongCompanyName() {
        let longName = String(repeating: "A", count: 1000)
        let clientInfo = ClientInformation(
            name: longName,
            researchSources: [],
            researchConfidence: 0.8,
            researchDate: Date()
        )

        ResearchCache.shared.set(clientInfo, forCompanyName: longName)

        let retrieved = ResearchCache.shared.get(companyName: longName)
        XCTAssertNotNil(retrieved)
    }

    func testUnicodeCompanyName() {
        let unicodeName = "株式会社テスト"
        let clientInfo = ClientInformation(
            name: unicodeName,
            researchSources: [],
            researchConfidence: 0.9,
            researchDate: Date()
        )

        ResearchCache.shared.set(clientInfo, forCompanyName: unicodeName)

        let retrieved = ResearchCache.shared.get(companyName: unicodeName)
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.name, unicodeName)
    }
}
