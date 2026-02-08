//
//  ScopeBreakdown.swift
//  angle-rfp
//
//  Visual breakdown of agency vs non-agency scope.
//

import SwiftUI

struct ScopeBreakdown: View {
    let agencyPercentage: Double
    let agencyServices: [String]
    let nonAgencyServices: [String]

    private var nonAgencyPercentage: Double {
        1.0 - agencyPercentage
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Visual bar
            GeometryReader { geo in
                HStack(spacing: 2) {
                    // Agency portion
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
                        .frame(width: geo.size.width * agencyPercentage)

                    // Non-agency portion
                    RoundedRectangle(cornerRadius: 4)
                        .fill(DesignSystem.Palette.Background.surface)
                }
            }
            .frame(height: 12)

            // Details
            HStack(alignment: .top, spacing: 32) {
                // Agency services
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(DesignSystem.Palette.Accent.primary)
                            .frame(width: 8, height: 8)
                        Text("Agency Work")
                            .font(.custom("Urbanist", size: 13).weight(.semibold))
                            .foregroundColor(DesignSystem.Palette.Text.primary)
                        Text("\(Int(agencyPercentage * 100))%")
                            .font(.custom("IBM Plex Mono", size: 12))
                            .foregroundColor(DesignSystem.Palette.Accent.primary)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(agencyServices.prefix(5), id: \.self) { service in
                            Text("• \(service)")
                                .font(.custom("Urbanist", size: 12))
                                .foregroundColor(DesignSystem.Palette.Text.tertiary)
                        }
                    }
                }

                // Non-agency services
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(DesignSystem.Palette.Text.muted)
                            .frame(width: 8, height: 8)
                        Text("Outside Scope")
                            .font(.custom("Urbanist", size: 13).weight(.semibold))
                            .foregroundColor(DesignSystem.Palette.Text.primary)
                        Text("\(Int(nonAgencyPercentage * 100))%")
                            .font(.custom("IBM Plex Mono", size: 12))
                            .foregroundColor(DesignSystem.Palette.Text.muted)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(nonAgencyServices.prefix(5), id: \.self) { service in
                            Text("• \(service)")
                                .font(.custom("Urbanist", size: 12))
                                .foregroundColor(DesignSystem.Palette.Text.muted)
                        }
                    }
                }

                Spacer()
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(DesignSystem.Palette.Background.elevated)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color.white.opacity(0.04), lineWidth: 1)
                )
        )
    }
}

#if DEBUG
struct ScopeBreakdown_Previews: PreviewProvider {
    static var previews: some View {
        ScopeBreakdown(
            agencyPercentage: 0.65,
            agencyServices: ["Brand Strategy", "Visual Design", "Campaign Planning", "Creative Execution"],
            nonAgencyServices: ["Media Buying", "PR Distribution"]
        )
        .padding(24)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
