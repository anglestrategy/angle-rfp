//
//  AppLogger.swift
//  angle-rfp
//
//  Centralized structured logging system with PII protection
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import Foundation
import os.log

/// Centralized logging system for the angle-rfp application
///
/// Provides structured logging with automatic PII redaction, metadata support,
/// and integration with Apple's unified logging system (OSLog).
///
/// Features:
/// - Automatic redaction of sensitive data (API keys, emails, paths)
/// - Structured metadata for rich log context
/// - Performance tracking integration
/// - Production/development mode awareness
/// - Thread-safe operation
///
/// Example Usage:
/// ```swift
/// AppLogger.shared.debug("File selected", metadata: [
///     "fileName": "proposal.pdf",
///     "fileSize": 1024000
/// ])
///
/// AppLogger.shared.error("API request failed", error: networkError, metadata: [
///     "endpoint": "/analyze",
///     "statusCode": 429
/// ])
/// ```
public final class AppLogger {

    // MARK: - Singleton

    /// Shared logger instance
    public static let shared = AppLogger()

    // MARK: - Test Support

    /// Set to true to suppress all console output (useful for tests)
    public static var suppressConsoleOutput: Bool = false

    // MARK: - Properties

    private let subsystem = "com.angle.rfp"
    private let logger: os.Logger
    private let minimumLevel: LogLevel

    /// Queue for thread-safe logging operations
    private let loggingQueue = DispatchQueue(
        label: "com.angle.rfp.logging",
        qos: .utility
    )

    // MARK: - Initialization

    private init() {
        self.logger = os.Logger(subsystem: subsystem, category: "app")

        // Set minimum log level based on build configuration
        #if DEBUG
        self.minimumLevel = .debug
        #else
        self.minimumLevel = .info
        #endif
    }

    // MARK: - Public Logging Methods

    /// Logs a debug message (development only)
    /// - Parameters:
    ///   - message: The message to log
    ///   - metadata: Additional context (optional)
    ///   - file: Source file (auto-captured)
    ///   - function: Source function (auto-captured)
    ///   - line: Source line (auto-captured)
    public func debug(
        _ message: String,
        metadata: [String: Any] = [:],
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        log(.debug, message, metadata: metadata, file: file, function: function, line: line)
    }

    /// Logs an informational message
    /// - Parameters:
    ///   - message: The message to log
    ///   - metadata: Additional context (optional)
    ///   - file: Source file (auto-captured)
    ///   - function: Source function (auto-captured)
    ///   - line: Source line (auto-captured)
    public func info(
        _ message: String,
        metadata: [String: Any] = [:],
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        log(.info, message, metadata: metadata, file: file, function: function, line: line)
    }

    /// Logs a warning message
    /// - Parameters:
    ///   - message: The message to log
    ///   - metadata: Additional context (optional)
    ///   - file: Source file (auto-captured)
    ///   - function: Source function (auto-captured)
    ///   - line: Source line (auto-captured)
    public func warning(
        _ message: String,
        metadata: [String: Any] = [:],
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        log(.warning, message, metadata: metadata, file: file, function: function, line: line)
    }

    /// Logs an error message
    /// - Parameters:
    ///   - message: The message to log
    ///   - error: The error object (optional)
    ///   - metadata: Additional context (optional)
    ///   - file: Source file (auto-captured)
    ///   - function: Source function (auto-captured)
    ///   - line: Source line (auto-captured)
    public func error(
        _ message: String,
        error: Error? = nil,
        metadata: [String: Any] = [:],
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        var enrichedMetadata = metadata

        if let error = error {
            enrichedMetadata["error"] = String(describing: error)
            enrichedMetadata["errorType"] = String(describing: type(of: error))

            if let localizedError = error as? LocalizedError {
                enrichedMetadata["errorDescription"] = localizedError.errorDescription
                enrichedMetadata["failureReason"] = localizedError.failureReason
                enrichedMetadata["recoverySuggestion"] = localizedError.recoverySuggestion
            }
        }

        log(.error, message, metadata: enrichedMetadata, file: file, function: function, line: line)
    }

    /// Logs a critical error message
    /// - Parameters:
    ///   - message: The message to log
    ///   - error: The error object (optional)
    ///   - metadata: Additional context (optional)
    ///   - file: Source file (auto-captured)
    ///   - function: Source function (auto-captured)
    ///   - line: Source line (auto-captured)
    public func critical(
        _ message: String,
        error: Error? = nil,
        metadata: [String: Any] = [:],
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        var enrichedMetadata = metadata

        if let error = error {
            enrichedMetadata["error"] = String(describing: error)
            enrichedMetadata["errorType"] = String(describing: type(of: error))
        }

        log(.critical, message, metadata: enrichedMetadata, file: file, function: function, line: line)
    }

    // MARK: - Core Logging Implementation

    /// Core logging method (internal)
    private func log(
        _ level: LogLevel,
        _ message: String,
        metadata: [String: Any],
        file: String,
        function: String,
        line: Int
    ) {
        // Check minimum log level
        guard level >= minimumLevel else { return }

        // In test mode we skip all async formatting/redaction work to keep
        // stress tests deterministic and avoid background log churn.
        if AppLogger.suppressConsoleOutput {
            return
        }

        loggingQueue.async { [weak self] in
            guard let self = self else { return }

            // Redact sensitive information
            let redactedMessage = LogRedactor.redact(message)
            let redactedMetadata = LogRedactor.redactMetadata(metadata)

            // Format source location
            let fileName = (file as NSString).lastPathComponent
            let sourceLocation = "\(fileName):\(line)"

            // Build log context
            var logContext: [String: Any] = [
                "level": level.rawValue,
                "source": sourceLocation,
                "function": function
            ]

            // Merge metadata
            logContext.merge(redactedMetadata) { _, new in new }

            // Format final message
            let formattedMessage = self.formatMessage(
                level: level,
                message: redactedMessage,
                metadata: logContext
            )

            // Write to OSLog
            self.writeToOSLog(level: level, message: formattedMessage)

            // In debug mode, also print to console for immediate visibility
            // (unless suppressed for tests)
            #if DEBUG
            if !AppLogger.suppressConsoleOutput {
                self.printToConsole(level: level, message: formattedMessage)
            }
            #endif
        }
    }

    // MARK: - Formatting

    private func formatMessage(level: LogLevel, message: String, metadata: [String: Any]) -> String {
        var formatted = "\(level.emoji) [\(level.description)] \(message)"

        if !metadata.isEmpty {
            let metadataString = metadata
                .map { "\($0.key)=\($0.value)" }
                .joined(separator: ", ")
            formatted += " | \(metadataString)"
        }

        return formatted
    }

    private func writeToOSLog(level: LogLevel, message: String) {
        logger.log(level: level.osLogType, "\(message, privacy: .public)")
    }

    private func printToConsole(level: LogLevel, message: String) {
        print(message)
    }
}

// MARK: - Convenience Methods

extension AppLogger {

    /// Logs the start of an operation
    /// - Parameter operation: Name of the operation
    public func beginOperation(_ operation: String) {
        info("▶️ Begin: \(operation)")
    }

    /// Logs the successful completion of an operation
    /// - Parameters:
    ///   - operation: Name of the operation
    ///   - duration: Time taken (optional)
    public func completeOperation(_ operation: String, duration: TimeInterval? = nil) {
        var metadata: [String: Any] = [:]
        if let duration = duration {
            metadata["duration"] = duration
            metadata["duration_ms"] = Int(duration * 1000)
        }
        info("✅ Complete: \(operation)", metadata: metadata)
    }

    /// Logs a failed operation
    /// - Parameters:
    ///   - operation: Name of the operation
    ///   - error: The error that occurred
    public func failOperation(_ operation: String, error: Error) {
        self.error("❌ Failed: \(operation)", error: error)
    }
}
