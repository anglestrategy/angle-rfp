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
        HStack(spacing: 10) {
            ForEach(Array(steps.indices), id: \.self) { index in
                HStack(spacing: 8) {
                    stepDot(index: index)

                    if index == currentStep {
                        Text(steps[index])
                            .font(.custom("Urbanist", size: 15).weight(.semibold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                    }
                }

                if index < steps.count - 1 {
                    connector(after: index)
                }
            }
        }
    }

    @ViewBuilder
    private func stepDot(index: Int) -> some View {
        let isActive = index == currentStep
        let isCompleted = completedSteps.contains(index)

        let stroke: Color = {
            if isActive {
                return DesignSystem.Palette.Accent.primary
            }
            if isCompleted {
                return DesignSystem.Palette.Accent.primary.opacity(0.6)
            }
            return DesignSystem.Palette.Line.soft
        }()

        let contentColor: Color = {
            if isActive {
                return DesignSystem.Palette.Accent.primary
            }
            if isCompleted {
                return DesignSystem.Palette.Accent.primary.opacity(0.85)
            }
            return DesignSystem.Palette.Text.muted
        }()

        ZStack {
            Circle()
                .fill(DesignSystem.Palette.Background.base)
                .overlay(
                    Circle()
                        .stroke(stroke, lineWidth: isActive ? 1.8 : 1.2)
                )
                .frame(width: 18, height: 18)

            if isCompleted {
                Image(systemName: "checkmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(contentColor)
            } else {
                Text("\(index + 1)")
                    .font(.custom("Urbanist", size: 11).weight(.semibold))
                    .foregroundColor(contentColor)
            }
        }
        .accessibilityLabel(accessibilityLabelForStep(index: index))
    }

    private func connector(after index: Int) -> some View {
        let completed = index < currentStep
        return Rectangle()
            .fill(Color.white.opacity(completed ? 0.18 : 0.12))
            .frame(width: 26, height: 1)
            .clipShape(Capsule())
            .accessibilityHidden(true)
    }

    private func accessibilityLabelForStep(index: Int) -> Text {
        let title = steps.indices.contains(index) ? steps[index] : "Step \(index + 1)"
        if index == currentStep {
            return Text("Current step: \(title)")
        }
        if completedSteps.contains(index) {
            return Text("Completed step: \(title)")
        }
        return Text("Upcoming step: \(title)")
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
