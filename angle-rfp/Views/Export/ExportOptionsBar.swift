//
//  ExportOptionsBar.swift
//  angle-rfp
//
//  Typography-driven floating export bar with cinematic reveal.
//  Dramatic hover states with accent glow effects.
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import SwiftUI

struct ExportOptionsBar: View {
    let onExport: (ExportType) -> Void
    let onNewAnalysis: () -> Void

    @State private var isVisible = false
    @State private var hoveredType: ExportType?
    @State private var loadingType: ExportType?
    @State private var completedType: ExportType?
    @State private var glowPulse = false

    var body: some View {
        HStack(spacing: 0) {
            // Section label
            HStack(spacing: 12) {
                Circle()
                    .fill(DesignSystem.accent)
                    .frame(width: 6, height: 6)
                    .scaleEffect(glowPulse ? 1.2 : 1.0)
                    .shadow(color: DesignSystem.accent.opacity(0.6), radius: glowPulse ? 6 : 3, x: 0, y: 0)

                Text("EXPORT")
                    .font(.custom("Urbanist", size: 11).weight(.bold))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .tracking(3)
            }

            // Gradient separator
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [DesignSystem.Gray.g300.opacity(0.5), Color.clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(width: 40, height: 1)
                .padding(.horizontal, 20)

            // Export options - dramatic typography
            HStack(spacing: 40) {
                ForEach(ExportType.allCases, id: \.self) { type in
                    ExportOption(
                        type: type,
                        isHovered: hoveredType == type,
                        isLoading: loadingType == type,
                        isCompleted: completedType == type,
                        action: { triggerExport(type) }
                    )
                    .onHover { hovering in
                        withAnimation(.easeOut(duration: 0.15)) {
                            hoveredType = hovering ? type : nil
                        }
                    }
                }
            }

            Spacer()

            // New analysis - accent CTA
            Button(action: onNewAnalysis) {
                HStack(spacing: 10) {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .bold))

                    Text("New Analysis")
                        .font(.custom("Urbanist", size: 15).weight(.bold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 28)
                .padding(.vertical, 14)
                .background(
                    Capsule()
                        .fill(DesignSystem.accent)
                        .shadow(color: DesignSystem.accent.opacity(0.5), radius: 20, x: 0, y: 8)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 60)
        .padding(.vertical, 24)
        .background(
            // Editorial dark bar with subtle top glow
            ZStack {
                Rectangle()
                    .fill(DesignSystem.background.opacity(0.95))

                // Top edge glow
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [DesignSystem.accent.opacity(0.2), Color.clear],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: 1)
                    .frame(maxHeight: .infinity, alignment: .top)
            }
            .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: -10)
        )
        .offset(y: isVisible ? 0 : 100)
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8).delay(0.8)) {
                isVisible = true
            }
            startGlowAnimation()
        }
    }

    private func triggerExport(_ type: ExportType) {
        guard loadingType == nil else { return }

        loadingType = type

        // Simulate export
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            loadingType = nil
            completedType = type
            onExport(type)

            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                if completedType == type {
                    completedType = nil
                }
            }
        }
    }

    private func startGlowAnimation() {
        withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
            glowPulse = true
        }
    }
}

// MARK: - Export Option

private struct ExportOption: View {
    let type: ExportType
    let isHovered: Bool
    let isLoading: Bool
    let isCompleted: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                // Icon with state
                ZStack {
                    if isLoading {
                        ProgressView()
                            .scaleEffect(0.7)
                            .tint(DesignSystem.accent)
                    } else if isCompleted {
                        Image(systemName: "checkmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(DesignSystem.success)
                    } else {
                        Image(systemName: type.icon)
                            .font(.system(size: 16, weight: isHovered ? .semibold : .medium))
                            .foregroundColor(isHovered ? DesignSystem.accent : DesignSystem.Gray.g400)
                    }
                }
                .frame(width: 24, height: 24)

                // Label
                Text(type.rawValue)
                    .font(.custom("Urbanist", size: 13).weight(isHovered ? .bold : .medium))
                    .foregroundColor(
                        isCompleted ? DesignSystem.success :
                        isHovered ? DesignSystem.textPrimary : DesignSystem.textTertiary
                    )
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(isHovered ? DesignSystem.accent.opacity(0.1) : Color.clear)
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .scaleEffect(isHovered ? 1.05 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isHovered)
    }
}

// MARK: - Standalone Export Menu

struct ExportMenu: View {
    let onExport: (ExportType) -> Void
    @State private var isHovered = false

    var body: some View {
        Menu {
            ForEach(ExportType.allCases, id: \.self) { type in
                Button(action: { onExport(type) }) {
                    Label(type.rawValue, systemImage: type.icon)
                }
            }
        } label: {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(isHovered ? DesignSystem.textPrimary : DesignSystem.textTertiary)
                .padding(8)
                .background(
                    Circle()
                        .fill(isHovered ? DesignSystem.Gray.g200 : Color.clear)
                )
        }
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
struct ExportOptionsBar_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            DesignSystem.background
                .ignoresSafeArea()

            VStack {
                Spacer()

                ExportOptionsBar(
                    onExport: { type in print("Export: \(type.rawValue)") },
                    onNewAnalysis: { print("New analysis") }
                )
            }
        }
        .frame(width: 1200, height: 400)
    }
}
#endif
