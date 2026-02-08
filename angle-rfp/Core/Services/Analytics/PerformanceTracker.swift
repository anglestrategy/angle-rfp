//
//  PerformanceTracker.swift
//  angle-rfp
//
//  Performance timing and measurement utilities
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import Foundation

/// Utility for tracking operation performance with automatic analytics and logging
///
/// Provides precise timing measurements with automatic integration to analytics
/// and logging systems. Supports nested operations and custom metrics.
///
/// Features:
/// - Automatic timing measurement
/// - Integration with analytics and logging
/// - Nested operation support
/// - Memory-efficient design
/// - Thread-safe operation
///
/// Example Usage:
/// ```swift
/// // Simple timing
/// let tracker = PerformanceTracker(operation: "document_parsing")
/// // ... perform operation ...
/// tracker.complete(success: true)
///
/// // With custom metadata
/// let tracker = PerformanceTracker(operation: "api_request")
/// tracker.recordMetric("inputTokens", value: 1500)
/// tracker.recordMetric("outputTokens", value: 800)
/// tracker.complete(success: true)
///
/// // Using closure-based API
/// PerformanceTracker.measure("file_upload") {
///     // ... perform operation ...
/// }
/// ```
public final class PerformanceTracker {

    // MARK: - Properties

    /// Operation being tracked
    public let operation: String

    /// Start time of the operation
    private let startTime: Date

    /// Custom metrics collected during operation
    private var metrics: [String: Any] = [:]

    /// Whether tracking is complete
    private var isComplete = false

    /// Queue for thread-safe metric recording
    private let metricsQueue = DispatchQueue(
        label: "com.angle.rfp.performance-tracker.\(UUID().uuidString)",
        qos: .utility
    )

    // MARK: - Initialization

    /// Initialize a performance tracker for an operation
    /// - Parameter operation: Name of the operation being tracked
    public init(operation: String) {
        self.operation = operation
        self.startTime = Date()

        AppLogger.shared.debug("Performance tracking started", metadata: [
            "operation": operation
        ])
    }

    deinit {
        // Ensure completion is called
        if !isComplete {
            AppLogger.shared.warning("Performance tracker deallocated without completion", metadata: [
                "operation": operation
            ])
        }
    }

    // MARK: - Public API

    /// Record a custom metric
    /// - Parameters:
    ///   - key: Metric name
    ///   - value: Metric value
    public func recordMetric(_ key: String, value: Any) {
        metricsQueue.sync {
            metrics[key] = value
        }
    }

    /// Record multiple metrics at once
    /// - Parameter metrics: Dictionary of metrics to record
    public func recordMetrics(_ metrics: [String: Any]) {
        metricsQueue.sync {
            self.metrics.merge(metrics) { _, new in new }
        }
    }

    /// Get current duration
    public var duration: TimeInterval {
        Date().timeIntervalSince(startTime)
    }

    /// Complete tracking and log results
    /// - Parameters:
    ///   - success: Whether the operation succeeded
    ///   - additionalMetrics: Optional additional metrics to include
    public func complete(success: Bool, additionalMetrics: [String: Any] = [:]) {
        metricsQueue.sync {
            guard !isComplete else { return }

            isComplete = true

            let finalDuration = duration

            // Merge additional metrics
            var allMetrics = metrics
            allMetrics.merge(additionalMetrics) { _, new in new }
            allMetrics["duration"] = finalDuration
            allMetrics["durationMs"] = Int(finalDuration * 1000)
            allMetrics["success"] = success
            allMetrics["operation"] = operation

            // Log completion
            if success {
                AppLogger.shared.info("Operation completed", metadata: [
                    "operation": operation,
                    "duration": finalDuration,
                    "durationMs": Int(finalDuration * 1000)
                ])
            } else {
                AppLogger.shared.warning("Operation failed", metadata: [
                    "operation": operation,
                    "duration": finalDuration,
                    "durationMs": Int(finalDuration * 1000)
                ])
            }

            // Log performance details
            AppLogger.shared.debug("Performance metrics", metadata: allMetrics)

            // Track to analytics using internal initializer
            let properties = allMetrics.mapValues { AnalyticsEvent.PropertyValue.from($0) }
            let event = AnalyticsEvent(
                category: .performance,
                name: operation,
                properties: properties,
                sessionID: AnalyticsManager.shared.sessionID
            )
            AnalyticsManager.shared.track(event)
        }
    }

    /// Complete with error
    /// - Parameter error: The error that occurred
    public func complete(withError error: Error) {
        let errorMetrics: [String: Any] = [
            "errorType": String(describing: type(of: error)),
            "errorDescription": error.localizedDescription
        ]

        complete(success: false, additionalMetrics: errorMetrics)
    }

    // MARK: - Class Methods

    /// Measure the execution time of a synchronous operation
    /// - Parameters:
    ///   - operation: Name of the operation
    ///   - block: The operation to measure
    /// - Returns: The result of the operation
    /// - Throws: Any error thrown by the operation
    @discardableResult
    public static func measure<T>(
        _ operation: String,
        _ block: () throws -> T
    ) rethrows -> T {
        let tracker = PerformanceTracker(operation: operation)

        do {
            let result = try block()
            tracker.complete(success: true)
            return result
        } catch {
            tracker.complete(withError: error)
            throw error
        }
    }

    /// Measure the execution time of an asynchronous operation
    /// - Parameters:
    ///   - operation: Name of the operation
    ///   - block: The async operation to measure
    /// - Returns: The result of the operation
    /// - Throws: Any error thrown by the operation
    @discardableResult
    public static func measure<T>(
        _ operation: String,
        _ block: () async throws -> T
    ) async rethrows -> T {
        let tracker = PerformanceTracker(operation: operation)

        do {
            let result = try await block()
            tracker.complete(success: true)
            return result
        } catch {
            tracker.complete(withError: error)
            throw error
        }
    }

    /// Create a checkpoint for multi-stage operations
    /// - Parameter stage: Name of the stage
    /// - Returns: A new tracker for this stage
    public func checkpoint(_ stage: String) -> PerformanceTracker {
        let stageName = "\(operation).\(stage)"
        return PerformanceTracker(operation: stageName)
    }
}

// MARK: - Performance Budget

/// Defines performance budgets for different operations
public enum PerformanceBudget {

    /// Maximum acceptable duration for an operation type
    public enum Budget {
        case parsing(pages: Int)
        case claudeRequest
        case webResearch
        case export

        var maxDuration: TimeInterval {
            switch self {
            case .parsing(let pages):
                // 100ms per page baseline
                return Double(pages) * 0.1
            case .claudeRequest:
                // 30 seconds for Claude API
                return 30.0
            case .webResearch:
                // 10 seconds for web research
                return 10.0
            case .export:
                // 5 seconds for export
                return 5.0
            }
        }

        var warningThreshold: TimeInterval {
            // Warn at 80% of budget
            return maxDuration * 0.8
        }
    }

    /// Check if duration exceeds budget
    /// - Parameters:
    ///   - duration: Actual duration
    ///   - budget: Performance budget
    /// - Returns: True if within budget
    public static func isWithinBudget(
        duration: TimeInterval,
        budget: Budget
    ) -> Bool {
        duration <= budget.maxDuration
    }

    /// Check if duration should trigger a warning
    /// - Parameters:
    ///   - duration: Actual duration
    ///   - budget: Performance budget
    /// - Returns: True if warning threshold exceeded
    public static func shouldWarn(
        duration: TimeInterval,
        budget: Budget
    ) -> Bool {
        duration > budget.warningThreshold
    }

    /// Log performance against budget
    /// - Parameters:
    ///   - operation: Operation name
    ///   - duration: Actual duration
    ///   - budget: Performance budget
    public static func logPerformance(
        operation: String,
        duration: TimeInterval,
        budget: Budget
    ) {
        let withinBudget = isWithinBudget(duration: duration, budget: budget)
        let shouldWarn = shouldWarn(duration: duration, budget: budget)

        let percentage = (duration / budget.maxDuration) * 100

        var metadata: [String: Any] = [
            "operation": operation,
            "duration": duration,
            "durationMs": Int(duration * 1000),
            "budget": budget.maxDuration,
            "budgetMs": Int(budget.maxDuration * 1000),
            "percentageOfBudget": Int(percentage),
            "withinBudget": withinBudget
        ]

        if !withinBudget {
            metadata["exceededBy"] = duration - budget.maxDuration
            metadata["exceededByMs"] = Int((duration - budget.maxDuration) * 1000)

            AppLogger.shared.warning(
                "Performance budget exceeded",
                metadata: metadata
            )
        } else if shouldWarn {
            AppLogger.shared.warning(
                "Performance approaching budget limit",
                metadata: metadata
            )
        } else {
            AppLogger.shared.debug(
                "Performance within budget",
                metadata: metadata
            )
        }
    }
}

// MARK: - Memory Tracker

/// Track memory usage for operations
public final class MemoryTracker {

    /// Get current memory usage in bytes
    public static var currentUsage: Int64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(
                    mach_task_self_,
                    task_flavor_t(MACH_TASK_BASIC_INFO),
                    $0,
                    &count
                )
            }
        }

        guard kerr == KERN_SUCCESS else {
            return 0
        }

        return Int64(info.resident_size)
    }

    /// Format bytes into human-readable string
    /// - Parameter bytes: Number of bytes
    /// - Returns: Formatted string (e.g., "45.2 MB")
    public static func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }

    /// Log current memory usage
    /// - Parameter context: Optional context description
    public static func logCurrentUsage(context: String = "Memory usage") {
        let usage = currentUsage
        let formatted = formatBytes(usage)

        AppLogger.shared.debug(context, metadata: [
            "memoryUsage": formatted,
            "memoryUsageBytes": usage
        ])
    }

    /// Track memory usage for an operation
    /// - Parameters:
    ///   - operation: Operation name
    ///   - block: Operation to track
    /// - Returns: Result of the operation
    /// - Throws: Any error thrown by the operation
    @discardableResult
    public static func track<T>(
        _ operation: String,
        _ block: () throws -> T
    ) rethrows -> T {
        let startMemory = currentUsage

        let result = try block()

        let endMemory = currentUsage
        let delta = endMemory - startMemory

        AppLogger.shared.debug("Memory tracking", metadata: [
            "operation": operation,
            "startMemory": formatBytes(startMemory),
            "endMemory": formatBytes(endMemory),
            "delta": formatBytes(delta),
            "deltaBytes": delta
        ])

        return result
    }

    /// Track memory usage for an async operation
    /// - Parameters:
    ///   - operation: Operation name
    ///   - block: Async operation to track
    /// - Returns: Result of the operation
    /// - Throws: Any error thrown by the operation
    @discardableResult
    public static func track<T>(
        _ operation: String,
        _ block: () async throws -> T
    ) async rethrows -> T {
        let startMemory = currentUsage

        let result = try await block()

        let endMemory = currentUsage
        let delta = endMemory - startMemory

        AppLogger.shared.debug("Memory tracking", metadata: [
            "operation": operation,
            "startMemory": formatBytes(startMemory),
            "endMemory": formatBytes(endMemory),
            "delta": formatBytes(delta),
            "deltaBytes": delta
        ])

        return result
    }
}
