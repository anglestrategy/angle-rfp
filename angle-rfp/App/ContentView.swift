//
//  ContentView.swift
//  angle-rfp
//
//  Quiet editorial runway shell for upload -> analysis -> results.
//

import SwiftUI

enum AppState: Equatable {
    case upload
    case analyzing(documentName: String)
    case dashboard(data: ExtractedRFPData, clientInfo: ClientInformation?)

    static func == (lhs: AppState, rhs: AppState) -> Bool {
        switch (lhs, rhs) {
        case (.upload, .upload):
            return true
        case (.analyzing(let left), .analyzing(let right)):
            return left == right
        case (.dashboard, .dashboard):
            return true
        default:
            return false
        }
    }
}

enum RunwayStep: Int, CaseIterable, Identifiable {
    case upload = 0
    case parse = 1
    case criteria = 2
    case research = 3
    case score = 4
    case results = 5

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .upload: return "Upload"
        case .parse: return "Parse"
        case .criteria: return "Criteria"
        case .research: return "Research"
        case .score: return "Score"
        case .results: return "Results"
        }
    }

    var subtitle: String {
        switch self {
        case .upload: return "Ingest source files"
        case .parse: return "Read structure and text"
        case .criteria: return "Map evaluation logic"
        case .research: return "Add context and signal"
        case .score: return "Calculate weighted output"
        case .results: return "Review final dossier"
        }
    }

    var icon: String {
        switch self {
        case .upload: return "tray.and.arrow.down"
        case .parse: return "doc.text"
        case .criteria: return "slider.horizontal.3"
        case .research: return "magnifyingglass"
        case .score: return "chart.bar.xaxis"
        case .results: return "sparkles"
        }
    }

    var code: String {
        String(format: "%02d", rawValue + 1)
    }
}

enum RunwayCardMode {
    case active
    case compact
    case peek
}

func runwayStep(for appState: AppState, analysisStage: AnalysisStage) -> RunwayStep {
    switch appState {
    case .upload:
        return .upload
    case .analyzing:
        switch analysisStage {
        case .parsing:
            return .parse
        case .extracting, .scopeAnalyzing:
            return .criteria
        case .researching:
            return .research
        case .scoring:
            return .score
        case .rendering, .exporting, .complete:
            return .results
        }
    case .dashboard:
        return .results
    }
}

private struct RunwayLayoutMetrics {
    let compact: CGFloat
    let active: CGFloat
    let peek: CGFloat
    let gap: CGFloat

    func width(for mode: RunwayCardMode) -> CGFloat {
        switch mode {
        case .active:
            return active
        case .compact:
            return compact
        case .peek:
            return peek
        }
    }
}

struct ContentView: View {
    @State private var appState: AppState = .upload
    @State private var uploadQueue: [UploadQueueItem] = []
    @State private var currentStage: AnalysisStage = .parsing
    @State private var analysisProgress: Double = 0
    @State private var parsingWarnings: [String] = []
    @State private var extractedData: ExtractedRFPData?
    @State private var clientInfo: ClientInformation?
    @State private var showSettings = false
    @State private var backendConfigured = false

    // Demo mode can be enabled with ANGLE_DEMO_MODE=1
    private let useDemoMode = ProcessInfo.processInfo.environment["ANGLE_DEMO_MODE"] == "1"
    private let backendClient = BackendAnalysisClient.shared

    @AppStorage("motionPreference") private var motionPreferenceRawValue = MotionPreference.balanced.rawValue

    private var selectedMotionPreference: MotionPreference {
        MotionPreference.from(rawValue: motionPreferenceRawValue)
    }

    private var motionPreferenceBinding: Binding<MotionPreference> {
        Binding(
            get: { MotionPreference.from(rawValue: motionPreferenceRawValue) },
            set: { motionPreferenceRawValue = $0.rawValue }
        )
    }

    private var activeRunwayStep: RunwayStep {
        runwayStep(for: appState, analysisStage: currentStage)
    }

    private var activeStepIndex: Int {
        activeRunwayStep.rawValue
    }

    // MARK: - Deprecated Runway Properties (kept for reference)
    /*
    private var visibleSteps: [RunwayStep] {
        let all = RunwayStep.allCases
        let active = activeStepIndex
        guard let current = all.first(where: { $0.rawValue == active }) else {
            return [.upload]
        }

        var result = all.filter { $0.rawValue < current.rawValue }
        result.append(current)

        if current.rawValue < all.count - 1 {
            result.append(all[current.rawValue + 1])
        }

        return result
    }
    */

    // overallProgress removed - no longer needed with scene-based navigation

    var body: some View {
        VStack(spacing: 0) {
            AppHeader(
                currentStep: activeStepIndex,
                completedSteps: completedSteps,
                apiKeysConfigured: backendConfigured || useDemoMode,
                onSettingsTap: { showSettings = true }
            )

            // Scene content
            Group {
                switch appState {
                case .upload:
                    DocumentUploadView(
                        uploadQueue: $uploadQueue,
                        motionPreference: motionPreferenceBinding,
                        onQueueChanged: { uploadQueue = $0 },
                        onBeginAnalysis: beginAnalysis,
                        onRunDemo: runQuickDemo
                    )

                case .analyzing:
                    AnalysisProgressView(
                        currentStage: $currentStage,
                        progress: $analysisProgress,
                        parsingWarnings: $parsingWarnings,
                        documentName: activeDocumentName,
                        onCancel: cancelAnalysis
                    )

                case .dashboard(let data, let info):
                    DashboardView(
                        data: data,
                        clientInfo: info,
                        onExport: handleExport,
                        onNewAnalysis: startNewAnalysis
                    )
                }
            }
            .transition(.opacity.combined(with: .move(edge: .trailing)))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(DesignSystem.Palette.Background.base)
        .ignoresSafeArea()
        .environment(\.motionPreference, selectedMotionPreference)
        .onAppear {
            checkAPIKeyStatus()
        }
        .animation(.easeInOut(duration: 0.35), value: appState)
        .sheet(isPresented: $showSettings) {
            SettingsView(
                motionPreference: motionPreferenceBinding,
                onDismiss: {
                    showSettings = false
                    checkAPIKeyStatus()
                }
            )
        }
        .onReceive(NotificationCenter.default.publisher(for: .openSettingsCommand)) { _ in
            showSettings = true
        }
        .onReceive(NotificationCenter.default.publisher(for: .startNewAnalysisCommand)) { _ in
            startNewAnalysis()
        }
    }

    private var completedSteps: Set<Int> {
        var completed = Set<Int>()

        switch appState {
        case .upload:
            break
        case .analyzing:
            completed.insert(0) // Upload complete
            if currentStage.rawValue >= AnalysisStage.extracting.rawValue {
                completed.insert(1) // Parse complete
            }
            if currentStage.rawValue >= AnalysisStage.researching.rawValue {
                completed.insert(2) // Criteria complete
            }
            if currentStage.rawValue >= AnalysisStage.scoring.rawValue {
                completed.insert(3) // Research complete
            }
            if currentStage.rawValue >= AnalysisStage.rendering.rawValue {
                completed.insert(4) // Score complete
            }
        case .dashboard:
            completed = [0, 1, 2, 3, 4] // All but results
        }

        return completed
    }

    // headerStrip replaced by AppHeader component

    // MARK: - Deprecated Runway Methods (kept for reference)
    /*
    private func runwayTrack(in size: CGSize) -> some View {
        let metrics = runwayMetrics(for: size.width)
        let cardHeight = max(360, size.height - 126)

        return ZStack(alignment: .leading) {
            ForEach(visibleSteps) { step in
                let mode = modeForStep(step)

                runwayCard(step: step, mode: mode)
                    .frame(width: metrics.width(for: mode), height: cardHeight)
                    .offset(x: runwayXOffset(for: step, metrics: metrics), y: runwayYOffset(for: step, mode: mode))
                    .zIndex(zIndex(for: step, mode: mode))
                    .rotationEffect(.degrees(mode == .peek ? -1.4 : 0))
                    .scaleEffect(mode == .peek ? 0.985 : 1, anchor: .leading)
                    .animation(DesignSystem.Animation.runway(for: selectedMotionPreference), value: activeStepIndex)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func runwayMetrics(for totalWidth: CGFloat) -> RunwayLayoutMetrics {
        var compact = DesignSystem.Layout.runwayCompactWidth(for: totalWidth)
        var active = DesignSystem.Layout.runwayActiveWidth(for: totalWidth)
        var peek = DesignSystem.Layout.runwayPeekWidth(for: totalWidth)
        var gap = DesignSystem.Layout.runwayGap(for: totalWidth)

        let completedCount = CGFloat(activeStepIndex)
        let peekCount: CGFloat = activeStepIndex < RunwayStep.allCases.count - 1 ? 1 : 0
        let cardCount = completedCount + 1 + peekCount
        guard cardCount > 0 else {
            return RunwayLayoutMetrics(compact: compact, active: active, peek: peek, gap: gap)
        }

        let totalNeeded = (completedCount * compact)
            + active
            + (peekCount * peek)
            + (max(cardCount - 1, 0) * gap)

        var overflow = totalNeeded - totalWidth
        if overflow <= 0 {
            return RunwayLayoutMetrics(compact: compact, active: active, peek: peek, gap: gap)
        }

        if completedCount > 0 {
            let minCompact: CGFloat = 104
            let reducible = (compact - minCompact) * completedCount
            let used = min(overflow, max(0, reducible))
            compact -= used / completedCount
            overflow -= used
        }

        if overflow > 0 {
            let minActive: CGFloat = 420
            let reducible = active - minActive
            let used = min(overflow, max(0, reducible))
            active -= used
            overflow -= used
        }

        if overflow > 0, peekCount > 0 {
            let minPeek: CGFloat = 52
            let reducible = peek - minPeek
            let used = min(overflow, max(0, reducible))
            peek -= used
            overflow -= used
        }

        if overflow > 0, cardCount > 1 {
            let minGap: CGFloat = 6
            let reducible = (gap - minGap) * (cardCount - 1)
            let used = min(overflow, max(0, reducible))
            gap -= used / (cardCount - 1)
        }

        return RunwayLayoutMetrics(compact: compact, active: active, peek: peek, gap: gap)
    }

    private func modeForStep(_ step: RunwayStep) -> RunwayCardMode {
        if step.rawValue < activeStepIndex {
            return .compact
        }

        if step.rawValue == activeStepIndex {
            return .active
        }

        return .peek
    }

    private func runwayXOffset(for step: RunwayStep, metrics: RunwayLayoutMetrics) -> CGFloat {
        let compactCount = CGFloat(activeStepIndex)
        let compactSpread = compactCount * (metrics.compact * 0.58)
        let activeX = compactSpread

        let mode = modeForStep(step)
        switch mode {
        case .active:
            return activeX
        case .compact:
            let index = CGFloat(step.rawValue)
            return index * (metrics.compact * 0.58)
        case .peek:
            return activeX + metrics.active - (metrics.peek * 0.42)
        }
    }

    private func runwayYOffset(for step: RunwayStep, mode: RunwayCardMode) -> CGFloat {
        switch mode {
        case .active:
            return 0
        case .compact:
            return CGFloat(activeStepIndex - step.rawValue) * 5
        case .peek:
            return 8
        }
    }

    private func zIndex(for step: RunwayStep, mode: RunwayCardMode) -> Double {
        switch mode {
        case .active:
            return 300
        case .compact:
            return 200 + Double(step.rawValue)
        case .peek:
            return 100 - Double(step.rawValue)
        }
    }

    @ViewBuilder
    private func runwayCard(step: RunwayStep, mode: RunwayCardMode) -> some View {
        switch mode {
        case .active:
            RunwayCardContainer(step: step, mode: mode) {
                activeCardContent(for: step)
            }

        case .compact:
            RunwayCardContainer(step: step, mode: mode) {
                VStack(spacing: 14) {
                    Rectangle()
                        .fill(DesignSystem.Palette.Cream.elevated.opacity(0.7))
                        .frame(width: 24, height: 2)
                        .padding(.top, 4)

                    Spacer(minLength: 0)

                    Text("Done")
                        .font(.custom("Urbanist", size: 10).weight(.bold))
                        .tracking(1.4)
                        .foregroundColor(DesignSystem.Palette.Cream.elevated.opacity(0.84))
                        .rotationEffect(.degrees(-90))
                        .frame(height: 42)

                    Image(systemName: step.icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(DesignSystem.Palette.Cream.elevated.opacity(0.72))

                    Spacer(minLength: 0)

                    Rectangle()
                        .fill(DesignSystem.Palette.Cream.elevated.opacity(0.72))
                        .frame(width: 26, height: 3)
                        .padding(.bottom, 14)
                }
            }

        case .peek:
            RunwayCardContainer(step: step, mode: mode) {
                VStack(spacing: 10) {
                    Text("NEXT")
                        .font(.custom("Urbanist", size: 9).weight(.bold))
                        .tracking(1.5)
                        .foregroundColor(DesignSystem.Palette.Cream.elevated.opacity(0.65))
                        .rotationEffect(.degrees(-90))
                        .frame(height: 36)
                    Spacer(minLength: 0)
                    Image(systemName: step.icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(DesignSystem.Palette.Cream.elevated.opacity(0.68))
                    Spacer(minLength: 0)
                    Circle()
                        .fill(DesignSystem.Palette.Vermillion.v500)
                        .frame(width: 6, height: 6)
                        .padding(.bottom, 12)
                }
            }
        }
    }

    @ViewBuilder
    private func activeCardContent(for step: RunwayStep) -> some View {
        switch step {
        case .upload:
            DocumentUploadView(
                uploadQueue: $uploadQueue,
                motionPreference: motionPreferenceBinding,
                onQueueChanged: { uploadQueue = $0 },
                onBeginAnalysis: beginAnalysis,
                onRunDemo: runQuickDemo
            )

        case .parse, .criteria, .research, .score:
            AnalysisProgressView(
                currentStage: $currentStage,
                progress: $analysisProgress,
                parsingWarnings: $parsingWarnings,
                documentName: activeDocumentName,
                onCancel: cancelAnalysis
            )

        case .results:
            if case .dashboard(let data, let info) = appState {
                DashboardView(
                    data: data,
                    clientInfo: info,
                    onExport: handleExport,
                    onNewAnalysis: startNewAnalysis
                )
            } else {
                preparingResultsView
            }
        }
    }

    private var preparingResultsView: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Preparing results")
                .font(.custom("Urbanist", size: 52).weight(.bold))
                .foregroundColor(DesignSystem.Palette.Charcoal.c900)
                .lineLimit(1)
                .minimumScaleFactor(0.72)

            Text("Your analysis is finishing. The final dashboard expands in place as soon as synthesis completes.")
                .font(.custom("Urbanist", size: 17).weight(.medium))
                .foregroundColor(DesignSystem.Palette.Charcoal.c700)
                .lineSpacing(5)
                .frame(maxWidth: 720, alignment: .leading)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(DesignSystem.Palette.Charcoal.c900.opacity(0.14))
                    Rectangle()
                        .fill(DesignSystem.Palette.Vermillion.v500)
                        .frame(width: geo.size.width * max(0.1, min(analysisProgress, 1)))
                }
            }
            .frame(height: 4)

            Text("Synthesizing recommendation and deliverable timeline.")
                .font(.custom("Urbanist", size: 12).weight(.semibold))
                .tracking(1.1)
                .foregroundColor(DesignSystem.Palette.Charcoal.c700)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 32)
        .padding(.top, 30)
        .padding(.bottom, 22)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    */

    private var activeDocumentName: String {
        if case .analyzing(let name) = appState {
            return name
        }
        return uploadQueue.first?.displayName ?? "Selected document"
    }

    // MARK: - Actions

    private func beginAnalysis(_ urls: [URL]) {
        guard let url = urls.first else { return }
        guard backendConfigured || useDemoMode else {
            parsingWarnings.append("Backend is not configured. Open Settings and enter your access token.")
            showSettings = true
            return
        }

        withAnimation(DesignSystem.Animation.runway(for: selectedMotionPreference)) {
            appState = .analyzing(documentName: url.lastPathComponent)
        }

        performAnalysis(documentURL: url)
    }

    private func runQuickDemo() {
        withAnimation(DesignSystem.Animation.runway(for: selectedMotionPreference)) {
            appState = .analyzing(documentName: "Demo RFP")
        }
        performMockAnalysis(documentName: "Demo RFP")
    }

    private func cancelAnalysis() {
        withAnimation(DesignSystem.Animation.standard(for: selectedMotionPreference)) {
            appState = .upload
            currentStage = .parsing
            analysisProgress = 0
            parsingWarnings = []
        }
    }

    private func startNewAnalysis() {
        withAnimation(DesignSystem.Animation.standard(for: selectedMotionPreference)) {
            uploadQueue = []
            extractedData = nil
            clientInfo = nil
            currentStage = .parsing
            analysisProgress = 0
            parsingWarnings = []
            appState = .upload
        }
    }

    private func handleExport(_ type: ExportType) {
        AppLogger.shared.debug("Export requested", metadata: ["type": type.rawValue])
    }

    private func checkAPIKeyStatus() {
        backendConfigured = APIKeySetup.hasBackendConfiguration()
    }

    // MARK: - Analysis Process

    private func performAnalysis(documentURL: URL) {
        if useDemoMode {
            performMockAnalysis(documentName: documentURL.lastPathComponent)
            return
        }

        Task {
            do {
                let result = try await backendClient.analyze(documentURL: documentURL) { update in
                    Task { @MainActor in
                        updateStage(analysisStage(from: update.stage), progress: update.progress)
                        if !update.warnings.isEmpty {
                            parsingWarnings = Array(Set(parsingWarnings + update.warnings)).sorted()
                        }
                    }
                }

                await MainActor.run {
                    withAnimation(DesignSystem.Animation.runway(for: selectedMotionPreference)) {
                        self.extractedData = result.extractedData
                        self.clientInfo = result.clientInfo
                        self.parsingWarnings = result.warnings
                        self.currentStage = .complete
                        self.analysisProgress = 1.0
                        self.appState = .dashboard(data: result.extractedData, clientInfo: result.clientInfo)
                    }
                }
            } catch {
                await MainActor.run {
                    // Keep the user on the progress screen so the failure is visible (instead of snapping back to upload).
                    parsingWarnings = Array(Set(parsingWarnings + ["Analysis failed: \(error.localizedDescription)"])).sorted()
                    currentStage = .complete
                    analysisProgress = max(analysisProgress, 0.12)
                }
            }
        }
    }

    // MARK: - Demo Mode

    private func performMockAnalysis(documentName: String) {
        Task { @MainActor in
            // Stage 1: Parsing
            currentStage = .parsing
            analysisProgress = 0.1
            try? await Task.sleep(nanoseconds: 500_000_000)
            analysisProgress = 0.25

            // Stage 2: Extracting
            currentStage = .extracting
            analysisProgress = 0.3
            try? await Task.sleep(nanoseconds: 500_000_000)
            analysisProgress = 0.46

            // Stage 3: Scope
            currentStage = .scopeAnalyzing
            analysisProgress = 0.52
            try? await Task.sleep(nanoseconds: 350_000_000)
            analysisProgress = 0.6

            // Stage 4: Researching
            currentStage = .researching
            analysisProgress = 0.65
            try? await Task.sleep(nanoseconds: 500_000_000)
            analysisProgress = 0.76

            // Stage 5: Scoring
            currentStage = .scoring
            analysisProgress = 0.82
            try? await Task.sleep(nanoseconds: 400_000_000)
            analysisProgress = 0.9

            // Stage 6: Rendering
            currentStage = .rendering
            analysisProgress = 0.93
            try? await Task.sleep(nanoseconds: 250_000_000)

            // Stage 7: Exporting
            currentStage = .exporting
            analysisProgress = 0.97
            try? await Task.sleep(nanoseconds: 250_000_000)

            // Stage 8: Complete
            currentStage = .complete
            analysisProgress = 1.0
            try? await Task.sleep(nanoseconds: 300_000_000)

            // Transition to dashboard with mock data
            withAnimation(DesignSystem.Animation.runway(for: selectedMotionPreference)) {
                self.extractedData = Self.mockRFPData
                self.clientInfo = Self.mockClientInfo
                self.appState = .dashboard(data: Self.mockRFPData, clientInfo: Self.mockClientInfo)
            }
        }
    }

    private func analysisStage(from stage: BackendPipelineStage) -> AnalysisStage {
        switch stage {
        case .parse:
            return .parsing
        case .extract:
            return .extracting
        case .scope:
            return .scopeAnalyzing
        case .research:
            return .researching
        case .score:
            return .scoring
        case .render:
            return .rendering
        case .export:
            return .exporting
        }
    }

    // MARK: - Mock Data

    private static var mockRFPData: ExtractedRFPData {
        ExtractedRFPData(
            clientName: "Meridian Healthcare",
            projectName: "2024 Brand Refresh & Digital Campaign",
            projectDescription: "A comprehensive brand refresh initiative encompassing visual identity updates, digital presence overhaul, and an integrated marketing campaign targeting healthcare professionals and patients across multiple channels.",
            scopeOfWork: """
            The selected agency will be responsible for delivering a complete brand refresh including:

            1. Brand Strategy Development - Comprehensive brand audit, competitive analysis, and strategic positioning recommendations
            2. Visual Identity System - Logo refinement, color palette expansion, typography guidelines, and brand asset library
            3. Digital Experience Design - Website redesign, mobile app UI/UX, and digital advertising templates
            4. Campaign Creative - Concept development, storyboarding, and production of video content for TV and digital
            5. Content Strategy - Editorial calendar, content pillars, and messaging framework for all channels
            6. Social Media Assets - Platform-specific creative templates and animated content

            The following services will require external partners or client-side resources:
            7. Media Buying - Programmatic and traditional media placement across digital and broadcast channels
            8. PR Distribution - Press release distribution and media outreach coordination
            9. Website Development - Front-end and back-end development, CMS integration, and hosting setup
            10. SEO Implementation - Technical SEO audit, keyword optimization, and ongoing search performance monitoring

            The project will span 6 months with phased deliverables and regular client reviews.
            """,
            scopeAnalysis: ScopeAnalysis(
                agencyServices: [
                    "Brand Strategy",
                    "Visual Identity Design",
                    "Website Design",
                    "Video Production",
                    "Motion Graphics",
                    "Content Strategy",
                    "Social Media Creative"
                ],
                nonAgencyServices: [
                    "Media Buying",
                    "PR Distribution",
                    "Website Development",
                    "SEO Implementation"
                ],
                agencyServicePercentage: 0.72,
                outputQuantities: OutputQuantities(
                    videoProduction: 4,
                    motionGraphics: 12,
                    visualDesign: 50,
                    contentOnly: 20
                ),
                outputTypes: [.video, .motionGraphics, .visuals, .content]
            ),
            financialPotential: FinancialPotential(
                totalScore: 78,
                recommendation: "Strong opportunity with excellent agency-service alignment. The client's enterprise size and national brand presence indicate substantial budget capacity. Video and motion graphics requirements align well with high-value deliverables.",
                factors: [
                    ScoringFactor(name: "Budget Indicators", weight: 0.25, score: 85, maxScore: 100, reasoning: "Enterprise client with national presence suggests strong budget"),
                    ScoringFactor(name: "Scope Alignment", weight: 0.30, score: 72, maxScore: 100, reasoning: "72% of scope aligns with agency services"),
                    ScoringFactor(name: "Client Profile", weight: 0.25, score: 80, maxScore: 100, reasoning: "Private healthcare company with established market position"),
                    ScoringFactor(name: "Timeline Feasibility", weight: 0.20, score: 75, maxScore: 100, reasoning: "6-month timeline is reasonable for scope")
                ],
                formulaExplanation: "Score calculated using weighted factors: Budget (25%), Scope Alignment (30%), Client Profile (25%), Timeline (20%). Enterprise healthcare clients typically have budgets in the $500K-$2M range for projects of this scope."
            ),
            evaluationCriteria: """
            Proposals will be evaluated based on the following criteria:

            • Creative Excellence (30%) - Demonstrated ability to deliver innovative, award-winning creative work
            • Strategic Thinking (25%) - Evidence of strategic approach and understanding of healthcare industry
            • Team Experience (20%) - Relevant experience of proposed team members on similar projects
            • Technical Capability (15%) - Production capabilities and technology infrastructure
            • Value & Pricing (10%) - Competitive pricing aligned with scope and deliverables

            Shortlisted agencies will be invited to present their proposals in person.
            """,
            requiredDeliverables: [
                "Agency credentials and case studies (3-5 relevant examples)",
                "Proposed team bios and org chart",
                "Strategic approach and creative vision",
                "Detailed project timeline with milestones",
                "Itemized budget breakdown by phase",
                "References from similar healthcare clients",
                "Sample creative concepts (optional but encouraged)"
            ],
            importantDates: [
                ImportantDate(title: "Intent to Respond", date: Date().addingTimeInterval(86400 * 5), dateType: .other, isCritical: false),
                ImportantDate(title: "Questions Due", date: Date().addingTimeInterval(86400 * 10), dateType: .questionsDeadline, isCritical: false),
                ImportantDate(title: "Proposal Deadline", date: Date().addingTimeInterval(86400 * 21), dateType: .proposalDeadline, isCritical: true),
                ImportantDate(title: "Presentation", date: Date().addingTimeInterval(86400 * 35), dateType: .presentationDate, isCritical: true),
                ImportantDate(title: "Award Decision", date: Date().addingTimeInterval(86400 * 42), dateType: .other, isCritical: false)
            ],
            submissionMethodRequirements: """
            Submit proposals electronically to procurement@meridianhealthcare.com by 5:00 PM EST on the deadline date.

            Format Requirements:
            • PDF format, maximum 40 pages excluding appendices
            • File size limit: 25MB
            • Subject line: "RFP Response - Brand Refresh 2024 - [Agency Name]"

            Physical samples or USB drives will not be accepted. Questions should be directed to Sarah Chen, Procurement Manager, at the email above.
            """,
            parsingWarnings: [],
            completeness: 0.95
        )
    }

    private static var mockClientInfo: ClientInformation {
        ClientInformation(
            name: "Meridian Healthcare",
            companySize: .enterprise,
            brandPopularity: .national,
            entityType: .privateCompany,
            holdingGroup: "Meridian Health Systems",
            industry: "Healthcare / Hospital Networks",
            socialMediaPresence: SocialMediaPresence(
                hasPresence: true,
                activityLevel: .high,
                platforms: [.linkedin, .facebook, .instagram, .youtube],
                contentTypes: [.video, .images]
            ),
            estimatedEmployees: 12000,
            estimatedRevenue: "$2.8B annually",
            mediaSpendIndicators: "Significant TV and digital advertising presence observed",
            researchSources: ["LinkedIn", "Crunchbase", "Company Website", "News Articles"],
            researchConfidence: 0.85,
            researchDate: Date()
        )
    }

    @MainActor
    private func updateStage(_ stage: AnalysisStage, progress: Double) {
        currentStage = stage
        analysisProgress = progress
    }

    @MainActor
    private func updateProgress(_ progress: Double) {
        analysisProgress = progress
    }
}

struct SettingsView: View {
    @Binding var motionPreference: MotionPreference
    let onDismiss: () -> Void

    @State private var backendToken = ""
    @State private var revealToken = false
    @State private var isSaving = false
    @State private var showSaveSuccess = false
    @State private var showClearConfirm = false

    var body: some View {
        VStack(spacing: 0) {
            header

            ScrollView {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.lg) {
                    settingsCard {
                        tokenSection
                    }

                    settingsCard {
                        motionSection
                    }
                }
                .padding(.horizontal, DesignSystem.Spacing.lg)
                .padding(.vertical, DesignSystem.Spacing.lg)
            }
        }
        .frame(width: 640, height: 520)
        .background(DesignSystem.Palette.Background.base)
        .onAppear {
            loadExistingKeys()
        }
        .confirmationDialog(
            "Clear access token?",
            isPresented: $showClearConfirm,
            titleVisibility: .visible
        ) {
            Button("Clear Token", role: .destructive) {
                clearBackendToken()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes the saved token from your Keychain. You can paste a new token anytime.")
        }
    }

    private func settingsCard<Content: View>(@ViewBuilder content: @escaping () -> Content) -> some View {
        RunwayCardSurface(role: .neutral, cornerRadius: 14, contentPadding: 18) {
            content()
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Settings")
                    .font(.custom("Urbanist", size: 22).weight(.bold))
                    .foregroundColor(DesignSystem.Palette.Text.primary)

                Text("Securely configure your access token and motion preference.")
                    .font(.custom("Urbanist", size: 12).weight(.medium))
                    .foregroundColor(DesignSystem.Palette.Text.tertiary)
            }

            Spacer()

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(DesignSystem.Palette.Text.secondary)
                    .frame(width: 32, height: 32)
                    .background(
                        Circle()
                            .fill(DesignSystem.Palette.Background.surface)
                            .overlay(
                                Circle().stroke(Color.white.opacity(0.08), lineWidth: 1)
                            )
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, DesignSystem.Spacing.lg)
        .padding(.vertical, DesignSystem.Spacing.md)
        .background(
            Rectangle()
                .fill(DesignSystem.Palette.Background.base)
                .overlay(
                    Rectangle()
                        .fill(Color.white.opacity(0.06))
                        .frame(height: 1),
                    alignment: .bottom
                )
        )
    }

    private var tokenSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Access Token")
                        .font(.custom("Urbanist", size: 17).weight(.semibold))
                        .foregroundColor(DesignSystem.Palette.Text.primary)

                    Text("Paste the token you received. It is stored securely in your macOS Keychain.")
                        .font(.custom("Urbanist", size: 12).weight(.medium))
                        .foregroundColor(DesignSystem.Palette.Text.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer()

                Text("Cloud backend")
                    .font(.custom("Urbanist", size: 11).weight(.semibold))
                    .foregroundColor(DesignSystem.Palette.Text.secondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .fill(Color.white.opacity(0.06))
                    )
            }

            tokenField

            HStack(alignment: .center) {
                if showSaveSuccess {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(DesignSystem.success)
                        Text("Saved")
                            .font(.custom("Urbanist", size: 12).weight(.semibold))
                            .foregroundColor(DesignSystem.success)
                    }
                } else {
                    Text("You only need to do this once on this Mac.")
                        .font(.custom("Urbanist", size: 12).weight(.medium))
                        .foregroundColor(DesignSystem.Palette.Text.tertiary)
                }

                Spacer()

                Button(action: saveAPIKeys) {
                    if isSaving {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else {
                        Text("Save")
                    }
                }
                .buttonStyle(.accent)
                .disabled(isSaving || backendToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            HStack {
                Button(role: .destructive) {
                    showClearConfirm = true
                } label: {
                    Text("Clear Token")
                        .font(.custom("Urbanist", size: 12).weight(.semibold))
                        .foregroundColor(DesignSystem.Palette.Semantic.error)
                }
                .buttonStyle(.plain)

                Spacer()
            }
        }
    }

    private var tokenField: some View {
        HStack(spacing: 10) {
            Group {
                if revealToken {
                    TextField("Paste token", text: $backendToken)
                } else {
                    SecureField("Paste token", text: $backendToken)
                }
            }
            .textFieldStyle(.plain)
            .font(.custom("Urbanist", size: 13).weight(.medium))
            .foregroundColor(DesignSystem.Palette.Text.primary)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(DesignSystem.Palette.Background.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(Color.white.opacity(0.1), lineWidth: 1)
                    )
            )
            .autocorrectionDisabled()

            Button(action: { revealToken.toggle() }) {
                Image(systemName: revealToken ? "eye.slash" : "eye")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(DesignSystem.Palette.Text.secondary)
                    .frame(width: 36, height: 36)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(DesignSystem.Palette.Background.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
                            )
                    )
            }
            .buttonStyle(.plain)
            .help(revealToken ? "Hide token" : "Show token")
        }
    }

    private var motionSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Motion")
                .font(.custom("Urbanist", size: 17).weight(.semibold))
                .foregroundColor(DesignSystem.Palette.Text.primary)

            Picker("Motion Preference", selection: $motionPreference) {
                ForEach(MotionPreference.allCases) { preference in
                    Text(preference.title).tag(preference)
                }
            }
            .pickerStyle(.segmented)

            Text(motionPreference.summary)
                .font(.custom("Urbanist", size: 12).weight(.medium))
                .foregroundColor(DesignSystem.Palette.Text.secondary)
        }
    }

    private func loadExistingKeys() {
        let config = APIKeySetup.verifyBackendConfiguration()
        backendToken = config.token ?? ""
    }

    private func saveAPIKeys() {
        isSaving = true

        Task {
            do {
                try APIKeySetup.storeBackendConfiguration(
                    token: backendToken,
                    // Ensure we do not persist a backend URL in the UI; production URL is built-in.
                    baseURL: ""
                )

                await MainActor.run {
                    isSaving = false
                    showSaveSuccess = true

                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        showSaveSuccess = false
                    }
                }
            } catch {
                await MainActor.run {
                    isSaving = false
                }
                AppLogger.shared.error("Failed to save backend configuration", error: error)
            }
        }
    }

    private func clearBackendToken() {
        do {
            try KeychainManager.shared.delete(.backendAPIKey)
            backendToken = ""
            showSaveSuccess = false
        } catch {
            AppLogger.shared.error("Failed to clear backend token", error: error)
        }
    }
}
