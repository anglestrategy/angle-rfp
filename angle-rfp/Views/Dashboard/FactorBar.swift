//
//  FactorBar.swift
//  angle-rfp
//
//  Horizontal factor score bar for dashboard.
//

import SwiftUI

struct FactorBar: View {
    let label: String
    let value: Int
    let maxValue: Int = 100

    private var fillPercentage: CGFloat {
        CGFloat(value) / CGFloat(maxValue)
    }

    private var barColor: Color {
        switch value {
        case 0..<40: return DesignSystem.Palette.Semantic.error
        case 40..<70: return DesignSystem.Palette.Semantic.warning
        default: return DesignSystem.Palette.Accent.primary
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Text(label)
                .font(.custom("Urbanist", size: 13).weight(.medium))
                .foregroundColor(DesignSystem.Palette.Text.secondary)
                .frame(width: 80, alignment: .leading)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // Track
                    RoundedRectangle(cornerRadius: 3)
                        .fill(DesignSystem.Palette.Background.surface)

                    // Fill
                    RoundedRectangle(cornerRadius: 3)
                        .fill(barColor)
                        .frame(width: geo.size.width * fillPercentage)
                }
            }
            .frame(height: 6)

            Text("\(value)%")
                .font(.custom("IBM Plex Mono", size: 12).weight(.medium))
                .foregroundColor(DesignSystem.Palette.Text.tertiary)
                .frame(width: 40, alignment: .trailing)
        }
    }
}

struct FactorBarGroup: View {
    let factors: [(label: String, value: Int)]

    var body: some View {
        VStack(spacing: 12) {
            ForEach(factors, id: \.label) { factor in
                FactorBar(label: factor.label, value: factor.value)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(DesignSystem.Palette.Background.elevated)
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.white.opacity(0.04), lineWidth: 1)
                )
        )
    }
}

#if DEBUG
struct FactorBar_Previews: PreviewProvider {
    static var previews: some View {
        FactorBarGroup(factors: [
            ("Budget", 85),
            ("Scope", 72),
            ("Client", 78),
            ("Timeline", 68)
        ])
        .frame(width: 300)
        .padding(40)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
