//
//  LogRedactor.swift
//  angle-rfp
//
//  Redacts personally identifiable information (PII) from logs
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import Foundation

/// Scrubs sensitive information from log messages to protect user privacy
///
/// This utility ensures that API keys, email addresses, file paths, and other
/// sensitive data are not exposed in application logs.
///
    /// Example:
    /// ```swift
    /// let redacted = LogRedactor.redact("API key: sk-ant-EXAMPLE")
    /// // Result: "API key: [REDACTED_API_KEY]"
    /// ```
public enum LogRedactor {

    // MARK: - Public Interface

    /// Redacts sensitive information from a string
    /// - Parameter message: The message to redact
    /// - Returns: Message with sensitive data replaced by placeholders
    public static func redact(_ message: String) -> String {
        var redacted = message

        // Redact API keys
        redacted = redactAPIKeys(redacted)

        // Redact email addresses
        redacted = redactEmails(redacted)

        // Redact file paths
        redacted = redactFilePaths(redacted)

        // Redact potential credit card numbers
        redacted = redactCreditCards(redacted)

        // Redact URLs with query parameters (may contain tokens)
        redacted = redactURLParameters(redacted)

        return redacted
    }

    /// Redacts sensitive fields from metadata dictionary
    /// - Parameter metadata: Dictionary of metadata
    /// - Returns: Dictionary with sensitive values redacted
    public static func redactMetadata(_ metadata: [String: Any]) -> [String: Any] {
        redactMetadataValue(metadata) as? [String: Any] ?? metadata
    }

    // MARK: - Private Helpers

    /// Redacts API keys (Claude, Brave, etc.)
    private static func redactAPIKeys(_ message: String) -> String {
        var redacted = message

        // Claude API keys (sk-ant-...)
        let claudePattern = "sk-ant-[A-Za-z0-9_-]+"
        redacted = redacted.replacingOccurrences(
            of: claudePattern,
            with: "[REDACTED_CLAUDE_KEY]",
            options: .regularExpression
        )

        // Generic API keys:
        // Require at least one digit to avoid redacting base64-like payloads.
        let genericKeyPattern = "\\b(?=[A-Za-z0-9_-]{20,}\\b)(?=[A-Za-z0-9_-]*\\d)[A-Za-z0-9_-]+\\b"
        redacted = redacted.replacingOccurrences(
            of: genericKeyPattern,
            with: "[REDACTED_API_KEY]",
            options: .regularExpression
        )

        return redacted
    }

    /// Redacts email addresses
    private static func redactEmails(_ message: String) -> String {
        let pattern = "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}"
        return message.replacingOccurrences(
            of: pattern,
            with: "[REDACTED_EMAIL]",
            options: .regularExpression
        )
    }

    /// Redacts file system paths
    private static func redactFilePaths(_ message: String) -> String {
        var redacted = message

        // macOS user paths
        let userPathPattern = "/Users/[^/\\s]+(/[^\\s]*)?"
        redacted = redacted.replacingOccurrences(
            of: userPathPattern,
            with: "/Users/[USER]",
            options: .regularExpression
        )

        // Document paths
        let documentPattern = "/Documents/[^\\s]+"
        redacted = redacted.replacingOccurrences(
            of: documentPattern,
            with: "/Documents/[PATH]",
            options: .regularExpression
        )

        return redacted
    }

    /// Redacts potential credit card numbers
    private static func redactCreditCards(_ message: String) -> String {
        // Match 13-19 digit numbers (common credit card lengths)
        let pattern = "\\b\\d{13,19}\\b"
        return message.replacingOccurrences(
            of: pattern,
            with: "[REDACTED_NUMBER]",
            options: .regularExpression
        )
    }

    /// Redacts URL query parameters
    private static func redactURLParameters(_ message: String) -> String {
        // Match URLs with query parameters
        let pattern = "(https?://[^\\s?]+)(\\?[^\\s]+)"
        return message.replacingOccurrences(
            of: pattern,
            with: "$1?[REDACTED_PARAMS]",
            options: .regularExpression
        )
    }

    private static func redactMetadataValue(_ value: Any) -> Any {
        if let dictionary = value as? [String: Any] {
            var redactedDictionary: [String: Any] = [:]
            redactedDictionary.reserveCapacity(dictionary.count)

            for (key, innerValue) in dictionary {
                if isSensitiveMetadataKey(key) {
                    redactedDictionary[key] = "[REDACTED_\(key.uppercased())]"
                } else {
                    redactedDictionary[key] = redactMetadataValue(innerValue)
                }
            }

            return redactedDictionary
        }

        if let array = value as? [Any] {
            return array.map { redactMetadataValue($0) }
        }

        return value
    }

    private static func isSensitiveMetadataKey(_ key: String) -> Bool {
        let normalized = key.lowercased()
        let sensitiveTokens = [
            "api_key",
            "apikey",
            "password",
            "token",
            "secret",
            "authorization",
            "credentials",
            "private_key",
            "auth"
        ]

        return sensitiveTokens.contains { normalized.contains($0) }
    }
}
