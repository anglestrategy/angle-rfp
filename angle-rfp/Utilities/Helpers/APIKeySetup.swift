//
//  APIKeySetup.swift
//  angle-rfp
//
//  Utility to help set up API keys on first launch
//

import Foundation

struct APIKeySetup {
    private static var isRunningTests: Bool {
        let environment = ProcessInfo.processInfo.environment
        return environment["XCTestConfigurationFilePath"] != nil ||
               environment["XCTestSessionIdentifier"] != nil
    }

    /// Store both API keys in Keychain
    static func storeAPIKeys(claudeKey: String, braveKey: String) throws {
        // Store Claude API key
        do {
            try KeychainHelper.save(claudeKey, for: .claude)
            AppLogger.shared.info("Claude API key stored in Keychain")
        } catch {
            AppLogger.shared.error("Failed to store Claude API key", error: error)
            throw error
        }

        // Store Brave Search API key
        do {
            try KeychainHelper.save(braveKey, for: .braveSearch)
            AppLogger.shared.info("Brave API key stored in Keychain")
        } catch {
            AppLogger.shared.error("Failed to store Brave API key", error: error)
            throw error
        }
    }

    /// Verify API keys are stored and retrieve them
    static func verifyAPIKeys() -> (claude: String?, brave: String?) {
        if isRunningTests {
            return (nil, nil)
        }

        var claudeKey: String?
        var braveKey: String?

        // Check Claude key
        do {
            claudeKey = try KeychainHelper.retrieve(for: .claude)
            AppLogger.shared.debug("Claude API key found in Keychain")
        } catch {
            AppLogger.shared.debug("Claude API key not found in Keychain")
        }

        // Check Brave key
        do {
            braveKey = try KeychainHelper.retrieve(for: .braveSearch)
            AppLogger.shared.debug("Brave API key found in Keychain")
        } catch {
            AppLogger.shared.debug("Brave API key not found in Keychain")
        }

        return (claudeKey, braveKey)
    }

    /// Check if API keys exist
    static func hasAPIKeys() -> Bool {
        if isRunningTests {
            return false
        }

        let claudeExists = KeychainHelper.exists(for: .claude)
        let braveExists = KeychainHelper.exists(for: .braveSearch)
        return claudeExists && braveExists
    }
}

// MARK: - First-Time Setup Instructions

/*
 FIRST-TIME SETUP:

 To store your API keys, add this code to your app's initialization (e.g., in angle_rfpApp.swift):

 ```swift
 init() {
     if !APIKeySetup.hasAPIKeys() {
         do {
             try APIKeySetup.storeAPIKeys(
                 claudeKey: "<CLAUDE_API_KEY>",
                 braveKey: "<BRAVE_API_KEY>"
             )
         } catch {
             print("Failed to store API keys: \(error)")
         }
     }
 }
 ```

 SECURITY NOTE:
 - NEVER commit API keys to git
 - NEVER hardcode keys in production code
 - Use environment variables or configuration files (not tracked by git)
 - The keys are stored securely in macOS Keychain
 */
