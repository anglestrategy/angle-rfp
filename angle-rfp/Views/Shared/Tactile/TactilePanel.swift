//
//  TactilePanel.swift
//  angle-rfp
//
//  Reusable tactile panel with bevel, grain, and depth interactions.
//

import SwiftUI

enum TactileTone {
    case cream
    case creamElevated
    case charcoal
    case vermillion
    case glass

    var fill: LinearGradient {
        switch self {
        case .cream:
            return LinearGradient(
                colors: [DesignSystem.Palette.Cream.elevated, DesignSystem.Palette.Cream.base],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .creamElevated:
            return LinearGradient(
                colors: [Color.white.opacity(0.95), DesignSystem.Palette.Cream.elevated],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .charcoal:
            return LinearGradient(
                colors: [DesignSystem.Palette.Charcoal.c700, DesignSystem.Palette.Charcoal.c800],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .vermillion:
            return LinearGradient(
                colors: [DesignSystem.Palette.Vermillion.v400, DesignSystem.Palette.Vermillion.v600],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .glass:
            return LinearGradient(
                colors: [Color.white.opacity(0.28), Color.white.opacity(0.08)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    var highlight: Color {
        switch self {
        case .cream, .creamElevated: return Color.white.opacity(0.75)
        case .charcoal: return Color.white.opacity(0.18)
        case .vermillion: return Color.white.opacity(0.22)
        case .glass: return Color.white.opacity(0.45)
        }
    }

    var innerShadow: Color {
        switch self {
        case .cream, .creamElevated: return Color.black.opacity(0.16)
        case .charcoal: return Color.black.opacity(0.34)
        case .vermillion: return Color.black.opacity(0.24)
        case .glass: return Color.black.opacity(0.2)
        }
    }
}

enum TactileInteractionState {
    case rest
    case hover
    case pressed
}

private struct TactileDepthProfile {
    let shadowY: CGFloat
    let shadowBlur: CGFloat
    let shadowAlpha: Double
    let lift: CGFloat
    let scale: CGFloat
}

private extension TactileInteractionState {
    var profile: TactileDepthProfile {
        switch self {
        case .rest:
            return TactileDepthProfile(
                shadowY: DesignSystem.Shadow.restY,
                shadowBlur: DesignSystem.Shadow.restBlur,
                shadowAlpha: DesignSystem.Shadow.restAlpha,
                lift: 0,
                scale: 1
            )
        case .hover:
            return TactileDepthProfile(
                shadowY: DesignSystem.Shadow.hoverY,
                shadowBlur: DesignSystem.Shadow.hoverBlur,
                shadowAlpha: DesignSystem.Shadow.hoverAlpha,
                lift: -2,
                scale: 1.0
            )
        case .pressed:
            return TactileDepthProfile(
                shadowY: DesignSystem.Shadow.pressedY,
                shadowBlur: DesignSystem.Shadow.pressedBlur,
                shadowAlpha: DesignSystem.Shadow.pressedAlpha,
                lift: 1,
                scale: 0.985
            )
        }
    }
}

private struct TactileBevelModifier: ViewModifier {
    let cornerRadius: CGFloat
    let tone: TactileTone

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        return content
            .overlay(
                shape
                    .stroke(tone.highlight, lineWidth: 2)
                    .blur(radius: 0.3)
                    .opacity(0.9)
            )
            .overlay(
                shape
                    .stroke(tone.innerShadow, lineWidth: 2)
                    .blur(radius: 1)
                    .offset(x: 0.5, y: 1)
                    .mask(
                        shape.fill(
                            LinearGradient(colors: [.clear, .black], startPoint: .top, endPoint: .bottom)
                        )
                    )
            )
    }
}

private struct TactileRimLightModifier: ViewModifier {
    let cornerRadius: CGFloat
    let intensity: Double

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        return content
            .overlay(
                shape
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.9),
                                Color.white.opacity(0.2),
                                DesignSystem.accent.opacity(0.35)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1.1
                    )
                    .blur(radius: 0.45)
                    .opacity(intensity)
            )
    }
}

private struct TactileDepthModifier: ViewModifier {
    let state: TactileInteractionState
    let motionPreference: MotionPreference
    let animation: SwiftUI.Animation

    func body(content: Content) -> some View {
        let reducedMotion = motionPreference.resolved == .reduced
        let profile = state.profile
        let lift = reducedMotion ? 0 : profile.lift
        let scale = reducedMotion ? 1 : profile.scale

        return content
            .scaleEffect(scale)
            .offset(y: lift)
            .shadow(
                color: Color.black.opacity(profile.shadowAlpha),
                radius: profile.shadowBlur,
                x: 0,
                y: profile.shadowY
            )
            .animation(animation, value: state)
    }
}

struct TactilePanel<Content: View>: View {
    let tone: TactileTone
    var cornerRadius: CGFloat = DesignSystem.Radius.tactileModule
    var contentPadding: CGFloat = DesignSystem.Spacing.md
    var interactive: Bool = false
    var interactionState: TactileInteractionState? = nil
    let content: Content

    @Environment(\.motionPreference) private var motionPreference
    @State private var isHovered = false

    init(
        tone: TactileTone = .charcoal,
        cornerRadius: CGFloat = DesignSystem.Radius.tactileModule,
        contentPadding: CGFloat = DesignSystem.Spacing.md,
        interactive: Bool = false,
        interactionState: TactileInteractionState? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.tone = tone
        self.cornerRadius = cornerRadius
        self.contentPadding = contentPadding
        self.interactive = interactive
        self.interactionState = interactionState
        self.content = content()
    }

    private var isActiveHover: Bool {
        interactive && isHovered && motionPreference.resolved != .reduced
    }

    private var resolvedState: TactileInteractionState {
        if let interactionState {
            return interactionState
        }
        return isActiveHover ? .hover : .rest
    }

    var body: some View {
        content
            .padding(contentPadding)
            .background(backgroundShape)
            .compositingGroup()
            .modifier(
                TactileDepthModifier(
                    state: resolvedState,
                    motionPreference: motionPreference,
                    animation: motionPreference.standardAnimation
                )
            )
            .onHover { hovering in
                guard interactive else { return }
                isHovered = hovering
            }
    }

    private var backgroundShape: some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        return shape
            .fill(tone.fill)
            .modifier(TactileBevelModifier(cornerRadius: cornerRadius, tone: tone))
            .modifier(TactileRimLightModifier(cornerRadius: cornerRadius, intensity: resolvedState == .hover ? 1 : 0.8))
            .overlay(
                shape
                    .fill(
                        LinearGradient(
                            colors: [Color.white.opacity(0.08), Color.clear, Color.black.opacity(0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            )
            .overlay(shapeOverlay(shape: shape))
    }

    private func shapeOverlay(shape: RoundedRectangle) -> some View {
        shape
            .fill(Color.white.opacity(0.045))
            .tactileShaderGrain(intensity: 0.05)
            .blendMode(.overlay)
            .opacity(DesignSystem.Materials.grainOpacity)
    }
}

extension View {
    func tactileBevel(cornerRadius: CGFloat, tone: TactileTone) -> some View {
        modifier(TactileBevelModifier(cornerRadius: cornerRadius, tone: tone))
    }

    func tactileRimLight(cornerRadius: CGFloat, intensity: Double = 1) -> some View {
        modifier(TactileRimLightModifier(cornerRadius: cornerRadius, intensity: intensity))
    }

    func tactileDepth(state: TactileInteractionState, motionPreference: MotionPreference) -> some View {
        modifier(TactileDepthModifier(state: state, motionPreference: motionPreference, animation: motionPreference.standardAnimation))
    }

    func tactilePanel(
        tone: TactileTone = .charcoal,
        cornerRadius: CGFloat = DesignSystem.Radius.tactileModule,
        contentPadding: CGFloat = DesignSystem.Spacing.md,
        interactive: Bool = false,
        interactionState: TactileInteractionState? = nil
    ) -> some View {
        TactilePanel(
            tone: tone,
            cornerRadius: cornerRadius,
            contentPadding: contentPadding,
            interactive: interactive,
            interactionState: interactionState
        ) {
            self
        }
    }
}
