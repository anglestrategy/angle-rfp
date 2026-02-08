//
//  ClientInfoCard.swift
//  angle-rfp
//
//  Typography-driven client display with editorial hierarchy.
//  No boxes - pure editorial design with dramatic reveals.
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import SwiftUI

struct ClientInfoCard: View {
    let clientName: String
    let projectName: String
    let description: String?
    let clientInfo: ClientInformation?

    @State private var animateIn = false
    @State private var glowPulse = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Massive client name - the hero
            clientHero
                .opacity(animateIn ? 1 : 0)
                .offset(y: animateIn ? 0 : 30)

            // Project name with accent
            projectSection
                .padding(.top, 24)
                .opacity(animateIn ? 1 : 0)
                .animation(.easeOut(duration: 0.6).delay(0.2), value: animateIn)

            // Description
            if let description = description, !description.isEmpty {
                descriptionSection(description)
                    .padding(.top, 32)
                    .opacity(animateIn ? 1 : 0)
                    .animation(.easeOut(duration: 0.6).delay(0.3), value: animateIn)
            }

            // Company intel - editorial grid
            if let info = clientInfo {
                companyIntel(info)
                    .padding(.top, 48)
                    .opacity(animateIn ? 1 : 0)
                    .animation(.easeOut(duration: 0.6).delay(0.4), value: animateIn)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                animateIn = true
            }
            startGlowAnimation()
        }
    }

    // MARK: - Client Hero (Massive Typography)

    private var clientHero: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Overline
            HStack(spacing: 8) {
                Circle()
                    .fill(DesignSystem.accent)
                    .frame(width: 8, height: 8)
                    .scaleEffect(glowPulse ? 1.2 : 1.0)
                    .shadow(color: DesignSystem.accent.opacity(0.5), radius: glowPulse ? 8 : 4, x: 0, y: 0)

                Text("Client")
                    .font(.custom("Urbanist", size: 12).weight(.semibold))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .textCase(.uppercase)
                    .tracking(3)

                // Research confidence
                if let confidence = clientInfo?.researchConfidence {
                    Spacer()
                    ConfidenceIndicator(confidence: confidence)
                }
            }

            // Client name - MASSIVE
            Text(clientName)
                .font(.custom("Urbanist", size: 72).weight(.black))
                .foregroundColor(DesignSystem.textPrimary)
                .tracking(-3)
                .lineLimit(2)
                .minimumScaleFactor(0.5)
                .shadow(color: DesignSystem.accent.opacity(0.1), radius: 40, x: 0, y: 0)
        }
    }

    // MARK: - Project Section

    private var projectSection: some View {
        HStack(alignment: .lastTextBaseline, spacing: 16) {
            // Accent line
            Rectangle()
                .fill(DesignSystem.accent)
                .frame(width: 40, height: 3)

            Text(projectName)
                .font(.custom("Urbanist", size: 28).weight(.light))
                .foregroundColor(DesignSystem.textSecondary)
                .tracking(-0.5)
        }
    }

    // MARK: - Description Section

    private func descriptionSection(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // Subtle divider
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [DesignSystem.Gray.g200, Color.clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(width: 120, height: 1)

            Text(text)
                .font(.custom("Urbanist", size: 18).weight(.regular))
                .foregroundColor(DesignSystem.Gray.g500)
                .lineSpacing(8)
                .lineLimit(3)
        }
    }

    // MARK: - Company Intel (Editorial Grid)

    @ViewBuilder
    private func companyIntel(_ info: ClientInformation) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            // Section header
            HStack(spacing: 12) {
                Text("Company Intel")
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

            // Intel grid - dramatic numbers
            HStack(alignment: .top, spacing: 48) {
                IntelMetric(
                    label: "Size",
                    value: info.companySize?.rawValue ?? "—",
                    icon: "building.2"
                )

                IntelMetric(
                    label: "Reach",
                    value: info.brandPopularity?.rawValue ?? "—",
                    icon: "globe"
                )

                IntelMetric(
                    label: "Type",
                    value: info.entityType?.rawValue ?? "—",
                    icon: "briefcase"
                )

                if let industry = info.industry {
                    IntelMetric(
                        label: "Industry",
                        value: industry,
                        icon: "chart.bar"
                    )
                }

                Spacer()
            }
        }
    }

    // MARK: - Helpers

    private func startGlowAnimation() {
        withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
            glowPulse = true
        }
    }
}

// MARK: - Intel Metric

private struct IntelMetric: View {
    let label: String
    let value: String
    let icon: String

    @State private var isHovered = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Icon
            Image(systemName: icon)
                .font(.system(size: 16, weight: .light))
                .foregroundColor(isHovered ? DesignSystem.accent : DesignSystem.Gray.g400)

            // Value - bold
            Text(value)
                .font(.custom("Urbanist", size: 20).weight(.bold))
                .foregroundColor(DesignSystem.textPrimary)

            // Label
            Text(label)
                .font(.custom("Urbanist", size: 11).weight(.medium))
                .foregroundColor(DesignSystem.Gray.g400)
                .textCase(.uppercase)
                .tracking(1)
        }
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - Confidence Indicator

struct ConfidenceIndicator: View {
    let confidence: Double

    private var level: (text: String, color: Color) {
        switch confidence {
        case 0.9...1.0: return ("Verified", DesignSystem.success)
        case 0.7..<0.9: return ("High", Color(hex: "#22C55E"))
        case 0.5..<0.7: return ("Moderate", DesignSystem.warning)
        default: return ("Low", DesignSystem.error)
        }
    }

    var body: some View {
        HStack(spacing: 6) {
            // Animated ring
            ZStack {
                Circle()
                    .stroke(DesignSystem.Gray.g200, lineWidth: 2)
                    .frame(width: 20, height: 20)

                Circle()
                    .trim(from: 0, to: confidence)
                    .stroke(level.color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    .frame(width: 20, height: 20)
                    .rotationEffect(.degrees(-90))
            }

            Text(level.text)
                .font(.custom("Urbanist", size: 11).weight(.semibold))
                .foregroundColor(level.color)
                .tracking(0.5)
        }
    }
}

// MARK: - Legacy Support

struct ConfidenceBadge: View {
    let confidence: Double

    var body: some View {
        ConfidenceIndicator(confidence: confidence)
    }
}

// MARK: - Preview

#if DEBUG
struct ClientInfoCard_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            DesignSystem.background.ignoresSafeArea()

            ClientInfoCard(
                clientName: "Acme Corporation",
                projectName: "Brand Campaign 2024",
                description: "A comprehensive brand refresh including digital and print assets for the Q3 marketing push.",
                clientInfo: ClientInformation(
                    name: "Acme Corporation",
                    companySize: .large,
                    brandPopularity: .national,
                    entityType: .privateCompany,
                    industry: "Technology",
                    researchConfidence: 0.85
                )
            )
            .padding(60)
        }
        .frame(width: 900, height: 500)
    }
}
#endif
