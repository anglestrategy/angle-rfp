//
//  LogLevel.swift
//  angle-rfp
//
//  Logging severity levels for structured logging
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import Foundation
import os.log

/// Defines severity levels for application logging
///
/// Use this enum to categorize log messages by their importance and purpose.
/// Each level corresponds to an OSLog type for system integration.
///
/// Example:
/// ```swift
/// AppLogger.shared.log(.debug, "User interaction", metadata: ["button": "upload"])
/// AppLogger.shared.log(.error, "Network failure", error: networkError)
/// ```
public enum LogLevel: String, Codable, CaseIterable {
    /// Detailed information for debugging purposes
    /// - Use for: Development-time debugging, verbose state information
    /// - Visible in: Development builds only
    case debug

    /// Informational messages about application flow
    /// - Use for: Normal operations, successful completions, state transitions
    /// - Visible in: All builds
    case info

    /// Warning messages for potentially problematic situations
    /// - Use for: Degraded performance, deprecated API usage, recoverable errors
    /// - Visible in: All builds
    case warning

    /// Error messages for failure conditions
    /// - Use for: Failed operations, exceptions, critical issues
    /// - Visible in: All builds
    case error

    /// Critical errors requiring immediate attention
    /// - Use for: Data loss, security issues, unrecoverable failures
    /// - Visible in: All builds, alerts monitoring
    case critical

    /// Converts LogLevel to OSLogType for system logging integration
    var osLogType: OSLogType {
        switch self {
        case .debug:
            return .debug
        case .info:
            return .info
        case .warning:
            return .default
        case .error:
            return .error
        case .critical:
            return .fault
        }
    }

    /// Human-readable description of the log level
    var description: String {
        rawValue.capitalized
    }

    /// Emoji representation for visual scanning in logs
    var emoji: String {
        switch self {
        case .debug:
            return "🔍"
        case .info:
            return "ℹ️"
        case .warning:
            return "⚠️"
        case .error:
            return "❌"
        case .critical:
            return "🚨"
        }
    }

    /// Determines if this log level should be recorded in production
    var isProductionVisible: Bool {
        switch self {
        case .debug:
            return false
        case .info, .warning, .error, .critical:
            return true
        }
    }
}

// MARK: - Comparable Conformance

extension LogLevel: Comparable {
    public static func < (lhs: LogLevel, rhs: LogLevel) -> Bool {
        let order: [LogLevel] = [.debug, .info, .warning, .error, .critical]
        guard let lhsIndex = order.firstIndex(of: lhs),
              let rhsIndex = order.firstIndex(of: rhs) else {
            return false
        }
        return lhsIndex < rhsIndex
    }
}
