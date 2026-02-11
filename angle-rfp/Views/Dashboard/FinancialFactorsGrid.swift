//
//  FinancialFactorsGrid.swift
//  angle-rfp
//
//  Displays all 11 scoring factors with evidence in a beautiful grid layout.
//

import SwiftUI

struct FinancialFactorsGrid: View {
    let factors: [ScoringFactor]

    @State private var expandedFactorId: UUID?

    private let columns = [
        GridItem(.flexible()),
        GridItem(.flexible())
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 16) {
            ForEach(factors) { factor in
                FactorCard(
                    factor: factor,
                    isExpanded: expandedFactorId == factor.id,
                    onTap: {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            if expandedFactorId == factor.id {
                                expandedFactorId = nil
                            } else {
                                expandedFactorId = factor.id
                            }
                        }
                    }
                )
            }
        }
    }
}

// MARK: - Factor Card

private struct FactorCard: View {
    let factor: ScoringFactor
    let isExpanded: Bool
    let onTap: () -> Void

    @State private var isHovered = false

    private var scoreColor: Color {
        switch factor.percentage {
        case 0..<0.4: return DesignSystem.Palette.Semantic.error
        case 0.4..<0.7: return DesignSystem.Palette.Semantic.warning
        default: return DesignSystem.Palette.Semantic.success
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header row
            HStack {
                // Factor name
                Text(factor.name)
                    .font(.custom("Urbanist", size: 13).weight(.semibold))
                    .foregroundColor(DesignSystem.Palette.Text.primary)
                    .lineLimit(1)

                Spacer()

                // Score badge
                Text("\(Int(factor.score))%")
                    .font(.custom("IBM Plex Mono", size: 14).weight(.bold))
                    .foregroundColor(scoreColor)
            }

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // Track
                    RoundedRectangle(cornerRadius: 3)
                        .fill(DesignSystem.Palette.Background.surface)

                    // Fill
                    RoundedRectangle(cornerRadius: 3)
                        .fill(
                            LinearGradient(
                                colors: [scoreColor, scoreColor.opacity(0.7)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geo.size.width * factor.percentage)
                }
            }
            .frame(height: 6)

            // Weight indicator
            HStack(spacing: 4) {
                Text("Weight:")
                    .font(.custom("Urbanist", size: 11))
                    .foregroundColor(DesignSystem.Palette.Text.muted)

                Text("\(Int(factor.weight * 100))%")
                    .font(.custom("IBM Plex Mono", size: 11).weight(.medium))
                    .foregroundColor(DesignSystem.Palette.Text.tertiary)

                Spacer()

                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(DesignSystem.Palette.Text.muted)
            }

            // Evidence (expanded)
            if isExpanded && !factor.reasoning.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Divider()
                        .background(DesignSystem.Palette.Background.surface)

                    Text("Evidence")
                        .font(.custom("Urbanist", size: 10).weight(.bold))
                        .foregroundColor(DesignSystem.Palette.Text.muted)
                        .textCase(.uppercase)
                        .tracking(1)

                    // Split evidence by " | " and display each
                    ForEach(factor.reasoning.components(separatedBy: " | "), id: \.self) { evidence in
                        HStack(alignment: .top, spacing: 8) {
                            Circle()
                                .fill(scoreColor.opacity(0.5))
                                .frame(width: 4, height: 4)
                                .padding(.top, 6)

                            Text(evidence)
                                .font(.custom("Urbanist", size: 12))
                                .foregroundColor(DesignSystem.Palette.Text.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(.top, 4)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(isHovered ? DesignSystem.Palette.Background.surface : DesignSystem.Palette.Background.elevated)
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(
                            isExpanded ? scoreColor.opacity(0.3) : Color.white.opacity(0.04),
                            lineWidth: 1
                        )
                )
        )
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
struct FinancialFactorsGrid_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            DesignSystem.Palette.Background.base.ignoresSafeArea()

            FinancialFactorsGrid(factors: [
                ScoringFactor(
                    name: "Project Scope Magnitude",
                    weight: 0.18,
                    score: 85,
                    maxScore: 100,
                    reasoning: "Deliverables counted: 12 | Timeline estimate: 4.5 months"
                ),
                ScoringFactor(
                    name: "Agency Services Percentage",
                    weight: 0.15,
                    score: 72,
                    maxScore: 100,
                    reasoning: "Agency service percentage: 72%"
                ),
                ScoringFactor(
                    name: "Company/Brand Size",
                    weight: 0.12,
                    score: 90,
                    maxScore: 100,
                    reasoning: "Employee estimate: 15,000"
                ),
                ScoringFactor(
                    name: "Media/Ad Spend Indicators",
                    weight: 0.10,
                    score: 65,
                    maxScore: 100,
                    reasoning: "Budget indicator: medium"
                )
            ])
            .padding(40)
        }
        .frame(width: 800, height: 600)
    }
}
#endif
