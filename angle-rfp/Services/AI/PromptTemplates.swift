//
//  PromptTemplates.swift
//  angle-rfp
//
//  System prompts and extraction templates for Claude API
//  Ensures accurate RFP field extraction
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import Foundation

/// Prompt templates for Claude API RFP extraction
public final class PromptTemplates {

    // MARK: - Singleton

    public static let shared = PromptTemplates()

    private init() {}

    // MARK: - System Prompt

    /// System prompt defining Claude's role and extraction requirements
    public var systemPrompt: String {
        """
        You are an expert RFP (Request for Proposal) analyzer specializing in extracting structured information from proposal documents.

        Your task is to carefully read RFP documents and extract exactly 10 specific fields with MAXIMUM ACCURACY.

        CRITICAL REQUIREMENTS:
        1. PRESERVE EXACT CLIENT WORDING AND TERMINOLOGY - Do not paraphrase the scope of work
        2. Extract ALL important dates and deadlines
        3. Identify evaluation criteria EXACTLY as stated in the RFP
        4. List ALL required deliverables for submission
        5. Be thorough but concise in descriptions
        6. If information is missing or unclear, indicate this in your response
        7. Return ONLY valid JSON with no additional commentary

        OUTPUT FORMAT:
        You must respond with a valid JSON object matching this exact structure:
        {
          "id": "<UUID>",
          "extractionDate": "<ISO8601 date>",
          "clientName": "Exact client/organization name",
          "projectName": "Exact project title from RFP",
          "projectDescription": "1-2 sentence summary of the project",
          "scopeOfWork": "Complete scope preserving ALL client terminology",
          "scopeAnalysis": {
            "agencyServices": ["list", "of", "matched", "services"],
            "nonAgencyServices": ["list", "of", "outsourcing", "needs"],
            "agencyServicePercentage": 0.65,
            "outputQuantities": {
              "videoProduction": 5,
              "motionGraphics": 10,
              "visualDesign": 15,
              "contentOnly": 20
            },
            "outputTypes": ["Video Production", "Motion Graphics"]
          },
          "financialPotential": null,
          "evaluationCriteria": "EXACT text from RFP about how proposals will be evaluated",
          "requiredDeliverables": ["List of ALL deliverables needed for submission"],
          "importantDates": [
            {
              "id": "<UUID>",
              "title": "Questions Deadline",
              "date": "<ISO8601 date>",
              "dateType": "Questions Deadline",
              "isCritical": true,
              "description": "Deadline for submitting questions"
            }
          ],
          "submissionMethodRequirements": "HOW and WHERE to submit (email, portal, physical delivery, format requirements, etc.)",
          "parsingWarnings": [
            {
              "id": "<UUID>",
              "level": "Warning",
              "message": "Could not find submission deadline",
              "affectedFields": ["importantDates"],
              "isActionable": true,
              "suggestedAction": "Review RFP section 7 manually"
            }
          ],
          "completeness": 0.9,
          "confidenceScores": {
            "clientName": 1.0,
            "projectName": 1.0,
            "scopeOfWork": 0.95,
            "evaluationCriteria": 0.8
          }
        }

        SCOPE ANALYSIS INSTRUCTIONS:
        - Compare the scope of work against the provided agency services list
        - Calculate agencyServicePercentage as: (matched services / total scope items)
        - Identify specific quantities for video, motion graphics, visuals, and content
        - List primary output types in order of value: Video > Motion Graphics > Visuals > Content

        DATE EXTRACTION:
        - Extract ALL dates mentioned in the RFP
        - Classify each date (Questions Deadline, Proposal Deadline, Presentation Date, etc.)
        - Mark critical deadlines with isCritical: true
        - Use ISO8601 format for all dates

        QUALITY STANDARDS:
        - Completeness score: Number of filled fields / 10
        - Confidence score per field (0.0-1.0)
        - Create warnings for any missing or unclear fields
        - Include suggested actions for manual review
        """
    }

    // MARK: - Extraction Prompt

    /// Generate extraction prompt for specific RFP document
    /// - Parameters:
    ///   - documentText: Full RFP document text
    ///   - agencyServices: List of agency services for matching
    /// - Returns: Formatted extraction prompt
    public func extractionPrompt(
        documentText: String,
        agencyServices: [String]
    ) -> String {
        let agencyServicesList = agencyServices.map { "- \($0)" }.joined(separator: "\n")

        return """
        Please analyze the following RFP document and extract ALL 10 required fields.

        AGENCY SERVICES FOR MATCHING:
        \(agencyServicesList)

        IMPORTANT INSTRUCTIONS:
        1. For "scopeOfWork": PRESERVE EXACT CLIENT WORDING - do not change their terminology
        2. For "scopeAnalysis": Compare scope items against the agency services list above
        3. For "evaluationCriteria": Extract EXACT text from RFP about evaluation
        4. For "requiredDeliverables": List ALL deliverables needed for the submission
        5. For "importantDates": Extract ALL dates (Q&A deadline, submission deadline, presentation dates, etc.)
        6. For "submissionMethodRequirements": Specify HOW and WHERE to submit

        Calculate agencyServicePercentage by:
        - Identifying distinct scope items/requirements in the RFP
        - Counting how many match the agency services list
        - Dividing matched by total: (matched / total)
        - Example: If RFP has 20 scope items and 13 match agency services, percentage = 0.65

        If any field is missing or unclear, add a warning with specific details and suggested action.

        Generate a NEW UUID for the "id" field using UUID format: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"

        RFP DOCUMENT:
        ---
        \(documentText)
        ---

        Respond with ONLY the JSON object, no additional text or explanation.
        """
    }

    // MARK: - Verification Prompt

    /// Generate verification prompt to validate extraction quality
    /// - Parameters:
    ///   - originalText: Original RFP text
    ///   - extractedData: Extracted data to verify
    /// - Returns: Verification prompt
    public func verificationPrompt(
        originalText: String,
        extractedData: String
    ) -> String {
        """
        Please verify the accuracy of this RFP extraction:

        ORIGINAL RFP:
        ---
        \(originalText.prefix(5000))...
        ---

        EXTRACTED DATA:
        ---
        \(extractedData)
        ---

        Verification checklist:
        1. Is the client name correct?
        2. Is the project name exact?
        3. Does the scope of work preserve client terminology?
        4. Are ALL important dates extracted?
        5. Are ALL required deliverables listed?
        6. Is the evaluation criteria exact from the RFP?
        7. Is the submission method complete?

        Respond with:
        {
          "isAccurate": true/false,
          "issues": ["list of any inaccuracies found"],
          "corrections": ["suggested corrections"],
          "confidenceScore": 0.95
        }
        """
    }

    // MARK: - Financial Analysis Prompt

    /// Generate prompt for financial potential analysis
    /// - Parameters:
    ///   - clientInfo: Client research data
    ///   - scopeAnalysis: Scope analysis results
    /// - Returns: Financial analysis prompt
    public func financialAnalysisPrompt(
        clientInfo: String,
        scopeAnalysis: String
    ) -> String {
        """
        Analyze the financial potential of this RFP opportunity using the following data:

        CLIENT INFORMATION:
        ---
        \(clientInfo)
        ---

        SCOPE ANALYSIS:
        ---
        \(scopeAnalysis)
        ---

        Apply the financial scoring formula:
        1. Company/brand size and popularity (15%)
        2. Project scope magnitude (20%)
        3. Social media presence and activity level (8%)
        4. Content types published - video > images > text (12%)
        5. Holding group relationships (8%)
        6. Entity type - private vs governmental (7%)
        7. Media/ad spend data (10%)
        8. Agency service alignment percentage (5%)
        9. Output quantities (3%)
        10. Output types - video > motion graphics > visuals > content (2%)

        For each factor:
        - Assign a score (0-100% of the factor's weight)
        - Provide clear reasoning
        - Consider available data quality

        Calculate total score (0-100) and provide recommendation:
        - 0-40%: Low financial potential - high risk
        - 41-65%: Moderate financial potential - proceed with caution
        - 66-85%: Good financial potential - recommended
        - 86-100%: Excellent financial potential - high priority

        Respond with JSON:
        {
          "totalScore": 75.5,
          "recommendation": "Good financial potential - recommended",
          "factors": [
            {
              "name": "Company Size & Popularity",
              "weight": 0.15,
              "score": 12.0,
              "maxScore": 15,
              "reasoning": "Large enterprise with strong brand recognition"
            }
          ],
          "formulaExplanation": "Detailed breakdown..."
        }
        """
    }
}
