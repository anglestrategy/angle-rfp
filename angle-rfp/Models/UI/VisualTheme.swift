//
//  VisualTheme.swift
//  angle-rfp
//
//  Runtime-selectable visual themes for cinematic desktop styling.
//

import SwiftUI

enum VisualTheme: String, Codable, CaseIterable, Identifiable {
    case atelier
    case ion
    case forge

    var id: String { rawValue }

    var title: String {
        switch self {
        case .atelier:
            return "Atelier"
        case .ion:
            return "Ion"
        case .forge:
            return "Forge"
        }
    }

    var summary: String {
        switch self {
        case .atelier:
            return "Cream + charcoal with vermillion highlights."
        case .ion:
            return "Cooled steel with electric blue energy."
        case .forge:
            return "Molten copper and industrial noir surfaces."
        }
    }

    var accent: Color {
        switch self {
        case .atelier:
            return Color(hex: "#D9572B")
        case .ion:
            return Color(hex: "#3E86FF")
        case .forge:
            return Color(hex: "#E0612C")
        }
    }

    var accentHover: Color {
        switch self {
        case .atelier:
            return Color(hex: "#E46A3D")
        case .ion:
            return Color(hex: "#63A6FF")
        case .forge:
            return Color(hex: "#F48A42")
        }
    }

    var accentPressed: Color {
        switch self {
        case .atelier:
            return Color(hex: "#BE4720")
        case .ion:
            return Color(hex: "#2C6CD8")
        case .forge:
            return Color(hex: "#BF491A")
        }
    }

    var stageAccents: [Color] {
        switch self {
        case .atelier:
            return [
                Color(hex: "#D9572B"),
                Color(hex: "#E46A3D"),
                Color(hex: "#E88758"),
                Color(hex: "#D06B44"),
                Color(hex: "#C95A31")
            ]
        case .ion:
            return [
                Color(hex: "#3E86FF"),
                Color(hex: "#63A6FF"),
                Color(hex: "#62C7FF"),
                Color(hex: "#5A7EFF"),
                Color(hex: "#4D66D3")
            ]
        case .forge:
            return [
                Color(hex: "#E0612C"),
                Color(hex: "#F48A42"),
                Color(hex: "#FFB15A"),
                Color(hex: "#DA6A2A"),
                Color(hex: "#B84A1F")
            ]
        }
    }

    var resultsAccent: Color {
        Color(hex: "#3FA56A")
    }

    var deckGradient: LinearGradient {
        switch self {
        case .atelier:
            return LinearGradient(
                colors: [Color(hex: "#090B11"), Color(hex: "#121523"), Color(hex: "#1D1A23")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .ion:
            return LinearGradient(
                colors: [Color(hex: "#070C14"), Color(hex: "#0D1B30"), Color(hex: "#14273D")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .forge:
            return LinearGradient(
                colors: [Color(hex: "#130C08"), Color(hex: "#201510"), Color(hex: "#2B1E17")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    var coolGlow: Color {
        switch self {
        case .atelier:
            return Color(hex: "#8AB6FF")
        case .ion:
            return Color(hex: "#59C9FF")
        case .forge:
            return Color(hex: "#F5AB79")
        }
    }

    var warmGlow: Color {
        switch self {
        case .atelier:
            return Color(hex: "#E46A3D")
        case .ion:
            return Color(hex: "#6F8BFF")
        case .forge:
            return Color(hex: "#FF6A3D")
        }
    }

    var activeCardGradient: LinearGradient {
        switch self {
        case .atelier:
            return LinearGradient(
                colors: [Color(hex: "#17181D"), Color(hex: "#222630"), Color(hex: "#131826")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .ion:
            return LinearGradient(
                colors: [Color(hex: "#111A28"), Color(hex: "#16263D"), Color(hex: "#1A324F")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .forge:
            return LinearGradient(
                colors: [Color(hex: "#22150F"), Color(hex: "#2F1A12"), Color(hex: "#1A120D")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    var compactCardGradient: LinearGradient {
        switch self {
        case .atelier:
            return LinearGradient(
                colors: [Color(hex: "#2A2826").opacity(0.9), Color(hex: "#121212").opacity(0.96)],
                startPoint: .top,
                endPoint: .bottom
            )
        case .ion:
            return LinearGradient(
                colors: [Color(hex: "#1A324F").opacity(0.9), Color(hex: "#0D1B30").opacity(0.96)],
                startPoint: .top,
                endPoint: .bottom
            )
        case .forge:
            return LinearGradient(
                colors: [Color(hex: "#3B271F").opacity(0.92), Color(hex: "#1A120D").opacity(0.96)],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }

    var edgeOverlayGradient: LinearGradient {
        switch self {
        case .atelier:
            return LinearGradient(
                colors: [Color.white.opacity(0.14), Color.black.opacity(0.42)],
                startPoint: .top,
                endPoint: .bottom
            )
        case .ion:
            return LinearGradient(
                colors: [Color.white.opacity(0.1), Color.black.opacity(0.5)],
                startPoint: .top,
                endPoint: .bottom
            )
        case .forge:
            return LinearGradient(
                colors: [Color.white.opacity(0.12), Color.black.opacity(0.46)],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }

    var topRailGradient: LinearGradient {
        switch self {
        case .atelier:
            return LinearGradient(
                colors: [Color(hex: "#8AB6FF"), accentHover, Color(hex: "#E46A3D")],
                startPoint: .leading,
                endPoint: .trailing
            )
        case .ion:
            return LinearGradient(
                colors: [Color(hex: "#57D1FF"), Color(hex: "#77A5FF"), Color(hex: "#3A5FA8")],
                startPoint: .leading,
                endPoint: .trailing
            )
        case .forge:
            return LinearGradient(
                colors: [Color(hex: "#FFC47A"), Color(hex: "#FF8E4A"), Color(hex: "#C5481D")],
                startPoint: .leading,
                endPoint: .trailing
            )
        }
    }

    var dropZoneTop: Color {
        switch self {
        case .atelier:
            return Color(hex: "#FCF8F1")
        case .ion:
            return Color(hex: "#EDF6FF")
        case .forge:
            return Color(hex: "#FFF2E6")
        }
    }

    var dropZoneBottom: Color {
        switch self {
        case .atelier:
            return Color(hex: "#F6F0E7")
        case .ion:
            return Color(hex: "#D9E8FF")
        case .forge:
            return Color(hex: "#F6DFC9")
        }
    }

    var panelTop: Color {
        switch self {
        case .atelier:
            return Color(hex: "#1B1A19")
        case .ion:
            return Color(hex: "#16202F")
        case .forge:
            return Color(hex: "#2A1C16")
        }
    }

    var panelBottom: Color {
        switch self {
        case .atelier:
            return Color(hex: "#121212")
        case .ion:
            return Color(hex: "#0D121D")
        case .forge:
            return Color(hex: "#18110D")
        }
    }

    static func from(rawValue: String?) -> VisualTheme {
        guard let rawValue else { return .atelier }
        return VisualTheme(rawValue: rawValue) ?? .atelier
    }
}

private struct VisualThemeKey: EnvironmentKey {
    static let defaultValue: VisualTheme = .atelier
}

extension EnvironmentValues {
    var visualTheme: VisualTheme {
        get { self[VisualThemeKey.self] }
        set { self[VisualThemeKey.self] = newValue }
    }
}
