//
//  RunwayCardContainer.swift
//  angle-rfp
//
//  Shared card frame and header for runway modes.
//

import SwiftUI

struct RunwayCardContainer<Content: View>: View {
    let step: RunwayStep
    let mode: RunwayCardMode
    @ViewBuilder var content: () -> Content

    private var radius: CGFloat {
        mode == .active ? DesignSystem.Editorial.cardRadius : DesignSystem.Editorial.compactCardRadius
    }

    private var surfaceRole: RunwaySurfaceRole {
        switch mode {
        case .active: return .active
        case .compact: return .compact
        case .peek: return .peek
        }
    }

    private var dividerColor: Color {
        switch mode {
        case .active:
            return DesignSystem.Palette.Charcoal.c900.opacity(0.18)
        case .compact:
            return DesignSystem.Palette.Cream.elevated.opacity(0.22)
        case .peek:
            return DesignSystem.Palette.Cream.elevated.opacity(0.1)
        }
    }

    var body: some View {
        RunwayCardSurface(role: surfaceRole, cornerRadius: radius, contentPadding: 0) {
            VStack(spacing: 0) {
                switch mode {
                case .active:
                    activeHeader
                case .compact:
                    compactHeader
                case .peek:
                    peekHeader
                }

                Rectangle()
                    .fill(dividerColor)
                    .frame(height: 1)

                content()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }

    private var activeHeader: some View {
        HStack(spacing: 12) {
            RunwayStepBadge(step: step, mode: .active)

            Spacer(minLength: 8)

            Text(step.subtitle.uppercased())
                .font(.custom("Urbanist", size: 10).weight(.bold))
                .tracking(1.4)
                .foregroundColor(DesignSystem.Palette.Charcoal.c700)
                .lineLimit(1)
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .padding(.bottom, 12)
    }

    private var compactHeader: some View {
        HStack {
            RunwayStepBadge(step: step, mode: .compact)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
    }

    private var peekHeader: some View {
        HStack {
            Spacer(minLength: 0)
            RunwayStepBadge(step: step, mode: .peek)
            Spacer(minLength: 0)
        }
        .padding(.vertical, 10)
    }
}
