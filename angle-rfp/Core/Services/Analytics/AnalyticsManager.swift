//
//  AnalyticsManager.swift
//  angle-rfp
//
//  Centralized analytics tracking and event management
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import Foundation

/// Centralized manager for application analytics and event tracking
///
/// Provides privacy-focused analytics with local storage, batch processing,
/// and automatic event lifecycle management.
///
/// Features:
/// - Thread-safe event tracking
/// - Persistent local storage
/// - Privacy-first design (no PII)
/// - Automatic session management
/// - Configurable retention periods
/// - Integration with logging system
///
/// Example Usage:
/// ```swift
/// // Track a user action
/// AnalyticsManager.shared.track(
///     .documentUploaded(fileType: "pdf", fileSize: 1024000, pageCount: 45)
/// )
///
/// // Query recent events
/// let recentErrors = AnalyticsManager.shared.getEvents(
///     category: .error,
///     since: Date().addingTimeInterval(-3600)
/// )
/// ```
public final class AnalyticsManager {

    // MARK: - Singleton

    /// Shared analytics manager instance
    public static let shared = AnalyticsManager()

    // MARK: - Properties

    /// Current session identifier (thread-safe)
    public var sessionID: UUID {
        analyticsQueue.sync { _sessionID }
    }

    /// Internal session ID storage
    private var _sessionID: UUID

    /// Session start time
    private let sessionStartTime: Date

    /// Queue for thread-safe operations
    private let analyticsQueue = DispatchQueue(
        label: "com.angle.rfp.analytics",
        qos: .utility
    )

    /// In-memory event buffer
    private var eventBuffer: [AnalyticsEvent] = []

    /// Maximum events to buffer before flushing
    private let maxBufferSize = 1000

    /// Event retention period (days)
    private let retentionDays = 30

    /// Storage URL for persisted events
    private let storageURL: URL

    /// Flush timer
    private var flushTimer: Timer?

    /// Whether analytics is enabled
    public var isEnabled: Bool = true {
        didSet {
            if isEnabled {
                AppLogger.shared.info("Analytics enabled")
            } else {
                AppLogger.shared.info("Analytics disabled")
                flush() // Flush before disabling
            }
        }
    }

    // MARK: - Initialization

    private init() {
        self._sessionID = UUID()
        self.sessionStartTime = Date()

        let fileManager = FileManager.default
        let environment = ProcessInfo.processInfo.environment
        let isRunningTests = environment["XCTestConfigurationFilePath"] != nil

        if isRunningTests {
            // Tests can run in parallel across multiple processes. Use per-process temp storage to avoid flakiness.
            let runID = Self.testRunIdentifier()
            self.storageURL = fileManager.temporaryDirectory
                .appendingPathComponent("com.angle.rfp.analytics.\(runID).json")

            AppLogger.shared.info("Analytics initialized (test mode)", metadata: [
                "sessionID": _sessionID.uuidString,
                "storageURL": storageURL.path
            ])
        } else if let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
            let analyticsDir = appSupport
                .appendingPathComponent("com.angle.rfp", isDirectory: true)
                .appendingPathComponent("Analytics", isDirectory: true)

            // Create directory if needed
            do {
                try fileManager.createDirectory(at: analyticsDir, withIntermediateDirectories: true)
                self.storageURL = analyticsDir.appendingPathComponent("events.json")

                AppLogger.shared.info("Analytics initialized", metadata: [
                    "sessionID": _sessionID.uuidString,
                    "storageURL": storageURL.path
                ])
            } catch {
                AppLogger.shared.error("Failed to create analytics directory, using temp storage", error: error)
                self.storageURL = fileManager.temporaryDirectory.appendingPathComponent("com.angle.rfp.analytics.json")
            }
        } else {
            AppLogger.shared.critical("Failed to locate Application Support directory, using temp storage")
            self.storageURL = fileManager.temporaryDirectory.appendingPathComponent("com.angle.rfp.analytics.json")
        }

        // Clean up + timers are disabled for tests (parallel test isolation + determinism).
        if !isRunningTests {
            cleanupOldEvents()
            setupFlushTimer()
        }
    }

    deinit {
        // Invalidate timer and perform final flush
        flushTimer?.invalidate()
        analyticsQueue.sync {
            performFlush()
        }
    }

    // MARK: - Public API

    /// Track an analytics event (async - for production use)
    /// - Parameter event: The event to track
    public func track(_ event: AnalyticsEvent) {
        guard isEnabled else { return }

        analyticsQueue.async { [weak self] in
            self?.performTrack(event)
        }
    }

    /// Track an analytics event synchronously (for testing)
    /// - Parameter event: The event to track
    /// - Note: This method blocks until the event is tracked
    public func trackSync(_ event: AnalyticsEvent) {
        guard isEnabled else { return }

        analyticsQueue.sync {
            performTrack(event)
        }
    }

    /// Internal track implementation
    private func performTrack(_ event: AnalyticsEvent) {
        // Add to buffer
        eventBuffer.append(event)

        // Keep per-event logging lightweight during stress loads.
        if eventBuffer.count <= 5 || eventBuffer.count % 250 == 0 {
            AppLogger.shared.debug("Analytics event tracked", metadata: [
                "category": event.category.rawValue,
                "name": event.name,
                "eventID": event.id.uuidString
            ])
        }

        // Flush if buffer is full
        if eventBuffer.count >= maxBufferSize {
            performFlush()
        }
    }

    /// Flush all buffered events to disk (async)
    public func flush() {
        analyticsQueue.async { [weak self] in
            self?.performFlush()
        }
    }

    /// Flush all buffered events to disk synchronously (for testing)
    /// - Note: This method blocks until flush is complete
    public func flushSync() {
        analyticsQueue.sync {
            performFlush()
        }
    }

    /// Get events matching criteria
    /// - Parameters:
    ///   - category: Optional category filter
    ///   - since: Optional time filter (events after this date)
    ///   - limit: Maximum number of events to return
    /// - Returns: Array of matching events
    public func getEvents(
        category: AnalyticsEvent.EventCategory? = nil,
        since: Date? = nil,
        limit: Int = .max
    ) -> [AnalyticsEvent] {
        guard limit > 0 else {
            return []
        }

        return analyticsQueue.sync {
            let persistedEvents = loadPersistedEvents()

            // Combine and sort first (by timestamp, newest first)
            let allEvents = (persistedEvents + eventBuffer)
                .sorted { $0.timestamp > $1.timestamp }

            // Stream processing: filter and limit in one pass
            var results: [AnalyticsEvent] = []
            results.reserveCapacity(min(limit, 100))

            for event in allEvents {
                // Apply filters
                if let category = category, event.category != category {
                    continue
                }
                if let since = since, event.timestamp < since {
                    continue
                }

                results.append(event)

                // Early exit when limit reached
                if results.count >= limit {
                    break
                }
            }

            return results
        }
    }

    /// Get event counts by category
    /// - Parameter since: Optional time filter
    /// - Returns: Dictionary of category to event count
    public func getEventCounts(since: Date? = nil) -> [AnalyticsEvent.EventCategory: Int] {
        let events = getEvents(since: since, limit: .max)
        var counts: [AnalyticsEvent.EventCategory: Int] = [:]

        for event in events {
            counts[event.category, default: 0] += 1
        }

        return counts
    }

    /// Get total session duration
    public var sessionDuration: TimeInterval {
        Date().timeIntervalSince(sessionStartTime)
    }

    /// Start a new session
    public func startNewSession() {
        analyticsQueue.async { [weak self] in
            guard let self = self else { return }

            // Flush current session events
            self.performFlush()

            // Generate new session ID
            self._sessionID = UUID()

            AppLogger.shared.info("New analytics session started", metadata: [
                "sessionID": self._sessionID.uuidString
            ])
        }
    }

    /// Clear all analytics data (async)
    public func clearAllData() {
        analyticsQueue.async { [weak self] in
            self?.performClearAllData()
        }
    }

    /// Clear all analytics data synchronously (for testing)
    /// - Note: This method blocks until all data is cleared
    public func clearAllDataSync() {
        analyticsQueue.sync {
            performClearAllData()
        }
    }

    /// Internal clear implementation
    private func performClearAllData() {
        // Clear buffer
        eventBuffer.removeAll()

        // Delete persisted file
        try? FileManager.default.removeItem(at: storageURL)

        AppLogger.shared.info("All analytics data cleared")
    }

    // MARK: - Private Methods

    /// Perform flush operation (must be called on analyticsQueue)
    /// - Parameter isRetry: Whether this is a retry attempt (prevents infinite recursion)
    private func performFlush(isRetry: Bool = false) {
        guard !eventBuffer.isEmpty else { return }

        do {
            // Load existing events
            var allEvents = loadPersistedEvents()

            // Append buffered events
            allEvents.append(contentsOf: eventBuffer)

            // Encode and save
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(allEvents)

            try data.write(to: storageURL, options: .atomic)

            AppLogger.shared.debug("Analytics events flushed", metadata: [
                "count": eventBuffer.count,
                "totalEvents": allEvents.count
            ])

            // Clear buffer only on success
            eventBuffer.removeAll()

        } catch {
            AppLogger.shared.error(
                "Failed to flush analytics events",
                error: error
            )

            // If file is corrupted and this is not already a retry, move it aside and retry once
            if !isRetry && (error as NSError).code == CocoaError.fileReadCorruptFile.rawValue {
                let backupURL = storageURL.appendingPathExtension("corrupted-\(Int(Date().timeIntervalSince1970))")
                try? FileManager.default.moveItem(at: storageURL, to: backupURL)
                AppLogger.shared.warning("Corrupted analytics file moved to backup, retrying flush")
                performFlush(isRetry: true) // Retry once with clean slate
                return
            }

            // Prevent unbounded buffer growth on persistent errors
            if eventBuffer.count > maxBufferSize * 10 {
                AppLogger.shared.warning("Event buffer overflow, dropping oldest events", metadata: [
                    "droppedCount": maxBufferSize
                ])
                eventBuffer.removeFirst(maxBufferSize)
            }
        }
    }

    /// Load persisted events from disk
    /// - Returns: Array of persisted events
    private func loadPersistedEvents() -> [AnalyticsEvent] {
        guard FileManager.default.fileExists(atPath: storageURL.path) else {
            return []
        }

        do {
            let data = try Data(contentsOf: storageURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let events = try decoder.decode([AnalyticsEvent].self, from: data)
            return events
        } catch {
            AppLogger.shared.error(
                "Failed to load persisted analytics events",
                error: error
            )
            return []
        }
    }

    /// Clean up events older than retention period
    private func cleanupOldEvents() {
        analyticsQueue.async { [weak self] in
            guard let self = self else { return }

            let cutoffDate = Date().addingTimeInterval(-Double(self.retentionDays * 86400))
            var events = self.loadPersistedEvents()

            let originalCount = events.count
            events = events.filter { $0.timestamp >= cutoffDate }

            let removedCount = originalCount - events.count

            if removedCount > 0 {
                do {
                    let encoder = JSONEncoder()
                    encoder.dateEncodingStrategy = .iso8601
                    let data = try encoder.encode(events)
                    try data.write(to: self.storageURL, options: .atomic)

                    AppLogger.shared.info("Old analytics events cleaned up", metadata: [
                        "removedCount": removedCount,
                        "remainingCount": events.count
                    ])
                } catch {
                    AppLogger.shared.error(
                        "Failed to cleanup old analytics events",
                        error: error
                    )
                }
            }
        }
    }

    /// Set up periodic flush timer
    private func setupFlushTimer() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            // Invalidate any existing timer first to prevent leaks
            self.flushTimer?.invalidate()

            self.flushTimer = Timer.scheduledTimer(
                withTimeInterval: 300, // 5 minutes
                repeats: true
            ) { [weak self] timer in
                // Additional safety: invalidate if self is deallocated
                guard let self = self else {
                    timer.invalidate()
                    return
                }
                self.flush()
            }

            // Add to common run loop mode to fire during UI events
            if let timer = self.flushTimer {
                RunLoop.main.add(timer, forMode: .common)
            }
        }
    }

    /// Invalidate the flush timer (call before deallocation)
    private func invalidateFlushTimer() {
        DispatchQueue.main.async { [weak self] in
            self?.flushTimer?.invalidate()
            self?.flushTimer = nil
        }
    }

    private static func testRunIdentifier() -> String {
        let environment = ProcessInfo.processInfo.environment
        if let session = environment["XCTestSessionIdentifier"], !session.isEmpty {
            return session
        }
        return "pid-\(ProcessInfo.processInfo.processIdentifier)"
    }
}

// MARK: - Convenience Extensions

extension AnalyticsManager {

    /// Track app launch
    public func trackAppLaunch(isFirstLaunch: Bool = false) {
        track(.appLaunched(isFirstLaunch: isFirstLaunch))
    }

    /// Track app termination
    public func trackAppTermination() {
        track(.appTerminated(sessionDuration: sessionDuration))
        flush() // Ensure events are saved before app terminates
    }

    /// Get performance summary for recent session
    /// - Parameter duration: Time window to analyze (default: 1 hour)
    /// - Returns: Dictionary with performance metrics
    public func getPerformanceSummary(
        duration: TimeInterval = 3600
    ) -> [String: Any] {
        let since = Date().addingTimeInterval(-duration)
        let events = getEvents(category: .performance, since: since)

        var summary: [String: Any] = [
            "totalEvents": events.count,
            "timeWindow": duration
        ]

        // Calculate averages for different operation types
        var parsingDurations: [TimeInterval] = []
        var claudeDurations: [TimeInterval] = []
        var researchDurations: [TimeInterval] = []

        for event in events {
            // Extract duration from PropertyValue
            var duration: TimeInterval? = nil
            if case .double(let d) = event.properties["duration"] {
                duration = d
            } else if case .int(let i) = event.properties["duration"] {
                duration = TimeInterval(i)
            }

            if let duration = duration {
                switch event.name {
                case "parsing_completed":
                    parsingDurations.append(duration)
                case "claude_request_completed":
                    claudeDurations.append(duration)
                case "web_research_completed":
                    researchDurations.append(duration)
                default:
                    break
                }
            }
        }

        if !parsingDurations.isEmpty {
            summary["avgParsingTime"] = parsingDurations.reduce(0, +) / Double(parsingDurations.count)
        }

        if !claudeDurations.isEmpty {
            summary["avgClaudeTime"] = claudeDurations.reduce(0, +) / Double(claudeDurations.count)
        }

        if !researchDurations.isEmpty {
            summary["avgResearchTime"] = researchDurations.reduce(0, +) / Double(researchDurations.count)
        }

        return summary
    }

    /// Get error summary
    /// - Parameter duration: Time window to analyze (default: 24 hours)
    /// - Returns: Dictionary with error metrics
    public func getErrorSummary(
        duration: TimeInterval = 86400
    ) -> [String: Any] {
        let since = Date().addingTimeInterval(-duration)
        let events = getEvents(category: .error, since: since)

        var summary: [String: Any] = [
            "totalErrors": events.count,
            "timeWindow": duration
        ]

        // Group by error type
        var errorsByType: [String: Int] = [:]
        for event in events {
            // Extract errorType from PropertyValue
            if case .string(let errorType) = event.properties["errorType"] {
                errorsByType[errorType, default: 0] += 1
            }
        }

        summary["errorsByType"] = errorsByType

        return summary
    }
}
