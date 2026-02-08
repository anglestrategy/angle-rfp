#!/usr/bin/env swift

import Foundation
import Security

print("🔍 Verifying API Key Setup...\n")

func retrieveFromKeychain(key: String) -> String? {
    let service = "com.angle.rfp"

    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: key,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne
    ]

    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)

    if status == errSecSuccess, let data = result as? Data {
        return String(data: data, encoding: .utf8)
    }

    return nil
}

// Verify Claude API key
if let claudeKey = retrieveFromKeychain(key: "com.angle.rfp.claude-api-key") {
    let masked = String(claudeKey.prefix(15)) + "..." + String(claudeKey.suffix(6))
    print("✅ Claude API Key: \(masked)")
    print("   Length: \(claudeKey.count) characters")
    print("   Valid format: \(claudeKey.hasPrefix("sk-ant-") ? "Yes" : "No")")
} else {
    print("❌ Claude API Key: Not found")
}

print()

// Verify Brave Search API key
if let braveKey = retrieveFromKeychain(key: "com.angle.rfp.brave-api-key") {
    let masked = String(braveKey.prefix(6)) + "..." + String(braveKey.suffix(4))
    print("✅ Brave Search API Key: \(masked)")
    print("   Length: \(braveKey.count) characters")
} else {
    print("❌ Brave Search API Key: Not found")
}

print("\n" + String(repeating: "=", count: 50))
print("✅ API Key Setup Verification Complete!")
print(String(repeating: "=", count: 50))
