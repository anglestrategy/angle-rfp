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
                VStack(alignment: .leading, spacing: 32) {
                    // Hero header
                    heroSection

                    // Scope of Work
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
                .padding(40)
            }
        }
        .opacity(isRevealed ? 1 : 0)
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) {
                isRevealed = true
            }
        }
    }

    // MARK: - Hero Section

    private var heroSection: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 12) {
                Text(data.clientName ?? "Unknown Client")
                    .font(.custom("Urbanist", size: 36).weight(.bold))
                    .foregroundColor(DesignSystem.Palette.Text.primary)

                Text(data.projectName ?? "RFP Analysis")
                    .font(.custom("Urbanist", size: 20).weight(.medium))
                    .foregroundColor(DesignSystem.Palette.Text.secondary)

                // Use beautified project description if available
                if let beautified = sanitizedHeroDescription, !beautified.sections.isEmpty {
                    BeautifiedTextView(
                        beautifiedText: beautified,
                        fallbackText: nil
                    )
                    .padding(.top, 4)
                } else if let description = data.projectDescription, !description.isEmpty {
                    Text(description)
                        .font(.custom("Urbanist", size: 15))
                        .foregroundColor(DesignSystem.Palette.Text.tertiary)
                        .lineSpacing(4)
                        .padding(.top, 4)
                }
            }

            Spacer()

            ScoreHero(score: financialScore, recommendation: recommendationLevel)
        }
    }

    // MARK: - Scope Section

    private func scopeSection(_ scope: String) -> some View {
        DashboardSection("Scope of Work") {
            VStack(alignment: .leading, spacing: 16) {
                // Use beautified text if available, otherwise fall back to raw text
                BeautifiedTextView(
                    beautifiedText: data.beautifiedText?.scopeOfWork,
                    fallbackText: scope
                )

                if let analysis = data.scopeAnalysis {
                    ScopeBreakdown(
                        agencyPercentage: analysis.agencyServicePercentage,
                        agencyServices: analysis.agencyServices,
                        nonAgencyServices: analysis.nonAgencyServices
                    )
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
            VStack(alignment: .leading) {
                BeautifiedTextView(
                    beautifiedText: data.beautifiedText?.evaluationCriteria,
                    fallbackText: criteria
                )
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
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

    // MARK: - Deliverables Section

    private func deliverablesSection(_ deliverables: [Deliverable]) -> some View {
        DashboardSection("Deliverables") {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(deliverables) { deliverable in
                    HStack(spacing: 10) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(DesignSystem.Palette.Semantic.success)
                        Text(deliverable.item)
                            .font(.custom("Urbanist", size: 14))
                            .foregroundColor(DesignSystem.Palette.Text.secondary)
                        Spacer()
                        // Source tag
                        Text(deliverable.source == .verbatim ? "Verbatim" : "Inferred")
                            .font(.custom("Urbanist", size: 10).weight(.medium))
                            .foregroundColor(deliverable.source == .verbatim
                                ? DesignSystem.Palette.Semantic.success
                                : DesignSystem.Palette.Accent.primary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                    .fill(deliverable.source == .verbatim
                                        ? DesignSystem.Palette.Semantic.success.opacity(0.15)
                                        : DesignSystem.Palette.Accent.primary.opacity(0.15))
                            )
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
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

    // MARK: - Dates Section

    private func datesSection(_ dates: [ImportantDate]) -> some View {
        DashboardSection("Important Dates") {
            TimelineVisualization(dates: dates)
        }
    }

    // MARK: - Submission Section

    private func submissionSection(_ requirements: String) -> some View {
        DashboardSection("Submission Requirements") {
            VStack(alignment: .leading, spacing: 12) {
                // Parse the submission requirements into structured rows
                ForEach(requirements.components(separatedBy: "\n"), id: \.self) { line in
                    if !line.isEmpty {
                        SubmissionRow(line: line)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
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
                HStack(spacing: 8) {
                    Image(systemName: "arrow.counterclockwise")
                    Text("Analyze Another")
                }
                .font(.custom("Urbanist", size: 14).weight(.medium))
                .foregroundColor(DesignSystem.Palette.Text.secondary)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(DesignSystem.Palette.Background.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(Color.white.opacity(0.06), lineWidth: 1)
                        )
                )
            }
            .buttonStyle(.plain)

            Spacer()

            Button(action: { onExport(.pdf) }) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.down.doc")
                    Text("Export PDF")
                }
            }
            .buttonStyle(.accentGradient)
        }
        .padding(.top, 16)
    }
}

// MARK: - Submission Row Component

private struct SubmissionRow: View {
    let line: String

    private var icon: String {
        if line.hasPrefix("Method:") {
            return "arrow.up.doc.fill"
        } else if line.hasPrefix("Format:") {
            return "doc.fill"
        } else if line.hasPrefix("Email:") {
            return "envelope.fill"
        } else if line.hasPrefix("Address:") {
            return "building.2.fill"
        } else if line.hasPrefix("Copies:") {
            return "doc.on.doc.fill"
        } else {
            return "info.circle.fill"
        }
    }

    private var label: String {
        if let colonIndex = line.firstIndex(of: ":") {
            return String(line[..<colonIndex])
        }
        return ""
    }

    private var value: String {
        if let colonIndex = line.firstIndex(of: ":") {
            let afterColon = line.index(after: colonIndex)
            return String(line[afterColon...]).trimmingCharacters(in: .whitespaces)
        }
        return line
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(DesignSystem.Palette.Accent.primary)
                .frame(width: 20)

            Text(label)
                .font(.custom("Urbanist", size: 13).weight(.medium))
                .foregroundColor(DesignSystem.Palette.Text.tertiary)
                .frame(width: 60, alignment: .leading)

            Text(value)
                .font(.custom("Urbanist", size: 14))
                .foregroundColor(DesignSystem.Palette.Text.secondary)

            Spacer()
        }
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
