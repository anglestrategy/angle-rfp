//
//  DeliverablesCard.swift
//  angle-rfp
//
//  Typography-driven deliverables checklist with progress tracking.
//  Interactive items with dramatic completion animations.
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import SwiftUI

struct DeliverablesCard: View {
    let deliverables: [String]

    @State private var animateIn = false
    @State private var checkedItems: Set<String> = []
    @State private var glowPulse = false

    private var completionPercentage: Double {
        guard !deliverables.isEmpty else { return 0 }
        return Double(checkedItems.count) / Double(deliverables.count)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            headerSection
                .opacity(animateIn ? 1 : 0)

            // Hero stats
            statsHero
                .padding(.top, 24)
                .opacity(animateIn ? 1 : 0)
                .offset(y: animateIn ? 0 : 30)

            // Progress bar
            progressSection
                .padding(.top, 32)
                .opacity(animateIn ? 1 : 0)
                .animation(.easeOut(duration: 0.6).delay(0.2), value: animateIn)

            // Deliverables list
            if deliverables.isEmpty {
                emptyState
                    .padding(.top, 32)
            } else {
                deliverablesList
                    .padding(.top, 32)
                    .opacity(animateIn ? 1 : 0)
                    .animation(.easeOut(duration: 0.6).delay(0.3), value: animateIn)
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

                Text("Deliverables")
                    .font(.custom("Urbanist", size: 12).weight(.semibold))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .textCase(.uppercase)
                    .tracking(3)
            }

            Spacer()

            // Progress indicator
            HStack(spacing: 6) {
                Text("\(checkedItems.count)/\(deliverables.count)")
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundColor(completionPercentage == 1 ? DesignSystem.success : DesignSystem.textPrimary)

                if completionPercentage == 1 {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(DesignSystem.success)
                }
            }
        }
    }

    // MARK: - Stats Hero

    private var statsHero: some View {
        HStack(alignment: .lastTextBaseline, spacing: 0) {
            // Count - MASSIVE
            Text("\(deliverables.count)")
                .font(.system(size: 96, weight: .black, design: .rounded))
                .foregroundColor(DesignSystem.textPrimary)
                .shadow(color: DesignSystem.accent.opacity(0.15), radius: 40, x: 0, y: 0)

            VStack(alignment: .leading, spacing: 4) {
                Text("required")
                    .font(.custom("Urbanist", size: 28).weight(.light))
                    .foregroundColor(DesignSystem.Gray.g400)

                Text("items")
                    .font(.custom("Urbanist", size: 14).weight(.medium))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .textCase(.uppercase)
                    .tracking(1)
            }
            .padding(.leading, 12)
            .offset(y: -10)

            Spacer()
        }
    }

    // MARK: - Progress Section

    private var progressSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background
                    RoundedRectangle(cornerRadius: 4)
                        .fill(DesignSystem.Gray.g200)
                        .frame(height: 6)

                    // Fill
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                colors: [DesignSystem.success, DesignSystem.success.opacity(0.6)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geometry.size.width * completionPercentage, height: 6)
                        .animation(.easeInOut(duration: 0.3), value: completionPercentage)
                }
            }
            .frame(height: 6)

            // Label
            Text("Track your progress by checking items as you prepare them")
                .font(.custom("Urbanist", size: 13).weight(.regular))
                .foregroundColor(DesignSystem.Gray.g400)
        }
    }

    // MARK: - Deliverables List

    private var deliverablesList: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Section header
            HStack(spacing: 12) {
                Text("Checklist")
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
            .padding(.bottom, 16)

            // Items
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(deliverables.enumerated()), id: \.offset) { index, deliverable in
                    DeliverableRow(
                        text: deliverable,
                        number: index + 1,
                        isChecked: checkedItems.contains(deliverable),
                        onToggle: {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                if checkedItems.contains(deliverable) {
                                    checkedItems.remove(deliverable)
                                } else {
                                    checkedItems.insert(deliverable)
                                }
                            }
                        }
                    )
                    .opacity(animateIn ? 1 : 0)
                    .offset(x: animateIn ? 0 : -20)
                    .animation(
                        .easeOut(duration: 0.4).delay(0.3 + Double(index) * 0.05),
                        value: animateIn
                    )
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.badge.ellipsis")
                .font(.system(size: 40, weight: .ultraLight))
                .foregroundColor(DesignSystem.Gray.g300)

            Text("No deliverables specified")
                .font(.custom("Urbanist", size: 18).weight(.medium))
                .foregroundColor(DesignSystem.textSecondary)

            Text("Required submission items were not found")
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
}

// MARK: - Deliverable Row

private struct DeliverableRow: View {
    let text: String
    let number: Int
    let isChecked: Bool
    let onToggle: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: onToggle) {
            HStack(alignment: .top, spacing: 16) {
                // Number/Check
                ZStack {
                    if isChecked {
                        Circle()
                            .fill(DesignSystem.success)
                            .frame(width: 28, height: 28)

                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                    } else {
                        Circle()
                            .stroke(isHovered ? DesignSystem.accent : DesignSystem.Gray.g300, lineWidth: 2)
                            .frame(width: 28, height: 28)

                        Text("\(number)")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(isHovered ? DesignSystem.accent : DesignSystem.Gray.g400)
                    }
                }

                // Text
                Text(text)
                    .font(.custom("Urbanist", size: 15).weight(isChecked ? .regular : .medium))
                    .foregroundColor(isChecked ? DesignSystem.Gray.g400 : DesignSystem.textPrimary)
                    .strikethrough(isChecked, color: DesignSystem.Gray.g400)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 12)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(isHovered ? DesignSystem.Gray.g100 : Color.clear)
            )
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
struct DeliverablesCard_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            DesignSystem.background.ignoresSafeArea()

            DeliverablesCard(
                deliverables: [
                    "Technical Proposal (max 20 pages)",
                    "Creative Portfolio with relevant samples",
                    "Team biographies and org chart",
                    "Pricing proposal in separate envelope",
                    "Proof of insurance",
                    "Three client references"
                ]
            )
            .padding(60)
        }
        .frame(width: 600, height: 750)
    }
}
#endif
