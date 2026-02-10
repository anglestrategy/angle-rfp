//
//  DocumentUploadView.swift
//  angle-rfp
//
//  Editorial-style document upload view with animated drop zone.
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
            VStack(spacing: 0) {
                Spacer()

                // Main content
                VStack(spacing: 32) {
                    // Title
                    VStack(spacing: 8) {
                        Text("Drop your RFP")
                            .font(.custom("Urbanist", size: 48).weight(.bold))
                            .foregroundColor(DesignSystem.Palette.Text.primary)

                        Text("PDF, DOCX, or TXT files")
                            .font(.custom("Urbanist", size: 16))
                            .foregroundColor(DesignSystem.Palette.Text.tertiary)
                    }

                    // Drop zone
                    AnimatedDropZone(isDragging: $isDragging) {
                        showFilePicker = true
                    }

                    // File queue
                    if !uploadQueue.isEmpty {
                        VStack(spacing: 10) {
                            ForEach(uploadQueue.prefix(4)) { item in
                                FileCard(item: item) {
                                    removeItem(item)
                                }
                            }

                            if uploadQueue.count > 4 {
                                Text("+\(uploadQueue.count - 4) more files")
                                    .font(.custom("Urbanist", size: 13))
                                    .foregroundColor(DesignSystem.Palette.Text.muted)
                            }
                        }
                        .frame(maxWidth: 400)
                    }
                }

                Spacer()

                // Bottom actions
                VStack(spacing: 20) {
                    if showDemoButton {
                        Button(action: onRunDemo) {
                            HStack(spacing: 10) {
                                Image(systemName: "play.fill")
                                    .font(.system(size: 14))
                                Text("Run Demo")
                                    .font(.custom("Urbanist", size: 16).weight(.semibold))
                            }
                        }
                        .buttonStyle(.accentGradient)
                    }

                    if hasReadyFiles {
                        Button(action: beginAnalysis) {
                            HStack(spacing: 10) {
                                Text("Begin Analysis")
                                    .font(.custom("Urbanist", size: 16).weight(.semibold))
                                Image(systemName: "arrow.right")
                                    .font(.system(size: 14, weight: .semibold))
                            }
                        }
                        .buttonStyle(.accentGradient)
                    }
                }
                .padding(.bottom, 40)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
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
