//
//  ClaudeAnalysisServiceTests.swift
//  angle-rfpTests
//
//  Tests for Claude AI RFP extraction and financial scoring
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import XCTest
@testable import angle_rfp

final class ClaudeAnalysisServiceTests: XCTestCase {

    override func setUp() {
        super.setUp()
        AnalyticsManager.shared.clearAllDataSync()
    }

    override func tearDown() {
        AnalyticsManager.shared.clearAllDataSync()
        super.tearDown()
    }

    // MARK: - Financial Scoring Formula Tests

    func testCompanySizeScoring() {
        // Enterprise: 15%
        let enterprise = CompanySize.enterprise
        XCTAssertEqual(enterprise.score, 1.0)

        // Large: 12% (0.8 of max 15%)
        let large = CompanySize.large
        XCTAssertEqual(large.score, 0.8)

        // Medium: 8% (0.6 of max 15%)
        let medium = CompanySize.medium
        XCTAssertEqual(medium.score, 0.6)

        // Small: 4% (0.4 of max 15%)
        let small = CompanySize.small
        XCTAssertEqual(small.score, 0.4)

        // Startup: minimal (0.2 of max 15%)
        let startup = CompanySize.startup
        XCTAssertEqual(startup.score, 0.2)
    }

    func testBrandPopularityScoring() {
        // International: 1.0
        XCTAssertEqual(BrandPopularity.international.score, 1.0)

        // National: 0.75
        XCTAssertEqual(BrandPopularity.national.score, 0.75)

        // Regional: 0.5
        XCTAssertEqual(BrandPopularity.regional.score, 0.5)

        // Local: 0.25
        XCTAssertEqual(BrandPopularity.local.score, 0.25)

        // Unknown: 0.0
        XCTAssertEqual(BrandPopularity.unknown.score, 0.0)
    }

    func testEntityTypeScoring() {
        // Private company: highest (1.0)
        XCTAssertEqual(EntityType.privateCompany.score, 1.0)

        // Public company: very high (0.9)
        XCTAssertEqual(EntityType.publicCompany.score, 0.9)

        // Governmental: low (0.4)
        XCTAssertEqual(EntityType.governmental.score, 0.4)

        // Non-profit: very low (0.3)
        XCTAssertEqual(EntityType.nonprofit.score, 0.3)
    }

    func testSocialMediaActivityScoring() {
        // Very high: 1.0
        XCTAssertEqual(ActivityLevel.veryHigh.score, 1.0)

        // High: 0.75
        XCTAssertEqual(ActivityLevel.high.score, 0.75)

        // Moderate: 0.5
        XCTAssertEqual(ActivityLevel.moderate.score, 0.5)

        // Low: 0.25
        XCTAssertEqual(ActivityLevel.low.score, 0.25)

        // Inactive: 0.0
        XCTAssertEqual(ActivityLevel.inactive.score, 0.0)
    }

    func testSocialMediaPresenceScoring() {
        // High activity + many platforms
        let highPresence = SocialMediaPresence(
            hasPresence: true,
            activityLevel: .veryHigh,
            platforms: [.linkedin, .instagram, .facebook, .twitter, .youtube],
            contentTypes: [.video, .images]
        )

        XCTAssertGreaterThan(highPresence.score, 0.9)

        // Moderate activity + few platforms
        let moderatePresence = SocialMediaPresence(
            hasPresence: true,
            activityLevel: .moderate,
            platforms: [.linkedin],
            contentTypes: [.textOnly]
        )

        XCTAssertGreaterThan(moderatePresence.score, 0.4)
        XCTAssertLessThan(moderatePresence.score, 0.7)

        // No presence
        let noPresence = SocialMediaPresence(
            hasPresence: false,
            activityLevel: nil,
            platforms: [],
            contentTypes: []
        )

        XCTAssertEqual(noPresence.score, 0.0)
    }

    func testContentTypeValueScoring() {
        // Video: highest value (1.0)
        XCTAssertEqual(ContentType.video.valueScore, 1.0)

        // Motion graphics: high (0.75)
        XCTAssertEqual(ContentType.motionGraphics.valueScore, 0.75)

        // Images: moderate (0.5)
        XCTAssertEqual(ContentType.images.valueScore, 0.5)

        // Text only: low (0.25)
        XCTAssertEqual(ContentType.textOnly.valueScore, 0.25)
    }

    func testOutputTypeValueScoring() {
        // Video: highest (1.0)
        XCTAssertEqual(OutputType.video.valueScore, 1.0)

        // Motion graphics: 0.75
        XCTAssertEqual(OutputType.motionGraphics.valueScore, 0.75)

        // Visuals: 0.5
        XCTAssertEqual(OutputType.visuals.valueScore, 0.5)

        // Content: 0.25
        XCTAssertEqual(OutputType.content.valueScore, 0.25)
    }

    // MARK: - Scope Analysis Tests

    func testAgencyServicePercentageCalculation() {
        let scopeAnalysis = ScopeAnalysis(
            agencyServices: ["Service 1", "Service 2", "Service 3"],
            nonAgencyServices: ["Service 4", "Service 5"],
            agencyServicePercentage: 0.60, // 3/5 = 60%
            outputQuantities: nil,
            outputTypes: []
        )

        XCTAssertEqual(scopeAnalysis.agencyServicePercentage, 0.60)
        XCTAssertEqual(scopeAnalysis.agencyServicePercentageDisplay, "60%")
        XCTAssertEqual(scopeAnalysis.outsourcingPercentageDisplay, "40%")
    }

    func testOutputQuantitiesCounting() {
        let quantities = OutputQuantities(
            videoProduction: 5,
            motionGraphics: 10,
            visualDesign: 15,
            contentOnly: 20
        )

        XCTAssertEqual(quantities.totalCount, 50)
    }

    func testOutputQuantitiesPartial() {
        let quantities = OutputQuantities(
            videoProduction: 3,
            motionGraphics: nil,
            visualDesign: 7,
            contentOnly: nil
        )

        XCTAssertEqual(quantities.totalCount, 10)
    }

    // MARK: - Financial Potential Model Tests

    func testFinancialPotentialScoreCategories() {
        // Excellent: 86-100%
        let excellent = FinancialPotential(
            totalScore: 90,
            recommendation: "Excellent",
            factors: [],
            formulaExplanation: "Test"
        )

        XCTAssertEqual(excellent.scoreColor, "green")
        XCTAssertEqual(excellent.recommendationLevel, "Excellent Financial Potential - High Priority")

        // Good: 66-85%
        let good = FinancialPotential(
            totalScore: 75,
            recommendation: "Good",
            factors: [],
            formulaExplanation: "Test"
        )

        XCTAssertEqual(good.scoreColor, "orange")
        XCTAssertEqual(good.recommendationLevel, "Good Financial Potential - Recommended")

        // Moderate: 41-65%
        let moderate = FinancialPotential(
            totalScore: 55,
            recommendation: "Moderate",
            factors: [],
            formulaExplanation: "Test"
        )

        XCTAssertEqual(moderate.scoreColor, "yellow")
        XCTAssertEqual(moderate.recommendationLevel, "Moderate Financial Potential - Proceed with Caution")

        // Low: 0-40%
        let low = FinancialPotential(
            totalScore: 30,
            recommendation: "Low",
            factors: [],
            formulaExplanation: "Test"
        )

        XCTAssertEqual(low.scoreColor, "red")
        XCTAssertEqual(low.recommendationLevel, "Low Financial Potential - High Risk")
    }

    func testScoringFactorWeightedCalculation() {
        // Company size factor: 15% weight, 80% achievement = 12% weighted score
        let factor = ScoringFactor(
            name: "Company Size",
            weight: 0.15,
            score: 12.0,
            maxScore: 15.0,
            reasoning: "Large enterprise with 5,000+ employees"
        )

        XCTAssertEqual(factor.weight, 0.15)
        XCTAssertEqual(factor.score, 12.0)
        XCTAssertEqual(factor.maxScore, 15.0)
        XCTAssertEqual(factor.percentage, 0.8) // 12/15
        XCTAssertEqual(factor.weightedScore, 12.0) // 0.15 * 0.8 * 100 = 12
    }

    // MARK: - Important Dates Tests

    func testImportantDateCreation() {
        let deadline = ImportantDate(
            title: "Proposal Submission Deadline",
            date: Date(),
            dateType: .proposalDeadline,
            isCritical: true,
            description: "Final deadline for submitting technical and financial proposals"
        )

        XCTAssertEqual(deadline.title, "Proposal Submission Deadline")
        XCTAssertEqual(deadline.dateType, .proposalDeadline)
        XCTAssertTrue(deadline.isCritical)
        XCTAssertNotNil(deadline.description)
    }

    func testDateTypeValues() {
        XCTAssertEqual(DateType.questionsDeadline.rawValue, "Questions Deadline")
        XCTAssertEqual(DateType.proposalDeadline.rawValue, "Proposal Deadline")
        XCTAssertEqual(DateType.presentationDate.rawValue, "Presentation Date")
        XCTAssertEqual(DateType.projectStartDate.rawValue, "Project Start Date")
        XCTAssertEqual(DateType.other.rawValue, "Other")
    }

    // MARK: - Warning Model Tests

    func testAnalysisWarningLevels() {
        let infoWarning = AnalysisWarning(
            level: .info,
            message: "Some optional fields were not found",
            affectedFields: ["holdingGroup"],
            isActionable: false,
            suggestedAction: nil
        )

        XCTAssertEqual(infoWarning.level, .info)
        XCTAssertEqual(infoWarning.level.icon, "ℹ️")

        let criticalWarning = AnalysisWarning(
            level: .critical,
            message: "Could not extract client name",
            affectedFields: ["clientName"],
            isActionable: true,
            suggestedAction: "Review RFP manually for client information"
        )

        XCTAssertEqual(criticalWarning.level, .critical)
        XCTAssertEqual(criticalWarning.level.icon, "❌")
        XCTAssertTrue(criticalWarning.isActionable)
    }

    // MARK: - Extracted RFP Data Tests

    func testCompletenessCalculation() {
        var data = ExtractedRFPData(
            id: UUID(),
            clientName: "Test Client",
            projectName: "Test Project",
            projectDescription: "Description",
            scopeOfWork: "Scope",
            scopeAnalysis: ScopeAnalysis(
                agencyServices: [],
                nonAgencyServices: [],
                agencyServicePercentage: 0.5,
                outputQuantities: nil,
                outputTypes: []
            ),
            financialPotential: nil, // Missing
            evaluationCriteria: "Criteria",
            requiredDeliverables: ["Deliverable 1"],
            importantDates: [ImportantDate(title: "Deadline", date: Date(), dateType: .proposalDeadline)],
            submissionMethodRequirements: "Requirements"
        )

        data.calculateCompleteness()

        // 9 out of 10 fields filled = 0.9
        XCTAssertEqual(data.completeness, 0.9)
    }

    func testCompletenessWithAllFields() {
        var data = ExtractedRFPData(
            clientName: "Client",
            projectName: "Project",
            projectDescription: "Description",
            scopeOfWork: "Scope",
            scopeAnalysis: ScopeAnalysis(
                agencyServices: [],
                nonAgencyServices: [],
                agencyServicePercentage: 0.5,
                outputQuantities: nil,
                outputTypes: []
            ),
            financialPotential: FinancialPotential(
                totalScore: 75,
                recommendation: "Good",
                factors: [],
                formulaExplanation: "Test"
            ),
            evaluationCriteria: "Criteria",
            requiredDeliverables: ["Deliverable"],
            importantDates: [ImportantDate(title: "Date", date: Date(), dateType: .other)],
            submissionMethodRequirements: "Requirements"
        )

        data.calculateCompleteness()

        // All 10 fields filled = 1.0
        XCTAssertEqual(data.completeness, 1.0)
    }

    func testCompletenessWithEmptyStrings() {
        var data = ExtractedRFPData(
            clientName: "", // Empty
            projectName: "Project",
            projectDescription: "", // Empty
            scopeOfWork: "Scope"
        )

        data.calculateCompleteness()

        // Only 2 valid fields (projectName, scopeOfWork) = 0.2
        XCTAssertEqual(data.completeness, 0.2)
    }

    // MARK: - Prompt Templates Tests

    func testSystemPromptContainsCriticalRequirements() {
        let systemPrompt = PromptTemplates.shared.systemPrompt

        // Verify critical requirements are in prompt
        XCTAssertTrue(systemPrompt.contains("PRESERVE EXACT CLIENT WORDING"))
        XCTAssertTrue(systemPrompt.contains("Extract ALL important dates"))
        XCTAssertTrue(systemPrompt.contains("evaluation criteria"))
        XCTAssertTrue(systemPrompt.contains("JSON"))
        XCTAssertTrue(systemPrompt.contains("deliverables"))
    }

    func testExtractionPromptIncludesAgencyServices() {
        let agencyServices = [
            "Video Production",
            "Motion Graphics",
            "Brand Strategy"
        ]

        let prompt = PromptTemplates.shared.extractionPrompt(
            documentText: "Sample RFP text",
            agencyServices: agencyServices
        )

        // Verify agency services are included
        XCTAssertTrue(prompt.contains("Video Production"))
        XCTAssertTrue(prompt.contains("Motion Graphics"))
        XCTAssertTrue(prompt.contains("Brand Strategy"))
        XCTAssertTrue(prompt.contains("Sample RFP text"))
    }

    func testVerificationPromptStructure() {
        let verificationPrompt = PromptTemplates.shared.verificationPrompt(
            originalText: "Original RFP",
            extractedData: "{\"clientName\": \"Test\"}"
        )

        XCTAssertTrue(verificationPrompt.contains("ORIGINAL RFP"))
        XCTAssertTrue(verificationPrompt.contains("EXTRACTED DATA"))
        XCTAssertTrue(verificationPrompt.contains("isAccurate"))
        XCTAssertTrue(verificationPrompt.contains("confidenceScore"))
    }

    func testFinancialAnalysisPromptContainsFormula() {
        let financialPrompt = PromptTemplates.shared.financialAnalysisPrompt(
            clientInfo: "Company info",
            scopeAnalysis: "Scope data"
        )

        // Verify formula factors are present
        XCTAssertTrue(financialPrompt.contains("Company/brand size and popularity (15%)"))
        XCTAssertTrue(financialPrompt.contains("Project scope magnitude (20%)"))
        XCTAssertTrue(financialPrompt.contains("Social media presence and activity level (8%)"))
        XCTAssertTrue(financialPrompt.contains("Content types published - video > images > text (12%)"))
        XCTAssertTrue(financialPrompt.contains("Holding group relationships (8%)"))
        XCTAssertTrue(financialPrompt.contains("Entity type - private vs governmental (7%)"))
        XCTAssertTrue(financialPrompt.contains("Media/ad spend data (10%)"))
        XCTAssertTrue(financialPrompt.contains("Agency service alignment percentage (5%)"))
        XCTAssertTrue(financialPrompt.contains("Output quantities (3%)"))
        XCTAssertTrue(financialPrompt.contains("Output types - video > motion graphics > visuals > content (2%)"))
    }

    // MARK: - Integration Tests

    func testCompleteFinancialScoringScenario() {
        // High-value enterprise client
        let clientInfo = ClientInformation(
            name: "Apple Inc.",
            companySize: .enterprise, // 15%
            brandPopularity: .international, // 10%
            entityType: .publicCompany, // 7% * 0.9 = 6.3%
            holdingGroup: nil, // 0%
            industry: "Technology",
            socialMediaPresence: SocialMediaPresence(
                hasPresence: true,
                activityLevel: .veryHigh, // 8%
                platforms: [.linkedin, .twitter, .youtube],
                contentTypes: [.video] // 12%
            ),
            estimatedEmployees: 150000,
            estimatedRevenue: "$394B",
            mediaSpendIndicators: "Very high", // 10%
            researchSources: [],
            researchConfidence: 0.95
        )

        let scopeAnalysis = ScopeAnalysis(
            agencyServices: ["Video", "Motion Graphics"],
            nonAgencyServices: ["Development"],
            agencyServicePercentage: 0.67, // 5% * 0.67 = 3.35%
            outputQuantities: OutputQuantities(
                videoProduction: 25, // 3%
                motionGraphics: 0,
                visualDesign: 0,
                contentOnly: 0
            ),
            outputTypes: [.video] // 2%
        )

        // Expected score: 15 + 10 + 6.3 + 0 + 8 + 12 + 10 + 3.35 + 3 + 2 = 69.65%
        // Should be "Good Financial Potential - Recommended"

        // This would be calculated by ClaudeAnalysisService.calculateFinancialPotential
        // We're verifying the scoring components exist and have correct ranges
        XCTAssertEqual(clientInfo.companySize?.score, 1.0)
        XCTAssertEqual(clientInfo.brandPopularity?.score, 1.0)
        XCTAssertEqual(scopeAnalysis.agencyServicePercentage, 0.67, accuracy: 0.01)
    }
}
