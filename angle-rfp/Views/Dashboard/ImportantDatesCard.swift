//
//  ImportantDatesCard.swift
//  angle-rfp
//
//  Cinematic timeline with typography-driven milestones.
//  Urgency indicators with dramatic countdown displays.
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import SwiftUI

struct ImportantDatesCard: View {
    let dates: [ImportantDate]

    @State private var animateIn = false
    @State private var glowPulse = false

    private var sortedDates: [ImportantDate] {
        dates.sorted { $0.date < $1.date }
    }

    private var nextCriticalDate: ImportantDate? {
        sortedDates.first { $0.date > Date() && $0.isCritical }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            headerSection
                .opacity(animateIn ? 1 : 0)

            // Hero countdown if critical date exists
            if let critical = nextCriticalDate {
                countdownHero(for: critical)
                    .padding(.top, 24)
                    .opacity(animateIn ? 1 : 0)
                    .offset(y: animateIn ? 0 : 30)
            }

            // Milestones count
            milestonesHeader
                .padding(.top, nextCriticalDate != nil ? 48 : 24)
                .opacity(animateIn ? 1 : 0)
                .animation(.easeOut(duration: 0.6).delay(0.2), value: animateIn)

            // Timeline
            if sortedDates.isEmpty {
                emptyState
                    .padding(.top, 24)
            } else {
                timelineView
                    .padding(.top, 24)
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
                    .fill(nextCriticalDate != nil ? DesignSystem.error : DesignSystem.accent)
                    .frame(width: 8, height: 8)
                    .scaleEffect(glowPulse && nextCriticalDate != nil ? 1.4 : 1.0)
                    .shadow(
                        color: (nextCriticalDate != nil ? DesignSystem.error : DesignSystem.accent).opacity(0.6),
                        radius: glowPulse ? 10 : 5,
                        x: 0, y: 0
                    )

                Text("Timeline")
                    .font(.custom("Urbanist", size: 12).weight(.semibold))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .textCase(.uppercase)
                    .tracking(3)
            }

            Spacer()

            // Urgent indicator
            if dates.contains(where: { $0.isCritical }) {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 11, weight: .medium))

                    Text("Urgent")
                        .font(.custom("Urbanist", size: 12).weight(.bold))
                }
                .foregroundColor(DesignSystem.error)
            }
        }
    }

    // MARK: - Countdown Hero

    private func countdownHero(for date: ImportantDate) -> some View {
        let daysUntil = Calendar.current.dateComponents([.day], from: Date(), to: date.date).day ?? 0

        return VStack(alignment: .leading, spacing: 16) {
            // Countdown number - MASSIVE
            HStack(alignment: .lastTextBaseline, spacing: 0) {
                Text("\(max(0, daysUntil))")
                    .font(.system(size: 96, weight: .black, design: .rounded))
                    .foregroundColor(daysUntil <= 7 ? DesignSystem.error : DesignSystem.textPrimary)
                    .shadow(
                        color: (daysUntil <= 7 ? DesignSystem.error : DesignSystem.accent).opacity(0.3),
                        radius: 40, x: 0, y: 0
                    )

                VStack(alignment: .leading, spacing: 4) {
                    Text("days")
                        .font(.custom("Urbanist", size: 28).weight(.light))
                        .foregroundColor(DesignSystem.Gray.g400)

                    Text("until deadline")
                        .font(.custom("Urbanist", size: 14).weight(.medium))
                        .foregroundColor(DesignSystem.Gray.g400)
                        .textCase(.uppercase)
                        .tracking(1)
                }
                .padding(.leading, 12)
                .offset(y: -10)
            }

            // What deadline
            HStack(spacing: 12) {
                Rectangle()
                    .fill(daysUntil <= 7 ? DesignSystem.error : DesignSystem.accent)
                    .frame(width: 40, height: 3)

                Text(date.title)
                    .font(.custom("Urbanist", size: 20).weight(.semibold))
                    .foregroundColor(DesignSystem.textSecondary)
            }
        }
    }

    // MARK: - Milestones Header

    private var milestonesHeader: some View {
        HStack(spacing: 12) {
            Text("\(dates.count) Milestone\(dates.count == 1 ? "" : "s")")
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
    }

    // MARK: - Timeline View

    private var timelineView: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(sortedDates.enumerated()), id: \.element.id) { index, date in
                TimelineMilestone(
                    date: date,
                    isFirst: index == 0,
                    isLast: index == sortedDates.count - 1
                )
                .opacity(animateIn ? 1 : 0)
                .offset(x: animateIn ? 0 : -20)
                .animation(
                    .easeOut(duration: 0.4).delay(0.3 + Double(index) * 0.1),
                    value: animateIn
                )
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "calendar.badge.exclamationmark")
                .font(.system(size: 40, weight: .ultraLight))
                .foregroundColor(DesignSystem.Gray.g300)

            Text("No dates extracted")
                .font(.custom("Urbanist", size: 18).weight(.medium))
                .foregroundColor(DesignSystem.textSecondary)

            Text("Important dates were not found in the RFP")
                .font(.custom("Urbanist", size: 14).weight(.regular))
                .foregroundColor(DesignSystem.Gray.g400)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    // MARK: - Helpers

    private func startGlowAnimation() {
        withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true)) {
            glowPulse = true
        }
    }
}

// MARK: - Timeline Milestone

private struct TimelineMilestone: View {
    let date: ImportantDate
    let isFirst: Bool
    let isLast: Bool

    @State private var isHovered = false

    private var daysUntil: Int {
        Calendar.current.dateComponents([.day], from: Date(), to: date.date).day ?? 0
    }

    private var urgencyColor: Color {
        if daysUntil < 0 {
            return DesignSystem.Gray.g400
        } else if daysUntil <= 3 {
            return DesignSystem.error
        } else if daysUntil <= 7 {
            return DesignSystem.warning
        } else if daysUntil <= 14 {
            return Color(hex: "#F97316")
        } else {
            return DesignSystem.success
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 20) {
            // Timeline track
            VStack(spacing: 0) {
                if !isFirst {
                    Rectangle()
                        .fill(DesignSystem.Gray.g200)
                        .frame(width: 2, height: 16)
                } else {
                    Spacer().frame(width: 2, height: 16)
                }

                // Node
                ZStack {
                    if date.isCritical {
                        Circle()
                            .fill(urgencyColor.opacity(0.2))
                            .frame(width: 24, height: 24)
                    }

                    Circle()
                        .fill(date.isCritical ? urgencyColor : DesignSystem.Gray.g300)
                        .frame(width: 12, height: 12)
                }

                if !isLast {
                    Rectangle()
                        .fill(DesignSystem.Gray.g200)
                        .frame(width: 2)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(width: 24)

            // Content
            VStack(alignment: .leading, spacing: 8) {
                // Type and urgency
                HStack(spacing: 8) {
                    Text(date.dateType.rawValue)
                        .font(.custom("Urbanist", size: 11).weight(.bold))
                        .foregroundColor(date.isCritical ? urgencyColor : DesignSystem.Gray.g500)
                        .textCase(.uppercase)
                        .tracking(1)

                    if date.isCritical {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 10))
                            .foregroundColor(urgencyColor)
                    }
                }

                // Title
                Text(date.title)
                    .font(.custom("Urbanist", size: 18).weight(.semibold))
                    .foregroundColor(DesignSystem.textPrimary)

                // Date and countdown
                HStack(spacing: 12) {
                    Text(date.date.formatted(date: .abbreviated, time: .shortened))
                        .font(.system(size: 13, weight: .medium, design: .monospaced))
                        .foregroundColor(DesignSystem.Gray.g500)

                    Text("•")
                        .foregroundColor(DesignSystem.Gray.g300)

                    Text(countdownText)
                        .font(.custom("Urbanist", size: 13).weight(.bold))
                        .foregroundColor(urgencyColor)
                }

                // Description
                if let description = date.description {
                    Text(description)
                        .font(.custom("Urbanist", size: 14).weight(.regular))
                        .foregroundColor(DesignSystem.Gray.g400)
                        .lineSpacing(4)
                        .padding(.top, 4)
                }
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 16)
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

    private var countdownText: String {
        if daysUntil < 0 {
            return "\(abs(daysUntil)) days ago"
        } else if daysUntil == 0 {
            return "Today"
        } else if daysUntil == 1 {
            return "Tomorrow"
        } else {
            return "In \(daysUntil) days"
        }
    }
}

// MARK: - Preview

#if DEBUG
struct ImportantDatesCard_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            DesignSystem.background.ignoresSafeArea()

            ImportantDatesCard(
                dates: [
                    ImportantDate(
                        title: "Questions Due",
                        date: Date().addingTimeInterval(86400 * 5),
                        dateType: .questionsDeadline,
                        isCritical: false,
                        description: "Submit all questions via email"
                    ),
                    ImportantDate(
                        title: "Proposal Submission",
                        date: Date().addingTimeInterval(86400 * 12),
                        dateType: .proposalDeadline,
                        isCritical: true,
                        description: "Submit via procurement portal by 5:00 PM EST"
                    ),
                    ImportantDate(
                        title: "Presentation",
                        date: Date().addingTimeInterval(86400 * 20),
                        dateType: .presentationDate,
                        isCritical: false
                    )
                ]
            )
            .padding(60)
        }
        .frame(width: 700, height: 700)
    }
}
#endif
