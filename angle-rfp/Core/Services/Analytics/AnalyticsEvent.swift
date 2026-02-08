//
//  AnalyticsEvent.swift
//  angle-rfp
//
//  Event definitions for application analytics tracking
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import Foundation
import CryptoKit

/// Represents a trackable event in the application
///
/// Events capture user actions, system behaviors, performance metrics, and errors.
/// All events include automatic timestamps and session context.
///
/// Privacy-focused: All PII is hashed before tracking.
///
/// Example Usage:
/// ```swift
/// let event = AnalyticsEvent.documentUploaded(
///     fileType: "pdf",
///     fileSize: 1024000,
///     pageCount: 45
/// )
/// AnalyticsManager.shared.track(event)
/// ```
public struct AnalyticsEvent {

    // MARK: - Property Value Type

    /// Type-safe property values that are Sendable and Codable
    public enum PropertyValue: Sendable, Codable, Equatable {
        case string(String)
        case int(Int)
        case double(Double)
        case bool(Bool)
        case array([String])

        private enum CodingKeys: String, CodingKey {
            case type
            case value
        }

        private enum ValueType: String, Codable {
            case string
            case int
            case double
            case bool
            case array
        }

        // Codable conformance with backward compatibility for legacy single-value payloads.
        public init(from decoder: Decoder) throws {
            if let typedContainer = try? decoder.container(keyedBy: CodingKeys.self),
               let valueType = try? typedContainer.decode(ValueType.self, forKey: .type) {
                switch valueType {
                case .string:
                    self = .string(try typedContainer.decode(String.self, forKey: .value))
                case .int:
                    self = .int(try typedContainer.decode(Int.self, forKey: .value))
                case .double:
                    self = .double(try typedContainer.decode(Double.self, forKey: .value))
                case .bool:
                    self = .bool(try typedContainer.decode(Bool.self, forKey: .value))
                case .array:
                    self = .array(try typedContainer.decode([String].self, forKey: .value))
                }
                return
            }

            // Legacy fallback.
            let legacyContainer = try decoder.singleValueContainer()
            if let value = try? legacyContainer.decode(String.self) {
                self = .string(value)
            } else if let value = try? legacyContainer.decode(Bool.self) {
                self = .bool(value)
            } else if let value = try? legacyContainer.decode(Int.self) {
                self = .int(value)
            } else if let value = try? legacyContainer.decode(Double.self) {
                self = .double(value)
            } else if let value = try? legacyContainer.decode([String].self) {
                self = .array(value)
            } else {
                throw DecodingError.typeMismatch(
                    PropertyValue.self,
                    DecodingError.Context(
                        codingPath: decoder.codingPath,
                        debugDescription: "Could not decode PropertyValue"
                    )
                )
            }
        }

        public func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            switch self {
            case .string(let value):
                try container.encode(ValueType.string, forKey: .type)
                try container.encode(value, forKey: .value)
            case .int(let value):
                try container.encode(ValueType.int, forKey: .type)
                try container.encode(value, forKey: .value)
            case .double(let value):
                try container.encode(ValueType.double, forKey: .type)
                try container.encode(value, forKey: .value)
            case .bool(let value):
                try container.encode(ValueType.bool, forKey: .type)
                try container.encode(value, forKey: .value)
            case .array(let value):
                try container.encode(ValueType.array, forKey: .type)
                try container.encode(value, forKey: .value)
            }
        }

        /// Convert Any to PropertyValue
        static func from(_ value: Any) -> PropertyValue {
            if let val = value as? String {
                return .string(val)
            } else if let val = value as? Int {
                return .int(val)
            } else if let val = value as? Double {
                return .double(val)
            } else if let val = value as? Bool {
                return .bool(val)
            } else if let val = value as? [String] {
                return .array(val)
            } else {
                // Fallback to string representation
                return .string(String(describing: value))
            }
        }

        /// Get underlying value as Any
        var anyValue: Any {
            switch self {
            case .string(let value): return value
            case .int(let value): return value
            case .double(let value): return value
            case .bool(let value): return value
            case .array(let value): return value
            }
        }
    }

    // MARK: - Properties

    /// Unique identifier for this event
    public let id: UUID

    /// Event category for grouping
    public let category: EventCategory

    /// Event name (unique within category)
    public let name: String

    /// Additional event properties (thread-safe, Codable)
    public let properties: [String: PropertyValue]

    /// When the event occurred
    public let timestamp: Date

    /// Session identifier for correlation
    public let sessionID: UUID

    // MARK: - Event Categories

    public enum EventCategory: String, Codable {
        case userAction = "user_action"
        case systemEvent = "system_event"
        case performance = "performance"
        case error = "error"
        case aiInteraction = "ai_interaction"
        case webResearch = "web_research"
        case export = "export"
    }

    // MARK: - Privacy Helper

    /// Hash a string for privacy-preserving analytics
    /// - Parameter value: The value to hash
    /// - Returns: SHA-256 hash (first 8 characters for readability)
    private static func privacyHash(_ value: String) -> String {
        let data = Data(value.utf8)
        let hash = SHA256.hash(data: data)
        let hashString = hash.compactMap { String(format: "%02x", $0) }.joined()
        return String(hashString.prefix(8)) // First 8 chars for readability
    }

    // MARK: - Initialization

    /// Internal initializer using legacy [String: Any] properties
    private init(
        category: EventCategory,
        name: String,
        properties: [String: Any],
        sessionID: UUID
    ) {
        self.id = UUID()
        self.category = category
        self.name = name
        // Convert Any properties to PropertyValue
        self.properties = properties.mapValues { PropertyValue.from($0) }
        self.timestamp = Date()
        self.sessionID = sessionID
    }

    /// Type-safe initializer using PropertyValue
    internal init(
        category: EventCategory,
        name: String,
        properties: [String: PropertyValue],
        sessionID: UUID
    ) {
        self.id = UUID()
        self.category = category
        self.name = name
        self.properties = properties
        self.timestamp = Date()
        self.sessionID = sessionID
    }

    // MARK: - User Action Events

    /// User uploaded a document
    public static func documentUploaded(
        fileType: String,
        fileSize: Int,
        pageCount: Int? = nil,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        var properties: [String: Any] = [
            "fileType": fileType,
            "fileSize": fileSize
        ]
        if let pageCount = pageCount {
            properties["pageCount"] = pageCount
        }
        return AnalyticsEvent(
            category: .userAction,
            name: "document_uploaded",
            properties: properties,
            sessionID: sessionID
        )
    }

    /// User started RFP analysis
    public static func analysisStarted(
        documentID: UUID,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .userAction,
            name: "analysis_started",
            properties: ["documentID": documentID.uuidString],
            sessionID: sessionID
        )
    }

    /// User cancelled analysis
    public static func analysisCancelled(
        documentID: UUID,
        stage: String,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .userAction,
            name: "analysis_cancelled",
            properties: [
                "documentID": documentID.uuidString,
                "stage": stage
            ],
            sessionID: sessionID
        )
    }

    /// User exported results
    public static func resultsExported(
        exportType: String,
        documentID: UUID,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .userAction,
            name: "results_exported",
            properties: [
                "exportType": exportType,
                "documentID": documentID.uuidString
            ],
            sessionID: sessionID
        )
    }

    /// User manually edited research data
    public static func researchDataEdited(
        documentID: UUID,
        fieldsEdited: [String],
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .userAction,
            name: "research_data_edited",
            properties: [
                "documentID": documentID.uuidString,
                "fieldsEdited": fieldsEdited,
                "fieldCount": fieldsEdited.count
            ],
            sessionID: sessionID
        )
    }

    // MARK: - System Events

    /// Application launched
    public static func appLaunched(
        isFirstLaunch: Bool,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .systemEvent,
            name: "app_launched",
            properties: ["isFirstLaunch": isFirstLaunch],
            sessionID: sessionID
        )
    }

    /// Application terminated
    public static func appTerminated(
        sessionDuration: TimeInterval,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .systemEvent,
            name: "app_terminated",
            properties: [
                "sessionDuration": sessionDuration,
                "sessionDurationMinutes": Int(sessionDuration / 60)
            ],
            sessionID: sessionID
        )
    }

    // MARK: - Performance Events

    /// Document parsing completed
    public static func parsingCompleted(
        documentID: UUID,
        duration: TimeInterval,
        fileType: String,
        pageCount: Int,
        success: Bool,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .performance,
            name: "parsing_completed",
            properties: [
                "documentID": documentID.uuidString,
                "duration": duration,
                "durationMs": Int(duration * 1000),
                "fileType": fileType,
                "pageCount": pageCount,
                "success": success
            ],
            sessionID: sessionID
        )
    }

    /// Claude API request completed
    public static func claudeRequestCompleted(
        duration: TimeInterval,
        model: String,
        inputTokens: Int,
        outputTokens: Int,
        success: Bool,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .performance,
            name: "claude_request_completed",
            properties: [
                "duration": duration,
                "durationMs": Int(duration * 1000),
                "model": model,
                "inputTokens": inputTokens,
                "outputTokens": outputTokens,
                "totalTokens": inputTokens + outputTokens,
                "success": success
            ],
            sessionID: sessionID
        )
    }

    /// Web research completed
    /// - Note: Company name is hashed for privacy
    public static func webResearchCompleted(
        duration: TimeInterval,
        companyName: String,
        queriesExecuted: Int,
        cacheHit: Bool,
        success: Bool,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .performance,
            name: "web_research_completed",
            properties: [
                "duration": duration,
                "durationMs": Int(duration * 1000),
                "companyHash": privacyHash(companyName), // Privacy: hash instead of raw name
                "queriesExecuted": queriesExecuted,
                "cacheHit": cacheHit,
                "success": success
            ],
            sessionID: sessionID
        )
    }

    /// Full analysis workflow completed
    public static func analysisCompleted(
        documentID: UUID,
        totalDuration: TimeInterval,
        parsingDuration: TimeInterval,
        aiDuration: TimeInterval,
        researchDuration: TimeInterval,
        success: Bool,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .performance,
            name: "analysis_completed",
            properties: [
                "documentID": documentID.uuidString,
                "totalDuration": totalDuration,
                "totalDurationSeconds": Int(totalDuration),
                "parsingDuration": parsingDuration,
                "aiDuration": aiDuration,
                "researchDuration": researchDuration,
                "success": success
            ],
            sessionID: sessionID
        )
    }

    // MARK: - AI Interaction Events

    /// Claude extraction completed
    public static func claudeExtractionCompleted(
        documentID: UUID,
        fieldsExtracted: Int,
        totalFields: Int,
        completenessPercentage: Double,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .aiInteraction,
            name: "claude_extraction_completed",
            properties: [
                "documentID": documentID.uuidString,
                "fieldsExtracted": fieldsExtracted,
                "totalFields": totalFields,
                "completenessPercentage": completenessPercentage
            ],
            sessionID: sessionID
        )
    }

    /// Financial scoring calculated
    public static func financialScoringCompleted(
        documentID: UUID,
        finalScore: Double,
        factorBreakdown: [String: Double],
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        var properties: [String: Any] = [
            "documentID": documentID.uuidString,
            "finalScore": finalScore
        ]
        properties.merge(factorBreakdown) { _, new in new }

        return AnalyticsEvent(
            category: .aiInteraction,
            name: "financial_scoring_completed",
            properties: properties,
            sessionID: sessionID
        )
    }

    // MARK: - Web Research Events

    /// Brave Search query executed
    /// - Note: Company name is hashed for privacy
    public static func braveQueryExecuted(
        companyName: String,
        queryType: String,
        resultsCount: Int,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .webResearch,
            name: "brave_query_executed",
            properties: [
                "companyHash": privacyHash(companyName), // Privacy: hash instead of raw name
                "queryType": queryType,
                "resultsCount": resultsCount
            ],
            sessionID: sessionID
        )
    }

    /// Research cache hit
    /// - Note: Company name is hashed for privacy
    public static func researchCacheHit(
        companyName: String,
        cacheAge: TimeInterval,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .webResearch,
            name: "research_cache_hit",
            properties: [
                "companyHash": privacyHash(companyName), // Privacy: hash instead of raw name
                "cacheAge": cacheAge,
                "cacheAgeDays": Int(cacheAge / 86400)
            ],
            sessionID: sessionID
        )
    }

    // MARK: - Error Events

    /// Error occurred
    public static func errorOccurred(
        error: Error,
        context: String,
        severity: LogLevel,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        var properties: [String: Any] = [
            "context": context,
            "severity": severity.rawValue,
            "errorType": String(describing: type(of: error)),
            "errorDescription": error.localizedDescription
        ]

        if let localizedError = error as? LocalizedError {
            if let reason = localizedError.failureReason {
                properties["failureReason"] = reason
            }
            if let suggestion = localizedError.recoverySuggestion {
                properties["recoverySuggestion"] = suggestion
            }
        }

        return AnalyticsEvent(
            category: .error,
            name: "error_occurred",
            properties: properties,
            sessionID: sessionID
        )
    }

    /// Parsing warning detected
    public static func parsingWarning(
        documentID: UUID,
        warningType: String,
        warningMessage: String,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .error,
            name: "parsing_warning",
            properties: [
                "documentID": documentID.uuidString,
                "warningType": warningType,
                "warningMessage": warningMessage
            ],
            sessionID: sessionID
        )
    }

    // MARK: - Export Events

    /// PDF export completed
    public static func pdfExportCompleted(
        documentID: UUID,
        duration: TimeInterval,
        fileSize: Int,
        success: Bool,
        sessionID: UUID = AnalyticsManager.shared.sessionID
    ) -> AnalyticsEvent {
        AnalyticsEvent(
            category: .export,
            name: "pdf_export_completed",
            properties: [
                "documentID": documentID.uuidString,
                "duration": duration,
                "fileSize": fileSize,
                "success": success
            ],
            sessionID: sessionID
        )
    }
}

// MARK: - Codable Support

extension AnalyticsEvent: Codable {
    enum CodingKeys: String, CodingKey {
        case id, category, name, properties, timestamp, sessionID
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(UUID.self, forKey: .id)
        self.category = try container.decode(EventCategory.self, forKey: .category)
        self.name = try container.decode(String.self, forKey: .name)
        self.timestamp = try container.decode(Date.self, forKey: .timestamp)
        self.sessionID = try container.decode(UUID.self, forKey: .sessionID)

        // Decode properties using PropertyValue's Codable conformance
        self.properties = try container.decode([String: PropertyValue].self, forKey: .properties)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(category, forKey: .category)
        try container.encode(name, forKey: .name)
        try container.encode(timestamp, forKey: .timestamp)
        try container.encode(sessionID, forKey: .sessionID)

        // Encode properties using PropertyValue's Codable conformance
        try container.encode(properties, forKey: .properties)
    }
}

// MARK: - Sendable Conformance

extension AnalyticsEvent: Sendable {}
