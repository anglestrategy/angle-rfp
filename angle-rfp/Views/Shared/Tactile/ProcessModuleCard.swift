//
//  ProcessModuleCard.swift
//  angle-rfp
//
//  Tactile process module card for control-rack status.
//

import SwiftUI

enum ProcessModule: String, CaseIterable, Identifiable {
    case ingest
    case parse
    case criteria
    case score
    case synthesize

    var id: String { rawValue }

    var title: String {
        switch self {
        case .ingest: return "Ingest"
        case .parse: return "Parse"
        case .criteria: return "Criteria"
        case .score: return "Score"
        case .synthesize: return "Synthesize"
        }
    }

    var subtitle: String {
        switch self {
        case .ingest: return "Collect source docs"
        case .parse: return "Read structure + text"
        case .criteria: return "Map evaluation logic"
        case .score: return "Compute financial signal"
        case .synthesize: return "Compose final output"
        }
    }
}

enum ProcessModuleState {
    case idle
    case active
    case complete
    case warning
}

struct ProcessModuleCardState: Identifiable {
    let module: ProcessModule
    let state: ProcessModuleState

    var id: ProcessModule { module }
    var title: String { module.title }
    var subtitle: String { module.subtitle }
}

struct ProcessModuleCard: View {
    let state: ProcessModuleCardState
    var compact: Bool = false
    var density: CGFloat = 1.0

    @Environment(\.motionPreference) private var motionPreference
    @State private var isHovered = false
    @State private var isPressed = false

    private var statusColor: Color {
        switch state.state {
        case .idle: return DesignSystem.Palette.Charcoal.c700.opacity(0.5)
        case .active: return DesignSystem.accent
        case .complete: return DesignSystem.success
        case .warning: return DesignSystem.warning
        }
    }

    private var cardTone: TactileTone {
        switch state.state {
        case .active: return .creamElevated
        case .complete: return .cream
        case .warning: return .cream
        case .idle: return .cream
        }
    }

    private var activeDepthState: TactileInteractionState {
        if isPressed {
            return .pressed
        }
        if state.state == .active {
            return .hover
        }
        if isHovered && motionPreference.allowsParallax {
            return .hover
        }
        return .rest
    }

    private func s(_ value: CGFloat, min: CGFloat? = nil, max: CGFloat? = nil) -> CGFloat {
        DesignSystem.Layout.scaled(value, by: density, min: min, max: max)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? s(7, min: 5) : s(10, min: 8)) {
            HStack(alignment: .center, spacing: s(10, min: 7)) {
                Circle()
                    .fill(statusColor)
                    .frame(width: s(compact ? 8 : 9, min: 7), height: s(compact ? 8 : 9, min: 7))
                    .shadow(color: statusColor.opacity(0.55), radius: state.state == .idle ? 0 : 8, x: 0, y: 0)

                Text(state.title)
                    .font(.custom("Urbanist", size: s(compact ? 11 : 12, min: 9)).weight(.semibold))
                    .tracking(0.8)
                    .foregroundColor(DesignSystem.Palette.Charcoal.c900)

                Spacer(minLength: 0)

                statusLabel
            }

            if !compact {
                Text(state.subtitle)
                    .font(.custom("Urbanist", size: s(11, min: 9)).weight(.medium))
                    .foregroundColor(DesignSystem.Palette.Charcoal.c700.opacity(0.75))
                    .lineLimit(1)
            }

            GeometryReader { geometry in
                Capsule()
                    .fill(DesignSystem.Palette.Charcoal.c900.opacity(0.14))
                    .frame(height: s(compact ? 3 : 4, min: 2))
                    .overlay(alignment: .leading) {
                        Capsule()
                            .fill(statusColor)
                            .frame(
                                width: max(geometry.size.width * progressFraction, s(18, min: 12)),
                                height: s(compact ? 3 : 4, min: 2)
                            )
                            .animation(motionPreference.standardAnimation, value: state.state)
                    }
            }
            .frame(height: s(compact ? 3 : 4, min: 2))
            .padding(.top, compact ? 0 : s(2, min: 1))
        }
        .padding(.horizontal, s(compact ? 10 : 12, min: 8))
        .padding(.vertical, s(compact ? 8 : 12, min: 7))
        .background(
            TactilePanel(
                tone: cardTone,
                cornerRadius: s(compact ? 10 : 12, min: 8),
                contentPadding: 0,
                interactive: true,
                interactionState: activeDepthState
            ) {
                Color.clear
            }
        )
        .overlay(
            RoundedRectangle(cornerRadius: s(compact ? 10 : 12, min: 8), style: .continuous)
                .stroke(DesignSystem.Palette.Line.hard.opacity(0.24), lineWidth: 1)
        )
        .animation(motionPreference.microAnimation, value: isHovered)
        .onHover { hovering in
            guard motionPreference.resolved != .reduced else { return }
            isHovered = hovering
        }
        .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
            guard motionPreference.resolved != .reduced else { return }
            isPressed = pressing
        }, perform: {})
    }

    private var progressFraction: CGFloat {
        switch state.state {
        case .idle:
            return 0.16
        case .active:
            return 0.56
        case .complete:
            return 1.0
        case .warning:
            return 0.74
        }
    }

    private var statusLabel: some View {
        Text(label)
            .font(.custom("Urbanist", size: s(compact ? 9 : 10, min: 8)).weight(.bold))
            .tracking(0.8)
            .foregroundColor(statusColor.opacity(state.state == .idle ? 0.6 : 1.0))
    }

    private var label: String {
        switch state.state {
        case .idle:
            return "IDLE"
        case .active:
            return "LIVE"
        case .complete:
            return "DONE"
        case .warning:
            return "WARN"
        }
    }
}
