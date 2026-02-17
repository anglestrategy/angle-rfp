//
//  AnimatedDropZone.swift
//  angle-rfp
//
//  Editorial drop zone with left-aligned content.
//

import SwiftUI

struct AnimatedDropZone: View {
    @Binding var isDragging: Bool
    let onTap: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 0) {
                // Left content
                VStack(alignment: .leading, spacing: 16) {
                    // Icon
                    ZStack {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(
                                isDragging
                                    ? DesignSystem.Palette.Accent.primary.opacity(0.15)
                                    : DesignSystem.Palette.Background.surface
                            )
                            .frame(width: 48, height: 48)

                        Image(systemName: isDragging ? "arrow.down" : "doc.badge.plus")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(
                                isDragging
                                    ? DesignSystem.Palette.Accent.primary
                                    : DesignSystem.Palette.Text.secondary
                            )
                    }

                    // Text
                    VStack(alignment: .leading, spacing: 6) {
                        Text(isDragging ? "Release to upload" : "Drop your RFP here")
                            .font(.custom("Urbanist", size: 17).weight(.semibold))
                            .foregroundColor(
                                isDragging
                                    ? DesignSystem.Palette.Accent.primary
                                    : DesignSystem.Palette.Text.primary
                            )

                        Text("or click to browse your files")
                            .font(.custom("Urbanist", size: 13))
                            .foregroundColor(DesignSystem.Palette.Text.muted)
                    }

                    // Formats
                    HStack(spacing: 12) {
                        ForEach(["PDF", "DOCX", "TXT"], id: \.self) { format in
                            Text(format)
                                .font(.custom("IBM Plex Mono", size: 10).weight(.medium))
                                .foregroundColor(DesignSystem.Palette.Text.muted)
                        }
                    }
                    .padding(.top, 4)
                }
                .padding(24)

                Spacer()
            }
            .frame(maxWidth: .infinity)
            .frame(height: 180)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(DesignSystem.Palette.Background.elevated)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(
                        isDragging
                            ? DesignSystem.Palette.Accent.primary
                            : Color.white.opacity(isHovered ? 0.1 : 0.06),
                        lineWidth: isDragging ? 1.5 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.15), value: isDragging)
        .animation(.easeOut(duration: 0.15), value: isHovered)
        .onHover { hovering in
            isHovered = hovering
        }
    }
}

#if DEBUG
struct AnimatedDropZone_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 40) {
            AnimatedDropZone(isDragging: .constant(false), onTap: {})
            AnimatedDropZone(isDragging: .constant(true), onTap: {})
        }
        .padding(60)
        .frame(width: 600)
        .background(DesignSystem.Palette.Background.base)
    }
}
#endif
