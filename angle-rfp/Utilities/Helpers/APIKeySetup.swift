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

    /// Validates (and lightly normalizes) a backend base URL string.
    /// - Adds `https://` when the user enters a bare host.
    /// - Strips `/api` or `/api/...` suffixes if the user pastes an endpoint URL.
    static func validatedBackendBaseURL(from raw: String?) -> URL? {
        guard let raw else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return nil }

        let lower = trimmed.lowercased()
        let withScheme: String
        if lower.hasPrefix("http://") || lower.hasPrefix("https://") {
            withScheme = trimmed
        } else {
            withScheme = "https://\(trimmed)"
        }

        guard let url = URL(string: withScheme) else { return nil }
        guard let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" else { return nil }
        guard let host = url.host, !host.isEmpty else { return nil }

        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return url
        }

        components.query = nil
        components.fragment = nil

        let path = components.path
        if path == "/api" || path == "/api/" {
            components.path = ""
            return components.url ?? url
        }
        if let range = path.range(of: "/api/") {
            components.path = String(path[..<range.lowerBound])
            return components.url ?? url
        }
        if path.hasSuffix("/api") {
            components.path = String(path.dropLast(4))
            if components.path == "/" {
                components.path = ""
            }
            return components.url ?? url
        }

        return url
    }

    static func storeBackendConfiguration(token: String, baseURL: String?) throws {
        let trimmedToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedToken.isEmpty {
            try KeychainManager.shared.setBackendAPIKey(trimmedToken)
            AppLogger.shared.info("Backend API token stored in Keychain")
        }

        // Only update base URL when explicitly provided (including empty string to clear).
        if let baseURL {
            let trimmedURL = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmedURL.isEmpty {
                UserDefaults.standard.removeObject(forKey: ConfigKeys.backendBaseURL)
                AppLogger.shared.info("Backend base URL cleared from user defaults")
            } else {
                let normalized = validatedBackendBaseURL(from: trimmedURL)?.absoluteString ?? trimmedURL
                UserDefaults.standard.set(normalized, forKey: ConfigKeys.backendBaseURL)
                AppLogger.shared.info("Backend base URL stored in user defaults")
            }
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
        guard let token = try? KeychainManager.shared.getBackendAPIKey() else {
            return false
        }
        return !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
