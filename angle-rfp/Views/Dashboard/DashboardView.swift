//
//  DashboardView.swift
//  angle-rfp
//
//  Clean, modern dashboard design
//

import SwiftUI

struct DashboardView: View {
    let data: ExtractedRFPData
    let clientInfo: ClientInformation?
    let onExport: (ExportType) -> Void
    let onNewAnalysis: () -> Void

    @State private var isRevealed = false

    private var financialScore: Int {
        Int((data.financialPotential?.totalScore ?? 0).rounded())
    }

    private var recommendationLevel: String {
        data.financialPotential?.recommendationLevel ?? "Review Required"
    }

    private var sanitizedHeroDescription: BeautifiedText? {
        guard let beautified = data.beautifiedText?.projectDescription else {
            return nil
        }

        var output: [TextSection] = []
        var suppressUntilNextHeading = false

        for section in beautified.sections {
            let headingText = section.content
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()

            if section.type == .heading || section.type == .subheading {
                if headingText == "project overview" {
                    suppressUntilNextHeading = false
                    continue
                }

                if headingText == "project scope" {
                    suppressUntilNextHeading = true
                    continue
                }

                suppressUntilNextHeading = false
            }

            if suppressUntilNextHeading {
                continue
            }

            output.append(section)
        }

        return BeautifiedText(
            formatted: beautified.formatted,
            sections: output.isEmpty ? beautified.sections : output
        )
    }

    var body: some View {
        SceneContainer {
            ScrollView {
                VStack(alignment: .leading, spacing: 40) {
                    // Hero header
                    heroSection

                    // Executive summary
                    executiveSummarySection

                    // Scope analysis
                    if let scope = data.scopeOfWork, !scope.isEmpty {
                        scopeSection(scope)
                    }

                    // Financial Potential
                    if data.financialPotential != nil {
                        financialSection
                    }

                    // Evaluation Criteria
                    if let criteria = data.evaluationCriteria, !criteria.isEmpty {
                        evaluationSection(criteria)
                    }

                    // Deliverables
                    if let deliverables = data.requiredDeliverables, !deliverables.isEmpty {
                        deliverablesSection(deliverables)
                    }

                    // Important Dates
                    if let dates = data.importantDates, !dates.isEmpty {
                        datesSection(dates)
                    }

                    // Submission Requirements
                    if let submission = data.submissionMethodRequirements, !submission.isEmpty {
                        submissionSection(submission)
                    }

                    // Actions footer
                    actionsSection
                }
                .padding(.horizontal, 40)
                .padding(.vertical, 48)
            }
        }
        .opacity(isRevealed ? 1 : 0)
        .onAppear {
            withAnimation(.easeOut(duration: 0.4)) {
                isRevealed = true
            }
        }
    }

    // MARK: - Hero Section

    private var heroSection: some View {
        VStack(alignment: .leading, spacing: 24) {
            // Overline
            Text("ANALYSIS COMPLETE")
                .font(.custom("IBM Plex Mono", size: 10).weight(.medium))
                .tracking(2)
                .foregroundColor(DesignSystem.Palette.Text.muted)

            // Client and score row
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(data.clientName ?? "Unknown Client")
                        .font(.custom("Urbanist", size: 36).weight(.bold))
                        .foregroundColor(DesignSystem.Palette.Text.primary)

                    Text(data.projectName ?? "RFP Analysis")
                        .font(.custom("Urbanist", size: 16))
                        .foregroundColor(DesignSystem.Palette.Text.tertiary)
                }

                Spacer()

                ScoreHero(score: financialScore, recommendation: recommendationLevel)
            }
        }
    }

    // MARK: - Executive Summary Section

    @ViewBuilder
    private var executiveSummarySection: some View {
        if let beautified = sanitizedHeroDescription, !beautified.sections.isEmpty {
            DashboardSection("Executive Summary") {
                BeautifiedTextView(
                    beautifiedText: beautified,
                    fallbackText: nil
                )
            }
        } else if let description = data.projectDescription, !description.isEmpty {
            DashboardSection("Executive Summary") {
                Text(description)
                    .font(.custom("Urbanist", size: 14))
                    .foregroundColor(DesignSystem.Palette.Text.secondary)
                    .lineSpacing(5)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: - Scope Section

    private func scopeSection(_: String) -> some View {
        DashboardSection("Scope Analysis") {
            VStack(alignment: .leading, spacing: 16) {
                if let analysis = data.scopeAnalysis {
                    ScopeBreakdown(
                        agencyPercentage: analysis.agencyServicePercentage,
                        agencyServices: analysis.agencyServices,
                        nonAgencyServices: analysis.nonAgencyServices
                    )
                } else {
                    Text("Scope analysis is unavailable for this document.")
                        .font(.custom("Urbanist", size: 13))
                        .foregroundColor(DesignSystem.Palette.Text.muted)
                }
            }
        }
    }

    // MARK: - Financial Section

    private var financialSection: some View {
        DashboardSection("Financial Potential") {
            VStack(alignment: .leading, spacing: 20) {
                // AI recommendation
                if let recommendation = data.financialPotential?.recommendation, !recommendation.isEmpty {
                    Text("\"\(recommendation)\"")
                        .font(.custom("Urbanist", size: 15).italic())
                        .foregroundColor(DesignSystem.Palette.Text.secondary)
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(DesignSystem.Palette.Accent.primary.opacity(0.08))
                                .overlay(
                                    Rectangle()
                                        .fill(DesignSystem.Palette.Accent.primary)
                                        .frame(width: 3),
                                    alignment: .leading
                                )
                        )
                }

                // All 11 scoring factors with evidence
                if let factors = data.financialPotential?.factors, !factors.isEmpty {
                    FinancialFactorsGrid(factors: factors)
                }

                // Formula explanation
                if let explanation = data.financialPotential?.formulaExplanation, !explanation.isEmpty {
                    Text(explanation)
                        .font(.custom("Urbanist", size: 12))
                        .foregroundColor(DesignSystem.Palette.Text.muted)
                        .lineSpacing(4)
                }
            }
        }
    }

    // MARK: - Evaluation Section

    private func evaluationSection(_ criteria: String) -> some View {
        DashboardSection("Evaluation Criteria") {
            EvaluationCriteriaView(
                beautifiedText: data.beautifiedText?.evaluationCriteria,
                fallbackText: criteria
            )
        }
    }

    // MARK: - Deliverables Section

    private func deliverablesSection(_ deliverables: [Deliverable]) -> some View {
        DashboardSection("Deliverables") {
            VStack(alignment: .leading, spacing: 20) {
                if let grouped = data.deliverableRequirements, !grouped.isEmpty {
                    deliverableRequirementGroup(
                        title: "Technical Requirements",
                        items: grouped.technical
                    )
                    deliverableRequirementGroup(
                        title: "Commercial Requirements",
                        items: grouped.commercial
                    )
                    deliverableRequirementGroup(
                        title: "Strategic and Creative Requirements",
                        items: grouped.strategicCreative
                    )
                } else {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(deliverables.enumerated()), id: \.element.id) { index, deliverable in
                            HStack(alignment: .center, spacing: 12) {
                                Circle()
                                    .fill(DesignSystem.Palette.Accent.primary)
                                    .frame(width: 5, height: 5)

                                Text(deliverable.item)
                                    .font(.custom("Urbanist", size: 14))
                                    .foregroundColor(DesignSystem.Palette.Text.primary)

                                Spacer()

                                Text(deliverable.source == .verbatim ? "Verbatim" : "Inferred")
                                    .font(.custom("IBM Plex Mono", size: 10))
                                    .foregroundColor(deliverable.source == .verbatim
                                        ? DesignSystem.Palette.Text.muted
                                        : DesignSystem.Palette.Accent.primary)
                            }
                            .padding(.vertical, 12)
                            .overlay(
                                Group {
                                    if index < deliverables.count - 1 {
                                        Rectangle()
                                            .fill(Color.white.opacity(0.04))
                                            .frame(height: 1)
                                    }
                                },
                                alignment: .bottom
                            )
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(DesignSystem.Palette.Background.elevated)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(Color.white.opacity(0.04), lineWidth: 1)
                    )
            )
        }
    }

    private func deliverableRequirementGroup(title: String, items: [DeliverableRequirementItem]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.custom("Urbanist", size: 14).weight(.semibold))
                .foregroundColor(DesignSystem.Palette.Text.primary)

            if items.isEmpty {
                Text("No explicit requirements extracted for this section.")
                    .font(.custom("Urbanist", size: 13))
                    .foregroundColor(DesignSystem.Palette.Text.tertiary)
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(items) { item in
                        HStack(alignment: .top, spacing: 10) {
                            Circle()
                                .fill(DesignSystem.Palette.Accent.primary)
                                .frame(width: 5, height: 5)
                                .padding(.top, 7)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.title)
                                    .font(.custom("Urbanist", size: 13).weight(.semibold))
                                    .foregroundColor(DesignSystem.Palette.Text.primary)

                                Text(item.description)
                                    .font(.custom("Urbanist", size: 13))
                                    .foregroundColor(DesignSystem.Palette.Text.secondary)
                                    .lineSpacing(4)
                                    .fixedSize(horizontal: false, vertical: true)
                            }

                            Spacer(minLength: 8)

                            Text(item.source == .verbatim ? "Verbatim" : "Inferred")
                                .font(.custom("IBM Plex Mono", size: 10))
                                .foregroundColor(item.source == .verbatim
                                    ? DesignSystem.Palette.Text.muted
                                    : DesignSystem.Palette.Accent.primary)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Dates Section

    private func datesSection(_ dates: [ImportantDate]) -> some View {
        DashboardSection("Important Dates") {
            TimelineVisualization(dates: dates)
        }
    }

    // MARK: - Submission Section

    private func submissionSection(_ requirements: String) -> some View {
        DashboardSection("Submission Requirements") {
            Text(requirements)
                .font(.custom("Urbanist", size: 14))
                .foregroundColor(DesignSystem.Palette.Text.secondary)
                .lineSpacing(6)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(DesignSystem.Palette.Background.elevated)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(Color.white.opacity(0.04), lineWidth: 1)
                        )
                )
        }
    }

    // MARK: - Actions

    private var actionsSection: some View {
        HStack {
            Button(action: onNewAnalysis) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(DesignSystem.Palette.Text.muted)
                        .frame(width: 6, height: 6)
                    Text("Analyze another")
                        .font(.custom("Urbanist", size: 13).weight(.medium))
                        .foregroundColor(DesignSystem.Palette.Text.muted)
                }
            }
            .buttonStyle(.plain)

            Spacer()

            Button(action: { onExport(.pdf) }) {
                HStack(spacing: 8) {
                    Text("Export PDF")
                        .font(.custom("Urbanist", size: 14).weight(.semibold))
                    Image(systemName: "arrow.down")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(DesignSystem.Palette.Accent.primary)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.top, 24)
    }
}

enum ExportType: String, CaseIterable {
    case pdf = "PDF"
    case email = "Email"
    case clipboard = "Clipboard"
    case link = "Link"

    var icon: String {
        switch self {
        case .pdf: return "doc.fill"
        case .email: return "envelope.fill"
        case .clipboard: return "doc.on.clipboard"
        case .link: return "link"
        }
    }
}

#if DEBUG
struct DashboardView_Previews: PreviewProvider {
    static var previews: some View {
        DashboardView(
            data: ExtractedRFPData(
                clientName: "Acme Corporation",
                projectName: "Brand Campaign 2024",
                projectDescription: "A comprehensive brand refresh including digital and print assets.",
                scopeOfWork: "The scope includes brand strategy development, visual identity design, and campaign execution across multiple channels.",
                scopeAnalysis: ScopeAnalysis(
                    agencyServices: ["Brand Strategy", "Visual Design", "Campaign Planning"],
                    nonAgencyServices: ["Media Buying", "PR Distribution"],
                    agencyServicePercentage: 0.65,
                    outputQuantities: nil,
                    outputTypes: [.video, .motionGraphics, .visuals]
                ),
                financialPotential: FinancialPotential(
                    totalScore: 78,
                    recommendation: "Strong opportunity with good agency fit.",
                    factors: [],
                    formulaExplanation: "Score based on company size, scope alignment, and output types."
                ),
                evaluationCriteria: "Proposals will be evaluated on creative approach (40%), team experience (30%), and pricing (30%).",
                requiredDeliverables: [
                    Deliverable(item: "Technical Proposal", source: .verbatim),
                    Deliverable(item: "Creative Samples", source: .verbatim),
                    Deliverable(item: "Team Bios", source: .inferred),
                    Deliverable(item: "Pricing Sheet", source: .verbatim)
                ],
                importantDates: [
                    ImportantDate(title: "Questions Due", date: Date().addingTimeInterval(86400 * 7), dateType: .questionsDeadline, isCritical: false),
                    ImportantDate(title: "Proposal Due", date: Date().addingTimeInterval(86400 * 14), dateType: .proposalDeadline, isCritical: true)
                ],
                submissionMethodRequirements: "Submit via email to procurement@acme.com by 5:00 PM EST.",
                parsingWarnings: [],
                completeness: 0.9
            ),
            clientInfo: ClientInformation(
                name: "Acme Corporation",
                companySize: .large,
                brandPopularity: .national,
                entityType: .privateCompany
            ),
            onExport: { _ in },
            onNewAnalysis: {}
        )
        .frame(width: 1240, height: 760)
        .padding(16)
        .background(DesignSystem.Palette.Cream.base)
    }
}
#endif
