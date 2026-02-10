//
//  CacheCoordinator.swift
//  angle-rfp
//
//  Multi-layer caching system with memory and disk tiers
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import Foundation
import CryptoKit

/// Multi-layer cache coordinator with memory and disk tiers
///
/// Provides high-performance caching with automatic eviction, TTL support,
/// and transparent fallback between memory and disk storage.
///
/// Features:
/// - Two-tier caching (memory → disk)
/// - Automatic cache eviction (LRU)
/// - TTL (time-to-live) support
/// - Thread-safe operations
/// - Storage size limits
/// - Performance analytics integration
///
/// Example Usage:
/// ```swift
/// // Store data with 30-day TTL
/// try CacheCoordinator.shared.set(
///     companyData,
///     forKey: "company-apple",
///     ttl: 30 * 86400 // 30 days
/// )
///
/// // Retrieve data (checks memory, then disk)
/// if let data: CompanyData = CacheCoordinator.shared.get("company-apple") {
///     print("Cache hit:", data)
/// }
/// ```
public final class CacheCoordinator {

    // MARK: - Singleton

    /// Shared cache coordinator instance
    public static let shared = CacheCoordinator()

    // MARK: - Cache Entry

    /// Internal cache entry with metadata
    private struct CacheEntry<T: Codable>: Codable {
        let value: T
        let timestamp: Date
        let ttl: TimeInterval?

        var isExpired: Bool {
            guard let ttl = ttl else { return false }
            return Date().timeIntervalSince(timestamp) > ttl
        }

        var age: TimeInterval {
            Date().timeIntervalSince(timestamp)
        }
    }

    // MARK: - Cache Statistics

    /// Cache performance statistics
    public struct CacheStats {
        public var memoryHits: Int = 0
        public var diskHits: Int = 0
        public var misses: Int = 0
        public var evictions: Int = 0

        public var totalHits: Int {
            memoryHits + diskHits
        }

        public var hitRate: Double {
            let total = totalHits + misses
            guard total > 0 else { return 0 }
            return Double(totalHits) / Double(total)
        }
    }

    // MARK: - Properties

    /// Memory cache (fast access)
    private let memoryCache = NSCache<NSString, AnyObject>()

    /// Disk cache directory URL
    private let diskCacheURL: URL

    /// Queue for thread-safe disk operations
    private let diskQueue = DispatchQueue(
        label: "com.angle.rfp.cache.disk",
        qos: .utility
    )
    private let diskQueueKey = DispatchSpecificKey<Void>()

    /// Queue for thread-safe stats
    private let statsQueue = DispatchQueue(
        label: "com.angle.rfp.cache.stats",
        qos: .utility
    )
    private let statsQueueKey = DispatchSpecificKey<Void>()

    /// Cache statistics
    private var stats = CacheStats()

    /// Maximum memory cache count
    private let maxMemoryCount = 100

    /// Maximum disk cache size (100 MB)
    private let maxDiskSize: Int64 = 100 * 1024 * 1024

    // MARK: - Initialization

    private init() {
        // Configure memory cache
        memoryCache.countLimit = maxMemoryCount
        memoryCache.totalCostLimit = 50 * 1024 * 1024 // 50 MB

        // Set up disk cache directory.
        //
        // IMPORTANT: tests can run in parallel across multiple processes. If they share a single
        // on-disk cache directory, they will clobber each other (clearAll/remove/evict) and become flaky.
        let fileManager = FileManager.default
        let environment = ProcessInfo.processInfo.environment
        let isRunningTests = environment["XCTestConfigurationFilePath"] != nil

        let cacheRoot: URL
        if isRunningTests {
            let runID = Self.testRunIdentifier()
            cacheRoot = fileManager.temporaryDirectory
                .appendingPathComponent("com.angle.rfp.tests", isDirectory: true)
                .appendingPathComponent(runID, isDirectory: true)
        } else {
            cacheRoot = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first!
                .appendingPathComponent("com.angle.rfp", isDirectory: true)
        }

        let cacheDir = cacheRoot.appendingPathComponent("Cache", isDirectory: true)

        // Create directory
        try? fileManager.createDirectory(
            at: cacheDir,
            withIntermediateDirectories: true
        )

        self.diskCacheURL = cacheDir
        diskQueue.setSpecific(key: diskQueueKey, value: ())
        statsQueue.setSpecific(key: statsQueueKey, value: ())

        AppLogger.shared.info("CacheCoordinator initialized", metadata: [
            "diskCacheURL": diskCacheURL.path,
            "maxMemoryCount": maxMemoryCount,
            "maxDiskSize": Int(maxDiskSize)
        ])

        // Clean up expired entries on init
        cleanupExpired()

        // Set up periodic cleanup (every hour)
        setupPeriodicCleanup()
    }

    // MARK: - Public API - Storage

    /// Store a value in cache
    /// - Parameters:
    ///   - value: The value to store
    ///   - key: Cache key
    ///   - ttl: Time-to-live in seconds (optional)
    /// - Throws: Error if encoding or disk write fails
    public func set<T: Codable>(
        _ value: T,
        forKey key: String,
        ttl: TimeInterval? = nil
    ) throws {
        let entry = CacheEntry(
            value: value,
            timestamp: Date(),
            ttl: ttl
        )

        // Store in memory cache
        if let wrapped = try? WrappedCodable(entry) {
            memoryCache.setObject(wrapped, forKey: key as NSString)

            AppLogger.shared.debug("Value stored in memory cache", metadata: [
                "key": key,
                "ttl": ttl ?? 0
            ])
        }

        // Store in disk cache
        try performDiskSync {
            let fileURL = diskFileURL(for: key)

            let encoder = makeCacheEncoder()
            let data = try encoder.encode(entry)

            try data.write(to: fileURL, options: .atomic)

            AppLogger.shared.debug("Value stored in disk cache", metadata: [
                "key": key,
                "size": data.count,
                "ttl": ttl ?? 0
            ])

            // Track analytics
            AnalyticsManager.shared.track(.init(
                category: .systemEvent,
                name: "cache_write",
                properties: [
                    "key": .string(key),
                    "size": .int(data.count),
                    "hasTTL": .bool(ttl != nil)
                ],
                sessionID: AnalyticsManager.shared.sessionID
            ))
        }

        // Cleanup if cache is too large
        try evictIfNeeded()
    }

    /// Retrieve a value from cache
    /// - Parameter key: Cache key
    /// - Returns: The cached value, or nil if not found or expired
    public func get<T: Codable>(_ key: String) -> T? {
        // Check memory cache first
        if let wrapped = memoryCache.object(forKey: key as NSString) as? WrappedCodable<CacheEntry<T>> {
            let entry = wrapped.value

            if !entry.isExpired {
                updateStats { $0.memoryHits += 1 }

                AppLogger.shared.debug("Memory cache hit", metadata: [
                    "key": key,
                    "age": entry.age
                ])

                // Track analytics
                AnalyticsManager.shared.track(.init(
                    category: .systemEvent,
                    name: "cache_hit",
                    properties: [
                        "key": .string(key),
                        "tier": .string("memory"),
                        "age": .double(entry.age)
                    ],
                    sessionID: AnalyticsManager.shared.sessionID
                ))

                return entry.value
            } else {
                // Expired, remove from memory
                memoryCache.removeObject(forKey: key as NSString)
            }
        }

        // Check disk cache
        let entry: CacheEntry<T>? = performDiskSync {
            let fileURL = diskFileURL(for: key)

            guard FileManager.default.fileExists(atPath: fileURL.path),
                  let data = try? Data(contentsOf: fileURL) else {
                return nil
            }

            let decoder = makeCacheDecoder()

            guard let entry = try? decoder.decode(CacheEntry<T>.self, from: data) else {
                return nil
            }

            if !entry.isExpired {
                return entry
            } else {
                // Expired, delete file
                try? FileManager.default.removeItem(at: fileURL)
                return nil
            }
        }

        if let entry = entry {
            updateStats { $0.diskHits += 1 }

            AppLogger.shared.debug("Disk cache hit", metadata: [
                "key": key,
                "age": entry.age
            ])

            // Promote to memory cache
            if let wrapped = try? WrappedCodable(entry) {
                memoryCache.setObject(wrapped, forKey: key as NSString)
            }

            // Track analytics
            AnalyticsManager.shared.track(.init(
                category: .systemEvent,
                name: "cache_hit",
                properties: [
                    "key": .string(key),
                    "tier": .string("disk"),
                    "age": .double(entry.age)
                ],
                sessionID: AnalyticsManager.shared.sessionID
            ))

            return entry.value
        }

        // Cache miss
        updateStats { $0.misses += 1 }

        AppLogger.shared.debug("Cache miss", metadata: [
            "key": key
        ])

        return nil
    }

    // MARK: - Public API - Management

    /// Remove a value from cache
    /// - Parameter key: Cache key
    public func remove(_ key: String) {
        // Remove from memory
        memoryCache.removeObject(forKey: key as NSString)

        // Remove from disk
        performDiskSync {
            let fileURL = self.diskFileURL(for: key)
            try? FileManager.default.removeItem(at: fileURL)

            AppLogger.shared.debug("Cache entry removed", metadata: [
                "key": key
            ])
        }
    }

    /// Clear all cached data
    public func clearAll() {
        // Clear memory cache
        memoryCache.removeAllObjects()

        // Clear disk cache
        performDiskSync {
            try? FileManager.default.removeItem(at: self.diskCacheURL)
            try? FileManager.default.createDirectory(
                at: self.diskCacheURL,
                withIntermediateDirectories: true
            )

            AppLogger.shared.info("All cache data cleared")
        }

        // Reset stats
        updateStats { $0 = CacheStats() }
    }

    /// Get current cache statistics
    /// - Returns: Cache performance statistics
    public func getStats() -> CacheStats {
        statsQueue.sync { stats }
    }

    // MARK: - Private Helpers

    /// Get disk file URL for a key
    private func diskFileURL(for key: String) -> URL {
        // Use a deterministic SHA-256 file name to avoid path length and encoding edge cases.
        let inputData = Data(key.utf8)
        let digest = SHA256.hash(data: inputData)
        let hash = digest.map { String(format: "%02x", $0) }.joined()
        return diskCacheURL.appendingPathComponent("\(hash).cache")
    }

    private static func testRunIdentifier() -> String {
        let environment = ProcessInfo.processInfo.environment
        if let session = environment["XCTestSessionIdentifier"], !session.isEmpty {
            return session
        }
        return "pid-\(ProcessInfo.processInfo.processIdentifier)"
    }

    /// Evict old entries if cache is too large
    private func evictIfNeeded() throws {
        try performDiskSync {
            // Get all cache files
            guard let files = try? FileManager.default.contentsOfDirectory(
                at: diskCacheURL,
                includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey],
                options: .skipsHiddenFiles
            ) else {
                return
            }

            // Calculate total size
            var totalSize: Int64 = 0
            var fileInfos: [(url: URL, size: Int64, date: Date)] = []

            for fileURL in files {
                if let resources = try? fileURL.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey]),
                   let size = resources.fileSize,
                   let date = resources.contentModificationDate {
                    totalSize += Int64(size)
                    fileInfos.append((fileURL, Int64(size), date))
                }
            }

            // Check if eviction needed
            guard totalSize > maxDiskSize else { return }

            // Sort by access date (LRU eviction)
            fileInfos.sort { $0.date < $1.date }

            // Evict oldest files until under limit
            var evictedCount = 0
            for fileInfo in fileInfos {
                guard totalSize > maxDiskSize * 80 / 100 else { break } // Target 80% of max

                try? FileManager.default.removeItem(at: fileInfo.url)
                totalSize -= fileInfo.size
                evictedCount += 1
            }

            if evictedCount > 0 {
                updateStats { $0.evictions += evictedCount }

                AppLogger.shared.info("Cache eviction completed", metadata: [
                    "evictedCount": evictedCount,
                    "newSize": Int(totalSize)
                ])
            }
        }
    }

    /// Clean up expired cache entries
    private func cleanupExpired() {
        performDiskSync {
            guard let files = try? FileManager.default.contentsOfDirectory(
                at: self.diskCacheURL,
                includingPropertiesForKeys: nil
            ) else {
                return
            }

            var expiredCount = 0

            for fileURL in files {
                // Try to load and check expiration
                if let data = try? Data(contentsOf: fileURL) {
                    let decoder = JSONDecoder()
                    decoder.dateDecodingStrategy = .iso8601

                    // We don't know the type, so just check the timestamp and TTL fields
                    if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let timestampString = json["timestamp"] as? String,
                       let timestamp = ISO8601DateFormatter().date(from: timestampString),
                       let ttl = json["ttl"] as? TimeInterval {
                        let age = Date().timeIntervalSince(timestamp)
                        if age > ttl {
                            try? FileManager.default.removeItem(at: fileURL)
                            expiredCount += 1
                        }
                    }
                }
            }

            if expiredCount > 0 {
                AppLogger.shared.info("Expired cache entries cleaned up", metadata: [
                    "expiredCount": expiredCount
                ])
            }
        }
    }

    /// Set up periodic cleanup timer
    private func setupPeriodicCleanup() {
        Timer.scheduledTimer(withTimeInterval: 3600, repeats: true) { [weak self] _ in
            self?.cleanupExpired()
        }
    }

    private func makeCacheEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.nonConformingFloatEncodingStrategy = .convertToString(
            positiveInfinity: "Infinity",
            negativeInfinity: "-Infinity",
            nan: "NaN"
        )
        return encoder
    }

    private func makeCacheDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        decoder.nonConformingFloatDecodingStrategy = .convertFromString(
            positiveInfinity: "Infinity",
            negativeInfinity: "-Infinity",
            nan: "NaN"
        )
        return decoder
    }

    private func performDiskSync<T>(_ operation: () throws -> T) rethrows -> T {
        if DispatchQueue.getSpecific(key: diskQueueKey) != nil {
            return try operation()
        }
        return try diskQueue.sync(execute: operation)
    }

    private func updateStats(_ operation: (inout CacheStats) -> Void) {
        if DispatchQueue.getSpecific(key: statsQueueKey) != nil {
            operation(&stats)
            return
        }
        statsQueue.sync {
            operation(&stats)
        }
    }
}

// MARK: - Type-Erased Codable Wrapper

/// Wrapper for storing Codable types in NSCache
private final class WrappedCodable<T: Codable>: NSObject {
    let value: T

    init(_ value: T) throws {
        self.value = value
        super.init()
    }
}
