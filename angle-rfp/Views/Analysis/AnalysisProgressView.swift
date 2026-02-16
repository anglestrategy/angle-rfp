//
//  AnalysisProgressView.swift
//  angle-rfp
//
//  Clean editorial progress visualization.
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
        case .extracting: return "Extracting"
        case .scopeAnalyzing: return "Analyzing"
        case .researching: return "Researching"
        case .scoring: return "Scoring"
        case .rendering: return "Rendering"
        case .exporting: return "Exporting"
        case .complete: return "Complete"
        }
    }

    var subtitle: String {
        switch self {
        case .parsing: return "Reading document structure"
        case .extracting: return "Pulling key information"
        case .scopeAnalyzing: return "Evaluating scope alignment"
        case .researching: return "Gathering market context"
        case .scoring: return "Calculating fit score"
        case .rendering: return "Building your dashboard"
        case .exporting: return "Preparing results"
        case .complete: return "Your analysis is ready"
        }
    }
}

struct AnalysisProgressView: View {
    @Binding var currentStage: AnalysisStage
    @Binding var progress: Double
    @Binding var parsingWarnings: [String]
    @Binding var errorMessage: String?
    let documentName: String
    let onCancel: () -> Void
    let onRetry: (() -> Void)?

    @State private var activityItems: [ActivityItem] = []
    @State private var showingStageTransition = false

    private var progressPercent: Int {
        Int((max(0, min(progress, 1)) * 100).rounded())
    }

    var body: some View {
        SceneContainer {
            VStack(alignment: .leading, spacing: 0) {
                // Top section
                VStack(alignment: .leading, spacing: 32) {
                    // Overline
                    Text("ANALYZING")
                        .font(.custom("IBM Plex Mono", size: 10).weight(.medium))
                        .tracking(2)
                        .foregroundColor(DesignSystem.Palette.Text.muted)

                    // Stage title and progress
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(currentStage.title)
                                .font(.custom("Urbanist", size: 36).weight(.bold))
                                .foregroundColor(DesignSystem.Palette.Text.primary)
                                .contentTransition(.numericText())

                            Text(currentStage.subtitle)
                                .font(.custom("Urbanist", size: 14))
                                .foregroundColor(DesignSystem.Palette.Text.tertiary)
                        }

                        Spacer()

                        // Percentage
                        Text("\(progressPercent)%")
                            .font(.custom("IBM Plex Mono", size: 48).weight(.light))
                            .foregroundColor(DesignSystem.Palette.Text.primary)
                            .contentTransition(.numericText())
                    }
                    .animation(.easeOut(duration: 0.3), value: currentStage)

                    // Progress bar
                    progressBar

                    // Document name
                    Text(documentName)
                        .font(.custom("IBM Plex Mono", size: 11))
                        .foregroundColor(DesignSystem.Palette.Text.muted)
                        .lineLimit(1)
                }
                .padding(.top, 60)
                .padding(.horizontal, 40)

                // Error display
                if let error = errorMessage {
                    errorBanner(error)
                        .padding(.top, 32)
                        .padding(.horizontal, 40)
                }

                Spacer()
                    .frame(height: 32)

                // Stage indicators (hide if error)
                if errorMessage == nil {
                    stageIndicators
                        .padding(.horizontal, 40)
                }

                Spacer()

                // Activity feed
                activityFeed

                // Bottom bar
                bottomBar
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .onAppear {
            addActivity("Started analysis", isHighlight: true)
            addActivity("Loading \(documentName)")
        }
        .onChange(of: currentStage) { _, newStage in
            handleStageChange(newStage)
        }
    }

    // MARK: - Progress Bar

    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(DesignSystem.Palette.Background.surface)

                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(DesignSystem.Palette.Accent.primary)
                    .frame(width: geo.size.width * progress)
                    .animation(.easeOut(duration: 0.4), value: progress)
            }
        }
        .frame(height: 4)
    }

    // MARK: - Stage Indicators

    private var stageIndicators: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("PROGRESS")
                .font(.custom("IBM Plex Mono", size: 10).weight(.medium))
                .tracking(1.5)
                .foregroundColor(DesignSystem.Palette.Text.muted)

            HStack(spacing: 6) {
                ForEach(Array(AnalysisStage.allCases.dropLast()), id: \.rawValue) { stage in
                    stageIndicator(stage)
                }
            }
        }
    }

    private func stageIndicator(_ stage: AnalysisStage) -> some View {
        let isActive = stage == currentStage
        let isComplete = stage.rawValue < currentStage.rawValue

        return HStack(spacing: 6) {
            // Indicator
            ZStack {
                Circle()
                    .fill(
                        isComplete ? DesignSystem.Palette.Accent.primary :
                        isActive ? DesignSystem.Palette.Accent.primary.opacity(0.2) :
                        DesignSystem.Palette.Background.surface
                    )
                    .frame(width: 24, height: 24)

                if isComplete {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                } else if isActive {
                    Circle()
                        .fill(DesignSystem.Palette.Accent.primary)
                        .frame(width: 6, height: 6)
                }
            }

            // Label for active stage
            if isActive {
                Text(stage.title)
                    .font(.custom("Urbanist", size: 12).weight(.semibold))
                    .foregroundColor(DesignSystem.Palette.Text.secondary)
            }
        }
        .animation(.easeOut(duration: 0.2), value: currentStage)
    }

    // MARK: - Activity Feed

    private var activityFeed: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("ACTIVITY")
                    .font(.custom("IBM Plex Mono", size: 10).weight(.medium))
                    .tracking(1.5)
                    .foregroundColor(DesignSystem.Palette.Text.muted)

                Spacer()

                if !parsingWarnings.isEmpty {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(DesignSystem.Palette.Semantic.warning)
                            .frame(width: 5, height: 5)
                        Text("\(parsingWarnings.count) warning\(parsingWarnings.count == 1 ? "" : "s")")
                            .font(.custom("IBM Plex Mono", size: 10))
                            .foregroundColor(DesignSystem.Palette.Semantic.warning)
                    }
                }
            }
            .padding(.horizontal, 40)
            .padding(.top, 20)
            .padding(.bottom, 12)

            // Activity list
            ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(activityItems) { item in
                            activityRow(item)
                                .id(item.id)
                        }
                    }
                }
                .onChange(of: activityItems.count) { _, _ in
                    if let last = activityItems.last {
                        withAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }
        }
        .frame(height: 180)
        .background(DesignSystem.Palette.Background.elevated)
    }

    private func activityRow(_ item: ActivityItem) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(item.isHighlight ? DesignSystem.Palette.Accent.primary : DesignSystem.Palette.Text.muted.opacity(0.4))
                .frame(width: 5, height: 5)

            Text(item.message)
                .font(.custom("Urbanist", size: 13))
                .foregroundColor(item.isHighlight ? DesignSystem.Palette.Text.primary : DesignSystem.Palette.Text.secondary)

            Spacer()

            Text(item.timestamp)
                .font(.custom("IBM Plex Mono", size: 10))
                .foregroundColor(DesignSystem.Palette.Text.muted)
        }
        .padding(.horizontal, 40)
        .padding(.vertical, 8)
    }

    // MARK: - Bottom Bar

    private var bottomBar: some View {
        HStack {
            Button(action: onCancel) {
                Text("Cancel")
                    .font(.custom("Urbanist", size: 13).weight(.medium))
                    .foregroundColor(DesignSystem.Palette.Text.muted)
            }
            .buttonStyle(.plain)

            Spacer()

            Text(currentStage == .complete ? "Complete" : "Step \(currentStage.rawValue + 1) of 7")
                .font(.custom("IBM Plex Mono", size: 11))
                .foregroundColor(currentStage == .complete ? DesignSystem.Palette.Semantic.success : DesignSystem.Palette.Text.muted)
        }
        .padding(.horizontal, 40)
        .padding(.vertical, 20)
        .background(
            Rectangle()
                .fill(Color.white.opacity(0.02))
                .overlay(
                    Rectangle()
                        .fill(Color.white.opacity(0.04))
                        .frame(height: 1),
                    alignment: .top
                )
        )
    }

    // MARK: - Error Banner

    private func errorBanner(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 24))
                    .foregroundColor(DesignSystem.Palette.Semantic.error)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Analysis Failed")
                        .font(.custom("Urbanist", size: 16).weight(.semibold))
                        .foregroundColor(DesignSystem.Palette.Text.primary)

                    Text(message)
                        .font(.custom("Urbanist", size: 13))
                        .foregroundColor(DesignSystem.Palette.Text.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer()
            }

            if let retry = onRetry {
                Button(action: retry) {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 11, weight: .medium))
                        Text("Retry Analysis")
                            .font(.custom("Urbanist", size: 13).weight(.medium))
                    }
                    .foregroundColor(DesignSystem.Palette.Accent.primary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(DesignSystem.Palette.Accent.primary.opacity(0.1))
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(DesignSystem.Palette.Semantic.error.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(DesignSystem.Palette.Semantic.error.opacity(0.3), lineWidth: 1)
                )
        )
    }

    // MARK: - Helpers

    private func handleStageChange(_ stage: AnalysisStage) {
        let messages: [String] = {
            switch stage {
            case .parsing: return ["Parsing document"]
            case .extracting: return ["Parse complete", "Extracting data"]
            case .scopeAnalyzing: return ["Extraction complete", "Analyzing scope"]
            case .researching: return ["Scope mapped", "Researching client"]
            case .scoring: return ["Research complete", "Calculating score"]
            case .rendering: return ["Score ready", "Rendering dashboard"]
            case .exporting: return ["Render complete", "Finalizing"]
            case .complete: return ["Analysis complete"]
            }
        }()

        for (i, msg) in messages.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.3) {
                addActivity(msg, isHighlight: i == messages.count - 1 && stage != .complete)
            }
        }
    }

    private func addActivity(_ message: String, isHighlight: Bool = false) {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        withAnimation(.easeOut(duration: 0.15)) {
            activityItems.append(ActivityItem(
                message: message,
                timestamp: formatter.string(from: Date()),
                isHighlight: isHighlight
            ))
        }
    }
}

// MARK: - Models

struct ActivityItem: Identifiable {
    let id = UUID()
    let message: String
    let timestamp: String
    let isHighlight: Bool
}

#if DEBUG
struct AnalysisProgressView_Previews: PreviewProvider {
    static var previews: some View {
        AnalysisProgressView(
            currentStage: .constant(.researching),
            progress: .constant(0.55),
            parsingWarnings: .constant([]),
            errorMessage: .constant(nil),
            documentName: "Brand_Refresh_RFP.pdf",
            onCancel: {},
            onRetry: {}
        )
        .frame(width: 600, height: 800)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
