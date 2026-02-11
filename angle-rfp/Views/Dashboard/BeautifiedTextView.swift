//
//  BeautifiedTextView.swift
//  angle-rfp
//
//  Renders AI-beautified text with proper typography hierarchy.
//  Supports headings, subheadings, paragraphs, lists, highlights, and quotes.
//

import SwiftUI

struct BeautifiedTextView: View {
    let beautifiedText: BeautifiedText?
    let fallbackText: String?

    var body: some View {
        if let beautified = beautifiedText, !beautified.sections.isEmpty {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(beautified.sections) { section in
                    sectionView(for: section)
                }
            }
        } else if let text = fallbackText, !text.isEmpty {
            // Fallback to plain text
            Text(text)
                .font(.custom("Urbanist", size: 14))
                .foregroundColor(DesignSystem.Palette.Text.secondary)
                .lineSpacing(5)
        }
    }

    @ViewBuilder
    private func sectionView(for section: TextSection) -> some View {
        switch section.type {
        case .heading:
            headingView(section.content)

        case .subheading:
            subheadingView(section.content)

        case .paragraph:
            paragraphView(section.content)

        case .bulletList:
            bulletListView(section.items ?? [section.content])

        case .numberedList:
            numberedListView(section.items ?? [section.content])

        case .highlight:
            highlightView(section.content)

        case .quote:
            quoteView(section.content)
        }
    }

    // MARK: - Section Renderers

    private func headingView(_ text: String) -> some View {
        Text(text)
            .font(.custom("Urbanist", size: 18).weight(.bold))
            .foregroundColor(DesignSystem.Palette.Text.primary)
            .padding(.top, 8)
    }

    private func subheadingView(_ text: String) -> some View {
        Text(text)
            .font(.custom("Urbanist", size: 15).weight(.semibold))
            .foregroundColor(DesignSystem.Palette.Text.secondary)
            .padding(.top, 4)
    }

    private func paragraphView(_ text: String) -> some View {
        Text(text)
            .font(.custom("Urbanist", size: 14))
            .foregroundColor(DesignSystem.Palette.Text.secondary)
            .lineSpacing(5)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func bulletListView(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 10) {
                    Circle()
                        .fill(DesignSystem.Palette.Accent.primary)
                        .frame(width: 6, height: 6)
                        .padding(.top, 7)

                    Text(item)
                        .font(.custom("Urbanist", size: 14))
                        .foregroundColor(DesignSystem.Palette.Text.secondary)
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(.leading, 4)
    }

    private func numberedListView(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                HStack(alignment: .top, spacing: 10) {
                    Text("\(index + 1).")
                        .font(.custom("IBM Plex Mono", size: 13).weight(.medium))
                        .foregroundColor(DesignSystem.Palette.Accent.primary)
                        .frame(width: 24, alignment: .trailing)

                    Text(item)
                        .font(.custom("Urbanist", size: 14))
                        .foregroundColor(DesignSystem.Palette.Text.secondary)
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private func highlightView(_ text: String) -> some View {
        HStack(spacing: 12) {
            Rectangle()
                .fill(DesignSystem.Palette.Accent.primary)
                .frame(width: 3)

            Text(text)
                .font(.custom("Urbanist", size: 14).weight(.medium))
                .foregroundColor(DesignSystem.Palette.Text.primary)
                .lineSpacing(4)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 16)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(DesignSystem.Palette.Accent.primary.opacity(0.08))
        )
    }

    private func quoteView(_ text: String) -> some View {
        HStack(spacing: 12) {
            Rectangle()
                .fill(DesignSystem.Palette.Text.muted)
                .frame(width: 3)

            Text("\"\(text)\"")
                .font(.custom("Urbanist", size: 14).italic())
                .foregroundColor(DesignSystem.Palette.Text.tertiary)
                .lineSpacing(5)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 16)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(DesignSystem.Palette.Background.surface)
        )
    }
}

// MARK: - Preview

#if DEBUG
struct BeautifiedTextView_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            DesignSystem.Palette.Background.base.ignoresSafeArea()

            ScrollView {
                BeautifiedTextView(
                    beautifiedText: BeautifiedText(
                        formatted: "",
                        sections: [
                            TextSection(type: .heading, content: "Project Overview", items: nil),
                            TextSection(type: .paragraph, content: "This comprehensive brand campaign will establish market presence across multiple channels with innovative creative solutions.", items: nil),
                            TextSection(type: .subheading, content: "Key Objectives", items: nil),
                            TextSection(type: .bulletList, content: "", items: [
                                "Increase brand awareness by 40% in target demographics",
                                "Launch integrated digital and print campaign",
                                "Develop cohesive visual identity system"
                            ]),
                            TextSection(type: .highlight, content: "Deadline: March 15, 2024 at 5:00 PM EST", items: nil),
                            TextSection(type: .quote, content: "We seek a partner who shares our vision for transformative brand experiences.", items: nil),
                            TextSection(type: .numberedList, content: "", items: [
                                "Submit technical proposal",
                                "Include creative samples",
                                "Provide team credentials"
                            ])
                        ]
                    ),
                    fallbackText: nil
                )
                .padding(40)
            }
        }
        .frame(width: 800, height: 700)
    }
}
#endif
