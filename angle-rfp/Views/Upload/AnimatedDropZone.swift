//
//  AnimatedDropZone.swift
//  angle-rfp
//
//  Animated gradient orb drop zone.
//

import SwiftUI

struct AnimatedDropZone: View {
    @Binding var isDragging: Bool
    let onTap: () -> Void

    @State private var pulseScale: CGFloat = 1.0
    @State private var rotation: Double = 0

    var body: some View {
        Button(action: onTap) {
            ZStack {
                // Outer glow
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                DesignSystem.Palette.Accent.primary.opacity(isDragging ? 0.3 : 0.1),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 80,
                            endRadius: 200
                        )
                    )
                    .frame(width: 400, height: 400)
                    .scaleEffect(pulseScale)

                // Gradient orb
                Circle()
                    .fill(
                        AngularGradient(
                            colors: [
                                DesignSystem.Palette.Accent.primary.opacity(0.6),
                                DesignSystem.Palette.Accent.secondary.opacity(0.4),
                                DesignSystem.Palette.Accent.primary.opacity(0.2),
                                DesignSystem.Palette.Accent.secondary.opacity(0.5),
                                DesignSystem.Palette.Accent.primary.opacity(0.6)
                            ],
                            center: .center,
                            angle: .degrees(rotation)
                        )
                    )
                    .frame(width: 180, height: 180)
                    .blur(radius: 30)
                    .scaleEffect(isDragging ? 1.15 : 1.0)

                // Inner circle
                Circle()
                    .fill(DesignSystem.Palette.Background.elevated)
                    .frame(width: 160, height: 160)
                    .overlay(
                        Circle()
                            .stroke(
                                LinearGradient(
                                    colors: [
                                        Color.white.opacity(0.2),
                                        Color.white.opacity(0.05)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1
                            )
                    )
                    .shadow(color: Color.black.opacity(0.3), radius: 20, y: 10)

                // Content
                VStack(spacing: 12) {
                    Image(systemName: "arrow.down.doc")
                        .font(.system(size: 36, weight: .light))
                        .foregroundColor(isDragging ? DesignSystem.Palette.Accent.primary : DesignSystem.Palette.Text.secondary)

                    Text(isDragging ? "Release to upload" : "Drop files here")
                        .font(.custom("Urbanist", size: 14).weight(.medium))
                        .foregroundColor(DesignSystem.Palette.Text.secondary)
                }
            }
        }
        .buttonStyle(.plain)
        .onAppear {
            // Subtle pulse animation
            withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
                pulseScale = 1.05
            }
            // Slow rotation
            withAnimation(.linear(duration: 20).repeatForever(autoreverses: false)) {
                rotation = 360
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.7), value: isDragging)
    }
}

#if DEBUG
struct AnimatedDropZone_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 40) {
            AnimatedDropZone(isDragging: .constant(false), onTap: {})
            AnimatedDropZone(isDragging: .constant(true), onTap: {})
        }
        .padding(60)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
