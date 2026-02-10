//
//  APIKeySetup.swift
//  angle-rfp
//
//  Utility to help set up API keys on first launch
//

import Foundation

struct APIKeySetup {
    private enum ConfigKeys {
        static let backendBaseURL = "backend.baseURL"
    }

    private static var isRunningTests: Bool {
        let environment = ProcessInfo.processInfo.environment
        return environment["XCTestConfigurationFilePath"] != nil ||
               environment["XCTestSessionIdentifier"] != nil
    }

    static func storeBackendConfiguration(token: String, baseURL: String?) throws {
        let trimmedToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedToken.isEmpty {
            try KeychainManager.shared.setBackendAPIKey(trimmedToken)
            AppLogger.shared.info("Backend API token stored in Keychain")
        }

        let trimmedURL = baseURL?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !trimmedURL.isEmpty {
            UserDefaults.standard.set(trimmedURL, forKey: ConfigKeys.backendBaseURL)
            AppLogger.shared.info("Backend base URL stored in user defaults")
        }
    }

    static func verifyBackendConfiguration() -> (token: String?, baseURL: String?) {
        if isRunningTests {
            return (nil, UserDefaults.standard.string(forKey: ConfigKeys.backendBaseURL))
        }

        let token = try? KeychainManager.shared.getBackendAPIKey()
        let baseURL = UserDefaults.standard.string(forKey: ConfigKeys.backendBaseURL)
        return (token, baseURL)
    }

    static func hasBackendConfiguration() -> Bool {
        if isRunningTests {
            return false
        }
        return KeychainManager.shared.exists(.backendAPIKey)
    }
}
