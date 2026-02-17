//
//  DocumentUploadView.swift
//  angle-rfp
//
//  Bold editorial upload view with strong typography.
//

import SwiftUI
import UniformTypeIdentifiers

struct DocumentUploadView: View {
    @Binding var uploadQueue: [UploadQueueItem]
    @Binding var motionPreference: MotionPreference

    @State private var isDragging = false
    @State private var showFilePicker = false

    let onQueueChanged: ([UploadQueueItem]) -> Void
    let onBeginAnalysis: ([URL]) -> Void
    let onRunDemo: () -> Void

    private var docxType: UTType {
        UTType(filenameExtension: "docx") ?? .data
    }

    private var allowedImporterTypes: [UTType] {
        [.pdf, .plainText, .folder, docxType]
    }

    private var readyURLs: [URL] {
        uploadQueue
            .filter { $0.canAnalyzeNow }
            .map(\.url)
            .filter { UploadKind.classify(url: $0) != .folder }
    }

    private var hasReadyFiles: Bool {
        !readyURLs.isEmpty
    }

    private var showDemoButton: Bool {
        #if DEBUG
        return true
        #else
        return ProcessInfo.processInfo.environment["ANGLE_SHOW_DEMO_BUTTON"] == "1"
        #endif
    }

    var body: some View {
        SceneContainer {
            VStack(alignment: .leading, spacing: 0) {
                // Top section with headline
                VStack(alignment: .leading, spacing: 20) {
                    Text("ANGLE / RFP")
                        .font(.custom("IBM Plex Mono", size: 10).weight(.medium))
                        .tracking(2)
                        .foregroundColor(DesignSystem.Palette.Text.muted)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Analyze your next")
                            .font(.custom("Urbanist", size: 40).weight(.bold))
                            .foregroundColor(DesignSystem.Palette.Text.primary)

                        Text("opportunity")
                            .font(.custom("Urbanist", size: 40).weight(.bold))
                            .foregroundColor(DesignSystem.Palette.Accent.primary)
                    }

                    Text("Extract key details, evaluate scope\nalignment, and calculate fit score.")
                        .font(.custom("Urbanist", size: 15))
                        .foregroundColor(DesignSystem.Palette.Text.tertiary)
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 60)
                .padding(.horizontal, 40)

                Spacer()
                    .frame(height: 48)

                // Drop zone - full width within padding
                AnimatedDropZone(isDragging: $isDragging) {
                    showFilePicker = true
                }
                .padding(.horizontal, 40)

                // File queue
                if !uploadQueue.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("\(uploadQueue.count) file\(uploadQueue.count == 1 ? "" : "s") queued")
                                .font(.custom("IBM Plex Mono", size: 11))
                                .foregroundColor(DesignSystem.Palette.Text.muted)

                            Spacer()

                            Button(action: { uploadQueue.removeAll(); onQueueChanged([]) }) {
                                Text("Clear all")
                                    .font(.custom("Urbanist", size: 12).weight(.medium))
                                    .foregroundColor(DesignSystem.Palette.Text.muted)
                            }
                            .buttonStyle(.plain)
                        }

                        VStack(spacing: 2) {
                            ForEach(uploadQueue.prefix(3)) { item in
                                FileRow(item: item) {
                                    removeItem(item)
                                }
                            }

                            if uploadQueue.count > 3 {
                                Text("+\(uploadQueue.count - 3) more")
                                    .font(.custom("IBM Plex Mono", size: 11))
                                    .foregroundColor(DesignSystem.Palette.Text.muted)
                                    .padding(.top, 8)
                                    .padding(.leading, 12)
                            }
                        }
                    }
                    .padding(.horizontal, 40)
                    .padding(.top, 24)
                    .transition(.opacity)
                }

                Spacer()

                // Bottom bar
                HStack(alignment: .center) {
                    if showDemoButton {
                        Button(action: onRunDemo) {
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(DesignSystem.Palette.Text.muted)
                                    .frame(width: 6, height: 6)
                                Text("Run demo")
                                    .font(.custom("Urbanist", size: 13).weight(.medium))
                                    .foregroundColor(DesignSystem.Palette.Text.muted)
                            }
                        }
                        .buttonStyle(.plain)
                    }

                    Spacer()

                    if hasReadyFiles {
                        Button(action: beginAnalysis) {
                            HStack(spacing: 8) {
                                Text("Begin Analysis")
                                    .font(.custom("Urbanist", size: 14).weight(.semibold))
                                Image(systemName: "arrow.right")
                                    .font(.system(size: 12, weight: .semibold))
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                            .background(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(DesignSystem.Palette.Accent.primary)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 40)
                .padding(.vertical, 24)
                .background(
                    Rectangle()
                        .fill(Color.white.opacity(0.02))
                        .overlay(
                            Rectangle()
                                .fill(Color.white.opacity(0.04))
                                .frame(height: 1),
                            alignment: .top
                        )
                )
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .animation(.easeOut(duration: 0.2), value: uploadQueue.count)
        }
        .onDrop(of: [.fileURL], isTargeted: $isDragging) { providers in
            handleDrop(providers: providers)
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: allowedImporterTypes,
            allowsMultipleSelection: true,
            onCompletion: handleFileSelection
        )
    }

    // MARK: - Queue Actions

    private func beginAnalysis() {
        guard !readyURLs.isEmpty else { return }
        onBeginAnalysis(readyURLs)
    }

    private func removeItem(_ item: UploadQueueItem) {
        uploadQueue.removeAll { $0.id == item.id }
        onQueueChanged(uploadQueue)
    }

    // MARK: - File Intake

    private func handleDrop(providers: [NSItemProvider]) -> Bool {
        let eligible = providers.filter { $0.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) }
        guard !eligible.isEmpty else { return false }

        let group = DispatchGroup()
        let queue = DispatchQueue(label: "angle-rfp.upload-drop")
        var resolvedURLs: [URL] = []

        for provider in eligible {
            group.enter()
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                defer { group.leave() }
                guard let url = resolveURL(from: item) else { return }
                queue.sync { resolvedURLs.append(url) }
            }
        }

        group.notify(queue: .main) {
            ingest(urls: resolvedURLs)
        }

        return true
    }

    private func handleFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            ingest(urls: urls)
        case .failure(let error):
            AppLogger.shared.error("File selection failed", error: error)
        }
    }

    private func ingest(urls: [URL]) {
        guard !urls.isEmpty else { return }

        var staged: [UploadQueueItem] = []
        for url in urls {
            staged.append(contentsOf: queueItems(from: url))
        }

        guard !staged.isEmpty else { return }

        uploadQueue = UploadQueueItem.deduplicated(uploadQueue + staged)
        onQueueChanged(uploadQueue)
    }

    private func queueItems(from url: URL) -> [UploadQueueItem] {
        let kind = UploadKind.classify(url: url)

        if kind == .folder {
            let expanded = supportedFiles(in: url)
            if expanded.isEmpty {
                return [
                    UploadQueueItem(
                        url: url,
                        kind: .folder,
                        status: .rejected,
                        errorMessage: "Folder contains no PDF, DOCX, or TXT files."
                    )
                ]
            }
            return expanded.map { UploadQueueItem.makeValidated(url: $0) }
        }

        return [UploadQueueItem.makeValidated(url: url)]
    }

    private func supportedFiles(in folder: URL) -> [URL] {
        var files: [URL] = []
        let didAccess = folder.startAccessingSecurityScopedResource()

        defer {
            if didAccess {
                folder.stopAccessingSecurityScopedResource()
            }
        }

        guard let enumerator = FileManager.default.enumerator(
            at: folder,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        for case let fileURL as URL in enumerator {
            let ext = fileURL.pathExtension.lowercased()
            if UploadKind.supportedFileExtensions.contains(ext) {
                files.append(fileURL)
            }
        }

        return files
    }

    private func resolveURL(from item: NSSecureCoding?) -> URL? {
        if let url = item as? URL { return url }
        if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) { return url }
        if let nsURL = item as? NSURL { return nsURL as URL }
        if let text = item as? String, let url = URL(string: text) { return url }
        return nil
    }
}

#if DEBUG
struct DocumentUploadView_Previews: PreviewProvider {
    static var previews: some View {
        DocumentUploadView(
            uploadQueue: .constant([]),
            motionPreference: .constant(.balanced),
            onQueueChanged: { _ in },
            onBeginAnalysis: { _ in },
            onRunDemo: { }
        )
        .frame(width: 1180, height: 760)
    }
}
#endif
