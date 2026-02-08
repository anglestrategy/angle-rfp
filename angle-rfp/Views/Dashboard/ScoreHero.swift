//
//  ScoreHero.swift
//  angle-rfp
//
//  Hero score display for dashboard header.
//

import SwiftUI

struct ScoreHero: View {
    let score: Int
    let recommendation: String

    private var scoreColor: Color {
        switch score {
        case 0..<40: return DesignSystem.Palette.Semantic.error
        case 40..<70: return DesignSystem.Palette.Semantic.warning
        default: return DesignSystem.Palette.Semantic.success
        }
    }

    var body: some View {
        VStack(spacing: 8) {
            // Score with glow
            ZStack {
                // Glow background
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                scoreColor.opacity(0.3),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 20,
                            endRadius: 60
                        )
                    )
                    .frame(width: 120, height: 120)

                // Score ring
                Circle()
                    .stroke(
                        DesignSystem.Palette.Background.surface,
                        lineWidth: 6
                    )
                    .frame(width: 80, height: 80)

                Circle()
                    .trim(from: 0, to: CGFloat(score) / 100)
                    .stroke(
                        scoreColor,
                        style: StrokeStyle(lineWidth: 6, lineCap: .round)
                    )
                    .frame(width: 80, height: 80)
                    .rotationEffect(.degrees(-90))

                // Score number
                Text("\(score)")
                    .font(.custom("IBM Plex Mono", size: 32).weight(.bold))
                    .foregroundColor(scoreColor)
            }

            // Recommendation label
            Text(recommendation)
                .font(.custom("Urbanist", size: 13).weight(.semibold))
                .foregroundColor(DesignSystem.Palette.Text.secondary)
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(DesignSystem.Palette.Background.elevated)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(scoreColor.opacity(0.2), lineWidth: 1)
                )
        )
    }
}

#if DEBUG
struct ScoreHero_Previews: PreviewProvider {
    static var previews: some View {
        HStack(spacing: 20) {
            ScoreHero(score: 78, recommendation: "Strong Fit")
            ScoreHero(score: 52, recommendation: "Review Needed")
            ScoreHero(score: 28, recommendation: "Low Potential")
        }
        .padding(40)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
