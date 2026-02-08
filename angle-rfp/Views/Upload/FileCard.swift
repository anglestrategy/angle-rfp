//
//  FileCard.swift
//  angle-rfp
//
//  Minimal file card for upload queue.
//

import SwiftUI

struct FileCard: View {
    let item: UploadQueueItem
    let onRemove: () -> Void

    @State private var isHovered = false

    private var statusIcon: (name: String, color: Color) {
        switch item.status {
        case .ready:
            return ("checkmark.circle.fill", DesignSystem.Palette.Semantic.success)
        case .validating:
            return ("arrow.triangle.2.circlepath", DesignSystem.Palette.Semantic.warning)
        case .rejected:
            return ("exclamationmark.triangle.fill", DesignSystem.Palette.Semantic.error)
        case .queued:
            return ("clock", DesignSystem.Palette.Text.muted)
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            // File icon
            Image(systemName: item.kind == .pdf ? "doc.fill" : "doc.text.fill")
                .font(.system(size: 18))
                .foregroundColor(DesignSystem.Palette.Accent.primary)
                .frame(width: 40, height: 40)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(DesignSystem.Palette.Accent.primary.opacity(0.1))
                )

            // File info
            VStack(alignment: .leading, spacing: 3) {
                Text(item.displayName)
                    .font(.custom("Urbanist", size: 14).weight(.medium))
                    .foregroundColor(DesignSystem.Palette.Text.primary)
                    .lineLimit(1)

                Text(item.fileSizeDisplay)
                    .font(.custom("IBM Plex Mono", size: 11))
                    .foregroundColor(DesignSystem.Palette.Text.muted)
            }

            Spacer()

            // Status
            Image(systemName: statusIcon.name)
                .font(.system(size: 16))
                .foregroundColor(statusIcon.color)

            // Remove button (visible on hover)
            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(DesignSystem.Palette.Text.muted)
                    .frame(width: 24, height: 24)
                    .background(
                        Circle()
                            .fill(DesignSystem.Palette.Background.surface)
                    )
            }
            .buttonStyle(.plain)
            .opacity(isHovered ? 1 : 0)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(DesignSystem.Palette.Background.elevated)
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.white.opacity(isHovered ? 0.1 : 0.04), lineWidth: 1)
                )
        )
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
}

#if DEBUG
struct FileCard_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 12) {
            FileCard(
                item: UploadQueueItem(
                    url: URL(fileURLWithPath: "/test/proposal.pdf"),
                    kind: .pdf,
                    status: .ready
                ),
                onRemove: {}
            )

            FileCard(
                item: UploadQueueItem(
                    url: URL(fileURLWithPath: "/test/brief.docx"),
                    kind: .docx,
                    status: .validating
                ),
                onRemove: {}
            )
        }
        .padding(24)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
