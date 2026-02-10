//
//  TactileContractTests.swift
//  angle-rfpTests
//
//  Contract tests for motion policy, process-module mapping, and upload queue validation.
//

import XCTest
@testable import angle_rfp

@MainActor
final class TactileContractTests: XCTestCase {

    func testMotionPreferenceFallbackDefaultsToBalanced() {
        XCTAssertEqual(MotionPreference.from(rawValue: nil), .balanced)
        XCTAssertEqual(MotionPreference.from(rawValue: "invalid"), .balanced)
        XCTAssertEqual(MotionPreference.from(rawValue: MotionPreference.full.rawValue), .full)
    }

    func testReducedMotionPolicyDisablesParallaxAndPulse() {
        let policy = MotionPreference.reduced.policy
        XCTAssertFalse(policy.allowsParallax)
        XCTAssertFalse(policy.allowsPulse)
    }

    func testProcessModuleMappingProgression() {
        XCTAssertEqual(moduleState(for: .ingest, analysisStage: nil), .idle)
        XCTAssertEqual(moduleState(for: .ingest, analysisStage: .parsing), .active)
        XCTAssertEqual(moduleState(for: .ingest, analysisStage: .researching), .complete)
        XCTAssertEqual(moduleState(for: .criteria, analysisStage: .researching), .active)
        XCTAssertEqual(moduleState(for: .score, analysisStage: .scoring), .active)
        XCTAssertEqual(moduleState(for: .synthesize, analysisStage: .complete), .complete)
    }

    func testUploadQueueValidationForSupportedAndUnsupportedTypes() throws {
        let tempDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDirectory) }

        let pdfURL = tempDirectory.appendingPathComponent("sample.pdf")
        FileManager.default.createFile(atPath: pdfURL.path, contents: Data("pdf".utf8))

        let docxURL = tempDirectory.appendingPathComponent("sample.docx")
        FileManager.default.createFile(atPath: docxURL.path, contents: Data("docx".utf8))

        let unknownURL = tempDirectory.appendingPathComponent("sample.xyz")
        FileManager.default.createFile(atPath: unknownURL.path, contents: Data("xyz".utf8))

        let pdfItem = UploadQueueItem.makeValidated(url: pdfURL)
        XCTAssertEqual(pdfItem.kind, .pdf)
        XCTAssertEqual(pdfItem.status, .ready)
        XCTAssertTrue(pdfItem.canAnalyzeNow)

        let docxItem = UploadQueueItem.makeValidated(url: docxURL)
        XCTAssertEqual(docxItem.kind, .docx)
        XCTAssertEqual(docxItem.status, .rejected)
        XCTAssertFalse(docxItem.canAnalyzeNow)

        let unknownItem = UploadQueueItem.makeValidated(url: unknownURL)
        XCTAssertEqual(unknownItem.kind, .other)
        XCTAssertEqual(unknownItem.status, .rejected)
        XCTAssertFalse(unknownItem.canAnalyzeNow)
    }
}
