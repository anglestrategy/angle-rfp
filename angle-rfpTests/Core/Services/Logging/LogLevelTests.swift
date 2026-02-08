//
//  LogLevelTests.swift
//  angle-rfpTests
//
//  Unit tests for log severity levels
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
import os.log
@testable import angle_rfp

final class LogLevelTests: XCTestCase {

    // MARK: - Enum Cases

    func testAllLogLevelsExist() {
        let levels: [LogLevel] = [.debug, .info, .warning, .error, .critical]
        XCTAssertEqual(levels.count, 5)
        XCTAssertEqual(LogLevel.allCases.count, 5)
    }

    // MARK: - OSLog Type Mapping

    func testOSLogTypeMapping() {
        XCTAssertEqual(LogLevel.debug.osLogType, .debug)
        XCTAssertEqual(LogLevel.info.osLogType, .info)
        XCTAssertEqual(LogLevel.warning.osLogType, .default)
        XCTAssertEqual(LogLevel.error.osLogType, .error)
        XCTAssertEqual(LogLevel.critical.osLogType, .fault)
    }

    // MARK: - Description

    func testDescription() {
        XCTAssertEqual(LogLevel.debug.description, "Debug")
        XCTAssertEqual(LogLevel.info.description, "Info")
        XCTAssertEqual(LogLevel.warning.description, "Warning")
        XCTAssertEqual(LogLevel.error.description, "Error")
        XCTAssertEqual(LogLevel.critical.description, "Critical")
    }

    // MARK: - Emoji

    func testEmoji() {
        XCTAssertEqual(LogLevel.debug.emoji, "🔍")
        XCTAssertEqual(LogLevel.info.emoji, "ℹ️")
        XCTAssertEqual(LogLevel.warning.emoji, "⚠️")
        XCTAssertEqual(LogLevel.error.emoji, "❌")
        XCTAssertEqual(LogLevel.critical.emoji, "🚨")
    }

    // MARK: - Production Visibility

    func testProductionVisibility() {
        XCTAssertFalse(LogLevel.debug.isProductionVisible)
        XCTAssertTrue(LogLevel.info.isProductionVisible)
        XCTAssertTrue(LogLevel.warning.isProductionVisible)
        XCTAssertTrue(LogLevel.error.isProductionVisible)
        XCTAssertTrue(LogLevel.critical.isProductionVisible)
    }

    // MARK: - Comparable

    func testComparable() {
        XCTAssertLessThan(LogLevel.debug, LogLevel.info)
        XCTAssertLessThan(LogLevel.info, LogLevel.warning)
        XCTAssertLessThan(LogLevel.warning, LogLevel.error)
        XCTAssertLessThan(LogLevel.error, LogLevel.critical)
    }

    func testComparableTransitive() {
        XCTAssertLessThan(LogLevel.debug, LogLevel.critical)
        XCTAssertLessThan(LogLevel.info, LogLevel.error)
    }

    func testComparableGreaterThan() {
        XCTAssertGreaterThan(LogLevel.critical, LogLevel.error)
        XCTAssertGreaterThan(LogLevel.error, LogLevel.warning)
        XCTAssertGreaterThan(LogLevel.warning, LogLevel.info)
        XCTAssertGreaterThan(LogLevel.info, LogLevel.debug)
    }

    func testComparableEqual() {
        XCTAssertEqual(LogLevel.debug, LogLevel.debug)
        XCTAssertEqual(LogLevel.info, LogLevel.info)
        XCTAssertEqual(LogLevel.warning, LogLevel.warning)
        XCTAssertEqual(LogLevel.error, LogLevel.error)
        XCTAssertEqual(LogLevel.critical, LogLevel.critical)
    }

    func testComparableGreaterThanOrEqual() {
        XCTAssertGreaterThanOrEqual(LogLevel.error, LogLevel.warning)
        XCTAssertGreaterThanOrEqual(LogLevel.error, LogLevel.error)
    }

    func testComparableLessThanOrEqual() {
        XCTAssertLessThanOrEqual(LogLevel.info, LogLevel.warning)
        XCTAssertLessThanOrEqual(LogLevel.info, LogLevel.info)
    }

    // MARK: - Codable

    func testEncodeDecode() throws {
        for level in LogLevel.allCases {
            let encoder = JSONEncoder()
            let data = try encoder.encode(level)

            let decoder = JSONDecoder()
            let decoded = try decoder.decode(LogLevel.self, from: data)

            XCTAssertEqual(level, decoded)
        }
    }

    func testEncodeToRawValue() throws {
        let encoder = JSONEncoder()

        let debugData = try encoder.encode(LogLevel.debug)
        let debugString = String(data: debugData, encoding: .utf8)
        XCTAssertEqual(debugString, "\"debug\"")

        let criticalData = try encoder.encode(LogLevel.critical)
        let criticalString = String(data: criticalData, encoding: .utf8)
        XCTAssertEqual(criticalString, "\"critical\"")
    }

    func testDecodeFromRawValue() throws {
        let decoder = JSONDecoder()

        let debugData = "\"debug\"".data(using: .utf8)!
        let debug = try decoder.decode(LogLevel.self, from: debugData)
        XCTAssertEqual(debug, .debug)

        let errorData = "\"error\"".data(using: .utf8)!
        let error = try decoder.decode(LogLevel.self, from: errorData)
        XCTAssertEqual(error, .error)
    }

    func testDecodeInvalidValue() {
        let decoder = JSONDecoder()
        let invalidData = "\"invalid\"".data(using: .utf8)!

        XCTAssertThrowsError(try decoder.decode(LogLevel.self, from: invalidData))
    }

    // MARK: - Filtering by Level

    func testMinimumLevelFiltering() {
        let minimumLevel = LogLevel.warning

        // Should pass
        XCTAssertTrue(LogLevel.warning >= minimumLevel)
        XCTAssertTrue(LogLevel.error >= minimumLevel)
        XCTAssertTrue(LogLevel.critical >= minimumLevel)

        // Should not pass
        XCTAssertFalse(LogLevel.debug >= minimumLevel)
        XCTAssertFalse(LogLevel.info >= minimumLevel)
    }

    func testProductionFiltering() {
        // In production, only these should be visible
        let productionLevels = LogLevel.allCases.filter { $0.isProductionVisible }

        XCTAssertEqual(productionLevels.count, 4)
        XCTAssertTrue(productionLevels.contains(.info))
        XCTAssertTrue(productionLevels.contains(.warning))
        XCTAssertTrue(productionLevels.contains(.error))
        XCTAssertTrue(productionLevels.contains(.critical))
        XCTAssertFalse(productionLevels.contains(.debug))
    }
}
