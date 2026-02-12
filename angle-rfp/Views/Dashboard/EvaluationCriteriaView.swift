//
//  EvaluationCriteriaView.swift
//  angle-rfp
//
//  Clean evaluation criteria display matching editorial style.
//

import SwiftUI

struct EvaluationCriteriaView: View {
    let beautifiedText: BeautifiedText?
    let fallbackText: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let factors = extractFactors() {
                // Structured factors display
                ForEach(Array(factors.enumerated()), id: \.offset) { index, factor in
                    factorRow(factor, isLast: index == factors.count - 1)
                }
            } else if let text = fallbackText ?? beautifiedText?.formatted, !text.isEmpty {
                // Plain text fallback
                Text(text)
                    .font(.custom("Urbanist", size: 14))
                    .foregroundColor(DesignSystem.Palette.Text.secondary)
                    .lineSpacing(6)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(20)
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(DesignSystem.Palette.Background.elevated)
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.white.opacity(0.04), lineWidth: 1)
                )
        )
    }

    private func factorRow(_ factor: EvaluationFactor, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: 20) {
            // Weight
            Text("\(factor.weight)%")
                .font(.custom("IBM Plex Mono", size: 24).weight(.light))
                .foregroundColor(DesignSystem.Palette.Accent.primary)
                .frame(width: 60, alignment: .leading)

            // Details
            VStack(alignment: .leading, spacing: 4) {
                Text(factor.name)
                    .font(.custom("Urbanist", size: 15).weight(.semibold))
                    .foregroundColor(DesignSystem.Palette.Text.primary)

                if let description = factor.description {
                    Text(description)
                        .font(.custom("Urbanist", size: 13))
                        .foregroundColor(DesignSystem.Palette.Text.tertiary)
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .overlay(
            Group {
                if !isLast {
                    Rectangle()
                        .fill(Color.white.opacity(0.04))
                        .frame(height: 1)
                }
            },
            alignment: .bottom
        )
    }

    private func extractFactors() -> [EvaluationFactor]? {
        let text = fallbackText ?? beautifiedText?.formatted ?? ""
        guard !text.isEmpty else { return nil }

        // Pattern to match "Factor Name (XX%)" or "Factor Name: XX%"
        let pattern = #"([A-Za-z][A-Za-z\s&/]+?)[\s]*[\(:][\s]*(\d+)[\s]*%[\)]?"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return nil
        }

        let range = NSRange(text.startIndex..., in: text)
        let matches = regex.matches(in: text, options: [], range: range)

        guard !matches.isEmpty else { return nil }

        var factors: [EvaluationFactor] = []

        for match in matches {
            guard let nameRange = Range(match.range(at: 1), in: text),
                  let weightRange = Range(match.range(at: 2), in: text),
                  let weight = Int(text[weightRange]) else { continue }

            let name = String(text[nameRange]).trimmingCharacters(in: .whitespaces)

            // Try to find description after the percentage
            var description: String? = nil
            let matchEnd = match.range.upperBound
            if matchEnd < text.count {
                let afterMatch = text[text.index(text.startIndex, offsetBy: matchEnd)...]
                // Get text until next factor or end, clean it up
                if let nextMatch = matches.first(where: { $0.range.lowerBound > matchEnd }) {
                    let descEnd = text.index(text.startIndex, offsetBy: nextMatch.range.lowerBound)
                    let desc = String(afterMatch[..<descEnd])
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                        .replacingOccurrences(of: "^[:\\-–—.]\\s*", with: "", options: .regularExpression)
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    if !desc.isEmpty && desc.count > 5 {
                        description = desc
                    }
                }
            }

            factors.append(EvaluationFactor(name: name, weight: weight, description: description))
        }

        return factors.isEmpty ? nil : factors.sorted { $0.weight > $1.weight }
    }
}

private struct EvaluationFactor {
    let name: String
    let weight: Int
    let description: String?
}

#if DEBUG
struct EvaluationCriteriaView_Previews: PreviewProvider {
    static var previews: some View {
        EvaluationCriteriaView(
            beautifiedText: nil,
            fallbackText: "Technical Approach (40%): Quality of the proposed strategy. Team Experience (30%): Relevant past work. Pricing (30%): Value and competitiveness."
        )
        .padding(40)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
