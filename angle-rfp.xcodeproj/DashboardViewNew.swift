//
//  DashboardViewNew.swift
//  angle-rfp
//
//  Clean, modern dashboard design
//

import SwiftUI

struct DashboardViewNew: View {
    let data: ExtractedRFPData
    let clientInfo: ClientInformation?
    let onExport: (ExportType) -> Void
    let onNewAnalysis: () -> Void

    @State private var isRevealed = false

    private var scoreColor: Color {
        let score = data.financialPotential?.totalScore ?? 0
        switch score {
        case 0..<40: return .red
        case 40..<70: return .orange
        case 70..<85: return DesignSystem.Palette.Vermillion.v500
        default: return .green
        }
    }

    private var financialScore: Int {
        Int((data.financialPotential?.totalScore ?? 0).rounded())
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text(data.projectName ?? "RFP Analysis")
                        .font(.custom("Urbanist", size: 36).weight(.bold))
                        .foregroundColor(.white)
                    
                    Text(data.clientName ?? "Unknown Client")
                        .font(.custom("Urbanist", size: 16))
                        .foregroundColor(.white.opacity(0.6))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                
                // Score card
                VStack(spacing: 24) {
                    HStack(alignment: .top, spacing: 32) {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Financial Score")
                                .font(.custom("Urbanist", size: 13).weight(.semibold))
                                .foregroundColor(.white.opacity(0.6))
                            
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text("\(financialScore)")
                                    .font(.custom("IBM Plex Mono", size: 72).weight(.bold))
                                    .foregroundColor(scoreColor)
                                Text("/100")
                                    .font(.custom("Urbanist", size: 20))
                                    .foregroundColor(.white.opacity(0.5))
                            }
                            
                            Text(data.financialPotential?.recommendationLevel ?? "Review Required")
                                .font(.custom("Urbanist", size: 16).weight(.medium))
                                .foregroundColor(.white.opacity(0.8))
                        }
                        
                        Spacer()
                        
                        VStack(alignment: .trailing, spacing: 16) {
                            Button(action: onNewAnalysis) {
                                HStack(spacing: 8) {
                                    Image(systemName: "arrow.counterclockwise")
                                    Text("New Analysis")
                                }
                                .font(.custom("Urbanist", size: 14).weight(.semibold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 12)
                                .background(
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .fill(Color.white.opacity(0.1))
                                )
                            }
                            .buttonStyle(.plain)
                            
                            HStack(spacing: 12) {
                                ForEach([("doc.fill", "PDF"), ("envelope.fill", "Email")], id: \.0) { icon, title in
                                    Button(action: { onExport(icon == "doc.fill" ? .pdf : .email) }) {
                                        VStack(spacing: 6) {
                                            Image(systemName: icon)
                                                .font(.system(size: 18))
                                            Text(title)
                                                .font(.custom("Urbanist", size: 11).weight(.medium))
                                        }
                                        .foregroundColor(.white.opacity(0.7))
                                        .frame(width: 70, height: 70)
                                        .background(
                                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                .fill(Color.white.opacity(0.05))
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                .padding(32)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.white.opacity(0.05))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(scoreColor.opacity(0.3), lineWidth: 1)
                        )
                )
                
                // Content sections
                VStack(alignment: .leading, spacing: 24) {
                    if let description = data.projectDescription, !description.isEmpty {
                        contentSection("Project Description", description)
                    }
                    
                    if let scope = data.scopeOfWork, !scope.isEmpty {
                        contentSection("Scope of Work", scope)
                    }
                    
                    if let criteria = data.evaluationCriteria, !criteria.isEmpty {
                        contentSection("Evaluation Criteria", criteria)
                    }
                    
                    if let deliverables = data.requiredDeliverables, !deliverables.isEmpty {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("Deliverables")
                                .font(.custom("Urbanist", size: 18).weight(.semibold))
                                .foregroundColor(.white)
                            
                            VStack(alignment: .leading, spacing: 12) {
                                ForEach(deliverables, id: \.self) { item in
                                    HStack(spacing: 12) {
                                        Circle()
                                            .fill(DesignSystem.Palette.Vermillion.v500)
                                            .frame(width: 6, height: 6)
                                        Text(item)
                                            .font(.custom("Urbanist", size: 14))
                                            .foregroundColor(.white.opacity(0.8))
                                    }
                                }
                            }
                        }
                        .padding(24)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color.white.opacity(0.03))
                        )
                    }
                    
                    if let dates = data.importantDates, !dates.isEmpty {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("Important Dates")
                                .font(.custom("Urbanist", size: 18).weight(.semibold))
                                .foregroundColor(.white)
                            
                            VStack(spacing: 12) {
                                ForEach(dates.sorted(by: { $0.date < $1.date }), id: \.id) { date in
                                    HStack {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(date.title)
                                                .font(.custom("Urbanist", size: 14).weight(.medium))
                                                .foregroundColor(.white)
                                            Text(date.date.formatted(date: .long, time: .omitted))
                                                .font(.custom("IBM Plex Mono", size: 12))
                                                .foregroundColor(.white.opacity(0.5))
                                        }
                                        
                                        Spacer()
                                        
                                        if date.isCritical {
                                            Text("Critical")
                                                .font(.custom("Urbanist", size: 11).weight(.semibold))
                                                .foregroundColor(.orange)
                                                .padding(.horizontal, 10)
                                                .padding(.vertical, 4)
                                                .background(
                                                    Capsule()
                                                        .fill(Color.orange.opacity(0.2))
                                                )
                                        }
                                    }
                                    .padding(16)
                                    .background(
                                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                                            .fill(Color.white.opacity(0.03))
                                    )
                                }
                            }
                        }
                        .padding(24)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color.white.opacity(0.03))
                        )
                    }
                }
            }
            .padding(40)
        }
        .opacity(isRevealed ? 1 : 0)
        .offset(y: isRevealed ? 0 : 20)
        .onAppear {
            withAnimation(.easeOut(duration: 0.4)) {
                isRevealed = true
            }
        }
    }
    
    private func contentSection(_ title: String, _ content: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.custom("Urbanist", size: 18).weight(.semibold))
                .foregroundColor(.white)
            
            Text(content)
                .font(.custom("Urbanist", size: 14))
                .foregroundColor(.white.opacity(0.7))
                .lineSpacing(6)
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.white.opacity(0.03))
        )
    }
}
