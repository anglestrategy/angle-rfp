//
//  RunwayMappingTests.swift
//  angle-rfpTests
//
//  Tests for runway stage mapping and motion policy behavior.
//

import XCTest
@testable import angle_rfp

@MainActor
final class RunwayMappingTests: XCTestCase {

    func testRunwayStepMappingAcrossAppStates() {
        XCTAssertEqual(runwayStep(for: .upload, analysisStage: .parsing), .upload)
        XCTAssertEqual(runwayStep(for: .analyzing(documentName: "A.pdf"), analysisStage: .parsing), .parse)
        XCTAssertEqual(runwayStep(for: .analyzing(documentName: "A.pdf"), analysisStage: .extracting), .criteria)
        XCTAssertEqual(runwayStep(for: .analyzing(documentName: "A.pdf"), analysisStage: .researching), .research)
        XCTAssertEqual(runwayStep(for: .analyzing(documentName: "A.pdf"), analysisStage: .scoring), .score)
        XCTAssertEqual(runwayStep(for: .analyzing(documentName: "A.pdf"), analysisStage: .complete), .results)
        XCTAssertEqual(
            runwayStep(
                for: .dashboard(data: ExtractedRFPData(), clientInfo: nil),
                analysisStage: .parsing
            ),
            .results
        )
    }

    func testMotionPreferencePoliciesByLevel() {
        let full = MotionPreference.full.policy
        XCTAssertTrue(full.allowsParallax)
        XCTAssertTrue(full.allowsPulse)

        let balanced = MotionPreference.balanced.policy
        XCTAssertTrue(balanced.allowsParallax)
        XCTAssertTrue(balanced.allowsPulse)

        let reduced = MotionPreference.reduced.policy
        XCTAssertFalse(reduced.allowsParallax)
        XCTAssertFalse(reduced.allowsPulse)
    }
}
