//
//  RFPDocument.swift
//  angle-rfp
//
//  Model for uploaded RFP document metadata
//

import Foundation

struct RFPDocument: Identifiable, Codable {
    let id: UUID
    let fileName: String
    let fileURL: URL
    let fileType: DocumentType
    let fileSize: Int64
    let uploadDate: Date
    var pageCount: Int?
    var documentHash: String?

    // Analysis state
    var analysisStatus: AnalysisStatus
    var extractedData: ExtractedRFPData?

    // Parsing metadata
    var parsingDate: Date?
    var parsingDuration: TimeInterval?

    init(id: UUID = UUID(),
         fileName: String,
         fileURL: URL,
         fileType: DocumentType,
         fileSize: Int64,
         uploadDate: Date = Date(),
         pageCount: Int? = nil,
         documentHash: String? = nil,
         analysisStatus: AnalysisStatus = .pending,
         extractedData: ExtractedRFPData? = nil) {
        self.id = id
        self.fileName = fileName
        self.fileURL = fileURL
        self.fileType = fileType
        self.fileSize = fileSize
        self.uploadDate = uploadDate
        self.pageCount = pageCount
        self.documentHash = documentHash
        self.analysisStatus = analysisStatus
        self.extractedData = extractedData
    }

    var fileSizeFormatted: String {
        ByteCountFormatter.string(fromByteCount: fileSize, countStyle: .file)
    }
}

// MARK: - Document Type

enum DocumentType: String, Codable, CaseIterable {
    case pdf = "PDF"
    case docx = "DOCX"
    case txt = "TXT"

    init?(from url: URL) {
        switch url.pathExtension.lowercased() {
        case "pdf":
            self = .pdf
        case "docx":
            self = .docx
        case "txt":
            self = .txt
        default:
            return nil
        }
    }

    var icon: String {
        switch self {
        case .pdf: return "doc.fill"
        case .docx: return "doc.text.fill"
        case .txt: return "doc.plaintext"
        }
    }

    var fileExtension: String {
        self.rawValue.lowercased()
    }
}

// MARK: - Analysis Status

enum AnalysisStatus: String, Codable {
    case pending = "Pending"
    case parsing = "Parsing"
    case analyzing = "Analyzing"
    case researching = "Researching"
    case completed = "Completed"
    case failed = "Failed"

    var icon: String {
        switch self {
        case .pending: return "clock"
        case .parsing: return "doc.text.magnifyingglass"
        case .analyzing: return "brain"
        case .researching: return "magnifyingglass"
        case .completed: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        }
    }

    var color: String {
        switch self {
        case .pending: return "gray"
        case .parsing, .analyzing, .researching: return "blue"
        case .completed: return "green"
        case .failed: return "red"
        }
    }
}

// ParseResult moved to Services/DocumentParsing/ParseResult.swift
