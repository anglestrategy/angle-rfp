//
//  AppHeader.swift
//  angle-rfp
//
//  Top navigation bar with step indicator and settings.
//

import SwiftUI

struct AppHeader: View {
    let currentStep: Int
    let completedSteps: Set<Int>
    let apiKeysConfigured: Bool
    let onSettingsTap: () -> Void

    private let stepTitles = ["Upload", "Parse", "Criteria", "Research", "Score", "Results"]

    var body: some View {
        HStack(spacing: 16) {
            // Logo
            Text("Angle")
                .font(.custom("Urbanist", size: 22).weight(.bold))
                .foregroundColor(.white)

            Spacer()

            // Step indicator
            StepIndicator(
                steps: stepTitles,
                currentStep: currentStep,
                completedSteps: completedSteps
            )

            Spacer()

            // Status + Settings
            HStack(spacing: 12) {
                if !apiKeysConfigured {
                    apiWarningBadge
                }

                settingsButton
            }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 16)
        .background(
            Rectangle()
                .fill(DesignSystem.Palette.Background.base)
                .overlay(
                    Rectangle()
                        .fill(Color.white.opacity(0.04))
                        .frame(height: 1),
                    alignment: .bottom
                )
        )
    }

    private var apiWarningBadge: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(DesignSystem.Palette.Semantic.warning)
                .frame(width: 6, height: 6)
            Text("Configure Backend")
                .font(.custom("Urbanist", size: 11).weight(.semibold))
                .foregroundColor(DesignSystem.Palette.Semantic.warning)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(DesignSystem.Palette.Semantic.warning.opacity(0.12))
        )
    }

    private var settingsButton: some View {
        Button(action: onSettingsTap) {
            Image(systemName: "gearshape")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(DesignSystem.Palette.Text.secondary)
                .frame(width: 36, height: 36)
                .background(
                    Circle()
                        .fill(DesignSystem.Palette.Background.surface)
                        .overlay(
                            Circle()
                                .stroke(Color.white.opacity(0.06), lineWidth: 1)
                        )
                )
        }
        .buttonStyle(.plain)
    }
}

#if DEBUG
struct AppHeader_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 0) {
            AppHeader(
                currentStep: 0,
                completedSteps: [],
                apiKeysConfigured: false,
                onSettingsTap: {}
            )

            AppHeader(
                currentStep: 3,
                completedSteps: [0, 1, 2],
                apiKeysConfigured: true,
                onSettingsTap: {}
            )

            Spacer()
        }
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
