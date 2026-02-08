//
//  GlassStageDropZone.swift
//  angle-rfp
//
//  Large glass upload and analysis stage with tactile depth.
//

import SwiftUI

struct GlassStageDropZone: View {
    let queue: [UploadQueueItem]
    let isDropTargeted: Bool
    let isAnalyzing: Bool
    let stageLabel: String?
    let onBrowse: () -> Void
    let onRemove: (UploadQueueItem) -> Void
    let onRetry: (UploadQueueItem) -> Void
    let onBeginAnalysis: () -> Void
    var density: CGFloat = 1.0

    @Environment(\.motionPreference) private var motionPreference
    @State private var hoverLocation: CGPoint = .zero
    @State private var isHovering = false
    @State private var isPressed = false
    @State private var glowPulse = false

    private var readyItems: [UploadQueueItem] {
        queue.filter { $0.canAnalyzeNow }
    }

    private var rejectedItems: [UploadQueueItem] {
        queue.filter { $0.status == .rejected }
    }

    private func s(_ value: CGFloat, min: CGFloat? = nil) -> CGFloat {
        DesignSystem.Layout.scaled(value, by: density, min: min)
    }

    private var stageCornerRadius: CGFloat {
        s(DesignSystem.Radius.glassStage, min: 16)
    }

    private var glassCornerRadius: CGFloat {
        s(18, min: 12)
    }

    var body: some View {
        GeometryReader { geometry in
            let tilt = tiltValues(in: geometry.size)
            let hoverOffset = hoverOffset(in: geometry.size)
            let depthState = interactionState

            ZStack {
                chassisBackground(size: geometry.size)

                glassBlock
                    .padding(.horizontal, s(22, min: 14))
                    .padding(.vertical, s(24, min: 16))

                contentOverlay

                if isDropTargeted {
                    dropOverlay
                        .padding(.horizontal, s(22, min: 14))
                        .padding(.vertical, s(24, min: 16))
                }

                if isAnalyzing {
                    analyzingOverlay
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: stageCornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: stageCornerRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.25), lineWidth: 1.1)
            )
            .rotation3DEffect(.degrees(tilt.x), axis: (x: 1, y: 0, z: 0))
            .rotation3DEffect(.degrees(tilt.y), axis: (x: 0, y: 1, z: 0))
            .offset(x: hoverOffset.width, y: hoverOffset.height + (isDropTargeted ? -2 : 0))
            .scaleEffect(isDropTargeted ? 1.008 : 1)
            .tactileDepth(state: depthState, motionPreference: motionPreference)
            .animation(motionPreference.standardAnimation, value: depthState)
            .animation(motionPreference.standardAnimation, value: isDropTargeted)
            .onContinuousHover { phase in
                switch phase {
                case .active(let location):
                    hoverLocation = location
                    isHovering = true
                case .ended:
                    isHovering = false
                }
            }
            .onAppear {
                guard motionPreference.allowsPulse else { return }
                let pulseDuration = DesignSystem.Motion.glowPulseInterval / max(0.5, motionPreference.pulseMultiplier)
                withAnimation(.easeInOut(duration: pulseDuration).repeatForever(autoreverses: true)) {
                    glowPulse = true
                }
            }
            .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
                guard motionPreference.resolved != .reduced else { return }
                isPressed = pressing
            }, perform: {})
        }
    }

    private func chassisBackground(size: CGSize) -> some View {
        let coolGlowDiameter = max(size.width * 0.95, s(460, min: 380))
        let warmGlowDiameter = max(size.width * 0.85, s(420, min: 340))

        return ZStack {
            RoundedRectangle(cornerRadius: stageCornerRadius, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            DesignSystem.Palette.Charcoal.c700,
                            DesignSystem.Palette.Charcoal.c800,
                            DesignSystem.Palette.Charcoal.c900
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            RoundedRectangle(cornerRadius: stageCornerRadius, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color.white.opacity(0.04), Color.black.opacity(0.15)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .blendMode(.softLight)

            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color(hex: "#8AB6FF").opacity(0.25), Color.clear],
                        center: .center,
                        startRadius: 0,
                        endRadius: 440
                    )
                )
                .frame(width: coolGlowDiameter, height: coolGlowDiameter)
                .offset(x: -size.width * 0.2, y: size.height * 0.22)
                .blur(radius: 60)

            Circle()
                .fill(
                    RadialGradient(
                        colors: [DesignSystem.accent.opacity(glowPulse ? 0.34 : 0.2), Color.clear],
                        center: .center,
                        startRadius: 0,
                        endRadius: 420
                    )
                )
                .frame(width: warmGlowDiameter, height: warmGlowDiameter)
                .offset(x: size.width * 0.25, y: size.height * 0.25)
                .blur(radius: 68)
        }
    }

    private var glassBlock: some View {
        let innerCornerRadius = max(glassCornerRadius - s(2, min: 1), s(10, min: 8))

        return ZStack {
            RoundedRectangle(cornerRadius: glassCornerRadius, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(hex: "#EAF5FF").opacity(0.76),
                            Color(hex: "#D3E0F9").opacity(0.45),
                            Color(hex: "#FFD9C8").opacity(0.56)
                        ],
                        startPoint: .bottomLeading,
                        endPoint: .topTrailing
                    )
                )

            RoundedRectangle(cornerRadius: glassCornerRadius, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color.white.opacity(0.26), Color.clear, Color.black.opacity(0.14)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            RoundedRectangle(cornerRadius: glassCornerRadius, style: .continuous)
                .stroke(Color.white.opacity(0.76), lineWidth: 1.5)

            RoundedRectangle(cornerRadius: innerCornerRadius, style: .continuous)
                .stroke(Color.white.opacity(0.28), lineWidth: 1)
                .padding(s(6, min: 4))

            RoundedRectangle(cornerRadius: glassCornerRadius, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color.white.opacity(0.08), Color.black.opacity(0.08)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .tactileShaderGrain(intensity: 0.04)
                .blendMode(.overlay)
                .opacity(DesignSystem.Materials.grainOpacity)

            RoundedRectangle(cornerRadius: glassCornerRadius, style: .continuous)
                .fill(Color.white.opacity(0.045))
                .glassCaustic(
                    enabled: motionPreference.resolved != .reduced,
                    strength: isDropTargeted ? 0.16 : 0.09
                )
                .blendMode(.plusLighter)
                .opacity(0.75)
        }
        .shadow(color: Color(hex: "#8AB6FF").opacity(0.4), radius: 24, x: -6, y: 10)
        .shadow(color: DesignSystem.accent.opacity(0.35), radius: 26, x: 8, y: 12)
        .tactileRimLight(cornerRadius: glassCornerRadius, intensity: isDropTargeted ? 1.15 : 0.95)
    }

    private var contentOverlay: some View {
        VStack(alignment: .leading, spacing: s(16, min: 10)) {
            HStack(spacing: 10) {
                Text("UPLOAD STAGE")
                    .font(.custom("Urbanist", size: s(11, min: 9)).weight(.bold))
                    .tracking(2)
                    .foregroundColor(DesignSystem.textSecondary)

                if !rejectedItems.isEmpty {
                    Text("\(rejectedItems.count) warning\(rejectedItems.count == 1 ? "" : "s")")
                        .font(.custom("Urbanist", size: s(10, min: 9)).weight(.bold))
                        .foregroundColor(DesignSystem.warning)
                        .padding(.horizontal, s(8, min: 6))
                        .padding(.vertical, s(4, min: 3))
                        .background(Capsule().fill(DesignSystem.warning.opacity(0.16)))
                }

                Spacer()

                browseButton
            }
            .padding(.horizontal, s(36, min: 20))
            .padding(.top, s(28, min: 18))

            Spacer()

            if queue.isEmpty {
                idleContent
            } else {
                queueContent
            }

            footerActionRow
                .padding(.horizontal, s(36, min: 20))
                .padding(.bottom, s(26, min: 16))
        }
    }

    private var idleContent: some View {
        VStack(spacing: 12) {
            Image(systemName: "square.and.arrow.down")
                .font(.system(size: s(38, min: 26), weight: .light))
                .foregroundColor(DesignSystem.Palette.Charcoal.c900.opacity(0.7))

            Text("Drop files to start RFP analysis")
                .font(.custom("Urbanist", size: s(30, min: 22)).weight(.black))
                .foregroundColor(DesignSystem.Palette.Charcoal.c900.opacity(0.9))

            Text("PDF, DOCX, TXT, or folders")
                .font(.custom("Urbanist", size: s(14, min: 12)).weight(.semibold))
                .foregroundColor(DesignSystem.Palette.Charcoal.c900.opacity(0.65))

            HStack(spacing: s(8, min: 6)) {
                formatPill("PDF")
                formatPill("DOCX")
                formatPill("TXT")
                formatPill("FOLDER")
            }
            .padding(.top, s(4, min: 2))
        }
        .frame(maxWidth: .infinity)
    }

    private func formatPill(_ title: String) -> some View {
        Text(title)
            .font(.custom("Urbanist", size: s(10, min: 9)).weight(.bold))
            .tracking(1.1)
            .foregroundColor(DesignSystem.Palette.Charcoal.c900.opacity(0.72))
            .padding(.horizontal, s(8, min: 6))
            .padding(.vertical, s(5, min: 4))
            .background(
                Capsule(style: .continuous)
                    .fill(Color.white.opacity(0.4))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(Color.white.opacity(0.65), lineWidth: 1)
                    )
            )
    }

    private var queueContent: some View {
        VStack(alignment: .leading, spacing: 10) {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 8) {
                    ForEach(queue) { item in
                        queueChip(item)
                    }
                }
                .padding(.horizontal, 2)
            }
            .frame(maxHeight: s(170, min: 120))
        }
        .padding(.horizontal, s(34, min: 18))
    }

    private func queueChip(_ item: UploadQueueItem) -> some View {
        HStack(spacing: 10) {
            Circle()
                .fill(statusColor(for: item.status))
                .frame(width: 8, height: 8)

            Text(item.filename)
                .font(.custom("Urbanist", size: s(13, min: 11)).weight(.semibold))
                .foregroundColor(DesignSystem.Palette.Charcoal.c900.opacity(0.88))
                .lineLimit(1)

            Text(item.typeLabel)
                .font(.custom("Urbanist", size: s(10, min: 9)).weight(.bold))
                .tracking(0.8)
                .foregroundColor(DesignSystem.Palette.Charcoal.c900.opacity(0.64))

            if item.status == .rejected {
                Button(action: { onRetry(item) }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(DesignSystem.warning)
                }
                .buttonStyle(.plain)
            }

            Spacer(minLength: 4)

            Button(action: { onRemove(item) }) {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(DesignSystem.Palette.Charcoal.c900.opacity(0.6))
                    .frame(width: 18, height: 18)
                    .background(Circle().fill(Color.black.opacity(0.08)))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, s(12, min: 8))
        .padding(.vertical, s(8, min: 6))
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.white.opacity(0.5))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Color.white.opacity(0.7), lineWidth: 1)
                )
        )
    }

    private var footerActionRow: some View {
        HStack(spacing: 10) {
            Text(readyItems.isEmpty ? "No analyzable files yet" : "\(readyItems.count) file\(readyItems.count == 1 ? "" : "s") ready")
                .font(.custom("Urbanist", size: s(12, min: 10)).weight(.semibold))
                .foregroundColor(DesignSystem.textSecondary)

            Spacer()

            Button(action: onBeginAnalysis) {
                HStack(spacing: 8) {
                    Text("Begin Analysis")
                        .font(.custom("Urbanist", size: s(14, min: 12)).weight(.bold))
                    Image(systemName: "arrow.right")
                        .font(.system(size: s(11, min: 10), weight: .bold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, s(16, min: 12))
                .padding(.vertical, s(10, min: 8))
                .background(
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [DesignSystem.accentHover, DesignSystem.accentPressed],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                )
                .shadow(color: DesignSystem.accent.opacity(0.35), radius: 12, x: 0, y: 7)
            }
            .buttonStyle(.plain)
            .disabled(readyItems.isEmpty || isAnalyzing)
            .opacity(readyItems.isEmpty || isAnalyzing ? 0.45 : 1)
        }
    }

    private var browseButton: some View {
        Button(action: onBrowse) {
            Text("Browse")
                .font(.custom("Urbanist", size: s(11, min: 9)).weight(.bold))
                .tracking(1.2)
                .foregroundColor(DesignSystem.textPrimary)
                .padding(.horizontal, s(12, min: 9))
                .padding(.vertical, s(7, min: 5))
                .background(
                    Capsule(style: .continuous)
                        .fill(DesignSystem.Palette.Charcoal.c900.opacity(0.56))
                        .overlay(
                            Capsule(style: .continuous)
                                .stroke(Color.white.opacity(0.22), lineWidth: 1)
                        )
                )
        }
        .buttonStyle(.plain)
    }

    private var dropOverlay: some View {
        RoundedRectangle(cornerRadius: s(18, min: 12), style: .continuous)
            .fill(DesignSystem.accent.opacity(0.12))
            .overlay(
                RoundedRectangle(cornerRadius: s(18, min: 12), style: .continuous)
                    .stroke(DesignSystem.accent.opacity(0.92), style: StrokeStyle(lineWidth: 3, dash: [8, 5]))
            )
            .overlay {
                VStack(spacing: 10) {
                    Image(systemName: "arrow.down.circle.fill")
                        .font(.system(size: s(40, min: 28), weight: .light))
                        .foregroundColor(DesignSystem.accent)
                    Text("Release to queue files")
                        .font(.custom("Urbanist", size: s(20, min: 15)).weight(.black))
                        .foregroundColor(DesignSystem.textPrimary)
                }
            }
            .transition(.opacity)
    }

    private var analyzingOverlay: some View {
        ZStack {
            RoundedRectangle(cornerRadius: stageCornerRadius, style: .continuous)
                .fill(Color.black.opacity(0.2))
                .analysisScanline(
                    enabled: motionPreference.resolved != .reduced,
                    strength: motionPreference.resolved == .full ? 0.24 : 0.16,
                    speed: 1.0
                )

            VStack(spacing: 8) {
                Text(stageLabel ?? "Analyzing")
                    .font(.custom("Urbanist", size: s(28, min: 20)).weight(.black))
                    .foregroundColor(.white)

                Text("Processing queued files")
                    .font(.custom("Urbanist", size: s(13, min: 11)).weight(.semibold))
                    .foregroundColor(Color.white.opacity(0.8))
            }
        }
        .allowsHitTesting(false)
    }

    private func tiltValues(in size: CGSize) -> (x: Double, y: Double) {
        guard motionPreference.allowsParallax,
              isHovering,
              size.width > 1,
              size.height > 1 else {
            return (0, 0)
        }

        let nx = ((hoverLocation.x / size.width) - 0.5)
        let ny = ((hoverLocation.y / size.height) - 0.5)

        let maxTilt = DesignSystem.Motion.hoverTiltDegrees * Double(motionPreference.parallaxMultiplier)
        return (-Double(ny) * maxTilt, Double(nx) * maxTilt)
    }

    private func hoverOffset(in size: CGSize) -> CGSize {
        guard motionPreference.allowsParallax,
              isHovering,
              size.width > 1,
              size.height > 1 else {
            return .zero
        }

        let nx = ((hoverLocation.x / size.width) - 0.5)
        let ny = ((hoverLocation.y / size.height) - 0.5)
        let maxOffset = DesignSystem.Motion.hoverParallax * motionPreference.parallaxMultiplier

        return CGSize(width: nx * maxOffset, height: ny * maxOffset)
    }

    private var interactionState: TactileInteractionState {
        if isPressed {
            return .pressed
        }
        if isDropTargeted || (isHovering && motionPreference.allowsParallax) {
            return .hover
        }
        return .rest
    }

    private func statusColor(for status: UploadStatus) -> Color {
        switch status {
        case .queued, .validating: return DesignSystem.accent
        case .ready: return DesignSystem.success
        case .rejected: return DesignSystem.warning
        }
    }

}
