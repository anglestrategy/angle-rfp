//
//  TimelineVisualization.swift
//  angle-rfp
//
//  Horizontal timeline for important dates.
//

import SwiftUI

struct TimelineVisualization: View {
    let dates: [ImportantDate]

    private var sortedDates: [ImportantDate] {
        dates.sorted { $0.date < $1.date }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Timeline track
            GeometryReader { geo in
                let nodePositions = calculateNodePositions(width: geo.size.width)

                ZStack(alignment: .leading) {
                    // Track line
                    Rectangle()
                        .fill(DesignSystem.Palette.Background.surface)
                        .frame(height: 2)
                        .padding(.horizontal, 20)

                    // Nodes
                    ForEach(Array(sortedDates.enumerated()), id: \.element.id) { index, date in
                        let position = nodePositions[index]

                        timelineNode(for: date)
                            .position(x: position, y: geo.size.height / 2)
                    }
                }
            }
            .frame(height: 60)

            // Date details
            VStack(spacing: 12) {
                ForEach(sortedDates) { date in
                    dateRow(for: date)
                }
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(DesignSystem.Palette.Background.elevated)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color.white.opacity(0.04), lineWidth: 1)
                )
        )
    }

    private func calculateNodePositions(width: CGFloat) -> [CGFloat] {
        guard !sortedDates.isEmpty else { return [] }

        let padding: CGFloat = 40
        let usableWidth = width - (padding * 2)
        let count = sortedDates.count

        if count == 1 {
            return [width / 2]
        }

        return (0..<count).map { index in
            padding + (usableWidth * CGFloat(index) / CGFloat(count - 1))
        }
    }

    @ViewBuilder
    private func timelineNode(for date: ImportantDate) -> some View {
        VStack(spacing: 6) {
            // Node
            Circle()
                .fill(date.isCritical ? DesignSystem.Palette.Semantic.warning : DesignSystem.Palette.Accent.primary)
                .frame(width: 12, height: 12)
                .overlay(
                    Circle()
                        .stroke(DesignSystem.Palette.Background.elevated, lineWidth: 3)
                )

            // Date label
            Text(date.date.formatted(.dateTime.month(.abbreviated).day()))
                .font(.custom("IBM Plex Mono", size: 10))
                .foregroundColor(DesignSystem.Palette.Text.tertiary)
        }
    }

    @ViewBuilder
    private func dateRow(for date: ImportantDate) -> some View {
        HStack(spacing: 12) {
            // Date
            Text(date.date.formatted(.dateTime.month(.abbreviated).day()))
                .font(.custom("IBM Plex Mono", size: 12).weight(.medium))
                .foregroundColor(DesignSystem.Palette.Accent.primary)
                .frame(width: 50, alignment: .leading)

            // Title
            Text(date.title)
                .font(.custom("Urbanist", size: 14).weight(.medium))
                .foregroundColor(DesignSystem.Palette.Text.primary)

            Spacer()

            // Critical badge
            if date.isCritical {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 10))
                    Text("Critical")
                        .font(.custom("Urbanist", size: 10).weight(.bold))
                }
                .foregroundColor(DesignSystem.Palette.Semantic.warning)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(DesignSystem.Palette.Semantic.warning.opacity(0.15))
                )
            }
        }
    }
}

#if DEBUG
struct TimelineVisualization_Previews: PreviewProvider {
    static var previews: some View {
        TimelineVisualization(dates: [
            ImportantDate(title: "Questions Due", date: Date().addingTimeInterval(86400 * 7), dateType: .questionsDeadline, isCritical: false),
            ImportantDate(title: "Proposal Deadline", date: Date().addingTimeInterval(86400 * 14), dateType: .proposalDeadline, isCritical: true),
            ImportantDate(title: "Award Decision", date: Date().addingTimeInterval(86400 * 30), dateType: .other, isCritical: false)
        ])
        .padding(24)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
