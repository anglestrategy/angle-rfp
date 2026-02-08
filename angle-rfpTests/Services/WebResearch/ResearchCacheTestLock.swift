//
//  ResearchCacheTestLock.swift
//  angle-rfpTests
//
//  Serializes tests that mutate ResearchCache.shared to avoid
//  cross-test interference when XCTest runs suites in parallel.
//

import Foundation

enum ResearchCacheTestLock {
    static let lock = NSLock()
}
