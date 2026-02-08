//
//  TactileShaderEffects.swift
//  angle-rfp
//
//  Runtime-safe tactile effects with Metal shader path and visual fallbacks.
//

import SwiftUI
import Metal
import Foundation

enum TactileShaderRenderingMode {
    case metal
    case fallback
}

enum TactileShaderRuntime {
    static let forceFallback: Bool = {
        let env = ProcessInfo.processInfo.environment["ANGLE_RFP_DISABLE_METAL_SHADERS"] == "1"
        let userDefault = UserDefaults.standard.bool(forKey: "disableMetalShaders")
        return env || userDefault
    }()

    static let supportsMetalShaders: Bool = {
        guard #available(macOS 14.0, *) else { return false }
        return MTLCreateSystemDefaultDevice() != nil
    }()

    static var renderingMode: TactileShaderRenderingMode {
        guard supportsMetalShaders, !forceFallback else {
            return .fallback
        }

        if shouldPreferFallbackForPower {
            return .fallback
        }

        return .metal
    }

    static var shouldUseMetalEffects: Bool {
        renderingMode == .metal
    }

    static var shouldPreferFallbackForPower: Bool {
        if #available(macOS 12.0, *), ProcessInfo.processInfo.isLowPowerModeEnabled {
            return true
        }

        switch ProcessInfo.processInfo.thermalState {
        case .serious, .critical:
            return true
        default:
            return false
        }
    }
}

private struct TactileGrainFallbackModifier: ViewModifier {
    let intensity: Double

    func body(content: Content) -> some View {
        content.overlay {
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [Color.white.opacity(0.7), Color.black.opacity(0.7)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .blendMode(.overlay)
                .opacity(max(0.01, intensity))
        }
    }
}

@available(macOS 14.0, *)
private struct MetalTactileGrainModifier: ViewModifier {
    let intensity: Double

    func body(content: Content) -> some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24.0, paused: false)) { timeline in
            let time = Float(timeline.date.timeIntervalSinceReferenceDate)

            content.colorEffect(
                ShaderLibrary.tactileGrain(
                    .float(Float(max(0.0, intensity))),
                    .float(time)
                )
            )
        }
    }
}

private struct GlassCausticFallbackModifier: ViewModifier {
    let enabled: Bool
    let strength: Double

    func body(content: Content) -> some View {
        if enabled {
            TimelineView(.animation(minimumInterval: 1.0 / 24.0, paused: false)) { timeline in
                content.overlay {
                    GeometryReader { proxy in
                        let cycle = timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 3.2) / 3.2
                        let travel = proxy.size.width * 1.4

                        LinearGradient(
                            colors: [
                                Color.clear,
                                Color.white.opacity(max(0.04, strength)),
                                Color.clear
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        .frame(width: proxy.size.width * 0.72)
                        .offset(x: (CGFloat(cycle) * travel) - (proxy.size.width * 0.7))
                        .blur(radius: 14)
                        .blendMode(.screen)
                    }
                    .allowsHitTesting(false)
                }
            }
        } else {
            content
        }
    }
}

@available(macOS 14.0, *)
private struct MetalGlassCausticModifier: ViewModifier {
    let enabled: Bool
    let strength: Double

    func body(content: Content) -> some View {
        if enabled {
            TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { timeline in
                let time = Float(timeline.date.timeIntervalSinceReferenceDate)

                content.colorEffect(
                    ShaderLibrary.glassCaustic(
                        .float(Float(max(0.0, strength))),
                        .float(time)
                    )
                )
            }
        } else {
            content
        }
    }
}

private struct AnalysisScanlineFallbackModifier: ViewModifier {
    let enabled: Bool
    let strength: Double
    let speed: Double

    func body(content: Content) -> some View {
        if enabled {
            TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { timeline in
                content.overlay {
                    Canvas { context, size in
                        let time = timeline.date.timeIntervalSinceReferenceDate * speed

                        for y in stride(from: CGFloat(0), through: size.height, by: 4) {
                            let alpha = (0.015 + (0.03 * (0.5 + 0.5 * sin((Double(y) * 0.42) + (time * 2.6))))) * strength
                            context.fill(
                                Path(CGRect(x: 0, y: y, width: size.width, height: 1)),
                                with: .color(.white.opacity(alpha))
                            )
                        }

                        let sweepProgress = time.truncatingRemainder(dividingBy: 2.0) / 2.0
                        let sweepY = (CGFloat(sweepProgress) * (size.height + 90)) - 45
                        let sweepRect = CGRect(x: 0, y: sweepY, width: size.width, height: 90)

                        context.fill(
                            Path(sweepRect),
                            with: .linearGradient(
                                Gradient(colors: [.clear, .white.opacity(0.18 * strength), .clear]),
                                startPoint: CGPoint(x: 0, y: sweepY),
                                endPoint: CGPoint(x: 0, y: sweepY + sweepRect.height)
                            )
                        )
                    }
                    .blendMode(.screen)
                    .allowsHitTesting(false)
                }
            }
        } else {
            content
        }
    }
}

@available(macOS 14.0, *)
private struct MetalAnalysisScanlineModifier: ViewModifier {
    let enabled: Bool
    let strength: Double
    let speed: Double

    func body(content: Content) -> some View {
        if enabled {
            TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { timeline in
                let time = Float(timeline.date.timeIntervalSinceReferenceDate)

                content.colorEffect(
                    ShaderLibrary.analysisScanline(
                        .float(Float(max(0.0, strength))),
                        .float(Float(max(0.1, speed))),
                        .float(time)
                    )
                )
            }
        } else {
            content
        }
    }
}

extension View {
    @ViewBuilder
    func tactileShaderGrain(intensity: Double = 0.02) -> some View {
        if TactileShaderRuntime.shouldUseMetalEffects {
            if #available(macOS 14.0, *) {
                modifier(MetalTactileGrainModifier(intensity: intensity))
            } else {
                modifier(TactileGrainFallbackModifier(intensity: intensity))
            }
        } else {
            modifier(TactileGrainFallbackModifier(intensity: intensity))
        }
    }

    @ViewBuilder
    func glassCaustic(enabled: Bool, strength: Double = 0.08) -> some View {
        if TactileShaderRuntime.shouldUseMetalEffects {
            if #available(macOS 14.0, *) {
                modifier(MetalGlassCausticModifier(enabled: enabled, strength: strength))
            } else {
                modifier(GlassCausticFallbackModifier(enabled: enabled, strength: strength))
            }
        } else {
            modifier(GlassCausticFallbackModifier(enabled: enabled, strength: strength))
        }
    }

    @ViewBuilder
    func analysisScanline(enabled: Bool, strength: Double = 0.2, speed: Double = 1.0) -> some View {
        if TactileShaderRuntime.shouldUseMetalEffects {
            if #available(macOS 14.0, *) {
                modifier(MetalAnalysisScanlineModifier(enabled: enabled, strength: strength, speed: speed))
            } else {
                modifier(AnalysisScanlineFallbackModifier(enabled: enabled, strength: strength, speed: speed))
            }
        } else {
            modifier(AnalysisScanlineFallbackModifier(enabled: enabled, strength: strength, speed: speed))
        }
    }
}
