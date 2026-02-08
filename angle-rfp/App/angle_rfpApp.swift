//
//  angle_rfpApp.swift
//  angle-rfp
//
//  Main app entry point
//

import SwiftUI

@main
struct angle_rfpApp: App {
    init() {
        if !isRunningTests {
            configureAPIKeysIfNeeded()
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 600, minHeight: 500)
        }
        .defaultSize(width: 1100, height: 700)
        .commands {
            CommandGroup(after: .newItem) {
                Button("New Analysis") {
                    NotificationCenter.default.post(name: .startNewAnalysisCommand, object: nil)
                }
                .keyboardShortcut("n", modifiers: [.command, .shift])
            }

            CommandGroup(after: .appSettings) {
                Button("Configure API Keys") {
                    NotificationCenter.default.post(name: .openSettingsCommand, object: nil)
                }
                .keyboardShortcut(",", modifiers: [.command, .option])
            }
        }
    }

    private var isRunningTests: Bool {
        let environment = ProcessInfo.processInfo.environment
        return environment["XCTestConfigurationFilePath"] != nil ||
               environment["XCTestSessionIdentifier"] != nil
    }

    /// Configure API keys from environment variables if available.
    /// Keys are never hardcoded in source.
    private func configureAPIKeysIfNeeded() {
        guard !APIKeySetup.hasAPIKeys() else {
            return
        }

        let environment = ProcessInfo.processInfo.environment
        let claudeKey = environment["CLAUDE_API_KEY"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        let braveKey = environment["BRAVE_API_KEY"]?.trimmingCharacters(in: .whitespacesAndNewlines)

        guard
            let claudeKey,
            let braveKey,
            !claudeKey.isEmpty,
            !braveKey.isEmpty
        else {
            AppLogger.shared.warning("API keys are missing. Configure keys in Settings or environment variables.")
            return
        }

        do {
            try APIKeySetup.storeAPIKeys(claudeKey: claudeKey, braveKey: braveKey)
            AppLogger.shared.info("API keys loaded from environment and stored in Keychain")
        } catch {
            AppLogger.shared.error("Failed to store API keys", error: error)
        }
    }
}

extension Notification.Name {
    static let openSettingsCommand = Notification.Name("angle-rfp.openSettingsCommand")
    static let startNewAnalysisCommand = Notification.Name("angle-rfp.startNewAnalysisCommand")
}
