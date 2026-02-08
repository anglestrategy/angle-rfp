//
//  ScopeAnalysisCard.swift
//  angle-rfp
//
//  Cinematic scope visualization with massive donut chart.
//  Typography-driven breakdown with dramatic animations.
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import SwiftUI

struct ScopeAnalysisCard: View {
    let scopeOfWork: String?
    let scopeAnalysis: ScopeAnalysis?

    @State private var animateIn = false
    @State private var animateChart = false
    @State private var expandedScope = false
    @State private var glowPulse = false

    private var agencyPercentage: Double {
        scopeAnalysis?.agencyServicePercentage ?? 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            headerSection
                .opacity(animateIn ? 1 : 0)

            // Main content - asymmetric hero layout
            HStack(alignment: .top, spacing: 60) {
                // Left - Massive donut chart
                massiveDonutChart
                    .opacity(animateIn ? 1 : 0)
                    .offset(y: animateIn ? 0 : 30)

                // Right - Services breakdown
                servicesBreakdown
                    .padding(.top, 20)
                    .opacity(animateIn ? 1 : 0)
                    .animation(.easeOut(duration: 0.6).delay(0.3), value: animateIn)
            }
            .padding(.top, 32)

            // Scope of work text
            if let scope = scopeOfWork, !scope.isEmpty {
                scopeSection(scope)
                    .padding(.top, 48)
                    .opacity(animateIn ? 1 : 0)
                    .animation(.easeOut(duration: 0.6).delay(0.4), value: animateIn)
            }

            // Output types
            if let outputTypes = scopeAnalysis?.outputTypes, !outputTypes.isEmpty {
                outputTypesSection(outputTypes)
                    .padding(.top, 32)
                    .opacity(animateIn ? 1 : 0)
                    .animation(.easeOut(duration: 0.6).delay(0.5), value: animateIn)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                animateIn = true
            }
            withAnimation(.easeOut(duration: 1.2).delay(0.4)) {
                animateChart = true
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

                Text("Scope Analysis")
                    .font(.custom("Urbanist", size: 12).weight(.semibold))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .textCase(.uppercase)
                    .tracking(3)
            }

            Spacer()

            // Alignment level
            AlignmentLevel(percentage: agencyPercentage)
        }
    }

    // MARK: - Massive Donut Chart

    private var massiveDonutChart: some View {
        ZStack {
            // Background ring
            Circle()
                .stroke(DesignSystem.Gray.g200, lineWidth: 32)
                .frame(width: 220, height: 220)

            // Agency percentage ring
            Circle()
                .trim(from: 0, to: animateChart ? agencyPercentage : 0)
                .stroke(
                    AngularGradient(
                        gradient: Gradient(colors: [
                            DesignSystem.accent,
                            DesignSystem.accentHover,
                            DesignSystem.accent
                        ]),
                        center: .center,
                        startAngle: .degrees(-90),
                        endAngle: .degrees(270)
                    ),
                    style: StrokeStyle(lineWidth: 32, lineCap: .round)
                )
                .frame(width: 220, height: 220)
                .rotationEffect(.degrees(-90))
                .shadow(color: DesignSystem.accent.opacity(0.4), radius: 20, x: 0, y: 0)

            // Center content
            VStack(spacing: 8) {
                // Massive percentage
                HStack(alignment: .lastTextBaseline, spacing: 0) {
                    Text("\(Int(agencyPercentage * 100))")
                        .font(.system(size: 64, weight: .black, design: .rounded))
                        .foregroundColor(DesignSystem.textPrimary)

                    Text("%")
                        .font(.custom("Urbanist", size: 24).weight(.light))
                        .foregroundColor(DesignSystem.Gray.g400)
                }

                Text("Agency Fit")
                    .font(.custom("Urbanist", size: 12).weight(.semibold))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .textCase(.uppercase)
                    .tracking(2)
            }

            // Legend dots positioned around
            Circle()
                .fill(DesignSystem.accent)
                .frame(width: 12, height: 12)
                .shadow(color: DesignSystem.accent.opacity(0.5), radius: 6, x: 0, y: 0)
                .offset(y: -140)

            Circle()
                .fill(DesignSystem.Gray.g300)
                .frame(width: 12, height: 12)
                .offset(y: 140)
        }
        .frame(width: 280, height: 280)
    }

    // MARK: - Services Breakdown

    private var servicesBreakdown: some View {
        VStack(alignment: .leading, spacing: 32) {
            // Agency services
            ServicesList(
                title: "Agency Services",
                services: scopeAnalysis?.agencyServices ?? [],
                color: DesignSystem.accent,
                icon: "checkmark"
            )

            // Outsourcing required
            ServicesList(
                title: "Outsourcing Required",
                services: scopeAnalysis?.nonAgencyServices ?? [],
                color: DesignSystem.Gray.g400,
                icon: "arrow.right"
            )
        }
    }

    // MARK: - Scope Section

    @ViewBuilder
    private func scopeSection(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header with line
            HStack(spacing: 12) {
                Text("Scope of Work")
                    .font(.custom("Urbanist", size: 11).weight(.bold))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .textCase(.uppercase)
                    .tracking(2)

                // Client terminology badge
                HStack(spacing: 4) {
                    Image(systemName: "quote.opening")
                        .font(.system(size: 8, weight: .bold))
                    Text("Client Terminology")
                        .font(.custom("Urbanist", size: 10).weight(.semibold))
                }
                .foregroundColor(DesignSystem.accent)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(DesignSystem.accent.opacity(0.1))
                )

                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [DesignSystem.Gray.g200, Color.clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(height: 1)

                // Expand toggle
                Button(action: { expandedScope.toggle() }) {
                    HStack(spacing: 4) {
                        Text(expandedScope ? "Less" : "More")
                            .font(.custom("Urbanist", size: 12).weight(.medium))
                        Image(systemName: expandedScope ? "chevron.up" : "chevron.down")
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundColor(DesignSystem.accent)
                }
                .buttonStyle(.plain)
            }

            // Scope text
            Text(text)
                .font(.custom("Urbanist", size: 16).weight(.regular))
                .foregroundColor(DesignSystem.Gray.g600)
                .lineSpacing(8)
                .lineLimit(expandedScope ? nil : 3)
                .animation(.easeInOut(duration: 0.25), value: expandedScope)
        }
    }

    // MARK: - Output Types Section

    @ViewBuilder
    private func outputTypesSection(_ types: [OutputType]) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Output Types")
                .font(.custom("Urbanist", size: 11).weight(.bold))
                .foregroundColor(DesignSystem.Gray.g400)
                .textCase(.uppercase)
                .tracking(2)

            HStack(spacing: 12) {
                ForEach(types, id: \.self) { type in
                    OutputTypeChip(type: type)
                }
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

// MARK: - Services List

private struct ServicesList: View {
    let title: String
    let services: [String]
    let color: Color
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack(spacing: 8) {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)

                Text(title)
                    .font(.custom("Urbanist", size: 12).weight(.bold))
                    .foregroundColor(DesignSystem.Gray.g500)
                    .textCase(.uppercase)
                    .tracking(1)
            }

            // Services
            if services.isEmpty {
                Text("None identified")
                    .font(.custom("Urbanist", size: 14).weight(.regular))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .italic()
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(services.prefix(5), id: \.self) { service in
                        HStack(spacing: 10) {
                            Image(systemName: icon)
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(color)
                                .frame(width: 16)

                            Text(service)
                                .font(.custom("Urbanist", size: 15).weight(.medium))
                                .foregroundColor(DesignSystem.textPrimary)
                        }
                    }

                    if services.count > 5 {
                        Text("+ \(services.count - 5) more")
                            .font(.custom("Urbanist", size: 13).weight(.semibold))
                            .foregroundColor(DesignSystem.accent)
                            .padding(.leading, 26)
                    }
                }
            }
        }
    }
}

// MARK: - Alignment Level

private struct AlignmentLevel: View {
    let percentage: Double

    private var level: (text: String, color: Color) {
        switch percentage {
        case 0.8...1.0: return ("Excellent", DesignSystem.success)
        case 0.6..<0.8: return ("Good", Color(hex: "#22C55E"))
        case 0.4..<0.6: return ("Partial", DesignSystem.warning)
        default: return ("Limited", DesignSystem.error)
        }
    }

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(level.color)
                .frame(width: 6, height: 6)

            Text(level.text)
                .font(.custom("Urbanist", size: 12).weight(.bold))
                .foregroundColor(level.color)
                .tracking(0.5)
        }
    }
}

// MARK: - Output Type Chip

private struct OutputTypeChip: View {
    let type: OutputType

    @State private var isHovered = false

    private var icon: String {
        switch type {
        case .video: return "video.fill"
        case .motionGraphics: return "sparkles"
        case .visuals: return "photo.fill"
        case .content: return "doc.text.fill"
        }
    }

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .medium))

            Text(type.rawValue)
                .font(.custom("Urbanist", size: 13).weight(.semibold))
        }
        .foregroundColor(isHovered ? DesignSystem.accent : DesignSystem.textPrimary)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            Capsule()
                .fill(isHovered ? DesignSystem.accent.opacity(0.1) : DesignSystem.Gray.g100)
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
struct ScopeAnalysisCard_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            DesignSystem.background.ignoresSafeArea()

            ScopeAnalysisCard(
                scopeOfWork: "The agency will develop a comprehensive brand campaign including strategy development, creative concepting, video production for three hero spots, motion graphics for social media, and visual design for print and digital collateral.",
                scopeAnalysis: ScopeAnalysis(
                    agencyServices: ["Brand Strategy", "Creative Direction", "Video Production", "Motion Graphics"],
                    nonAgencyServices: ["Media Buying", "PR Distribution"],
                    agencyServicePercentage: 0.65,
                    outputQuantities: OutputQuantities(videoProduction: 3, motionGraphics: 12, visualDesign: 25, contentOnly: 10),
                    outputTypes: [.video, .motionGraphics, .visuals]
                )
            )
            .padding(60)
        }
        .frame(width: 1000, height: 700)
    }
}
#endif
