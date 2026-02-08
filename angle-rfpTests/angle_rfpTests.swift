//
//  angle_rfpTests.swift
//  angle-rfpTests
//

import Foundation
import Testing
@testable import angle_rfp

@MainActor
struct angle_rfpTests {

    @Test func uploadKindClassificationAndValidation() async throws {
        let pdfURL = URL(fileURLWithPath: "/tmp/proposal.pdf")
        let txtURL = URL(fileURLWithPath: "/tmp/specs.txt")
        let unsupportedURL = URL(fileURLWithPath: "/tmp/archive.zip")
        let folderURL = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)

        #expect(UploadKind.classify(url: pdfURL) == .pdf)
        #expect(UploadKind.classify(url: txtURL) == .txt)
        #expect(UploadKind.classify(url: folderURL) == .folder)

        let valid = UploadQueueItem(url: pdfURL).validated()
        #expect(valid.status == .ready)

        let invalid = UploadQueueItem(url: unsupportedURL).validated()
        #expect(invalid.status == .rejected)
        #expect(invalid.errorMessage != nil)
    }

    @Test func analysisStageMappingProgression() async throws {
        let parsing = ProcessModuleMapper.modulesForAnalysis(stage: .parsing, warningCount: 0)
        #expect(parsing[0].state == .active)
        #expect(parsing[1].state == .idle)

        let researching = ProcessModuleMapper.modulesForAnalysis(stage: .researching, warningCount: 0)
        #expect(researching[0].state == .complete)
        #expect(researching[1].state == .complete)
        #expect(researching[2].state == .active)
        #expect(researching[3].state == .idle)
        #expect(researching[4].state == .idle)

        let complete = ProcessModuleMapper.modulesForAnalysis(stage: .complete, warningCount: 0)
        #expect(complete.allSatisfy { $0.state == .complete })
    }

    @Test func motionPreferenceReducedBehavior() async throws {
        #expect(MotionPreference.reduced.resolved == .reduced)
        #expect(MotionPreference.reduced.allowsParallax == false)
        #expect(MotionPreference.reduced.allowsPulse == false)
    }
}
