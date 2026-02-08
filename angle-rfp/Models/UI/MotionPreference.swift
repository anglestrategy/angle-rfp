//
//  MotionPreference.swift
//  angle-rfp
//
//  Motion intensity preferences and environment wiring.
//

import SwiftUI
import AppKit

struct MotionPolicy {
    let allowsParallax: Bool
    let allowsPulse: Bool
    let micro: Animation
    let standard: Animation
    let emphasis: Animation
}

enum MotionPreference: String, CaseIterable, Codable, Identifiable {
    case full
    case balanced
    case reduced

    var id: String { rawValue }

    var title: String {
        switch self {
        case .full: return "Full"
        case .balanced: return "Balanced"
        case .reduced: return "Reduced"
        }
    }

    var summary: String {
        switch self {
        case .full: return "Max depth and motion"
        case .balanced: return "Expressive with guardrails"
        case .reduced: return "Minimal movement"
        }
    }

    var resolved: MotionPreference {
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? .reduced : self
    }

    var allowsParallax: Bool {
        resolved != .reduced
    }

    var allowsPulse: Bool {
        resolved != .reduced
    }

    var parallaxMultiplier: CGFloat {
        switch resolved {
        case .full:
            return 1.0
        case .balanced:
            return 0.55
        case .reduced:
            return 0
        }
    }

    var pulseMultiplier: Double {
        switch resolved {
        case .full:
            return 1.0
        case .balanced:
            return 0.7
        case .reduced:
            return 0
        }
    }

    var microAnimation: SwiftUI.Animation {
        resolved == .reduced ? .easeOut(duration: 0.16) : .easeOut(duration: 0.14)
    }

    var standardAnimation: SwiftUI.Animation {
        resolved == .reduced
            ? .easeOut(duration: 0.16)
            : .timingCurve(0.22, 1.0, 0.36, 1.0, duration: 0.24)
    }

    var emphasisAnimation: SwiftUI.Animation {
        resolved == .reduced
            ? .easeOut(duration: 0.16)
            : .spring(response: 0.44, dampingFraction: 0.78)
    }

    var policy: MotionPolicy {
        MotionPolicy(
            allowsParallax: allowsParallax,
            allowsPulse: allowsPulse,
            micro: microAnimation,
            standard: standardAnimation,
            emphasis: emphasisAnimation
        )
    }

    static func from(rawValue: String?) -> MotionPreference {
        guard let rawValue else { return .balanced }
        return MotionPreference(rawValue: rawValue) ?? .balanced
    }
}

private struct MotionPreferenceKey: EnvironmentKey {
    static let defaultValue: MotionPreference = .balanced
}

extension EnvironmentValues {
    var motionPreference: MotionPreference {
        get { self[MotionPreferenceKey.self] }
        set { self[MotionPreferenceKey.self] = newValue }
    }
}
