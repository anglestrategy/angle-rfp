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

                if let description = data.projectDescription, !description.isEmpty {
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
                Text(scope)
                    .font(.custom("Urbanist", size: 14))
                    .foregroundColor(DesignSystem.Palette.Text.secondary)
                    .lineSpacing(5)

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
            VStack(alignment: .leading, spacing: 16) {
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

                // Factor bars (mock data for now - would come from FinancialPotential.factors)
                FactorBarGroup(factors: [
                    ("Budget", 85),
                    ("Scope", 72),
                    ("Client", 78),
                    ("Timeline", 68)
                ])

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
            Text(criteria)
                .font(.custom("Urbanist", size: 14))
                .foregroundColor(DesignSystem.Palette.Text.secondary)
                .lineSpacing(5)
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

    private func deliverablesSection(_ deliverables: [String]) -> some View {
        DashboardSection("Deliverables") {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(deliverables, id: \.self) { item in
                    HStack(spacing: 10) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(DesignSystem.Palette.Semantic.success)
                        Text(item)
                            .font(.custom("Urbanist", size: 14))
                            .foregroundColor(DesignSystem.Palette.Text.secondary)
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
                Text(requirements)
                    .font(.custom("Urbanist", size: 14))
                    .foregroundColor(DesignSystem.Palette.Text.secondary)
                    .lineSpacing(5)
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
                requiredDeliverables: ["Technical Proposal", "Creative Samples", "Team Bios", "Pricing Sheet"],
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
