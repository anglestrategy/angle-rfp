//
//  ScopeBreakdown.swift
//  angle-rfp
//
//  Clean scope breakdown with minimal styling.
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
        VStack(alignment: .leading, spacing: 24) {
            // Visual bar with labels
            VStack(alignment: .leading, spacing: 12) {
                GeometryReader { geo in
                    HStack(spacing: 2) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(DesignSystem.Palette.Accent.primary)
                            .frame(width: geo.size.width * agencyPercentage)

                        RoundedRectangle(cornerRadius: 2)
                            .fill(DesignSystem.Palette.Background.surface)
                    }
                }
                .frame(height: 6)

                // Percentage labels
                HStack {
                    Text("\(Int(agencyPercentage * 100))% in scope")
                        .font(.custom("IBM Plex Mono", size: 11))
                        .foregroundColor(DesignSystem.Palette.Accent.primary)

                    Spacer()

                    Text("\(Int(nonAgencyPercentage * 100))% outside")
                        .font(.custom("IBM Plex Mono", size: 11))
                        .foregroundColor(DesignSystem.Palette.Text.muted)
                }
            }

            // Service lists - two equal columns
            HStack(alignment: .top, spacing: 0) {
                // Agency services (left column)
                VStack(alignment: .leading, spacing: 10) {
                    Text("Agency Services")
                        .font(.custom("Urbanist", size: 13).weight(.semibold))
                        .foregroundColor(DesignSystem.Palette.Text.primary)

                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(agencyServices.prefix(5), id: \.self) { service in
                            HStack(spacing: 8) {
                                Circle()
                                    .fill(DesignSystem.Palette.Accent.primary)
                                    .frame(width: 4, height: 4)
                                Text(service)
                                    .font(.custom("Urbanist", size: 13))
                                    .foregroundColor(DesignSystem.Palette.Text.secondary)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Non-agency services (right column)
                VStack(alignment: .leading, spacing: 10) {
                    Text("Outside Scope")
                        .font(.custom("Urbanist", size: 13).weight(.semibold))
                        .foregroundColor(DesignSystem.Palette.Text.primary)

                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(nonAgencyServices.prefix(5), id: \.self) { service in
                            HStack(spacing: 8) {
                                Circle()
                                    .fill(DesignSystem.Palette.Text.muted)
                                    .frame(width: 4, height: 4)
                                Text(service)
                                    .font(.custom("Urbanist", size: 13))
                                    .foregroundColor(DesignSystem.Palette.Text.muted)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
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
