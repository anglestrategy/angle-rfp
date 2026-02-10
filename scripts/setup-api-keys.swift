#!/usr/bin/env swift

import Foundation
import Security

// Store API keys in macOS Keychain
func storeInKeychain(key: String, value: String) throws {
    let service = "com.angle.rfp"

    // Remove existing item first
    let deleteQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: key
    ]
    SecItemDelete(deleteQuery as CFDictionary)

    // Add new item
    guard let data = value.data(using: .utf8) else {
        throw NSError(domain: "KeychainError", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to encode value"])
    }

    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: key,
        kSecValueData as String: data,
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    ]

    let status = SecItemAdd(query as CFDictionary, nil)

    if status != errSecSuccess {
        throw NSError(domain: "KeychainError", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Failed to store key in keychain: \(status)"])
    }

    print("✅ Stored \(key) successfully")
}

// Main execution
do {
    func requireEnv(_ name: String) throws -> String {
        let value = (ProcessInfo.processInfo.environment[name] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if value.isEmpty {
            throw NSError(
                domain: "EnvError",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Missing required environment variable: \(name)"]
            )
        }
        return value
    }

    let claudeKey = try requireEnv("CLAUDE_API_KEY")
    let braveKey = try requireEnv("BRAVE_SEARCH_API_KEY")

    // Store Claude API key
    try storeInKeychain(key: "com.angle.rfp.claude-api-key", value: claudeKey)

    // Store Brave Search API key
    try storeInKeychain(key: "com.angle.rfp.brave-api-key", value: braveKey)

    print("\n🎉 All API keys stored successfully in macOS Keychain!")
    print("Keys are encrypted and stored securely.")
    print("\nTip: run like this:")
    print("  CLAUDE_API_KEY='...' BRAVE_SEARCH_API_KEY='...' swift scripts/setup-api-keys.swift")

} catch {
    print("❌ Error: \(error.localizedDescription)")
    print("\nExpected env vars:")
    print("  - CLAUDE_API_KEY")
    print("  - BRAVE_SEARCH_API_KEY")
    exit(1)
}
