//
//  DashboardSection.swift
//  angle-rfp
//
//  Editorial section wrapper - clean label, no chrome.
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
            // Section label
            Text(title.uppercased())
                .font(.custom("IBM Plex Mono", size: 10).weight(.medium))
                .tracking(1.5)
                .foregroundColor(DesignSystem.Palette.Text.muted)

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
