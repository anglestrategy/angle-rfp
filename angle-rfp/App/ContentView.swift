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
        case .analyzing:
            return .criteria
        case .researching:
            return .research
        case .calculating:
            return .score
        case .complete:
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
    @State private var apiKeysConfigured = false

    // Demo mode - set to true to bypass API and use mock data
    private let useDemoMode = true

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
        ZStack {
            backgroundLayer

            VStack(spacing: 0) {
                AppHeader(
                    currentStep: activeStepIndex,
                    completedSteps: completedSteps,
                    apiKeysConfigured: useDemoMode || apiKeysConfigured,
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
                            onBeginAnalysis: beginAnalysis
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
        }
        .frame(minWidth: DesignSystem.Layout.minWindowWidth, minHeight: DesignSystem.Layout.minWindowHeight)
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

    private var backgroundLayer: some View {
        DesignSystem.Palette.Background.base
            .ignoresSafeArea()
    }

    private var completedSteps: Set<Int> {
        var completed = Set<Int>()

        switch appState {
        case .upload:
            break
        case .analyzing:
            completed.insert(0) // Upload complete
            if currentStage.rawValue >= AnalysisStage.analyzing.rawValue {
                completed.insert(1) // Parse complete
            }
            if currentStage.rawValue >= AnalysisStage.researching.rawValue {
                completed.insert(2) // Criteria complete
            }
            if currentStage.rawValue >= AnalysisStage.calculating.rawValue {
                completed.insert(3) // Research complete
            }
            if currentStage == .complete {
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
                onBeginAnalysis: beginAnalysis
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

        withAnimation(DesignSystem.Animation.runway(for: selectedMotionPreference)) {
            appState = .analyzing(documentName: url.lastPathComponent)
        }

        performAnalysis(documentURL: url)
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
        print("Exporting as: \(type.rawValue)")
    }

    private func checkAPIKeyStatus() {
        let keys = APIKeySetup.verifyAPIKeys()
        apiKeysConfigured = keys.claude != nil
    }

    // MARK: - Analysis Process

    private func performAnalysis(documentURL: URL) {
        if useDemoMode {
            performMockAnalysis(documentName: documentURL.lastPathComponent)
            return
        }

        Task {
            let accessGranted = documentURL.startAccessingSecurityScopedResource()
            defer {
                if accessGranted {
                    documentURL.stopAccessingSecurityScopedResource()
                }
            }

            do {
                updateStage(.parsing, progress: 0.1)
                let parseResult = try await parseDocument(at: documentURL)

                if !parseResult.warnings.isEmpty {
                    await MainActor.run {
                        parsingWarnings = parseResult.warnings.map { $0.message }
                    }
                }

                updateProgress(0.25)

                updateStage(.analyzing, progress: 0.3)
                let extractedData = try await analyzeWithClaude(text: parseResult.text)
                updateProgress(0.55)

                updateStage(.researching, progress: 0.6)
                let clientInfo = try? await researchCompany(name: extractedData.clientName ?? "Unknown")
                updateProgress(0.8)

                updateStage(.calculating, progress: 0.85)
                updateProgress(0.95)

                updateStage(.complete, progress: 1.0)
                try await Task.sleep(nanoseconds: 450_000_000)

                await MainActor.run {
                    withAnimation(DesignSystem.Animation.runway(for: selectedMotionPreference)) {
                        self.extractedData = extractedData
                        self.clientInfo = clientInfo
                        self.appState = .dashboard(data: extractedData, clientInfo: clientInfo)
                    }
                }

            } catch {
                print("Analysis error: \(error)")
                await MainActor.run {
                    parsingWarnings.append("Analysis failed: \(error.localizedDescription)")
                    appState = .upload
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

            // Stage 2: Analyzing
            currentStage = .analyzing
            analysisProgress = 0.3
            try? await Task.sleep(nanoseconds: 600_000_000)
            analysisProgress = 0.55

            // Stage 3: Researching
            currentStage = .researching
            analysisProgress = 0.6
            try? await Task.sleep(nanoseconds: 500_000_000)
            analysisProgress = 0.8

            // Stage 4: Calculating
            currentStage = .calculating
            analysisProgress = 0.85
            try? await Task.sleep(nanoseconds: 400_000_000)
            analysisProgress = 0.95

            // Stage 5: Complete
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
                ImportantDate(title: "Finalist Presentations", date: Date().addingTimeInterval(86400 * 35), dateType: .presentationDate, isCritical: true),
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

    private func parseDocument(at url: URL) async throws -> ParseResult {
        let fileExtension = url.pathExtension.lowercased()

        switch fileExtension {
        case "pdf":
            let parser = PDFParsingService()
            return try await parser.parseDocument(at: url) { progress in
                Task { self.updateProgress(0.1 + progress * 0.15) }
            }
        case "txt":
            let parser = TXTParsingService()
            return try await parser.parseDocument(at: url)
        case "docx":
            throw NSError(
                domain: "angle.rfp",
                code: 1001,
                userInfo: [NSLocalizedDescriptionKey: "DOCX support coming soon"]
            )
        default:
            throw NSError(
                domain: "angle.rfp",
                code: 1000,
                userInfo: [NSLocalizedDescriptionKey: "Unsupported format: .\(fileExtension)"]
            )
        }
    }

    private func analyzeWithClaude(text: String) async throws -> ExtractedRFPData {
        try await ClaudeAnalysisService.shared.analyzeRFP(
            documentText: text,
            documentID: UUID(),
            agencyServices: []
        )
    }

    private func researchCompany(name: String) async throws -> ClientInformation {
        try await BraveSearchService.shared.researchCompany(name)
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

    @State private var claudeAPIKey = ""
    @State private var braveAPIKey = ""
    @State private var isSaving = false
    @State private var showSaveSuccess = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Settings")
                    .font(.custom("Urbanist", size: 28).weight(.bold))
                    .foregroundColor(DesignSystem.Palette.Charcoal.c900)

                Spacer()

                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(DesignSystem.Palette.Charcoal.c700)
                        .padding(8)
                        .background(Circle().fill(DesignSystem.Palette.Cream.base))
                }
                .buttonStyle(.plain)
            }
            .padding(DesignSystem.Spacing.lg)

            Divider()
                .overlay(DesignSystem.Palette.Charcoal.c900.opacity(0.16))

            ScrollView {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xl) {
                    settingsCard {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("Motion")
                                .font(.custom("Urbanist", size: 17).weight(.semibold))
                                .foregroundColor(DesignSystem.Palette.Charcoal.c900)

                            Picker("Motion Preference", selection: $motionPreference) {
                                ForEach(MotionPreference.allCases) { preference in
                                    Text(preference.title).tag(preference)
                                }
                            }
                            .pickerStyle(.segmented)

                            Text(motionPreference.summary)
                                .font(.custom("Urbanist", size: 12).weight(.medium))
                                .foregroundColor(DesignSystem.Palette.Charcoal.c700)
                        }
                    }

                    settingsCard {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("API Configuration")
                                .font(.custom("Urbanist", size: 17).weight(.semibold))
                                .foregroundColor(DesignSystem.Palette.Charcoal.c900)

                            VStack(alignment: .leading, spacing: 6) {
                                Text("Claude API Key")
                                    .font(.custom("Urbanist", size: 12).weight(.medium))
                                    .foregroundColor(DesignSystem.Palette.Charcoal.c700)
                                SecureField("sk-ant-...", text: $claudeAPIKey)
                                    .textFieldStyle(.roundedBorder)
                            }

                            VStack(alignment: .leading, spacing: 6) {
                                Text("Brave Search API Key")
                                    .font(.custom("Urbanist", size: 12).weight(.medium))
                                    .foregroundColor(DesignSystem.Palette.Charcoal.c700)
                                SecureField("BSA...", text: $braveAPIKey)
                                    .textFieldStyle(.roundedBorder)
                            }

                            HStack {
                                if showSaveSuccess {
                                    HStack(spacing: 6) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundColor(DesignSystem.success)
                                        Text("Saved")
                                            .font(.custom("Urbanist", size: 12).weight(.semibold))
                                            .foregroundColor(DesignSystem.success)
                                    }
                                }

                                Spacer()

                                Button(action: saveAPIKeys) {
                                    if isSaving {
                                        ProgressView()
                                            .scaleEffect(0.8)
                                    } else {
                                        Text("Save Keys")
                                    }
                                }
                                .buttonStyle(.accent)
                                .disabled(isSaving)
                            }
                        }
                    }
                }
                .padding(DesignSystem.Spacing.lg)
            }
        }
        .frame(width: 560, height: 420)
        .background(DesignSystem.Palette.Cream.elevated)
        .onAppear {
            loadExistingKeys()
        }
    }

    private func settingsCard<Content: View>(@ViewBuilder content: @escaping () -> Content) -> some View {
        RunwayCardSurface(role: .neutral, cornerRadius: 14, contentPadding: 18) {
            content()
        }
    }

    private func loadExistingKeys() {
        claudeAPIKey = (try? KeychainManager.shared.get(.claudeAPIKey)) ?? ""
        braveAPIKey = (try? KeychainManager.shared.get(.braveAPIKey)) ?? ""
    }

    private func saveAPIKeys() {
        isSaving = true

        Task {
            do {
                if !claudeAPIKey.isEmpty {
                    try KeychainManager.shared.set(claudeAPIKey, forKey: .claudeAPIKey)
                }
                if !braveAPIKey.isEmpty {
                    try KeychainManager.shared.set(braveAPIKey, forKey: .braveAPIKey)
                }

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
                print("Failed to save API keys: \(error)")
            }
        }
    }
}
