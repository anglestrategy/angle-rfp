//
//  AnalysisProgressView.swift
//  angle-rfp
//
//  Clean, minimal analysis view with live data extraction preview.
//

import SwiftUI

enum AnalysisStage: Int, CaseIterable {
    case parsing = 0
    case extracting = 1
    case scopeAnalyzing = 2
    case researching = 3
    case scoring = 4
    case rendering = 5
    case exporting = 6
    case complete = 7

    var title: String {
        switch self {
        case .parsing: return "Parsing"
        case .extracting: return "Extraction"
        case .scopeAnalyzing: return "Scope"
        case .researching: return "Researching"
        case .scoring: return "Scoring"
        case .rendering: return "Rendering"
        case .exporting: return "Exporting"
        case .complete: return "Complete"
        }
    }

    var description: String {
        switch self {
        case .parsing: return "Reading document structure..."
        case .extracting: return "Extracting key information..."
        case .scopeAnalyzing: return "Matching scope against taxonomy..."
        case .researching: return "Gathering context..."
        case .scoring: return "Calculating fit score..."
        case .rendering: return "Rendering analysis report..."
        case .exporting: return "Preparing export artifact..."
        case .complete: return "Analysis complete"
        }
    }
}

struct AnalysisProgressView: View {
    @Binding var currentStage: AnalysisStage
    @Binding var progress: Double
    @Binding var parsingWarnings: [String]
    let documentName: String
    let onCancel: () -> Void

    @State private var visibleDataPoints: [ExtractedDataPoint] = []
    @State private var animationTimer: Timer?

    private var progressPercent: Int {
        Int((max(0, min(progress, 1)) * 100).rounded())
    }

    var body: some View {
        SceneContainer {
            VStack(spacing: 0) {
                Spacer()

                // Main content
                VStack(spacing: 40) {
                    // Header with document name and progress
                    VStack(spacing: 16) {
                        Text("Analyzing")
                            .font(.custom("Urbanist", size: 16).weight(.medium))
                            .foregroundColor(DesignSystem.Palette.Text.tertiary)
                            .textCase(.uppercase)
                            .tracking(2)

                        Text(documentName)
                            .font(.custom("Urbanist", size: 32).weight(.bold))
                            .foregroundColor(DesignSystem.Palette.Text.primary)
                            .lineLimit(1)

                        // Progress bar
                        progressBar
                    }

                    // Live extraction preview
                    liveExtractionCard

                    // Errors / warnings (kept minimal; only appears when something went wrong)
                    if !parsingWarnings.isEmpty {
                        warningCard
                    }

                    // Stage indicators
                    stageIndicators
                }
                .frame(maxWidth: 560)

                Spacer()

                // Cancel button
                Button(action: onCancel) {
                    Text(parsingWarnings.isEmpty ? "Cancel" : "Back")
                        .font(.custom("Urbanist", size: 14).weight(.medium))
                        .foregroundColor(DesignSystem.Palette.Text.muted)
                }
                .buttonStyle(.plain)
                .padding(.bottom, 32)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .onAppear {
            startDataAnimation()
        }
        .onDisappear {
            animationTimer?.invalidate()
        }
        .onChange(of: currentStage) { _, newStage in
            addDataPointsForStage(newStage)
        }
    }

    // MARK: - Progress Bar

    private var progressBar: some View {
        VStack(spacing: 8) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // Track
                    RoundedRectangle(cornerRadius: 4)
                        .fill(DesignSystem.Palette.Background.surface)

                    // Fill
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                colors: [
                                    DesignSystem.Palette.Accent.primary,
                                    DesignSystem.Palette.Accent.secondary
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geo.size.width * max(0.02, progress))
                        .animation(.easeOut(duration: 0.3), value: progress)
                }
            }
            .frame(height: 6)

            HStack {
                Text(currentStage.description)
                    .font(.custom("Urbanist", size: 13))
                    .foregroundColor(DesignSystem.Palette.Text.tertiary)

                Spacer()

                Text("\(progressPercent)%")
                    .font(.custom("IBM Plex Mono", size: 13).weight(.medium))
                    .foregroundColor(DesignSystem.Palette.Accent.primary)
            }
        }
    }

    // MARK: - Live Extraction Card

    private var liveExtractionCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Circle()
                    .fill(DesignSystem.Palette.Accent.primary)
                    .frame(width: 8, height: 8)
                    .modifier(PulseAnimation())

                Text("LIVE EXTRACTION")
                    .font(.custom("Urbanist", size: 10).weight(.bold))
                    .tracking(1.5)
                    .foregroundColor(DesignSystem.Palette.Accent.primary)

                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .background(DesignSystem.Palette.Accent.primary.opacity(0.08))

            // Data points
            VStack(alignment: .leading, spacing: 0) {
                ForEach(visibleDataPoints) { point in
                    dataPointRow(point)
                        .transition(.asymmetric(
                            insertion: .opacity.combined(with: .move(edge: .top)),
                            removal: .opacity
                        ))
                }

                if visibleDataPoints.isEmpty {
                    HStack(spacing: 8) {
                        ProgressView()
                            .scaleEffect(0.7)
                            .tint(DesignSystem.Palette.Text.muted)
                        Text("Waiting for data...")
                            .font(.custom("Urbanist", size: 14))
                            .foregroundColor(DesignSystem.Palette.Text.muted)
                    }
                    .padding(20)
                }
            }
            .frame(minHeight: 180, alignment: .top)
        }
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(DesignSystem.Palette.Background.elevated)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(DesignSystem.Palette.Accent.primary.opacity(0.2), lineWidth: 1)
                )
        )
    }

    private var warningCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(DesignSystem.Palette.Semantic.warning)

                Text("ISSUES")
                    .font(.custom("Urbanist", size: 10).weight(.bold))
                    .tracking(1.4)
                    .foregroundColor(DesignSystem.Palette.Semantic.warning)

                Spacer()
            }

            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(parsingWarnings.prefix(4).enumerated()), id: \.offset) { _, message in
                    Text(message)
                        .font(.custom("Urbanist", size: 12).weight(.medium))
                        .foregroundColor(DesignSystem.Palette.Text.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if parsingWarnings.count > 4 {
                    Text("+\(parsingWarnings.count - 4) more")
                        .font(.custom("Urbanist", size: 12).weight(.medium))
                        .foregroundColor(DesignSystem.Palette.Text.tertiary)
                }
            }
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(DesignSystem.Palette.Background.elevated)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(DesignSystem.Palette.Semantic.warning.opacity(0.22), lineWidth: 1)
                )
        )
    }

    private func dataPointRow(_ point: ExtractedDataPoint) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: point.icon)
                .font(.system(size: 14))
                .foregroundColor(DesignSystem.Palette.Accent.primary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(point.label)
                    .font(.custom("Urbanist", size: 11).weight(.semibold))
                    .foregroundColor(DesignSystem.Palette.Text.tertiary)
                    .textCase(.uppercase)
                    .tracking(0.5)

                Text(point.value)
                    .font(.custom("Urbanist", size: 15).weight(.medium))
                    .foregroundColor(DesignSystem.Palette.Text.primary)
            }

            Spacer()

            Image(systemName: "checkmark")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(DesignSystem.Palette.Semantic.success)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(
            Rectangle()
                .fill(Color.black.opacity(0.02))
                .overlay(
                    Rectangle()
                        .fill(DesignSystem.Palette.Background.surface)
                        .frame(height: 1),
                    alignment: .bottom
                )
        )
    }

    // MARK: - Stage Indicators

    private var stageIndicators: some View {
        HStack(spacing: 24) {
            ForEach(Array(AnalysisStage.allCases.dropLast().enumerated()), id: \.element.rawValue) { index, stage in
                stageIndicator(stage, index: index)
            }
        }
    }

    private func stageIndicator(_ stage: AnalysisStage, index: Int) -> some View {
        let isActive = stage == currentStage
        let isComplete = stage.rawValue < currentStage.rawValue

        return HStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(
                        isComplete ? DesignSystem.Palette.Semantic.success :
                        isActive ? DesignSystem.Palette.Accent.primary :
                        DesignSystem.Palette.Background.surface
                    )
                    .frame(width: 24, height: 24)

                if isComplete {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                } else if isActive {
                    Circle()
                        .fill(Color.white)
                        .frame(width: 8, height: 8)
                }
            }

            Text(stage.title)
                .font(.custom("Urbanist", size: 12).weight(isActive ? .semibold : .medium))
                .foregroundColor(
                    isComplete ? DesignSystem.Palette.Semantic.success :
                    isActive ? DesignSystem.Palette.Text.primary :
                    DesignSystem.Palette.Text.muted
                )

            if index < AnalysisStage.allCases.count - 2 {
                Rectangle()
                    .fill(
                        isComplete ? DesignSystem.Palette.Semantic.success.opacity(0.5) :
                        DesignSystem.Palette.Background.surface
                    )
                    .frame(width: 24, height: 2)
            }
        }
    }

    // MARK: - Data Animation

    private func startDataAnimation() {
        addDataPointsForStage(currentStage)
    }

    private func addDataPointsForStage(_ stage: AnalysisStage) {
        let newPoints: [ExtractedDataPoint]

        switch stage {
        case .parsing:
            newPoints = [
                ExtractedDataPoint(label: "Document", value: documentName, icon: "doc.fill")
            ]
        case .extracting:
            newPoints = [
                ExtractedDataPoint(label: "Client", value: "Meridian Healthcare", icon: "building.2.fill"),
                ExtractedDataPoint(label: "Project", value: "2024 Brand Refresh", icon: "briefcase.fill")
            ]
        case .scopeAnalyzing:
            newPoints = [
                ExtractedDataPoint(label: "Scope Match", value: "Agency vs outsource split computed", icon: "circle.grid.cross")
            ]
        case .researching:
            newPoints = [
                ExtractedDataPoint(label: "Company Size", value: "Enterprise (12,000+ employees)", icon: "person.3.fill"),
                ExtractedDataPoint(label: "Industry", value: "Healthcare / Hospital Networks", icon: "cross.case.fill")
            ]
        case .scoring:
            newPoints = [
                ExtractedDataPoint(label: "Scope Alignment", value: "72% agency services", icon: "chart.pie.fill"),
                ExtractedDataPoint(label: "Financial Score", value: "78/100 - Strong Fit", icon: "star.fill")
            ]
        case .rendering:
            newPoints = [
                ExtractedDataPoint(label: "Report", value: "Analysis report assembled", icon: "doc.text.fill")
            ]
        case .exporting:
            newPoints = [
                ExtractedDataPoint(label: "Export", value: "Share link prepared", icon: "link")
            ]
        case .complete:
            newPoints = []
        }

        // Animate adding points one by one
        for (index, point) in newPoints.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * 0.4) {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    if !visibleDataPoints.contains(where: { $0.label == point.label }) {
                        visibleDataPoints.append(point)
                    }
                }
            }
        }
    }
}

// MARK: - Supporting Types

struct ExtractedDataPoint: Identifiable {
    let id = UUID()
    let label: String
    let value: String
    let icon: String
}

struct PulseAnimation: ViewModifier {
    @State private var isPulsing = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPulsing ? 1.3 : 1.0)
            .opacity(isPulsing ? 0.7 : 1.0)
            .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: isPulsing)
            .onAppear { isPulsing = true }
    }
}

#if DEBUG
struct AnalysisProgressView_Previews: PreviewProvider {
    static var previews: some View {
        AnalysisProgressView(
            currentStage: .constant(.extracting),
            progress: .constant(0.45),
            parsingWarnings: .constant([]),
            documentName: "Brand_Refresh_RFP.pdf",
            onCancel: {}
        )
        .frame(width: 900, height: 700)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
