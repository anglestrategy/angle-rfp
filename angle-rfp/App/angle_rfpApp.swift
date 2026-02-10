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
            configureBackendIfNeeded()
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(width: 600, height: 800)
        }
        .windowResizability(.contentSize)
        .commands {
            CommandGroup(after: .newItem) {
                Button("New Analysis") {
                    NotificationCenter.default.post(name: .startNewAnalysisCommand, object: nil)
                }
                .keyboardShortcut("n", modifiers: [.command, .shift])
            }

            CommandGroup(after: .appSettings) {
                Button("Configure Backend") {
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

    /// Configure backend token/base URL from environment variables if available.
    private func configureBackendIfNeeded() {
#if DEBUG
        guard !APIKeySetup.hasBackendConfiguration() else {
            return
        }

        let environment = ProcessInfo.processInfo.environment
        let backendToken = environment["BACKEND_APP_TOKEN"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        let backendBaseURL = environment["BACKEND_BASE_URL"]?.trimmingCharacters(in: .whitespacesAndNewlines)

        guard let backendToken, !backendToken.isEmpty else {
            AppLogger.shared.warning("Backend token missing. Configure backend token in Settings or environment variables.")
            return
        }

        do {
            try APIKeySetup.storeBackendConfiguration(token: backendToken, baseURL: backendBaseURL)
            AppLogger.shared.info("Backend configuration loaded from environment")
        } catch {
            AppLogger.shared.error("Failed to store backend configuration", error: error)
        }
#endif
    }
}

extension Notification.Name {
    static let openSettingsCommand = Notification.Name("angle-rfp.openSettingsCommand")
    static let startNewAnalysisCommand = Notification.Name("angle-rfp.startNewAnalysisCommand")
}
