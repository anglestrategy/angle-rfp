//
//  FinancialPotentialCard.swift
//  angle-rfp
//
//  Cinematic financial score visualization with dramatic typography.
//  No boxes - pure editorial design with glowing data viz.
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import SwiftUI

struct FinancialPotentialCard: View {
    let financialPotential: FinancialPotential?

    @State private var animateIn = false
    @State private var animateScore = false
    @State private var glowPulse = false
    @State private var showAllFactors = false

    private var score: Double {
        financialPotential?.totalScore ?? 0
    }

    private var scoreColor: Color {
        switch score {
        case 0..<40: return DesignSystem.error
        case 40..<66: return DesignSystem.warning
        case 66..<86: return Color(hex: "#F97316")
        default: return DesignSystem.success
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header row
            headerSection
                .opacity(animateIn ? 1 : 0)

            // The star - massive score display
            scoreHero
                .padding(.top, 24)
                .opacity(animateIn ? 1 : 0)
                .offset(y: animateIn ? 0 : 30)

            // Score ring visualization
            scoreVisualization
                .padding(.top, 48)
                .opacity(animateIn ? 1 : 0)
                .animation(.easeOut(duration: 0.6).delay(0.3), value: animateIn)

            // Factors breakdown
            if let factors = financialPotential?.factors, !factors.isEmpty {
                factorsSection(factors)
                    .padding(.top, 48)
                    .opacity(animateIn ? 1 : 0)
                    .animation(.easeOut(duration: 0.6).delay(0.4), value: animateIn)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                animateIn = true
            }
            withAnimation(.easeOut(duration: 1.5).delay(0.5)) {
                animateScore = true
            }
            startGlowAnimation()
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack {
            HStack(spacing: 8) {
                Circle()
                    .fill(scoreColor)
                    .frame(width: 8, height: 8)
                    .scaleEffect(glowPulse ? 1.3 : 1.0)
                    .shadow(color: scoreColor.opacity(0.6), radius: glowPulse ? 10 : 5, x: 0, y: 0)

                Text("Financial Potential")
                    .font(.custom("Urbanist", size: 12).weight(.semibold))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .textCase(.uppercase)
                    .tracking(3)
            }

            Spacer()

            // Level indicator
            Text(financialPotential?.recommendationLevel ?? "Unknown")
                .font(.custom("Urbanist", size: 13).weight(.bold))
                .foregroundColor(scoreColor)
                .tracking(1)
        }
    }

    // MARK: - Score Hero (Massive Typography)

    private var scoreHero: some View {
        HStack(alignment: .lastTextBaseline, spacing: 0) {
            // The score - MASSIVE
            Text("\(Int(animateScore ? score : 0))")
                .font(.system(size: 140, weight: .black, design: .rounded))
                .foregroundColor(DesignSystem.textPrimary)
                .contentTransition(.numericText())
                .shadow(color: scoreColor.opacity(0.3), radius: 60, x: 0, y: 0)

            // Percent and label
            VStack(alignment: .leading, spacing: 4) {
                Text("%")
                    .font(.custom("Urbanist", size: 48).weight(.ultraLight))
                    .foregroundColor(DesignSystem.Gray.g400)

                Text("score")
                    .font(.custom("Urbanist", size: 14).weight(.medium))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .textCase(.uppercase)
                    .tracking(2)
            }
            .offset(y: -20)

            Spacer()

            // Score indicator icon
            ZStack {
                Circle()
                    .fill(scoreColor.opacity(0.15))
                    .frame(width: 80, height: 80)

                Image(systemName: scoreIcon)
                    .font(.system(size: 32, weight: .medium))
                    .foregroundColor(scoreColor)
            }
        }
    }

    private var scoreIcon: String {
        switch score {
        case 0..<40: return "exclamationmark.triangle"
        case 40..<66: return "minus.circle"
        case 66..<86: return "checkmark.circle"
        default: return "star.fill"
        }
    }

    // MARK: - Score Visualization

    private var scoreVisualization: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Progress bar - full width dramatic
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background track
                    RoundedRectangle(cornerRadius: 4)
                        .fill(DesignSystem.Gray.g200)
                        .frame(height: 8)

                    // Score fill with gradient
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                colors: [scoreColor, scoreColor.opacity(0.6)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: animateScore ? geometry.size.width * (score / 100) : 0, height: 8)
                        .shadow(color: scoreColor.opacity(0.5), radius: 10, x: 0, y: 0)

                    // Glowing tip
                    if animateScore {
                        Circle()
                            .fill(scoreColor)
                            .frame(width: 16, height: 16)
                            .shadow(color: scoreColor.opacity(0.8), radius: 8, x: 0, y: 0)
                            .offset(x: geometry.size.width * (score / 100) - 8)
                    }
                }
            }
            .frame(height: 16)

            // Scale markers
            HStack {
                Text("0")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(DesignSystem.Gray.g400)

                Spacer()

                ForEach([25, 50, 75], id: \.self) { mark in
                    Text("\(mark)")
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(DesignSystem.Gray.g300)
                }

                Spacer()

                Text("100")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(DesignSystem.Gray.g400)
            }

            // Recommendation
            if let recommendation = financialPotential?.recommendation {
                Text(recommendation)
                    .font(.custom("Urbanist", size: 16).weight(.regular))
                    .foregroundColor(DesignSystem.Gray.g500)
                    .lineSpacing(6)
                    .padding(.top, 8)
            }
        }
    }

    // MARK: - Factors Section

    @ViewBuilder
    private func factorsSection(_ factors: [ScoringFactor]) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            // Section header
            HStack {
                HStack(spacing: 12) {
                    Text("Score Breakdown")
                        .font(.custom("Urbanist", size: 11).weight(.bold))
                        .foregroundColor(DesignSystem.Gray.g400)
                        .textCase(.uppercase)
                        .tracking(2)

                    Rectangle()
                        .fill(
                            LinearGradient(
                                colors: [DesignSystem.Gray.g200, Color.clear],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(height: 1)
                }

                Spacer()

                // Toggle
                Button(action: { showAllFactors.toggle() }) {
                    HStack(spacing: 4) {
                        Text(showAllFactors ? "Less" : "All")
                            .font(.custom("Urbanist", size: 12).weight(.medium))
                        Image(systemName: showAllFactors ? "chevron.up" : "chevron.down")
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundColor(DesignSystem.accent)
                }
                .buttonStyle(.plain)
            }

            // Factors grid
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 16) {
                ForEach(factors.prefix(showAllFactors ? factors.count : 6)) { factor in
                    FactorMetric(factor: factor, accentColor: scoreColor)
                }
            }
            .animation(.easeInOut(duration: 0.3), value: showAllFactors)
        }
    }

    // MARK: - Helpers

    private func startGlowAnimation() {
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            glowPulse = true
        }
    }
}

// MARK: - Factor Metric

private struct FactorMetric: View {
    let factor: ScoringFactor
    let accentColor: Color

    @State private var isHovered = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Weight percentage
            Text("\(Int(factor.weight * 100))%")
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundColor(isHovered ? accentColor : DesignSystem.textPrimary)

            // Factor name
            Text(factor.name)
                .font(.custom("Urbanist", size: 13).weight(.medium))
                .foregroundColor(DesignSystem.Gray.g500)
                .lineLimit(1)

            // Mini progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(DesignSystem.Gray.g200)
                        .frame(height: 3)

                    RoundedRectangle(cornerRadius: 2)
                        .fill(accentColor.opacity(isHovered ? 1 : 0.6))
                        .frame(width: geometry.size.width * factor.percentage, height: 3)
                }
            }
            .frame(height: 3)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(isHovered ? DesignSystem.Gray.g100 : Color.clear)
        )
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
struct FinancialPotentialCard_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            DesignSystem.background.ignoresSafeArea()

            FinancialPotentialCard(
                financialPotential: FinancialPotential(
                    totalScore: 78,
                    recommendation: "Strong opportunity with good agency alignment and favorable company profile.",
                    factors: [
                        ScoringFactor(name: "Company Size", weight: 0.15, score: 8, maxScore: 10, reasoning: "Large enterprise"),
                        ScoringFactor(name: "Scope Alignment", weight: 0.20, score: 7, maxScore: 10, reasoning: "65% alignment"),
                        ScoringFactor(name: "Brand Popularity", weight: 0.10, score: 9, maxScore: 10, reasoning: "National brand"),
                        ScoringFactor(name: "Social Media", weight: 0.08, score: 6, maxScore: 10, reasoning: "Active presence"),
                        ScoringFactor(name: "Output Types", weight: 0.12, score: 8, maxScore: 10, reasoning: "Video required"),
                        ScoringFactor(name: "Media Spend", weight: 0.10, score: 7, maxScore: 10, reasoning: "High spend")
                    ],
                    formulaExplanation: "Weighted scoring formula"
                )
            )
            .padding(60)
        }
        .frame(width: 900, height: 700)
    }
}
#endif
