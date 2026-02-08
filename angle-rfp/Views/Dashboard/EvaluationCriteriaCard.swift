//
//  EvaluationCriteriaCard.swift
//  angle-rfp
//
//  Typography-driven evaluation criteria with preserved RFP text.
//  Editorial quote styling with dramatic weight visualizations.
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import SwiftUI

struct EvaluationCriteriaCard: View {
    let criteria: String?

    @State private var animateIn = false
    @State private var isExpanded = false
    @State private var glowPulse = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            headerSection
                .opacity(animateIn ? 1 : 0)

            // Hero title
            heroTitle
                .padding(.top, 24)
                .opacity(animateIn ? 1 : 0)
                .offset(y: animateIn ? 0 : 20)

            // Content
            if let criteria = criteria, !criteria.isEmpty {
                criteriaContent(criteria)
                    .padding(.top, 32)
                    .opacity(animateIn ? 1 : 0)
                    .animation(.easeOut(duration: 0.6).delay(0.2), value: animateIn)
            } else {
                emptyState
                    .padding(.top, 32)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                animateIn = true
            }
            startGlowAnimation()
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack {
            HStack(spacing: 8) {
                Circle()
                    .fill(DesignSystem.accent)
                    .frame(width: 8, height: 8)
                    .scaleEffect(glowPulse ? 1.2 : 1.0)
                    .shadow(color: DesignSystem.accent.opacity(0.5), radius: glowPulse ? 8 : 4, x: 0, y: 0)

                Text("Evaluation Criteria")
                    .font(.custom("Urbanist", size: 12).weight(.semibold))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .textCase(.uppercase)
                    .tracking(3)
            }

            Spacer()

            // Source indicator
            HStack(spacing: 6) {
                Image(systemName: "doc.text")
                    .font(.system(size: 11, weight: .medium))
                Text("From RFP")
                    .font(.custom("Urbanist", size: 11).weight(.semibold))
            }
            .foregroundColor(DesignSystem.Gray.g400)
        }
    }

    // MARK: - Hero Title

    private var heroTitle: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("How Proposals")
                .font(.custom("Urbanist", size: 48).weight(.black))
                .foregroundColor(DesignSystem.textPrimary)
                .tracking(-2)

            HStack(spacing: 12) {
                Rectangle()
                    .fill(DesignSystem.accent)
                    .frame(width: 40, height: 3)

                Text("Will Be Scored")
                    .font(.custom("Urbanist", size: 32).weight(.light))
                    .foregroundColor(DesignSystem.textSecondary)
            }
        }
    }

    // MARK: - Criteria Content

    @ViewBuilder
    private func criteriaContent(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 32) {
            // Quote block
            quoteBlock(text)

            // Key factors if detectable
            if let keyFactors = extractKeyFactors(from: text), !keyFactors.isEmpty {
                weightSection(keyFactors)
            }
        }
    }

    // MARK: - Quote Block

    private func quoteBlock(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 20) {
            // Accent border
            Rectangle()
                .fill(DesignSystem.accent)
                .frame(width: 4)

            VStack(alignment: .leading, spacing: 16) {
                // Opening quote
                Text("\u{201C}")
                    .font(.system(size: 64, weight: .bold))
                    .foregroundColor(DesignSystem.accent.opacity(0.2))
                    .offset(y: -12)

                // Criteria text
                Text(text)
                    .font(.custom("Urbanist", size: 16).weight(.regular))
                    .foregroundColor(DesignSystem.Gray.g600)
                    .lineSpacing(8)
                    .lineLimit(isExpanded ? nil : 8)

                // Expand toggle
                if text.count > 400 {
                    Button(action: { isExpanded.toggle() }) {
                        HStack(spacing: 6) {
                            Text(isExpanded ? "Show Less" : "Read Full Criteria")
                                .font(.custom("Urbanist", size: 13).weight(.semibold))
                            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundColor(DesignSystem.accent)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 8)
                }
            }
        }
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(DesignSystem.Gray.g100.opacity(0.5))
        )
        .animation(.easeInOut(duration: 0.25), value: isExpanded)
    }

    // MARK: - Weight Section

    @ViewBuilder
    private func weightSection(_ factors: [(String, Int)]) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            // Section header
            HStack(spacing: 12) {
                Text("Scoring Weights")
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

            // Weight bars
            VStack(alignment: .leading, spacing: 16) {
                ForEach(factors.sorted(by: { $0.1 > $1.1 }), id: \.0) { factor, weight in
                    WeightBar(factor: factor, weight: weight)
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "star.slash")
                .font(.system(size: 40, weight: .ultraLight))
                .foregroundColor(DesignSystem.Gray.g300)

            Text("No evaluation criteria found")
                .font(.custom("Urbanist", size: 18).weight(.medium))
                .foregroundColor(DesignSystem.textSecondary)

            Text("Scoring criteria were not specified in the RFP")
                .font(.custom("Urbanist", size: 14).weight(.regular))
                .foregroundColor(DesignSystem.Gray.g400)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    // MARK: - Helpers

    private func startGlowAnimation() {
        withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
            glowPulse = true
        }
    }

    private func extractKeyFactors(from text: String) -> [(String, Int)]? {
        let pattern = "(\\w+(?:\\s+\\w+)?)\\s*(?:\\(|:)\\s*(\\d+)\\s*%"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return nil
        }

        let range = NSRange(text.startIndex..., in: text)
        let matches = regex.matches(in: text, options: [], range: range)

        var factors: [(String, Int)] = []

        for match in matches {
            if let factorRange = Range(match.range(at: 1), in: text),
               let weightRange = Range(match.range(at: 2), in: text),
               let weight = Int(text[weightRange]) {
                let factor = String(text[factorRange])
                factors.append((factor, weight))
            }
        }

        return factors.isEmpty ? nil : factors
    }
}

// MARK: - Weight Bar

private struct WeightBar: View {
    let factor: String
    let weight: Int

    @State private var animateBar = false
    @State private var isHovered = false

    private var barColor: Color {
        switch weight {
        case 40...100: return DesignSystem.accent
        case 25..<40: return Color(hex: "#F97316")
        case 15..<25: return DesignSystem.warning
        default: return DesignSystem.Gray.g500
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Label row
            HStack {
                Text(factor)
                    .font(.custom("Urbanist", size: 15).weight(.medium))
                    .foregroundColor(isHovered ? barColor : DesignSystem.textPrimary)

                Spacer()

                Text("\(weight)%")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundColor(barColor)
            }

            // Bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background
                    RoundedRectangle(cornerRadius: 4)
                        .fill(DesignSystem.Gray.g200)
                        .frame(height: 8)

                    // Fill
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                colors: [barColor, barColor.opacity(0.6)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: animateBar ? geometry.size.width * (Double(weight) / 100) : 0, height: 8)
                        .shadow(color: barColor.opacity(0.4), radius: 6, x: 0, y: 0)
                }
            }
            .frame(height: 8)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(isHovered ? DesignSystem.Gray.g100 : Color.clear)
        )
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8).delay(0.3)) {
                animateBar = true
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
struct EvaluationCriteriaCard_Previews: PreviewProvider {
    static var sampleCriteria: String {
        """
        Proposals will be evaluated based on the following criteria:

        1. Technical Approach (40%): Quality and feasibility of the proposed creative strategy.

        2. Team Experience (30%): Relevant experience of the proposed team.

        3. Pricing (30%): Competitiveness and clarity of the pricing proposal.
        """
    }

    static var previews: some View {
        ZStack {
            DesignSystem.background.ignoresSafeArea()

            EvaluationCriteriaCard(criteria: sampleCriteria)
                .padding(60)
        }
        .frame(width: 800, height: 650)
    }
}
#endif
