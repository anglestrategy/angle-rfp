//
//  RunwayCardSurface.swift
//  angle-rfp
//
//  Shared dark surface for stacked step cards.
//

import SwiftUI

enum RunwaySurfaceRole {
    case active
    case compact
    case peek
    case neutral
}

struct RunwayCardSurface<Content: View>: View {
    let role: RunwaySurfaceRole
    var cornerRadius: CGFloat = DesignSystem.Editorial.cardRadius
    var contentPadding: CGFloat = 0
    @ViewBuilder var content: () -> Content

    private var fillColor: Color {
        switch role {
        case .active:
            return DesignSystem.Palette.Charcoal.c800
        case .neutral:
            return DesignSystem.Palette.Charcoal.c700
        case .compact:
            return DesignSystem.Palette.Charcoal.c700
        case .peek:
            return DesignSystem.Palette.Charcoal.c900
        }
    }

    private var railColor: Color {
        switch role {
        case .active, .neutral:
            return DesignSystem.Palette.Vermillion.v500
        case .compact:
            return DesignSystem.Palette.Cream.elevated.opacity(0.38)
        case .peek:
            return DesignSystem.Palette.Cream.elevated.opacity(0.3)
        }
    }

    private var borderColor: Color {
        switch role {
        case .active:
            return DesignSystem.Palette.Cream.elevated.opacity(0.12)
        case .neutral:
            return DesignSystem.Palette.Cream.elevated.opacity(0.1)
        case .compact:
            return DesignSystem.Palette.Cream.elevated.opacity(0.08)
        case .peek:
            return DesignSystem.Palette.Cream.elevated.opacity(0.06)
        }
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(shadowPlate)
                .offset(x: 8, y: 8)

            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(fillColor)
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .stroke(borderColor, lineWidth: 1)
                )
                .overlay(alignment: .top) {
                    Rectangle()
                        .fill(DesignSystem.Palette.Cream.elevated.opacity(0.12))
                        .frame(height: 1)
                }
                .overlay(alignment: .topLeading) {
                    Rectangle()
                        .fill(railColor)
                        .frame(width: role == .active ? 92 : 42, height: 2)
                        .padding(.top, role == .active ? 16 : 12)
                        .padding(.leading, role == .active ? 20 : 12)
                }

            content()
                .padding(contentPadding)
        }
        .shadow(color: Color.black.opacity(role == .active ? 0.34 : 0.2), radius: role == .active ? 22 : 10, x: 0, y: role == .active ? 14 : 6)
    }

    private var shadowPlate: Color {
        switch role {
        case .active:
            return DesignSystem.Palette.Vermillion.v500.opacity(0.1)
        case .neutral:
            return DesignSystem.Palette.Charcoal.c900.opacity(0.16)
        case .compact:
            return DesignSystem.Palette.Charcoal.c900.opacity(0.24)
        case .peek:
            return DesignSystem.Palette.Charcoal.c900.opacity(0.18)
        }
    }
}
