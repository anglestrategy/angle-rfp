//
//  ScoreHero.swift
//  angle-rfp
//
//  Editorial score display - bold typography, minimal chrome.
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
        VStack(alignment: .trailing, spacing: 8) {
            // Large score number
            Text("\(score)")
                .font(.custom("IBM Plex Mono", size: 56).weight(.light))
                .foregroundColor(scoreColor)

            // Single label based on score
            Text(scoreLabel)
                .font(.custom("Urbanist", size: 13).weight(.medium))
                .foregroundColor(DesignSystem.Palette.Text.muted)
        }
    }

    private var scoreLabel: String {
        switch score {
        case 0..<40: return "Low Potential"
        case 40..<70: return "Review Recommended"
        default: return "Strong Potential"
        }
    }
}

#if DEBUG
struct ScoreHero_Previews: PreviewProvider {
    static var previews: some View {
        VStack(alignment: .trailing, spacing: 40) {
            ScoreHero(score: 78, recommendation: "Strong Fit")
            ScoreHero(score: 52, recommendation: "Review Needed")
            ScoreHero(score: 28, recommendation: "Low Potential")
        }
        .padding(40)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
