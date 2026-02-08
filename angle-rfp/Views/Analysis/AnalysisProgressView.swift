//
//  AnalysisProgressView.swift
//  angle-rfp
//
//  Active analysis stage surface.
//

import SwiftUI

enum AnalysisStage: Int, CaseIterable {
    case parsing = 0
    case analyzing = 1
    case researching = 2
    case calculating = 3
    case complete = 4

    var title: String {
        switch self {
        case .parsing: return "Parsing Inputs"
        case .analyzing: return "Criteria Mapping"
        case .researching: return "Context Research"
        case .calculating: return "Score Modeling"
        case .complete: return "Synthesis"
        }
    }

    var shortLabel: String {
        switch self {
        case .parsing: return "Parse"
        case .analyzing: return "Criteria"
        case .researching: return "Research"
        case .calculating: return "Score"
        case .complete: return "Synthesize"
        }
    }

    var narrative: String {
        switch self {
        case .parsing:
            return "Reading structure and extraction boundaries."
        case .analyzing:
            return "Linking requirements to scoring criteria."
        case .researching:
            return "Enriching with company and market context."
        case .calculating:
            return "Computing weighted opportunity signal."
        case .complete:
            return "Preparing final recommendation surface."
        }
    }
}

struct AnalysisProgressView: View {
    @Binding var currentStage: AnalysisStage
    @Binding var progress: Double
    @Binding var parsingWarnings: [String]
    let documentName: String
    let onCancel: () -> Void

    @Environment(\.motionPreference) private var motionPreference

    private var progressPercent: Int {
        Int((max(0, min(progress, 1)) * 100).rounded())
    }

    var body: some View {
        GeometryReader { proxy in
            let edge = DesignSystem.Editorial.edgePadding(for: proxy.size.width)
            let spacing = DesignSystem.Editorial.stackSpacing(for: proxy.size.width)
            let compact = proxy.size.width < 1080

            VStack(alignment: .leading, spacing: spacing) {
                headerBand

                if compact {
                    VStack(alignment: .leading, spacing: spacing) {
                        signalPanel
                        stageLadder
                    }
                } else {
                    HStack(alignment: .top, spacing: spacing) {
                        signalPanel
                        stageLadder
                            .frame(width: min(340, proxy.size.width * 0.3))
                    }
                }

                if !parsingWarnings.isEmpty {
                    warningStrip
                }

                footerBand
            }
            .padding(.horizontal, edge)
            .padding(.vertical, max(14, edge - 2))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    private var headerBand: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(currentStage.shortLabel.uppercased())
                .font(.custom("Urbanist", size: 10).weight(.bold))
                .tracking(1.7)
                .foregroundColor(DesignSystem.Palette.Vermillion.v500)

            Rectangle()
                .fill(DesignSystem.Palette.Vermillion.v500)
                .frame(width: 44, height: 2)
                .offset(y: -3)

            Text(currentStage.title)
                .font(.custom("Urbanist", size: 50).weight(.bold))
                .foregroundColor(DesignSystem.Palette.Charcoal.c900)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Spacer(minLength: 8)

            Text("\(progressPercent)%")
                .font(.system(size: 42, weight: .bold, design: .monospaced))
                .foregroundColor(DesignSystem.Palette.Charcoal.c900)
                .contentTransition(.numericText())
                .animation(motionPreference.standardAnimation, value: progressPercent)
        }
    }

    private var signalPanel: some View {
        HStack(alignment: .top, spacing: 20) {
            progressRing

            VStack(alignment: .leading, spacing: 14) {
                Text("LIVE SIGNAL")
                    .font(.custom("Urbanist", size: 10).weight(.bold))
                    .tracking(1.6)
                    .foregroundColor(DesignSystem.Palette.Cream.elevated.opacity(0.75))

                Text(currentStage.narrative)
                    .font(.custom("Urbanist", size: 24).weight(.medium))
                    .foregroundColor(DesignSystem.Palette.Cream.elevated)
                    .lineSpacing(5)

                Rectangle()
                    .fill(DesignSystem.Palette.Cream.elevated.opacity(0.2))
                    .frame(height: 1)

                Text(documentName)
                    .font(.custom("Urbanist", size: 12).weight(.semibold))
                    .foregroundColor(DesignSystem.Palette.Cream.elevated.opacity(0.75))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(DesignSystem.Palette.Charcoal.c900)
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(DesignSystem.Palette.Vermillion.v500.opacity(0.42), lineWidth: 1)
                )
        )
    }

    private var progressRing: some View {
        ZStack {
            Circle()
                .stroke(DesignSystem.Palette.Cream.elevated.opacity(0.16), lineWidth: 10)

            Circle()
                .trim(from: 0, to: max(0.02, min(progress, 1)))
                .stroke(
                    DesignSystem.Palette.Vermillion.v500,
                    style: StrokeStyle(lineWidth: 10, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(motionPreference.standardAnimation, value: progress)

            Text("\(progressPercent)")
                .font(.system(size: 26, weight: .bold, design: .monospaced))
                .foregroundColor(DesignSystem.Palette.Cream.elevated)
        }
        .frame(width: 150, height: 150)
    }

    private var stageLadder: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(AnalysisStage.allCases, id: \.rawValue) { stage in
                stageLane(stage)
                if stage != .complete {
                    Rectangle()
                        .fill(DesignSystem.Palette.Charcoal.c900.opacity(0.14))
                        .frame(height: 1)
                }
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(DesignSystem.Palette.Cream.elevated)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(DesignSystem.Palette.Charcoal.c900.opacity(0.22), lineWidth: 1)
                )
        )
    }

    private func stageLane(_ stage: AnalysisStage) -> some View {
        let isCurrent = stage == currentStage
        let isDone = stage.rawValue < currentStage.rawValue || currentStage == .complete

        return HStack(alignment: .center, spacing: 10) {
            Circle()
                .fill(
                    isDone
                        ? DesignSystem.success
                        : (isCurrent ? DesignSystem.Palette.Vermillion.v500 : DesignSystem.Palette.Charcoal.c900.opacity(0.2))
                )
                .frame(width: 8, height: 8)

            Text(stage.shortLabel)
                .font(.custom("Urbanist", size: 16).weight(.semibold))
                .foregroundColor(DesignSystem.Palette.Charcoal.c900)

            Spacer(minLength: 8)

            Text(isDone ? "Done" : (isCurrent ? "Active" : "Waiting"))
                .font(.custom("Urbanist", size: 10).weight(.bold))
                .tracking(1.2)
                .foregroundColor(
                    isDone
                        ? DesignSystem.success
                        : (isCurrent ? DesignSystem.Palette.Vermillion.v500 : DesignSystem.Palette.Charcoal.c700)
                )
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .background(isCurrent ? DesignSystem.Palette.Vermillion.v500.opacity(0.08) : Color.clear)
    }

    private var warningStrip: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Warnings")
                .font(.custom("Urbanist", size: 10).weight(.bold))
                .tracking(1.4)
                .foregroundColor(DesignSystem.warning)

            ForEach(Array(parsingWarnings.prefix(3).enumerated()), id: \.offset) { _, warning in
                Text("• \(warning)")
                    .font(.custom("Urbanist", size: 13).weight(.medium))
                    .foregroundColor(DesignSystem.Palette.Charcoal.c900)
                    .lineLimit(2)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(DesignSystem.warning.opacity(0.14))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(DesignSystem.warning.opacity(0.38), lineWidth: 1)
                )
        )
    }

    private var footerBand: some View {
        HStack {
            Text("The next card takes focus automatically when this stage completes.")
                .font(.custom("Urbanist", size: 12).weight(.medium))
                .foregroundColor(DesignSystem.Palette.Charcoal.c700)

            Spacer(minLength: 8)

            Button(action: onCancel) {
                Text("Cancel")
                    .font(.custom("Urbanist", size: 12).weight(.semibold))
                    .foregroundColor(DesignSystem.Palette.Charcoal.c900)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(DesignSystem.Palette.Cream.base)
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(DesignSystem.Palette.Charcoal.c900.opacity(0.22), lineWidth: 1)
                            )
                    )
            }
            .buttonStyle(.plain)
        }
    }
}

#if DEBUG
struct AnalysisProgressView_Previews: PreviewProvider {
    static var previews: some View {
        AnalysisProgressView(
            currentStage: .constant(.researching),
            progress: .constant(0.62),
            parsingWarnings: .constant(["Page 17 had malformed tables."]),
            documentName: "Brand_Refresh_RFP.pdf",
            onCancel: {}
        )
        .frame(width: 1180, height: 760)
        .padding(16)
        .background(DesignSystem.Palette.Cream.base)
    }
}
#endif
