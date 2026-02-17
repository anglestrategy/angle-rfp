//
//  TimelineVisualization.swift
//  angle-rfp
//
//  Clean date list without graphical timeline.
//

import SwiftUI

struct TimelineVisualization: View {
    let dates: [ImportantDate]

    private var sortedDates: [ImportantDate] {
        dates.sorted { $0.date < $1.date }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(sortedDates.enumerated()), id: \.element.id) { index, date in
                dateRow(for: date, isLast: index == sortedDates.count - 1)
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(DesignSystem.Palette.Background.elevated)
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.white.opacity(0.04), lineWidth: 1)
                )
        )
    }

    @ViewBuilder
    private func dateRow(for date: ImportantDate, isLast: Bool) -> some View {
        HStack(alignment: .center, spacing: 20) {
            // Date column - fixed width for alignment
            Text(date.date.formatted(.dateTime.month(.abbreviated).day()))
                .font(.custom("IBM Plex Mono", size: 12).weight(.medium))
                .foregroundColor(date.isCritical ? DesignSystem.Palette.Semantic.warning : DesignSystem.Palette.Accent.primary)
                .frame(width: 50, alignment: .leading)

            // Title
            Text(date.title)
                .font(.custom("Urbanist", size: 14))
                .foregroundColor(DesignSystem.Palette.Text.primary)

            Spacer()

            // Critical badge
            if date.isCritical {
                Text("Critical")
                    .font(.custom("IBM Plex Mono", size: 10).weight(.medium))
                    .foregroundColor(DesignSystem.Palette.Semantic.warning)
            }
        }
        .padding(.vertical, 14)
        .overlay(
            Group {
                if !isLast {
                    Rectangle()
                        .fill(Color.white.opacity(0.04))
                        .frame(height: 1)
                }
            },
            alignment: .bottom
        )
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
