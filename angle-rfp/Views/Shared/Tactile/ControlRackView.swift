//
//  ControlRackView.swift
//  angle-rfp
//
//  Hardware-inspired left control rack.
//

import SwiftUI

struct ControlRackView: View {
    let modeTitle: String
    let modeSubtitle: String
    let modules: [ProcessModuleCardState]
    var modeColor: Color = DesignSystem.accent
    var density: CGFloat = 1.0

    @Environment(\.motionPreference) private var motionPreference
    @State private var pulse = false

    var body: some View {
        GeometryReader { proxy in
            let resolvedDensity = resolvedDensity(for: proxy.size)
            let shellRadius = s(DesignSystem.Radius.appShell, resolvedDensity, min: 14, max: 22)

            ZStack {
                RoundedRectangle(cornerRadius: shellRadius, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [DesignSystem.Palette.Charcoal.c700, DesignSystem.Palette.Charcoal.c900],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: shellRadius, style: .continuous)
                            .stroke(Color.black.opacity(0.08), lineWidth: 1)
                    )
                    .shadow(
                        color: .black.opacity(0.45),
                        radius: s(30, resolvedDensity, min: 18, max: 34),
                        x: 0,
                        y: s(18, resolvedDensity, min: 12, max: 22)
                    )

                VStack(spacing: s(10, resolvedDensity, min: 6, max: 14)) {
                    identityStrip(density: resolvedDensity)

                    topModuleSurface(density: resolvedDensity)

                    stageKeyStrip(density: resolvedDensity)

                    processStatusStack(density: resolvedDensity)

                    bottomModuleSurface(density: resolvedDensity)

                    bottomRail(density: resolvedDensity)
                }
                .padding(s(12, resolvedDensity, min: 8, max: 16))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
        }
        .onAppear {
            guard motionPreference.allowsPulse else { return }
            let pulseDuration = DesignSystem.Motion.glowPulseInterval / max(0.5, motionPreference.pulseMultiplier)
            withAnimation(.easeInOut(duration: pulseDuration).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
    }

    private func identityStrip(density: CGFloat) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Circle()
                .fill(modeColor)
                .frame(
                    width: s(8, density, min: 6, max: 10),
                    height: s(8, density, min: 6, max: 10)
                )
                .shadow(
                    color: modeColor.opacity(pulse ? 0.6 : 0.25),
                    radius: pulse ? s(10, density, min: 6, max: 12) : s(4, density, min: 2, max: 6),
                    x: 0,
                    y: 0
                )

            VStack(alignment: .leading, spacing: 2) {
                Text("RFP Analysis Tool")
                    .font(.custom("Urbanist", size: s(11, density, min: 9, max: 13)).weight(.bold))
                    .foregroundColor(DesignSystem.textPrimary)

                Text(modeSubtitle)
                    .font(.custom("Urbanist", size: s(10, density, min: 8, max: 12)).weight(.medium))
                    .foregroundColor(DesignSystem.Gray.g500)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            Text(modeTitle.uppercased())
                .font(.custom("Urbanist", size: s(9, density, min: 8, max: 11)).weight(.bold))
                .tracking(s(1, density, min: 0.7, max: 1.5))
                .foregroundColor(modeColor)
                .padding(.horizontal, s(8, density, min: 6, max: 10))
                .padding(.vertical, s(4, density, min: 3, max: 6))
                .background(
                    Capsule(style: .continuous)
                        .fill(modeColor.opacity(0.16))
                )
        }
        .padding(.horizontal, s(8, density, min: 6, max: 10))
        .padding(.vertical, s(6, density, min: 4, max: 8))
    }

    private func topModuleSurface(density: CGFloat) -> some View {
        HStack(spacing: s(10, density, min: 6, max: 14)) {
            knobCluster(
                knobs: Array(modules.prefix(4)),
                baseTone: .charcoal,
                knobTone: .cream,
                density: density
            )

            accentColumn(density: density)
        }
    }

    private func stageKeyStrip(density: CGFloat) -> some View {
        HStack(spacing: s(8, density, min: 5, max: 10)) {
            ForEach(Array(modules.prefix(3).enumerated()), id: \.offset) { _, module in
                rackKey(label: module.title, status: module.state, density: density)
            }
        }
    }

    private func processStatusStack(density: CGFloat) -> some View {
        TactilePanel(
            tone: .charcoal,
            cornerRadius: s(12, density, min: 8, max: 15),
            contentPadding: s(8, density, min: 6, max: 10),
            interactive: false
        ) {
            VStack(alignment: .leading, spacing: s(7, density, min: 5, max: 9)) {
                HStack(alignment: .center) {
                    Text("PROCESS")
                        .font(.custom("Urbanist", size: s(9, density, min: 8, max: 11)).weight(.bold))
                        .tracking(s(1.5, density, min: 0.9, max: 1.8))
                        .foregroundColor(DesignSystem.Gray.g500)

                    Spacer(minLength: 0)

                    Text("\(modules.filter { $0.state == .complete || $0.state == .active }.count)/\(ProcessModule.allCases.count)")
                        .font(.system(size: s(10, density, min: 8, max: 12), weight: .bold, design: .monospaced))
                        .foregroundColor(DesignSystem.textSecondary)
                }
                .padding(.horizontal, s(2, density, min: 1, max: 3))

                VStack(spacing: s(6, density, min: 4, max: 8)) {
                    ForEach(modules) { module in
                        ProcessModuleCard(
                            state: module,
                            compact: true,
                            density: density
                        )
                    }
                }
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: s(12, density, min: 8, max: 15), style: .continuous)
                .stroke(Color.black.opacity(0.06), lineWidth: 1)
        )
    }

    private func bottomModuleSurface(density: CGFloat) -> some View {
        HStack(spacing: s(10, density, min: 6, max: 14)) {
            knobCluster(
                knobs: Array(modules.suffix(4)),
                baseTone: .charcoal,
                knobTone: .vermillion,
                density: density
            )

            meterColumn(density: density)
        }
    }

    private func bottomRail(density: CGFloat) -> some View {
        HStack(spacing: s(6, density, min: 4, max: 8)) {
            ForEach(["PDF", "DOCX", "TXT", "FOLDER"], id: \.self) { format in
                Text(format)
                    .font(.custom("Urbanist", size: s(8, density, min: 7, max: 9)).weight(.bold))
                    .tracking(s(1, density, min: 0.6, max: 1.2))
                    .foregroundColor(DesignSystem.Gray.g500)
                    .padding(.horizontal, s(6, density, min: 4, max: 8))
                    .padding(.vertical, s(5, density, min: 3, max: 6))
                    .background(
                        RoundedRectangle(cornerRadius: s(6, density, min: 4, max: 8), style: .continuous)
                            .fill(DesignSystem.Palette.Charcoal.c800)
                            .overlay(
                                RoundedRectangle(cornerRadius: s(6, density, min: 4, max: 8), style: .continuous)
                                    .stroke(Color.black.opacity(0.06), lineWidth: 1)
                            )
                    )
            }

            Spacer(minLength: 0)

            Circle()
                .fill(DesignSystem.success)
                .frame(width: s(6, density, min: 5, max: 8), height: s(6, density, min: 5, max: 8))

            Text("Private")
                .font(.custom("Urbanist", size: s(9, density, min: 8, max: 11)).weight(.semibold))
                .foregroundColor(DesignSystem.Gray.g500)
        }
        .padding(.top, s(4, density, min: 2, max: 5))
    }

    private func accentColumn(density: CGFloat) -> some View {
        VStack(spacing: s(8, density, min: 5, max: 10)) {
            ForEach(Array(modules.prefix(3).enumerated()), id: \.offset) { _, module in
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                statusColor(for: module.state).opacity(0.95),
                                statusColor(for: module.state).opacity(0.7)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: s(52, density, min: 38, max: 56))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(Color.black.opacity(0.22), lineWidth: 1)
                    )
                    .overlay(alignment: .bottom) {
                        Capsule()
                            .fill(Color.black.opacity(0.2))
                            .frame(width: s(20, density, min: 14, max: 22), height: s(2, density, min: 1, max: 3))
                            .padding(.bottom, s(6, density, min: 4, max: 8))
                    }
            }
        }
        .padding(s(8, density, min: 6, max: 10))
        .background(
            RoundedRectangle(cornerRadius: s(12, density, min: 8, max: 14), style: .continuous)
                .fill(DesignSystem.Palette.Charcoal.c800)
                .overlay(
                    RoundedRectangle(cornerRadius: s(12, density, min: 8, max: 14), style: .continuous)
                        .stroke(Color.black.opacity(0.06), lineWidth: 1)
                )
        )
    }

    private func meterColumn(density: CGFloat) -> some View {
        VStack(spacing: s(8, density, min: 5, max: 10)) {
            HStack(spacing: s(6, density, min: 4, max: 8)) {
                meterTrack(level: meterLevel(at: 0), color: DesignSystem.Palette.Cream.elevated, density: density)
                meterTrack(level: meterLevel(at: 1), color: DesignSystem.accent, density: density)
                meterTrack(level: meterLevel(at: 2), color: DesignSystem.accentHover, density: density)
            }

            HStack(spacing: s(4, density, min: 2, max: 5)) {
                ForEach(0..<18, id: \.self) { index in
                    Circle()
                        .fill(dotColor(for: index))
                        .frame(width: s(3, density, min: 2, max: 4), height: s(3, density, min: 2, max: 4))
                }
            }
            .frame(maxWidth: .infinity)

            HStack(spacing: s(6, density, min: 4, max: 8)) {
                ForEach(Array(modules.prefix(3).enumerated()), id: \.offset) { _, module in
                    Rectangle()
                        .fill(statusColor(for: module.state).opacity(0.85))
                        .frame(height: s(3, density, min: 2, max: 4))
                }
            }
        }
        .padding(s(10, density, min: 7, max: 12))
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: s(12, density, min: 8, max: 14), style: .continuous)
                .fill(DesignSystem.Palette.Charcoal.c800)
                .overlay(
                    RoundedRectangle(cornerRadius: s(12, density, min: 8, max: 14), style: .continuous)
                        .stroke(Color.black.opacity(0.08), lineWidth: 1)
                )
        )
    }

    private func knobCluster(
        knobs: [ProcessModuleCardState],
        baseTone: TactileTone,
        knobTone: TactileTone,
        density: CGFloat
    ) -> some View {
        VStack(spacing: s(8, density, min: 5, max: 10)) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: s(8, density, min: 5, max: 10)) {
                ForEach(Array(knobs.enumerated()), id: \.offset) { _, module in
                    knobView(status: module.state, knobTone: knobTone, density: density)
                }
            }
            .padding(s(6, density, min: 4, max: 8))

            HStack(spacing: s(6, density, min: 4, max: 8)) {
                ForEach(knobs.prefix(3), id: \.id) { module in
                    Text(module.title.prefix(2).uppercased())
                        .font(.custom("Urbanist", size: s(8, density, min: 7, max: 9)).weight(.bold))
                        .tracking(s(0.8, density, min: 0.4, max: 1.1))
                        .foregroundColor(DesignSystem.Gray.g500)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, s(4, density, min: 3, max: 5))
        }
        .padding(s(8, density, min: 6, max: 10))
        .frame(maxWidth: .infinity)
        .background(
            TactilePanel(tone: baseTone, cornerRadius: s(12, density, min: 8, max: 14), contentPadding: 0, interactive: false) {
                Color.clear
            }
        )
        .overlay(
            RoundedRectangle(cornerRadius: s(12, density, min: 8, max: 14), style: .continuous)
                .stroke(Color.black.opacity(0.06), lineWidth: 1)
        )
    }

    private func knobView(status: ProcessModuleState, knobTone: TactileTone, density: CGFloat) -> some View {
        ZStack {
            Circle()
                .fill(DesignSystem.Palette.Charcoal.c900.opacity(0.55))
                .frame(
                    width: s(44, density, min: 32, max: 48),
                    height: s(44, density, min: 32, max: 48)
                )

            Circle()
                .fill(knobFill(for: knobTone))
                .frame(
                    width: s(28, density, min: 20, max: 30),
                    height: s(28, density, min: 20, max: 30)
                )
                .overlay(
                    Circle()
                        .stroke(Color.black.opacity(0.25), lineWidth: 1)
                )
                .offset(x: -1, y: -1)
                .shadow(
                    color: .black.opacity(0.5),
                    radius: s(6, density, min: 4, max: 8),
                    x: s(3, density, min: 2, max: 4),
                    y: s(7, density, min: 4, max: 9)
                )

            Rectangle()
                .fill(statusColor(for: status).opacity(0.9))
                .frame(
                    width: s(2, density, min: 1, max: 2),
                    height: s(8, density, min: 5, max: 10)
                )
                .offset(y: -s(10, density, min: 7, max: 12))
                .rotationEffect(.degrees(pointerRotation(for: status)))
        }
        .frame(height: s(46, density, min: 34, max: 52))
    }

    private func meterTrack(level: CGFloat, color: Color, density: CGFloat) -> some View {
        let trackHeight = s(78, density, min: 56, max: 84)
        let trackWidth = s(8, density, min: 6, max: 10)

        return ZStack(alignment: .bottom) {
            Capsule()
                .fill(Color.black.opacity(0.06))
                .frame(width: trackWidth, height: trackHeight)

            Capsule()
                .fill(color)
                .frame(width: trackWidth, height: max(s(14, density, min: 10, max: 16), trackHeight * level))
                .shadow(color: color.opacity(0.35), radius: s(5, density, min: 3, max: 6), x: 0, y: s(2, density, min: 1, max: 3))
        }
    }

    private func rackKey(label: String, status: ProcessModuleState, density: CGFloat) -> some View {
        Button(action: {}) {
            VStack(spacing: s(4, density, min: 2, max: 5)) {
                Rectangle()
                    .fill(Color.black.opacity(0.6))
                    .frame(width: s(16, density, min: 11, max: 18), height: s(2, density, min: 1, max: 3))

                Text(String(label.prefix(3)).uppercased())
                    .font(.custom("Urbanist", size: s(8, density, min: 7, max: 9)).weight(.bold))
                    .tracking(s(0.8, density, min: 0.4, max: 1))
                    .foregroundColor(DesignSystem.Palette.Charcoal.c900.opacity(0.8))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, s(10, density, min: 7, max: 12))
            .background(
                RoundedRectangle(cornerRadius: s(7, density, min: 5, max: 9), style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                keyBaseColor(for: status),
                                keyBaseColor(for: status).opacity(0.88)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: s(7, density, min: 5, max: 9), style: .continuous)
                    .stroke(Color.black.opacity(0.22), lineWidth: 1)
            )
            .shadow(
                color: .black.opacity(0.34),
                radius: s(4, density, min: 2, max: 6),
                x: 0,
                y: s(4, density, min: 2, max: 6)
            )
        }
        .buttonStyle(.plain)
    }

    private func resolvedDensity(for size: CGSize) -> CGFloat {
        let widthScale = size.width / DesignSystem.Layout.rackWidth
        let heightScale = size.height / 760
        let adaptiveScale = min(widthScale, heightScale)
        return DesignSystem.Layout.clamp(min(density, adaptiveScale), min: 0.72, max: 1.12)
    }

    private func s(_ value: CGFloat, _ density: CGFloat, min: CGFloat? = nil, max: CGFloat? = nil) -> CGFloat {
        DesignSystem.Layout.scaled(value, by: density, min: min, max: max)
    }

    private func pointerRotation(for status: ProcessModuleState) -> Double {
        switch status {
        case .idle: return -70
        case .active: return 25
        case .complete: return 65
        case .warning: return -15
        }
    }

    private func meterLevel(at index: Int) -> CGFloat {
        guard !modules.isEmpty else { return 0.2 }
        let activeIndex = modules.firstIndex(where: { $0.state == .active }) ?? 0

        if index < activeIndex {
            return 0.82
        }

        if index == activeIndex {
            return pulse ? 0.75 : 0.62
        }

        return 0.25
    }

    private func dotColor(for index: Int) -> Color {
        let activeCount = modules.filter { $0.state == .complete || $0.state == .active }.count
        if index < activeCount * 3 {
            return DesignSystem.success.opacity(0.85)
        }
        return DesignSystem.Gray.g300
    }

    private func knobFill(for tone: TactileTone) -> Color {
        switch tone {
        case .cream:
            return DesignSystem.Palette.Cream.elevated
        case .vermillion:
            return DesignSystem.accentHover
        case .creamElevated:
            return DesignSystem.Palette.Cream.elevated
        case .charcoal:
            return DesignSystem.Palette.Charcoal.c700
        case .glass:
            return DesignSystem.Palette.Cream.elevated.opacity(0.6)
        }
    }

    private func keyBaseColor(for status: ProcessModuleState) -> Color {
        switch status {
        case .idle: return DesignSystem.Palette.Cream.base
        case .active: return DesignSystem.Palette.Cream.elevated
        case .complete: return DesignSystem.Palette.Cream.elevated
        case .warning: return DesignSystem.Palette.Cream.base
        }
    }

    private func statusColor(for status: ProcessModuleState) -> Color {
        switch status {
        case .idle: return DesignSystem.Gray.g400
        case .active: return DesignSystem.accent
        case .complete: return DesignSystem.success
        case .warning: return DesignSystem.warning
        }
    }
}

enum ProcessModuleMapper {
    static func modulesForUpload(queue: [UploadQueueItem]) -> [ProcessModuleCardState] {
        let hasReady = queue.contains(where: { $0.canAnalyzeNow })
        let hasRejected = queue.contains(where: { $0.status == .rejected })

        return ProcessModule.allCases.map { module in
            let state: ProcessModuleState
            if module == .ingest {
                if hasRejected {
                    state = .warning
                } else if hasReady {
                    state = .active
                } else {
                    state = .idle
                }
            } else {
                state = .idle
            }

            return ProcessModuleCardState(module: module, state: state)
        }
    }

    static func modulesForAnalysis(stage: AnalysisStage, warningCount: Int = 0) -> [ProcessModuleCardState] {
        ProcessModule.allCases.map { module in
            var state = moduleState(for: module, analysisStage: stage)
            if warningCount > 0, stage == .parsing, module == .ingest {
                state = .warning
            }
            return ProcessModuleCardState(module: module, state: state)
        }
    }

    static var modulesForResults: [ProcessModuleCardState] {
        ProcessModule.allCases.map { module in
            ProcessModuleCardState(module: module, state: .complete)
        }
    }

    static func moduleState(for module: ProcessModule, analysisStage: AnalysisStage?) -> ProcessModuleState {
        guard let analysisStage else {
            return .idle
        }

        if analysisStage == .complete {
            return .complete
        }

        guard let activeModule = activeModule(for: analysisStage),
              let activeIndex = ProcessModule.allCases.firstIndex(of: activeModule),
              let moduleIndex = ProcessModule.allCases.firstIndex(of: module) else {
            return .idle
        }

        if moduleIndex < activeIndex {
            return .complete
        }

        if moduleIndex == activeIndex {
            return .active
        }

        return .idle
    }

    private static func activeModule(for stage: AnalysisStage) -> ProcessModule? {
        switch stage {
        case .parsing:
            return .ingest
        case .extracting, .scopeAnalyzing:
            return .parse
        case .researching:
            return .criteria
        case .scoring:
            return .score
        case .rendering, .exporting, .complete:
            return .synthesize
        }
    }
}

func moduleState(for module: ProcessModule, analysisStage: AnalysisStage?) -> ProcessModuleState {
    ProcessModuleMapper.moduleState(for: module, analysisStage: analysisStage)
}
