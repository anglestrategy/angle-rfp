//
//  ResearchCache.swift
//  angle-rfp
//
//  30-day caching layer for company research data
//  Reduces redundant API calls and improves performance
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import Foundation
import CryptoKit

/// Cache manager for company research data
///
/// Features:
/// - 30-day TTL (time-to-live)
/// - In-memory cache (NSCache) for fast access
/// - Disk persistence for session continuity
/// - Automatic expiration and cleanup
/// - Thread-safe operations
public final class ResearchCache: @unchecked Sendable {

    // MARK: - Singleton

    public static let shared = ResearchCache()

    // MARK: - Properties

    /// In-memory cache for fast access
    private let memoryCache = NSCache<NSString, CacheEntry>()

    /// Disk cache directory
    private let cacheDirectory: URL

    /// Default TTL: 30 days
    private let defaultTTL: TimeInterval = 30 * 24 * 60 * 60 // 30 days in seconds

    /// Queue for thread-safe operations
    private let queue = DispatchQueue(label: "com.angle-rfp.research-cache", attributes: .concurrent)

    private static let cacheDateFormatterWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let cacheDateFormatterLegacy: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    // MARK: - Initialization

    private init() {
        // Set up cache directory
        let fileManager = FileManager.default
        let cacheURL = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        self.cacheDirectory = cacheURL.appendingPathComponent("CompanyResearch", isDirectory: true)

        // Create directory if needed
        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)

        // Configure memory cache
        memoryCache.countLimit = 100 // Store up to 100 companies in memory
        memoryCache.totalCostLimit = 50 * 1024 * 1024 // 50MB memory limit

        // Clean up expired entries on init
        cleanupExpiredEntries()

        AppLogger.shared.info("ResearchCache initialized with directory: \(cacheDirectory.path)")
    }

    // MARK: - Public API

    /// Get cached research data for company
    ///
    /// - Parameter companyName: Company name (will be normalized)
    /// - Returns: ClientInformation if cached and not expired, nil otherwise
    public func get(companyName: String) -> ClientInformation? {
        let key = normalizeKey(companyName)

        return queue.sync {
            // Check memory cache first
            if let entry = memoryCache.object(forKey: key as NSString) {
                if entry.isExpired {
                    // Remove expired entry
                    memoryCache.removeObject(forKey: key as NSString)
                    removeDiskCache(forKey: key)
                    return nil
                }

                AppLogger.shared.debug("Memory cache hit for: \(companyName)")
                return entry.data
            }

            // Check disk cache
            if let entry = loadDiskCache(forKey: key) {
                if entry.isExpired {
                    removeDiskCache(forKey: key)
                    return nil
                }

                // Restore to memory cache
                memoryCache.setObject(entry, forKey: key as NSString)

                AppLogger.shared.debug("Disk cache hit for: \(companyName)")
                return entry.data
            }

            return nil
        }
    }

    /// Set research data in cache
    ///
    /// - Parameters:
    ///   - data: ClientInformation to cache
    ///   - companyName: Company name (will be normalized)
    ///   - ttl: Time-to-live in seconds (default: 30 days)
    public func set(_ data: ClientInformation, forCompanyName companyName: String, ttl: TimeInterval? = nil) {
        let key = normalizeKey(companyName)
        let expirationTime = ttl ?? defaultTTL

        queue.sync(flags: .barrier) {
            let entry = CacheEntry(data: data, expirationDate: Date().addingTimeInterval(expirationTime))

            memoryCache.setObject(entry, forKey: key as NSString)
            saveDiskCache(entry, forKey: key)

            AppLogger.shared.debug("Cached research for: \(companyName)")
        }
    }

    /// Remove specific company from cache
    ///
    /// - Parameter companyName: Company name to remove
    public func remove(companyName: String) {
        let key = normalizeKey(companyName)

        queue.sync(flags: .barrier) {
            memoryCache.removeObject(forKey: key as NSString)
            removeDiskCache(forKey: key)

            AppLogger.shared.debug("Removed cache for: \(companyName)")
        }
    }

    /// Clear all cached data
    public func clearAll() {
        queue.sync(flags: .barrier) {
            // Clear memory
            memoryCache.removeAllObjects()

            // Clear disk
            let fileManager = FileManager.default
            if let files = try? fileManager.contentsOfDirectory(at: cacheDirectory,
                                                                includingPropertiesForKeys: nil) {
                for file in files {
                    try? fileManager.removeItem(at: file)
                }
            }

            AppLogger.shared.info("Cleared all research cache")
        }
    }

    /// Get cache statistics
    ///
    /// - Returns: Tuple with (totalEntries, memoryEntries, diskEntries, totalSizeBytes)
    public func getStatistics() -> (total: Int, memory: Int, disk: Int, size: Int64) {
        queue.sync {
            let fileManager = FileManager.default

            guard let files = try? fileManager.contentsOfDirectory(at: cacheDirectory,
                                                                   includingPropertiesForKeys: [.fileSizeKey]) else {
                return (0, 0, 0, 0)
            }

            let diskCount = files.count
            var totalSize: Int64 = 0

            for file in files {
                if let attributes = try? fileManager.attributesOfItem(atPath: file.path),
                   let fileSize = attributes[.size] as? Int64 {
                    totalSize += fileSize
                }
            }

            // Memory count is approximate (NSCache doesn't provide exact count)
            // We'll just return disk count as total
            return (diskCount, 0, diskCount, totalSize)
        }
    }

    /// Clean up expired cache entries
    public func cleanupExpiredEntries() {
        queue.sync(flags: .barrier) {
            let fileManager = FileManager.default

            guard let files = try? fileManager.contentsOfDirectory(at: cacheDirectory,
                                                                   includingPropertiesForKeys: nil) else {
                return
            }

            var removedCount = 0

            for file in files {
                if let entry = try? loadEntry(from: file) {
                    if entry.isExpired {
                        try? fileManager.removeItem(at: file)
                        removedCount += 1
                    }
                }
            }

            if removedCount > 0 {
                AppLogger.shared.info("Cleaned up \(removedCount) expired cache entries")
            }
        }
    }

    // MARK: - Private Helpers

    /// Normalize company name for consistent keys
    private func normalizeKey(_ companyName: String) -> String {
        companyName
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: " ", with: "_")
            .replacingOccurrences(of: "/", with: "_")
    }

    /// Load entry from disk
    private func loadDiskCache(forKey key: String) -> CacheEntry? {
        let hashedURL = diskURL(forKey: key)
        if FileManager.default.fileExists(atPath: hashedURL.path) {
            return try? loadEntry(from: hashedURL)
        }

        // Backward compatibility for cache files written before hashed disk keys.
        let legacyURL = legacyDiskURL(forKey: key)
        guard FileManager.default.fileExists(atPath: legacyURL.path) else {
            return nil
        }

        return try? loadEntry(from: legacyURL)
    }

    /// Save entry to disk
    private func saveDiskCache(_ entry: CacheEntry, forKey key: String) {
        let fileURL = diskURL(forKey: key)

        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .custom { date, container in
                var singleValue = container.singleValueContainer()
                let encoded = ResearchCache.cacheDateFormatterWithFractionalSeconds.string(from: date)
                try singleValue.encode(encoded)
            }
            let data = try encoder.encode(entry)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            AppLogger.shared.error("Failed to save cache to disk: \(error)")
        }
    }

    /// Remove entry from disk
    private func removeDiskCache(forKey key: String) {
        try? FileManager.default.removeItem(at: diskURL(forKey: key))
        try? FileManager.default.removeItem(at: legacyDiskURL(forKey: key))
    }

    /// Load entry from file URL
    private func loadEntry(from url: URL) throws -> CacheEntry {
        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            if let withFractional = ResearchCache.cacheDateFormatterWithFractionalSeconds.date(from: dateString) {
                return withFractional
            }

            if let legacy = ResearchCache.cacheDateFormatterLegacy.date(from: dateString) {
                return legacy
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Invalid ISO8601 date: \(dateString)"
            )
        }
        return try decoder.decode(CacheEntry.self, from: data)
    }

    private func diskURL(forKey key: String) -> URL {
        cacheDirectory.appendingPathComponent("\(hashedDiskKey(for: key)).cache")
    }

    private func legacyDiskURL(forKey key: String) -> URL {
        cacheDirectory.appendingPathComponent("\(key).cache")
    }

    private func hashedDiskKey(for key: String) -> String {
        let digest = SHA256.hash(data: Data(key.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - Cache Entry

/// Cache entry with expiration
private final class CacheEntry: NSObject, Codable {
    let data: ClientInformation
    let expirationDate: Date

    var isExpired: Bool {
        Date() > expirationDate
    }

    init(data: ClientInformation, expirationDate: Date) {
        self.data = data
        self.expirationDate = expirationDate
        super.init()
    }

    // MARK: - Codable

    enum CodingKeys: String, CodingKey {
        case data
        case expirationDate
    }

    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        data = try container.decode(ClientInformation.self, forKey: .data)
        expirationDate = try container.decode(Date.self, forKey: .expirationDate)
        super.init()
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(data, forKey: .data)
        try container.encode(expirationDate, forKey: .expirationDate)
    }
}
