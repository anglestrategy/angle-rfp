//
//  KeychainHelper.swift
//  angle-rfp
//
//  Secure storage for API keys using macOS Keychain
//

import Foundation
import Security

enum KeychainHelper {
    enum KeychainError: LocalizedError {
        case duplicateEntry
        case unknown(OSStatus)
        case itemNotFound
        case invalidData

        var errorDescription: String? {
            switch self {
            case .duplicateEntry:
                return "This API key already exists in the Keychain"
            case .unknown(let status):
                return "Keychain operation failed with status: \(status)"
            case .itemNotFound:
                return "API key not found in Keychain"
            case .invalidData:
                return "Unable to read API key data from Keychain"
            }
        }

        var recoverySuggestion: String? {
            switch self {
            case .duplicateEntry:
                return "The key will be updated with the new value"
            case .itemNotFound:
                return "Please add your API key in Settings"
            default:
                return nil
            }
        }
    }

    // MARK: - API Key Identifiers

    enum APIKey: String {
        case claude = "com.angle.rfp.api.claude"
        case braveSearch = "com.angle.rfp.api.brave"

        var displayName: String {
            switch self {
            case .claude: return "Claude API Key"
            case .braveSearch: return "Brave Search API Key"
            }
        }
    }

    // MARK: - Save API Key

    /// Save an API key to the Keychain
    static func save(_ key: String, for identifier: APIKey) throws {
        // Validate format first
        guard validate(key, for: identifier) else {
            throw KeychainError.invalidData
        }

        guard let data = key.data(using: .utf8) else {
            throw KeychainError.invalidData
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: identifier.rawValue,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlocked
        ]

        let status = SecItemAdd(query as CFDictionary, nil)

        if status == errSecDuplicateItem {
            // Update existing key
            try update(key, for: identifier)
        } else if status != errSecSuccess {
            throw KeychainError.unknown(status)
        }
    }

    // MARK: - Retrieve API Key

    /// Retrieve an API key from the Keychain
    static func retrieve(for identifier: APIKey) throws -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: identifier.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess else {
            if status == errSecItemNotFound {
                throw KeychainError.itemNotFound
            }
            throw KeychainError.unknown(status)
        }

        guard let data = result as? Data,
              let key = String(data: data, encoding: .utf8) else {
            throw KeychainError.invalidData
        }

        return key
    }

    // MARK: - Update API Key

    /// Update an existing API key in the Keychain
    static func update(_ key: String, for identifier: APIKey) throws {
        let data = key.data(using: .utf8)!

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: identifier.rawValue
        ]

        let attributes: [String: Any] = [
            kSecValueData as String: data
        ]

        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)

        guard status == errSecSuccess else {
            throw KeychainError.unknown(status)
        }
    }

    // MARK: - Delete API Key

    /// Delete an API key from the Keychain
    static func delete(for identifier: APIKey) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: identifier.rawValue
        ]

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unknown(status)
        }
    }

    // MARK: - Check if Key Exists

    /// Check if an API key exists in the Keychain
    static func exists(for identifier: APIKey) -> Bool {
        do {
            _ = try retrieve(for: identifier)
            return true
        } catch {
            return false
        }
    }

    // MARK: - Validate API Key Format

    /// Basic validation of API key format
    static func validate(_ key: String, for identifier: APIKey) -> Bool {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)

        switch identifier {
        case .claude:
            // Claude keys start with "sk-ant-"
            return trimmed.hasPrefix("sk-ant-") && trimmed.count > 20
        case .braveSearch:
            // Brave keys are alphanumeric with hyphens/underscores, minimum 20 characters
            return trimmed.count >= 20 && trimmed.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
        }
    }
}
