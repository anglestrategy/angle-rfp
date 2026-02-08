//
//  DashboardSection.swift
//  angle-rfp
//
//  Editorial section wrapper for dashboard content.
//

import SwiftUI

struct DashboardSection<Content: View>: View {
    let title: String
    let content: Content

    init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Section header
            HStack(spacing: 12) {
                Text(title.uppercased())
                    .font(.custom("Urbanist", size: 11).weight(.bold))
                    .tracking(1.6)
                    .foregroundColor(DesignSystem.Palette.Text.tertiary)

                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [
                                DesignSystem.Palette.Text.muted,
                                Color.clear
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(height: 1)
            }

            // Content
            content
        }
    }
}

#if DEBUG
struct DashboardSection_Previews: PreviewProvider {
    static var previews: some View {
        DashboardSection("Scope of Work") {
            Text("Content goes here")
                .foregroundColor(.white)
        }
        .padding(24)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
