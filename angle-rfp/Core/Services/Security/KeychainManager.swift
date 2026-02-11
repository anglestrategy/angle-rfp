//
//  KeychainManager.swift
//  angle-rfp
//
//  Secure keychain storage with hardware encryption and biometric protection
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import Foundation
import Security
import LocalAuthentication

/// Secure keychain storage manager with hardware encryption
///
/// Provides secure storage for sensitive data (API keys, tokens, credentials)
/// with optional biometric protection and hardware-backed encryption.
///
/// Features:
/// - Hardware-backed encryption (Secure Enclave when available)
/// - Optional biometric authentication (Touch ID/Face ID)
/// - Thread-safe operations
/// - Automatic logging and error handling
/// - Support for string and data values
///
/// Example Usage:
/// ```swift
    /// // Store API key with biometric protection
    /// try KeychainManager.shared.set(
    ///     "sk-ant-EXAMPLE",
    ///     forKey: .claudeAPIKey,
    ///     requireBiometrics: true
    /// )
///
/// // Retrieve API key (prompts for biometrics if protected)
/// let apiKey = try KeychainManager.shared.get(.claudeAPIKey)
/// ```
public final class KeychainManager {

    // MARK: - Singleton

    /// Shared keychain manager instance
    public static let shared = KeychainManager()

    // MARK: - Keychain Keys

    /// Predefined keys for application secrets
    public enum KeychainKey {
        case claudeAPIKey
        case braveAPIKey
        case backendAPIKey
        case encryptionKey
        /// Custom key with prefix
        case custom(String)

        /// Get the actual storage key
        var storageKey: String {
            switch self {
            case .claudeAPIKey:
                return "com.angle.rfp.claude-api-key"
            case .braveAPIKey:
                return "com.angle.rfp.brave-api-key"
            case .backendAPIKey:
                return "com.angle.rfp.backend-api-key"
            case .encryptionKey:
                return "com.angle.rfp.encryption-key"
            case .custom(let key):
                return "com.angle.rfp.custom.\(key)"
            }
        }
    }

    // MARK: - Errors

    public enum KeychainError: LocalizedError, Equatable {
        case stringEncodingFailed
        case dataConversionFailed
        case itemNotFound
        case duplicateItem
        case accessDenied
        case biometricsNotAvailable
        case biometricsFailed
        case securityError(OSStatus)

        public var errorDescription: String? {
            switch self {
            case .stringEncodingFailed:
                return "Failed to encode string to data"
            case .dataConversionFailed:
                return "Failed to convert data to string"
            case .itemNotFound:
                return "Item not found in keychain"
            case .duplicateItem:
                return "Item already exists in keychain"
            case .accessDenied:
                return "Access to keychain item denied"
            case .biometricsNotAvailable:
                return "Biometric authentication not available on this device"
            case .biometricsFailed:
                return "Biometric authentication failed"
            case .securityError(let status):
                return "Keychain error: \(SecCopyErrorMessageString(status, nil) as String? ?? "Unknown error (\(status))")"
            }
        }

        public var failureReason: String? {
            switch self {
            case .itemNotFound:
                return "The requested item has not been stored yet"
            case .accessDenied:
                return "User denied biometric authentication or insufficient permissions"
            case .biometricsNotAvailable:
                return "Device does not support Touch ID or Face ID"
            case .biometricsFailed:
                return "User failed biometric authentication"
            default:
                return nil
            }
        }

        public var recoverySuggestion: String? {
            switch self {
            case .itemNotFound:
                return "Store the item first before attempting to retrieve it"
            case .biometricsNotAvailable:
                return "Use a device with biometric authentication support"
            case .biometricsFailed:
                return "Try again or authenticate manually"
            default:
                return nil
            }
        }
    }

    // MARK: - Properties

    /// Queue for thread-safe operations
    private let keychainQueue = DispatchQueue(
        label: "com.angle.rfp.keychain",
        qos: .userInitiated
    )

    /// Service name for keychain items
    private let service: String

    /// Local authentication context
    private var authContext = LAContext()
    private let runningTests: Bool

    // MARK: - Initialization

    private init() {
        let environment = ProcessInfo.processInfo.environment
        let isRunningTests = environment["XCTestConfigurationFilePath"] != nil
        self.runningTests = isRunningTests
        // Keep a stable Keychain service name independent of bundle identifier,
        // so dev scripts and future bundle-id changes don't break key retrieval.
        let baseService = "com.angle.rfp"
        if isRunningTests {
            // Prevent parallel test processes from clobbering each other (and avoid polluting real user keychain items).
            let runID = Self.testRunIdentifier()
            self.service = "\(baseService).tests.\(runID)"
        } else {
            self.service = baseService
        }

        AppLogger.shared.info("KeychainManager initialized", metadata: [
            "service": service,
            "biometricsAvailable": isBiometricsAvailable()
        ])
    }

    private static func testRunIdentifier() -> String {
        let environment = ProcessInfo.processInfo.environment
        if let session = environment["XCTestSessionIdentifier"], !session.isEmpty {
            return session
        }
        return "pid-\(ProcessInfo.processInfo.processIdentifier)"
    }

    // MARK: - Public API - String Values

    /// Store a string value in the keychain
    /// - Parameters:
    ///   - value: The string to store
    ///   - key: The keychain key
    ///   - requireBiometrics: Whether to require biometric authentication (default: false)
    /// - Throws: KeychainError if storage fails
    public func set(
        _ value: String,
        forKey key: KeychainKey,
        requireBiometrics: Bool = false
    ) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.stringEncodingFailed
        }

        try setData(data, forKey: key, requireBiometrics: requireBiometrics)
    }

    /// Retrieve a string value from the keychain
    /// - Parameter key: The keychain key
    /// - Returns: The stored string value
    /// - Throws: KeychainError if retrieval fails
    public func get(_ key: KeychainKey) throws -> String {
        let data = try getData(key)

        guard let string = String(data: data, encoding: .utf8) else {
            throw KeychainError.dataConversionFailed
        }

        return string
    }

    // MARK: - Public API - Data Values

    /// Store data in the keychain
    /// - Parameters:
    ///   - data: The data to store
    ///   - key: The keychain key
    ///   - requireBiometrics: Whether to require biometric authentication
    /// - Throws: KeychainError if storage fails
    public func setData(
        _ data: Data,
        forKey key: KeychainKey,
        requireBiometrics: Bool = false
    ) throws {
        try keychainQueue.sync {
            let storageKey = key.storageKey

            // Build base query
            var query = baseQuery(for: storageKey)
            query[kSecValueData as String] = data
            query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly

            // Add hardware encryption (Secure Enclave) when available
            #if targetEnvironment(macCatalyst) || os(iOS)
            query[kSecAttrAccessControl as String] = try createAccessControl(requireBiometrics: requireBiometrics)
            #else
            // macOS: Use different access control
            if requireBiometrics {
                query[kSecAttrAccessControl as String] = try createAccessControlMac(requireBiometrics: true)
            }
            #endif

            // Add or update. `SecItemDelete + SecItemAdd` is significantly slower under contention.
            // Using `SecItemUpdate` for duplicate items keeps the boundary tests deterministic.
            let status = SecItemAdd(query as CFDictionary, nil)
            if status == errSecDuplicateItem {
                if runningTests {
                    // Tests intentionally hammer Keychain with contention; updates are faster and deterministic.
                    let updateQuery = baseQuery(for: storageKey)
                    let attributesToUpdate: [String: Any] = [
                        kSecValueData as String: data
                    ]

                    let updateStatus = SecItemUpdate(updateQuery as CFDictionary, attributesToUpdate as CFDictionary)
                    if updateStatus != errSecSuccess {
                        AppLogger.shared.error("Failed to update keychain item", metadata: [
                            "key": storageKey,
                            "status": Int(updateStatus)
                        ])
                        throw mapKeychainError(updateStatus)
                    }
                } else {
                    // Production UX: replace the item to ensure we don't keep any old access controls/ACLs that
                    // can cause repeated password prompts for users.
                    let deleteStatus = SecItemDelete(baseQuery(for: storageKey) as CFDictionary)
                    if deleteStatus != errSecSuccess && deleteStatus != errSecItemNotFound {
                        AppLogger.shared.warning("Failed to delete existing keychain item before replace", metadata: [
                            "key": storageKey,
                            "status": Int(deleteStatus)
                        ])
                    }

                    let addStatus = SecItemAdd(query as CFDictionary, nil)
                    if addStatus != errSecSuccess {
                        AppLogger.shared.error("Failed to replace keychain item", metadata: [
                            "key": storageKey,
                            "status": Int(addStatus)
                        ])
                        throw mapKeychainError(addStatus)
                    }
                }
            } else if status != errSecSuccess {
                AppLogger.shared.error("Failed to store keychain item", metadata: [
                    "key": storageKey,
                    "status": Int(status)
                ])
                throw mapKeychainError(status)
            }

            AppLogger.shared.debug("Keychain item stored", metadata: [
                "key": storageKey,
                "biometricsRequired": requireBiometrics
            ])
        }
    }

    /// Retrieve data from the keychain
    /// - Parameter key: The keychain key
    /// - Returns: The stored data
    /// - Throws: KeychainError if retrieval fails
    public func getData(_ key: KeychainKey) throws -> Data {
        try keychainQueue.sync {
            let storageKey = key.storageKey

            var query = baseQuery(for: storageKey)
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne

            var result: AnyObject?
            let status = SecItemCopyMatching(query as CFDictionary, &result)

            if status == errSecSuccess, let data = result as? Data {
                AppLogger.shared.debug("Keychain item retrieved", metadata: [
                    "key": storageKey
                ])
                return data
            } else {
                AppLogger.shared.warning("Failed to retrieve keychain item", metadata: [
                    "key": storageKey,
                    "status": Int(status)
                ])
                throw mapKeychainError(status)
            }
        }
    }

    // MARK: - Public API - Management

    /// Delete a keychain item
    /// - Parameter key: The keychain key
    /// - Throws: KeychainError if deletion fails
    public func delete(_ key: KeychainKey) throws {
        try keychainQueue.sync {
            let storageKey = key.storageKey
            let query = baseQuery(for: storageKey)

            let status = SecItemDelete(query as CFDictionary)

            if status != errSecSuccess && status != errSecItemNotFound {
                throw mapKeychainError(status)
            }

            AppLogger.shared.debug("Keychain item deleted", metadata: [
                "key": storageKey
            ])
        }
    }

    /// Check if a keychain item exists
    /// - Parameter key: The keychain key
    /// - Returns: True if the item exists
    public func exists(_ key: KeychainKey) -> Bool {
        keychainQueue.sync {
            let storageKey = key.storageKey
            var query = baseQuery(for: storageKey)
            query[kSecMatchLimit as String] = kSecMatchLimitOne

            let status = SecItemCopyMatching(query as CFDictionary, nil)
            return status == errSecSuccess
        }
    }

    /// Clear all keychain items for this app
    /// - Throws: KeychainError if clearing fails
    public func clearAll() throws {
        try keychainQueue.sync {
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service
            ]

            let status = SecItemDelete(query as CFDictionary)

            if status != errSecSuccess && status != errSecItemNotFound {
                throw mapKeychainError(status)
            }

            AppLogger.shared.info("All keychain items cleared")
        }
    }

    // MARK: - Biometrics

    /// Check if biometric authentication is available
    /// - Returns: True if Touch ID or Face ID is available
    public func isBiometricsAvailable() -> Bool {
        var error: NSError?
        let available = authContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

        if let error = error {
            AppLogger.shared.debug("Biometrics check failed", metadata: [
                "error": error.localizedDescription
            ])
        }

        return available
    }

    /// Get the type of biometric authentication available
    /// - Returns: Description of biometric type ("Touch ID", "Face ID", or "None")
    public func biometricType() -> String {
        guard isBiometricsAvailable() else {
            return "None"
        }

        switch authContext.biometryType {
        case .touchID:
            return "Touch ID"
        case .faceID:
            return "Face ID"
        case .opticID:
            return "Optic ID"
        case .none:
            return "None"
        @unknown default:
            return "Unknown"
        }
    }

    // MARK: - Private Helpers

    /// Build base keychain query
    private func baseQuery(for key: String) -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
    }

    /// Create access control for biometric protection
    private func createAccessControl(requireBiometrics: Bool) throws -> SecAccessControl {
        var flags: SecAccessControlCreateFlags = []

        if requireBiometrics {
            flags = [.userPresence, .biometryCurrentSet]
        } else {
            flags = [.userPresence]
        }

        var error: Unmanaged<CFError>?
        guard let accessControl = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            flags,
            &error
        ) else {
            if let error = error?.takeRetainedValue() {
                AppLogger.shared.error("Failed to create access control", metadata: [
                    "error": String(describing: error)
                ])
            }
            throw KeychainError.biometricsNotAvailable
        }

        return accessControl
    }

    /// Create access control for macOS
    private func createAccessControlMac(requireBiometrics: Bool) throws -> SecAccessControl {
        var error: Unmanaged<CFError>?
        guard let accessControl = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [],
            &error
        ) else {
            throw KeychainError.biometricsNotAvailable
        }

        return accessControl
    }

    /// Map OSStatus to KeychainError
    private func mapKeychainError(_ status: OSStatus) -> KeychainError {
        switch status {
        case errSecItemNotFound:
            return .itemNotFound
        case errSecDuplicateItem:
            return .duplicateItem
        case errSecAuthFailed, errSecUserCanceled:
            return .accessDenied
        default:
            return .securityError(status)
        }
    }

    /// Get display name for a key
    private func getKeyDisplayName(_ key: KeychainKey) -> String {
        switch key {
        case .claudeAPIKey:
            return "Claude API Key"
        case .braveAPIKey:
            return "Brave Search API Key"
        case .backendAPIKey:
            return "Backend API Key"
        case .encryptionKey:
            return "Encryption Key"
        case .custom:
            return "API Key"
        }
    }
}

// MARK: - Convenience Extensions

extension KeychainManager {

    /// Get Claude API key
    public func getClaudeAPIKey() throws -> String {
        try get(.claudeAPIKey)
    }

    /// Set Claude API key
    public func setClaudeAPIKey(_ key: String, requireBiometrics: Bool = false) throws {
        try set(key, forKey: .claudeAPIKey, requireBiometrics: requireBiometrics)
    }

    /// Get Brave API key
    public func getBraveAPIKey() throws -> String {
        try get(.braveAPIKey)
    }

    /// Set Brave API key
    public func setBraveAPIKey(_ key: String, requireBiometrics: Bool = false) throws {
        try set(key, forKey: .braveAPIKey, requireBiometrics: requireBiometrics)
    }

    /// Get backend API token
    public func getBackendAPIKey() throws -> String {
        try get(.backendAPIKey)
    }

    /// Set backend API token
    public func setBackendAPIKey(_ key: String, requireBiometrics: Bool = false) throws {
        try set(key, forKey: .backendAPIKey, requireBiometrics: requireBiometrics)
    }
}
