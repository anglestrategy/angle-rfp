//
//  StepIndicator.swift
//  angle-rfp
//
//  Horizontal step indicator for scene navigation.
//

import SwiftUI

struct StepIndicator: View {
    let steps: [String]
    let currentStep: Int
    let completedSteps: Set<Int>

    var body: some View {
        HStack(spacing: 8) {
            ForEach(Array(steps.enumerated()), id: \.offset) { index, title in
                stepPill(index: index, title: title)
            }
        }
    }

    @ViewBuilder
    private func stepPill(index: Int, title: String) -> some View {
        let isActive = index == currentStep
        let isCompleted = completedSteps.contains(index)
        let isFuture = index > currentStep

        HStack(spacing: 6) {
            if isCompleted {
                Image(systemName: "checkmark")
                    .font(.system(size: 10, weight: .bold))
            }
            Text(title)
                .font(.custom("Urbanist", size: 12).weight(isActive ? .bold : .medium))
        }
        .foregroundColor(stepTextColor(isActive: isActive, isCompleted: isCompleted, isFuture: isFuture))
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(
            Capsule()
                .fill(stepBackgroundColor(isActive: isActive, isCompleted: isCompleted))
                .overlay(
                    Capsule()
                        .stroke(stepBorderColor(isActive: isActive), lineWidth: 1)
                )
        )
        .shadow(
            color: isActive ? DesignSystem.Palette.Accent.primary.opacity(0.3) : .clear,
            radius: 8,
            y: 2
        )
    }

    private func stepTextColor(isActive: Bool, isCompleted: Bool, isFuture: Bool) -> Color {
        if isActive {
            return .white
        } else if isCompleted {
            return DesignSystem.Palette.Semantic.success
        } else {
            return DesignSystem.Palette.Text.muted
        }
    }

    private func stepBackgroundColor(isActive: Bool, isCompleted: Bool) -> Color {
        if isActive {
            return DesignSystem.Palette.Accent.primary
        } else if isCompleted {
            return DesignSystem.Palette.Semantic.success.opacity(0.15)
        } else {
            return DesignSystem.Palette.Background.surface
        }
    }

    private func stepBorderColor(isActive: Bool) -> Color {
        if isActive {
            return .clear
        } else {
            return Color.white.opacity(0.06)
        }
    }
}

#if DEBUG
struct StepIndicator_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 40) {
            StepIndicator(
                steps: ["Upload", "Parse", "Criteria", "Research", "Score", "Results"],
                currentStep: 0,
                completedSteps: []
            )

            StepIndicator(
                steps: ["Upload", "Parse", "Criteria", "Research", "Score", "Results"],
                currentStep: 3,
                completedSteps: [0, 1, 2]
            )

            StepIndicator(
                steps: ["Upload", "Parse", "Criteria", "Research", "Score", "Results"],
                currentStep: 5,
                completedSteps: [0, 1, 2, 3, 4]
            )
        }
        .padding(40)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
