//
//  DesignSystem.swift
//  angle-rfp
//
//  Tactile UI design system for desktop macOS experience.
//

import SwiftUI

enum DesignSystem {

    // MARK: - Palette Tokens

    enum Palette {
        // Background layers (dark mode)
        enum Background {
            static let deepest = Color(hex: "#0A0A0B")
            static let base = Color(hex: "#111113")
            static let elevated = Color(hex: "#1A1A1E")
            static let surface = Color(hex: "#222226")
        }

        // Accent gradient (warm coral to amber)
        enum Accent {
            static let primary = Color(hex: "#E8734A")
            static let secondary = Color(hex: "#F4A574")
            static let glow = Color(hex: "#E8734A").opacity(0.15)

            static var gradient: LinearGradient {
                LinearGradient(
                    colors: [primary, secondary],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        }

        // Text hierarchy
        enum Text {
            static let primary = Color.white
            static let secondary = Color.white.opacity(0.72)
            static let tertiary = Color.white.opacity(0.48)
            static let muted = Color.white.opacity(0.28)
        }

        // Semantic colors
        enum Semantic {
            static let success = Color(hex: "#4ADE80")
            static let warning = Color(hex: "#FBBF24")
            static let error = Color(hex: "#F87171")
            static let info = Color(hex: "#60A5FA")
        }

        // Legacy support - map old names to new
        enum Cream {
            static let base = Text.secondary
            static let elevated = Text.primary
        }

        enum Charcoal {
            static let c900 = Background.deepest
            static let c800 = Background.base
            static let c700 = Background.elevated
        }

        enum Vermillion {
            static let v500 = Accent.primary
            static let v400 = Accent.secondary
            static let v600 = Color(hex: "#D65A3A")
        }

        enum Line {
            static let soft = Color(hex: "#FFFFFF").opacity(0.12)
            static let hard = Color(hex: "#000000").opacity(0.3)
        }

        enum Feedback {
            static let success = Semantic.success
            static let warning = Semantic.warning
            static let error = Semantic.error
        }
    }

    // MARK: - Semantic Colors (updated palette)

    static let background = Palette.Background.base
    static let backgroundSecondary = Palette.Background.elevated
    static let backgroundTertiary = Palette.Background.surface

    static let textPrimary = Palette.Text.primary
    static let textSecondary = Palette.Text.secondary
    static let textTertiary = Palette.Text.tertiary

    static let accent = Palette.Accent.primary
    static let accentHover = Palette.Accent.secondary
    static let accentPressed = Color(hex: "#D65A3A")
    static let accentSubtle = Palette.Accent.glow
    static let accentGlow = Palette.Accent.primary.opacity(0.3)

    static let success = Palette.Semantic.success
    static let warning = Palette.Semantic.warning
    static let error = Palette.Semantic.error

    enum Gray {
        static let g50 = Palette.Cream.elevated.opacity(0.06)
        static let g100 = Palette.Cream.elevated.opacity(0.1)
        static let g200 = Palette.Cream.elevated.opacity(0.16)
        static let g300 = Palette.Cream.elevated.opacity(0.25)
        static let g400 = Palette.Cream.elevated.opacity(0.4)
        static let g500 = Palette.Cream.elevated.opacity(0.55)
        static let g600 = Palette.Cream.elevated.opacity(0.72)
        static let g700 = Palette.Cream.elevated.opacity(0.84)
        static let g800 = Palette.Cream.elevated.opacity(0.92)
        static let g900 = Palette.Cream.elevated
    }

    enum Surface {
        static let shell = Palette.Charcoal.c900
        static let rack = Palette.Charcoal.c800
        static let panelCream = Palette.Cream.base
        static let panelCreamElevated = Palette.Cream.elevated
        static let panelDark = Palette.Charcoal.c700
    }

    enum Materials {
        static let grainOpacity: Double = 0.035
        static let paperNoiseOpacity: Double = 0.02
        
        static func noiseTexture(opacity: Double = 0.02) -> some View {
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(opacity * 1.2),
                            Color.black.opacity(opacity * 0.8),
                            Color.white.opacity(opacity * 1.0),
                            Color.black.opacity(opacity * 0.6)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .blendMode(.overlay)
        }
    }

    enum Cinematic {
        static let coolEdge = Color(hex: "#8AB6FF")
        static let warmEdge = Palette.Vermillion.v400
        static let inkyBlue = Color(hex: "#131826")
        static let steel = Color(hex: "#222630")
        static let cardCream = Color(hex: "#F6F0E7")
        static let cardCreamElevated = Color(hex: "#FCF8F1")
        static let matteCharcoal = Color(hex: "#17181D")

        static let deckAmbientGradient = LinearGradient(
            colors: [
                Color(hex: "#090B11"),
                Color(hex: "#121523"),
                Color(hex: "#1D1A23")
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        static let activeCardGradient = LinearGradient(
            colors: [
                matteCharcoal.opacity(0.98),
                steel.opacity(0.96),
                inkyBlue.opacity(0.98)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        static let edgeCardGradient = LinearGradient(
            colors: [
                Color.white.opacity(0.14),
                Color.black.opacity(0.42)
            ],
            startPoint: .top,
            endPoint: .bottom
        )

        static func topRailGradient(for accent: Color) -> LinearGradient {
            LinearGradient(
                colors: [coolEdge.opacity(0.95), accent.opacity(0.9), warmEdge.opacity(0.85)],
                startPoint: .leading,
                endPoint: .trailing
            )
        }

        static func edgeBorder(for accent: Color, active: Bool) -> LinearGradient {
            LinearGradient(
                colors: [
                    Color.white.opacity(active ? 0.34 : 0.18),
                    accent.opacity(active ? 0.52 : 0.24)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    enum Glass {
        static let ultraThin = Material.ultraThinMaterial
        static let thin = Material.thinMaterial
        static let regular = Material.regularMaterial
        static let thick = Material.thickMaterial

        static func border(opacity: Double = 0.2) -> LinearGradient {
            LinearGradient(
                colors: [Color.white.opacity(opacity), Color.white.opacity(opacity * 0.35)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }

        static func borderHover(opacity: Double = 0.4) -> LinearGradient {
            LinearGradient(
                colors: [Color.white.opacity(opacity), Color.white.opacity(opacity * 0.4)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }

        static let stageGradient = LinearGradient(
            colors: [
                Color(hex: "#DDE9F8").opacity(0.8),
                Color(hex: "#F5F0ED").opacity(0.55),
                Palette.Vermillion.v400.opacity(0.6)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        static let accentGlow = RadialGradient(
            colors: [Palette.Vermillion.v500.opacity(0.4), Color.clear],
            center: .center,
            startRadius: 0,
            endRadius: 220
        )
    }

    // MARK: - Typography

    enum Typography {
        static func display(_ weight: Font.Weight = .heavy) -> Font {
            .custom("Urbanist", size: 64).weight(weight)
        }

        static func headlineLarge(_ weight: Font.Weight = .bold) -> Font {
            .custom("Urbanist", size: 34).weight(weight)
        }

        static func headline(_ weight: Font.Weight = .semibold) -> Font {
            .custom("Urbanist", size: 28).weight(weight)
        }

        static func title(_ weight: Font.Weight = .bold) -> Font {
            .custom("Urbanist", size: 22).weight(weight)
        }

        static func subtitle(_ weight: Font.Weight = .medium) -> Font {
            .custom("Urbanist", size: 18).weight(weight)
        }

        static func body(_ weight: Font.Weight = .medium) -> Font {
            .custom("Urbanist", size: 15).weight(weight)
        }

        static func bodySmall(_ weight: Font.Weight = .medium) -> Font {
            .custom("Urbanist", size: 13).weight(weight)
        }

        static func caption(_ weight: Font.Weight = .semibold) -> Font {
            .custom("Urbanist", size: 12).weight(weight)
        }

        static func overline() -> Font {
            .custom("Urbanist", size: 12).weight(.semibold)
        }

        static func mono(_ size: CGFloat = 13, _ weight: Font.Weight = .medium) -> Font {
            .custom("IBM Plex Mono", size: size).weight(weight)
        }
        
        static func monoCaption() -> Font {
            .custom("IBM Plex Mono", size: 10).weight(.semibold)
        }
        
        static func monoBody() -> Font {
            .custom("IBM Plex Mono", size: 11).weight(.medium)
        }
    }

    enum Fonts {
        static func urbanist(size: CGFloat, weight: Font.Weight = .regular) -> Font {
            .custom("Urbanist", size: size).weight(weight)
        }

        static let largeTitle = urbanist(size: 34, weight: .bold)
        static let title1 = urbanist(size: 28, weight: .bold)
        static let title2 = urbanist(size: 22, weight: .bold)
        static let title3 = urbanist(size: 20, weight: .semibold)
        static let headline = urbanist(size: 17, weight: .semibold)
        static let body = urbanist(size: 17, weight: .regular)
        static let callout = urbanist(size: 16, weight: .regular)
        static let subheadline = urbanist(size: 15, weight: .regular)
        static let footnote = urbanist(size: 13, weight: .regular)
        static let caption1 = urbanist(size: 12, weight: .regular)
        static let caption2 = urbanist(size: 11, weight: .regular)
    }

    // MARK: - Sizing

    enum Spacing {
        static let xxxs: CGFloat = 2
        static let xxs: CGFloat = 4
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
        static let xxxl: CGFloat = 64
        static let section: CGFloat = 80

        static let xxsmall: CGFloat = 4
        static let xsmall: CGFloat = 6
        static let small: CGFloat = 8
        static let medium: CGFloat = 16
        static let large: CGFloat = 24
        static let xlarge: CGFloat = 32
        static let xxlarge: CGFloat = 48
    }

    enum Editorial {
        static let baseUnit: CGFloat = 8
        static let cardRadius: CGFloat = 20
        static let compactCardRadius: CGFloat = 16

        static func edgePadding(for width: CGFloat) -> CGFloat {
            Layout.clamp(width * 0.018, min: 16, max: 30)
        }

        static func stackSpacing(for width: CGFloat) -> CGFloat {
            Layout.clamp(width * 0.014, min: 12, max: 24)
        }
    }

    enum Radius {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
        static let full: CGFloat = 9999

        static let tactileModule: CGFloat = 14
        static let glassStage: CGFloat = 22
        static let appShell: CGFloat = 18

        static let small: CGFloat = 8
        static let medium: CGFloat = 12
        static let large: CGFloat = 16
        static let xlarge: CGFloat = 24
    }

    enum CornerRadius {
        static let small: CGFloat = 8
        static let medium: CGFloat = 12
        static let large: CGFloat = 16
        static let xlarge: CGFloat = 24
    }

    enum Shadow {
        static let restY: CGFloat = 12
        static let restBlur: CGFloat = 26
        static let restAlpha: Double = 0.26

        static let hoverY: CGFloat = 18
        static let hoverBlur: CGFloat = 34
        static let hoverAlpha: Double = 0.34

        static let pressedY: CGFloat = 6
        static let pressedBlur: CGFloat = 14
        static let pressedAlpha: Double = 0.22

        static let card: CGFloat = 0.26
        static let cardHover: CGFloat = 0.34
        static let elevated: CGFloat = 0.4

        static func accentGlow(radius: CGFloat = 20) -> some View {
            DesignSystem.accent.opacity(0.3).blur(radius: radius)
        }
        
        // Multi-layer shadow system for depth
        static func layeredCard(isHovered: Bool = false) -> some View {
            ZStack {
                // Ambient shadow (soft, diffused)
                Color.black.opacity(isHovered ? 0.08 : 0.05)
                    .blur(radius: isHovered ? 32 : 24)
                    .offset(y: isHovered ? 6 : 4)
                
                // Direct shadow (sharper, directional)
                Color.black.opacity(isHovered ? 0.12 : 0.08)
                    .blur(radius: isHovered ? 16 : 12)
                    .offset(x: 0, y: isHovered ? 12 : 8)
            }
        }
    }

    enum Motion {
        static let microDuration: Double = 0.14
        static let standardDuration: Double = 0.24
        static let emphasisDuration: Double = 0.42
        static let reducedDuration: Double = 0.16
        static let runwayResponse: Double = 0.56
        static let runwayDamping: Double = 0.86
        static let hoverParallax: CGFloat = 6
        static let hoverTiltDegrees: Double = 3
        static let glowPulseInterval: Double = 1.8
    }

    enum Animation {
        static let micro: SwiftUI.Animation = .easeOut(duration: Motion.microDuration)
        static let standard: SwiftUI.Animation = .timingCurve(0.22, 1.0, 0.36, 1.0, duration: Motion.standardDuration)
        static let emphasis: SwiftUI.Animation = .spring(response: 0.44, dampingFraction: 0.78)
        static let runway: SwiftUI.Animation = .spring(response: Motion.runwayResponse, dampingFraction: Motion.runwayDamping)

        static let entrance: SwiftUI.Animation = emphasis
        static let spring: SwiftUI.Animation = .spring(response: 0.35, dampingFraction: 0.7)
        static let cardSpring: SwiftUI.Animation = .spring(response: 0.4, dampingFraction: 0.8)

        static func micro(for preference: MotionPreference) -> SwiftUI.Animation {
            preference.microAnimation
        }

        static func standard(for preference: MotionPreference) -> SwiftUI.Animation {
            preference.standardAnimation
        }

        static func emphasis(for preference: MotionPreference) -> SwiftUI.Animation {
            preference.emphasisAnimation
        }

        static func runway(for preference: MotionPreference) -> SwiftUI.Animation {
            preference.resolved == .reduced
                ? .easeOut(duration: Motion.reducedDuration)
                : runway
        }
    }

    enum Layout {
        static let minWindowWidth: CGFloat = 1180
        static let minWindowHeight: CGFloat = 760
        static let shellInset: CGFloat = 20
        static let shellGap: CGFloat = 24
        static let rackWidth: CGFloat = 312
        static let rackMinWidth: CGFloat = 260
        static let rackMaxWidth: CGFloat = 332
        static let stageMinWidth: CGFloat = 560
        static let stageReferenceWidth: CGFloat = 960
        static let shellReferenceHeight: CGFloat = 860

        static let maxWidth: CGFloat = 1280
        static let sidebarWidth: CGFloat = rackWidth
        static let cardMinHeight: CGFloat = 120
        static let gridColumns: Int = 12

        static func shellInset(for width: CGFloat) -> CGFloat {
            clamp(width * 0.016, min: 12, max: 24)
        }

        static func shellGap(for width: CGFloat) -> CGFloat {
            clamp(width * 0.018, min: 12, max: 24)
        }

        static func rackWidth(for width: CGFloat) -> CGFloat {
            clamp(width * 0.24, min: rackMinWidth, max: rackMaxWidth)
        }

        static func stageWidth(
            for totalWidth: CGFloat,
            shellInset: CGFloat,
            shellGap: CGFloat,
            rackWidth: CGFloat
        ) -> CGFloat {
            max(stageMinWidth, totalWidth - (shellInset * 2) - shellGap - rackWidth)
        }

        static func rackScale(for rackWidth: CGFloat) -> CGFloat {
            clamp(rackWidth / Layout.rackWidth, min: 0.8, max: 1.12)
        }

        static func stageScale(for stageWidth: CGFloat) -> CGFloat {
            clamp(stageWidth / stageReferenceWidth, min: 0.8, max: 1.16)
        }

        static func runwayActiveWidth(for windowWidth: CGFloat) -> CGFloat {
            clamp(windowWidth * 0.72, min: 680, max: 1320)
        }

        static func runwayCompactWidth(for windowWidth: CGFloat) -> CGFloat {
            clamp(windowWidth * 0.16, min: 170, max: 280)
        }

        static func runwayPeekWidth(for windowWidth: CGFloat) -> CGFloat {
            clamp(windowWidth * 0.08, min: 72, max: 132)
        }

        static func runwayGap(for windowWidth: CGFloat) -> CGFloat {
            clamp(windowWidth * 0.012, min: 10, max: 22)
        }

        static func runwayVerticalPadding(for windowWidth: CGFloat) -> CGFloat {
            clamp(windowWidth * 0.016, min: 14, max: 28)
        }

        static func heightScale(for height: CGFloat) -> CGFloat {
            clamp(height / shellReferenceHeight, min: 0.8, max: 1.16)
        }

        static func scaled(
            _ value: CGFloat,
            by scale: CGFloat,
            min: CGFloat? = nil,
            max: CGFloat? = nil
        ) -> CGFloat {
            let scaled = value * scale
            if let min {
                return clamp(scaled, min: min, max: max ?? .greatestFiniteMagnitude)
            }
            if let max {
                return clamp(scaled, min: -.greatestFiniteMagnitude, max: max)
            }
            return scaled
        }

        static func clamp(_ value: CGFloat, min lowerBound: CGFloat, max upperBound: CGFloat) -> CGFloat {
            Swift.min(Swift.max(value, lowerBound), upperBound)
        }
    }
}

// MARK: - Color Extension

extension Color {
    init(hex: String) {
        let sanitized = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: sanitized).scanHexInt64(&value)

        let r, g, b, a: UInt64

        switch sanitized.count {
        case 3:
            (r, g, b, a) = (
                ((value >> 8) & 0xF) * 17,
                ((value >> 4) & 0xF) * 17,
                (value & 0xF) * 17,
                255
            )
        case 6:
            (r, g, b, a) = (
                (value >> 16) & 0xFF,
                (value >> 8) & 0xFF,
                value & 0xFF,
                255
            )
        case 8:
            (r, g, b, a) = (
                (value >> 24) & 0xFF,
                (value >> 16) & 0xFF,
                (value >> 8) & 0xFF,
                value & 0xFF
            )
        default:
            (r, g, b, a) = (0, 0, 0, 255)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Card Modifiers (legacy compatibility)

struct GlassCardModifier: ViewModifier {
    var isHovered: Bool = false
    var cornerRadius: CGFloat = 24
    var padding: CGFloat = 24

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .stroke(
                                isHovered ? DesignSystem.Glass.borderHover() : DesignSystem.Glass.border(),
                                lineWidth: 1
                            )
                    )
            )
            .shadow(
                color: Color.black.opacity(isHovered ? DesignSystem.Shadow.hoverAlpha : DesignSystem.Shadow.restAlpha),
                radius: isHovered ? DesignSystem.Shadow.hoverBlur : DesignSystem.Shadow.restBlur,
                x: 0,
                y: isHovered ? DesignSystem.Shadow.hoverY : DesignSystem.Shadow.restY
            )
            .scaleEffect(isHovered ? 1.005 : 1.0)
            .animation(DesignSystem.Animation.cardSpring, value: isHovered)
    }
}

struct PremiumCardStyle: ViewModifier {
    var isHovered: Bool = false
    var padding: CGFloat = DesignSystem.Spacing.lg

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.Radius.lg, style: .continuous)
                    .stroke(DesignSystem.Glass.border(), lineWidth: 1)
            )
            .shadow(
                color: Color.black.opacity(isHovered ? DesignSystem.Shadow.hoverAlpha : DesignSystem.Shadow.restAlpha),
                radius: isHovered ? 20 : 12,
                x: 0,
                y: isHovered ? 8 : 4
            )
            .scaleEffect(isHovered ? 1.01 : 1.0)
            .animation(DesignSystem.Animation.cardSpring, value: isHovered)
    }
}

struct AccentButtonStyle: ButtonStyle {
    @State private var isHovered = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(DesignSystem.Typography.body(.semibold))
            .foregroundColor(.white)
            .padding(.horizontal, DesignSystem.Spacing.lg)
            .padding(.vertical, DesignSystem.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.Radius.sm, style: .continuous)
                    .fill(configuration.isPressed ? DesignSystem.accentPressed : (isHovered ? DesignSystem.accentHover : DesignSystem.accent))
                    .shadow(color: DesignSystem.accent.opacity(0.45), radius: isHovered ? 14 : 0, x: 0, y: 4)
            )
            .scaleEffect(configuration.isPressed ? 0.985 : 1.0)
            .animation(DesignSystem.Animation.micro, value: configuration.isPressed)
            .onHover { hovering in
                isHovered = hovering
            }
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    @State private var isHovered = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(DesignSystem.Typography.body(.medium))
            .foregroundColor(DesignSystem.textPrimary)
            .padding(.horizontal, DesignSystem.Spacing.lg)
            .padding(.vertical, DesignSystem.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.Radius.sm, style: .continuous)
                    .fill(isHovered ? DesignSystem.Gray.g100 : DesignSystem.Gray.g50)
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignSystem.Radius.sm, style: .continuous)
                            .stroke(DesignSystem.Gray.g300, lineWidth: 1)
                    )
            )
            .scaleEffect(configuration.isPressed ? 0.985 : 1.0)
            .animation(DesignSystem.Animation.micro, value: configuration.isPressed)
            .onHover { hovering in
                isHovered = hovering
            }
    }
}

struct GhostButtonStyle: ButtonStyle {
    @State private var isHovered = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(DesignSystem.Typography.body(.medium))
            .foregroundColor(isHovered ? DesignSystem.accent : DesignSystem.textPrimary)
            .padding(.horizontal, DesignSystem.Spacing.md)
            .padding(.vertical, DesignSystem.Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.Radius.sm, style: .continuous)
                    .fill(isHovered ? DesignSystem.accentSubtle : .clear)
            )
            .animation(DesignSystem.Animation.micro, value: isHovered)
            .onHover { hovering in
                isHovered = hovering
            }
    }
}

extension View {
    func glassCard(isHovered: Bool = false, cornerRadius: CGFloat = 24, padding: CGFloat = 24) -> some View {
        modifier(GlassCardModifier(isHovered: isHovered, cornerRadius: cornerRadius, padding: padding))
    }

    func premiumCard(isHovered: Bool = false, padding: CGFloat = DesignSystem.Spacing.lg) -> some View {
        modifier(PremiumCardStyle(isHovered: isHovered, padding: padding))
    }

    func cardStyle(hoverable: Bool = false) -> some View {
        self
            .background(.ultraThinMaterial)
            .cornerRadius(DesignSystem.CornerRadius.medium)
            .shadow(color: Color.black.opacity(DesignSystem.Shadow.card), radius: 4, x: 0, y: 2)
    }

    func accentButtonStyle() -> some View {
        self
            .padding(.horizontal, DesignSystem.Spacing.large)
            .padding(.vertical, DesignSystem.Spacing.medium)
            .background(DesignSystem.accent)
            .foregroundColor(.white)
            .cornerRadius(DesignSystem.CornerRadius.medium)
            .font(DesignSystem.Fonts.headline)
    }
}

extension ButtonStyle where Self == AccentButtonStyle {
    static var accent: AccentButtonStyle { AccentButtonStyle() }
}

extension ButtonStyle where Self == SecondaryButtonStyle {
    static var secondary: SecondaryButtonStyle { SecondaryButtonStyle() }
}

extension ButtonStyle where Self == GhostButtonStyle {
    static var ghost: GhostButtonStyle { GhostButtonStyle() }
}
