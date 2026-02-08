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
    // Store Claude API key
    try storeInKeychain(
        key: "com.angle.rfp.claude-api-key",
        value: "sk-ant-api03-REDACTED"
    )

    // Store Brave Search API key
    try storeInKeychain(
        key: "com.angle.rfp.brave-api-key",
        value: "BRAVE_SEARCH_API_KEY_REDACTED"
    )

    print("\n🎉 All API keys stored successfully in macOS Keychain!")
    print("Keys are encrypted and stored securely.")

} catch {
    print("❌ Error: \(error.localizedDescription)")
    exit(1)
}
