//
//  UploadQueueItem.swift
//  angle-rfp
//
//  Queue-first upload model for drag/drop and multi-source ingest.
//

import Foundation

enum UploadKind: String, Codable, CaseIterable {
    case pdf
    case docx
    case txt
    case folder
    case other

    static let supportedFileExtensions: Set<String> = ["pdf", "docx", "txt"]

    var displayName: String {
        switch self {
        case .pdf: return "PDF"
        case .docx: return "DOCX"
        case .txt: return "TXT"
        case .folder: return "Folder"
        case .other: return "Unsupported"
        }
    }

    var isSupported: Bool {
        self != .other
    }

    static func classify(url: URL) -> UploadKind {
        if isDirectory(url: url) {
            return .folder
        }

        switch url.pathExtension.lowercased() {
        case "pdf": return .pdf
        case "docx": return .docx
        case "txt": return .txt
        default: return .other
        }
    }

    static func isDirectory(url: URL) -> Bool {
        (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false
    }
}

enum UploadStatus: String, Codable, CaseIterable {
    case queued
    case validating
    case ready
    case rejected
}

struct UploadQueueItem: Identifiable, Equatable {
    let id: UUID
    let url: URL
    let kind: UploadKind
    var status: UploadStatus
    var errorMessage: String?
    var fileSizeBytes: Int64?
    var displayName: String

    init(
        id: UUID = UUID(),
        url: URL,
        kind: UploadKind? = nil,
        status: UploadStatus = .queued,
        errorMessage: String? = nil,
        fileSizeBytes: Int64? = nil,
        displayName: String? = nil
    ) {
        self.id = id
        self.url = url
        self.kind = kind ?? UploadKind.classify(url: url)
        self.status = status
        self.errorMessage = errorMessage
        self.fileSizeBytes = fileSizeBytes ?? UploadQueueItem.readFileSize(for: url)
        self.displayName = displayName ?? url.lastPathComponent
    }

    var filename: String {
        displayName
    }

    var typeLabel: String {
        kind.displayName
    }

    var pathFingerprint: String {
        url.standardizedFileURL.path.lowercased()
    }

    var isReadyForAnalysis: Bool {
        status == .ready
    }

    var canAnalyzeNow: Bool {
        status == .ready
    }

    var isRejected: Bool {
        status == .rejected
    }

    var fileSizeDisplay: String {
        guard let fileSizeBytes else {
            return "-"
        }

        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        formatter.allowedUnits = [.useKB, .useMB]
        return formatter.string(fromByteCount: fileSizeBytes)
    }

    func validated() -> UploadQueueItem {
        var copy = self
        copy.status = .validating

        switch kind {
        case .pdf, .txt:
            copy.status = .ready
            copy.errorMessage = nil

        case .docx:
            copy.status = .rejected
            copy.errorMessage = "DOCX parsing is not enabled yet. Convert to PDF or TXT for now."

        case .folder:
            copy.status = .rejected
            copy.errorMessage = "Drop folders to expand them into supported files."

        case .other:
            copy.status = .rejected
            copy.errorMessage = "Unsupported format. Upload PDF, DOCX, TXT, or a folder containing them."
        }

        return copy
    }

    static func makeValidated(url: URL) -> UploadQueueItem {
        UploadQueueItem(url: url).validated()
    }

    static func deduplicated(_ items: [UploadQueueItem]) -> [UploadQueueItem] {
        var seen = Set<String>()
        return items.filter { seen.insert($0.pathFingerprint).inserted }
    }

    private static func readFileSize(for url: URL) -> Int64? {
        if UploadKind.isDirectory(url: url) {
            return nil
        }

        guard let values = try? url.resourceValues(forKeys: [.fileSizeKey]),
              let bytes = values.fileSize else {
            return nil
        }

        return Int64(bytes)
    }
}
