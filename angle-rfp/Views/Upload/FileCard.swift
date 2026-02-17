//
//  FileCard.swift
//  angle-rfp
//
//  Clean file card with colored type indicator.
//

import SwiftUI

struct FileCard: View {
    let item: UploadQueueItem
    let onRemove: () -> Void

    private var dotColor: Color {
        switch item.kind {
        case .pdf:
            return Color(red: 0.9, green: 0.31, blue: 0.31) // Red
        case .docx:
            return Color(red: 0.29, green: 0.56, blue: 0.85) // Blue
        case .txt:
            return DesignSystem.Palette.Text.muted
        default:
            return DesignSystem.Palette.Text.muted
        }
    }

    private var typeLabel: String {
        switch item.kind {
        case .pdf: return "PDF"
        case .docx: return "DOCX"
        case .txt: return "TXT"
        case .folder: return "FOLDER"
        default: return "FILE"
        }
    }

    private var statusIndicator: some View {
        Group {
            switch item.status {
            case .ready:
                Image(systemName: "checkmark")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(DesignSystem.Palette.Semantic.success)
            case .validating:
                ProgressView()
                    .scaleEffect(0.6)
                    .tint(DesignSystem.Palette.Text.muted)
            case .rejected:
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 12))
                    .foregroundColor(DesignSystem.Palette.Semantic.error)
            case .queued:
                Image(systemName: "clock")
                    .font(.system(size: 11))
                    .foregroundColor(DesignSystem.Palette.Text.muted)
            }
        }
    }

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: 12) {
            // File type indicator
            ZStack {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(dotColor.opacity(0.15))
                    .frame(width: 36, height: 36)

                Text(typeLabel)
                    .font(.custom("IBM Plex Mono", size: 9).weight(.bold))
                    .foregroundColor(dotColor)
            }

            // File info
            VStack(alignment: .leading, spacing: 3) {
                Text(item.displayName)
                    .font(.custom("Urbanist", size: 14).weight(.semibold))
                    .foregroundColor(DesignSystem.Palette.Text.primary)
                    .lineLimit(1)

                Text(item.fileSizeDisplay)
                    .font(.custom("IBM Plex Mono", size: 10))
                    .foregroundColor(DesignSystem.Palette.Text.muted)
            }

            Spacer()

            // Status indicator
            statusIndicator
                .frame(width: 24)

            // Remove button
            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(DesignSystem.Palette.Text.muted)
                    .frame(width: 24, height: 24)
                    .background(
                        Circle()
                            .fill(Color.white.opacity(isHovered ? 0.08 : 0.04))
                    )
            }
            .buttonStyle(.plain)
            .opacity(isHovered ? 1 : 0.6)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(DesignSystem.Palette.Background.elevated)
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(
                            isHovered ? Color.white.opacity(0.12) : Color.white.opacity(0.06),
                            lineWidth: 1
                        )
                )
        )
        .shadow(
            color: Color.black.opacity(0.15),
            radius: 8,
            x: 0,
            y: 4
        )
        .animation(.easeOut(duration: 0.15), value: isHovered)
        .onHover { hovering in
            isHovered = hovering
        }
    }
}

// MARK: - Minimal File Row

struct FileRow: View {
    let item: UploadQueueItem
    let onRemove: () -> Void

    @State private var isHovered = false

    private var typeLabel: String {
        switch item.kind {
        case .pdf: return "PDF"
        case .docx: return "DOCX"
        case .txt: return "TXT"
        case .folder: return "FOLDER"
        default: return "FILE"
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            // Type label
            Text(typeLabel)
                .font(.custom("IBM Plex Mono", size: 10).weight(.medium))
                .foregroundColor(DesignSystem.Palette.Text.muted)
                .frame(width: 40, alignment: .leading)

            // File name
            Text(item.displayName)
                .font(.custom("Urbanist", size: 14))
                .foregroundColor(DesignSystem.Palette.Text.primary)
                .lineLimit(1)

            Spacer()

            // Status
            Group {
                switch item.status {
                case .ready:
                    Image(systemName: "checkmark")
                        .foregroundColor(DesignSystem.Palette.Semantic.success)
                case .validating:
                    ProgressView()
                        .scaleEffect(0.5)
                case .rejected:
                    Image(systemName: "xmark")
                        .foregroundColor(DesignSystem.Palette.Semantic.error)
                case .queued:
                    Image(systemName: "clock")
                        .foregroundColor(DesignSystem.Palette.Text.muted)
                }
            }
            .font(.system(size: 10, weight: .semibold))

            // Remove
            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(DesignSystem.Palette.Text.muted)
            }
            .buttonStyle(.plain)
            .opacity(isHovered ? 1 : 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(isHovered ? Color.white.opacity(0.04) : Color.clear)
        )
        .animation(.easeOut(duration: 0.1), value: isHovered)
        .onHover { hovering in
            isHovered = hovering
        }
    }
}

#if DEBUG
struct FileCard_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 12) {
            FileCard(
                item: UploadQueueItem(
                    url: URL(fileURLWithPath: "/test/Strategic Brief 2024.pdf"),
                    kind: .pdf,
                    status: .ready
                ),
                onRemove: {}
            )

            FileCard(
                item: UploadQueueItem(
                    url: URL(fileURLWithPath: "/test/proposal.docx"),
                    kind: .docx,
                    status: .validating
                ),
                onRemove: {}
            )

            FileRow(
                item: UploadQueueItem(
                    url: URL(fileURLWithPath: "/test/notes.txt"),
                    kind: .txt,
                    status: .ready
                ),
                onRemove: {}
            )
        }
        .padding(24)
        .frame(width: 450)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
