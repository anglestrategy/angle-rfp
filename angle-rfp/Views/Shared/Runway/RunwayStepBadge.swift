//
//  RunwayStepBadge.swift
//  angle-rfp
//
//  Step marker for stacked runway cards.
//

import SwiftUI

struct RunwayStepBadge: View {
    let step: RunwayStep
    let mode: RunwayCardMode

    var body: some View {
        switch mode {
        case .active:
            HStack(spacing: 10) {
                Text(step.code)
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundColor(DesignSystem.Palette.Cream.elevated)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .fill(DesignSystem.Palette.Charcoal.c900)
                    )

                Text(step.title.uppercased())
                    .font(.custom("Urbanist", size: 11).weight(.bold))
                    .tracking(1.6)
                    .foregroundColor(DesignSystem.Palette.Charcoal.c900)
            }

        case .compact:
            VStack(spacing: 10) {
                Text(step.code)
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(DesignSystem.Palette.Cream.elevated)

                Text(step.title.uppercased())
                    .font(.custom("Urbanist", size: 9).weight(.bold))
                    .tracking(1.3)
                    .foregroundColor(DesignSystem.Palette.Cream.elevated.opacity(0.9))
                    .rotationEffect(.degrees(-90))
                    .frame(height: 80)
            }

        case .peek:
            HStack(spacing: 6) {
                Circle()
                    .fill(DesignSystem.Palette.Vermillion.v400)
                    .frame(width: 5, height: 5)
                Text(step.code)
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundColor(DesignSystem.Palette.Cream.elevated.opacity(0.88))
            }
        }
    }
}
