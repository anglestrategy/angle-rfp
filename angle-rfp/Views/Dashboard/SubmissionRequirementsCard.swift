//
//  SubmissionRequirementsCard.swift
//  angle-rfp
//
//  Typography-driven submission method display.
//  Copyable contact details with elegant visual hierarchy.
//
//  Created by Excellence Architecture
//  Copyright © 2024 Angle RFP. All rights reserved.
//

import SwiftUI

struct SubmissionRequirementsCard: View {
    let requirements: String?

    @State private var animateIn = false
    @State private var glowPulse = false
    @State private var copiedEmail = false
    @State private var copiedURL = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            headerSection
                .opacity(animateIn ? 1 : 0)

            // Hero title
            heroTitle
                .padding(.top, 24)
                .opacity(animateIn ? 1 : 0)
                .offset(y: animateIn ? 0 : 20)

            // Content
            if let requirements = requirements, !requirements.isEmpty {
                requirementsContent(requirements)
                    .padding(.top, 32)
                    .opacity(animateIn ? 1 : 0)
                    .animation(.easeOut(duration: 0.6).delay(0.2), value: animateIn)
            } else {
                emptyState
                    .padding(.top, 32)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                animateIn = true
            }
            startGlowAnimation()
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack {
            HStack(spacing: 8) {
                Circle()
                    .fill(DesignSystem.accent)
                    .frame(width: 8, height: 8)
                    .scaleEffect(glowPulse ? 1.2 : 1.0)
                    .shadow(color: DesignSystem.accent.opacity(0.5), radius: glowPulse ? 8 : 4, x: 0, y: 0)

                Text("Submission")
                    .font(.custom("Urbanist", size: 12).weight(.semibold))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .textCase(.uppercase)
                    .tracking(3)
            }

            Spacer()

            // Method badge
            if let method = requirements.flatMap({ extractSubmissionMethod(from: $0) }) {
                SubmissionMethodBadge(method: method)
            }
        }
    }

    // MARK: - Hero Title

    private var heroTitle: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("How & Where")
                .font(.custom("Urbanist", size: 48).weight(.black))
                .foregroundColor(DesignSystem.textPrimary)
                .tracking(-2)

            HStack(spacing: 12) {
                Rectangle()
                    .fill(DesignSystem.accent)
                    .frame(width: 40, height: 3)

                Text("to Submit")
                    .font(.custom("Urbanist", size: 32).weight(.light))
                    .foregroundColor(DesignSystem.textSecondary)
            }
        }
    }

    // MARK: - Requirements Content

    @ViewBuilder
    private func requirementsContent(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 32) {
            // Main text
            Text(text)
                .font(.custom("Urbanist", size: 16).weight(.regular))
                .foregroundColor(DesignSystem.Gray.g600)
                .lineSpacing(8)

            // Extracted contact details
            extractedDetails(from: text)
        }
    }

    // MARK: - Extracted Details

    @ViewBuilder
    private func extractedDetails(from text: String) -> some View {
        let email = extractEmail(from: text)
        let url = extractURL(from: text)

        if email != nil || url != nil {
            VStack(alignment: .leading, spacing: 20) {
                // Section header
                HStack(spacing: 12) {
                    Text("Contact Details")
                        .font(.custom("Urbanist", size: 11).weight(.bold))
                        .foregroundColor(DesignSystem.Gray.g400)
                        .textCase(.uppercase)
                        .tracking(2)

                    Rectangle()
                        .fill(
                            LinearGradient(
                                colors: [DesignSystem.Gray.g200, Color.clear],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(height: 1)
                }

                HStack(alignment: .top, spacing: 40) {
                    // Email
                    if let email = email {
                        ContactDetail(
                            icon: "envelope.fill",
                            label: "Email",
                            value: email,
                            isCopied: copiedEmail,
                            onCopy: {
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(email, forType: .string)
                                withAnimation { copiedEmail = true }
                                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                    withAnimation { copiedEmail = false }
                                }
                            }
                        )
                    }

                    // URL
                    if let url = url {
                        ContactDetail(
                            icon: "link",
                            label: "Portal",
                            value: simplifyURL(url),
                            fullValue: url,
                            isLink: true
                        )
                    }

                    Spacer()
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "paperplane.circle")
                .font(.system(size: 40, weight: .ultraLight))
                .foregroundColor(DesignSystem.Gray.g300)

            Text("No submission details found")
                .font(.custom("Urbanist", size: 18).weight(.medium))
                .foregroundColor(DesignSystem.textSecondary)

            Text("Submission method was not specified in the RFP")
                .font(.custom("Urbanist", size: 14).weight(.regular))
                .foregroundColor(DesignSystem.Gray.g400)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    // MARK: - Helpers

    private func startGlowAnimation() {
        withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
            glowPulse = true
        }
    }

    private func extractEmail(from text: String) -> String? {
        let pattern = "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}"
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range, in: text) else { return nil }
        return String(text[range])
    }

    private func extractURL(from text: String) -> String? {
        let pattern = "https?://[^\\s<>\"{}|\\\\^`\\[\\]]+"
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range, in: text) else { return nil }
        return String(text[range])
    }

    private func extractSubmissionMethod(from text: String) -> String? {
        let lowercased = text.lowercased()
        if lowercased.contains("email") { return "Email" }
        if lowercased.contains("portal") { return "Online Portal" }
        if lowercased.contains("mail") || lowercased.contains("courier") { return "Physical Mail" }
        if lowercased.contains("hand deliver") { return "Hand Delivery" }
        if lowercased.contains("upload") { return "File Upload" }
        return nil
    }

    private func simplifyURL(_ url: String) -> String {
        var result = url
        if result.hasPrefix("https://") {
            result = String(result.dropFirst(8))
        } else if result.hasPrefix("http://") {
            result = String(result.dropFirst(7))
        }
        if result.count > 40 {
            result = String(result.prefix(40)) + "..."
        }
        return result
    }
}

// MARK: - Submission Method Badge

private struct SubmissionMethodBadge: View {
    let method: String

    private var icon: String {
        switch method {
        case "Email": return "envelope.fill"
        case "Online Portal": return "globe"
        case "Physical Mail": return "shippingbox.fill"
        case "Hand Delivery": return "hand.raised.fill"
        case "File Upload": return "arrow.up.doc.fill"
        default: return "paperplane.fill"
        }
    }

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .medium))

            Text(method)
                .font(.custom("Urbanist", size: 12).weight(.bold))
        }
        .foregroundColor(DesignSystem.accent)
    }
}

// MARK: - Contact Detail

private struct ContactDetail: View {
    let icon: String
    let label: String
    let value: String
    var fullValue: String? = nil
    var isCopied: Bool = false
    var isLink: Bool = false
    var onCopy: (() -> Void)? = nil

    @State private var isHovered = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Label
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(DesignSystem.Gray.g400)

                Text(label)
                    .font(.custom("Urbanist", size: 11).weight(.bold))
                    .foregroundColor(DesignSystem.Gray.g400)
                    .textCase(.uppercase)
                    .tracking(1)
            }

            // Value
            if isLink, let urlString = fullValue ?? Optional(value), let url = URL(string: urlString) {
                Link(destination: url) {
                    HStack(spacing: 8) {
                        Text(value)
                            .font(.custom("Urbanist", size: 16).weight(.medium))
                            .foregroundColor(DesignSystem.accent)

                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(DesignSystem.accent)
                    }
                }
            } else {
                Button(action: { onCopy?() }) {
                    HStack(spacing: 10) {
                        Text(value)
                            .font(.custom("Urbanist", size: 16).weight(.medium))
                            .foregroundColor(DesignSystem.textPrimary)

                        Image(systemName: isCopied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(isCopied ? DesignSystem.success : DesignSystem.Gray.g400)
                    }
                    .padding(.vertical, 8)
                    .padding(.horizontal, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(isHovered ? DesignSystem.Gray.g100 : Color.clear)
                    )
                }
                .buttonStyle(.plain)
                .onHover { hovering in
                    withAnimation(.easeOut(duration: 0.15)) {
                        isHovered = hovering
                    }
                }
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
struct SubmissionRequirementsCard_Previews: PreviewProvider {
    static var sampleRequirements: String {
        """
        Submit your proposal via email to procurement@acmecorp.com by 5:00 PM EST on the deadline date. Please include "RFP Response - Brand Campaign 2024" in the subject line.

        Alternatively, proposals may be submitted through our procurement portal at https://procurement.acmecorp.com/rfp/2024-brand.

        All submissions must include one (1) original hard copy and one (1) electronic copy in PDF format.
        """
    }

    static var previews: some View {
        ZStack {
            DesignSystem.background.ignoresSafeArea()

            SubmissionRequirementsCard(requirements: sampleRequirements)
                .padding(60)
        }
        .frame(width: 800, height: 550)
    }
}
#endif
