//
//  ApiEnvelope.swift
//  angle-rfp
//
//  Shared backend response envelope models.
//

import Foundation

enum JSONValue: Codable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported JSON value"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }
}

struct ApiErrorPayload: Codable, Error {
    let code: String
    let message: String
    let retryable: Bool
    let stage: String
    let details: [String: JSONValue]?
}

struct ApiEnvelope<T: Decodable>: Decodable {
    let requestId: String
    let traceId: String
    let schemaVersion: String
    let durationMs: Int
    let warnings: [String]
    let partialResult: Bool
    let data: T?
    let error: ApiErrorPayload?
}

enum ApiEnvelopeError: LocalizedError {
    case api(ApiErrorPayload)
    case missingData

    var errorDescription: String? {
        switch self {
        case .api(let payload):
            return payload.message
        case .missingData:
            return "Backend response was missing `data`."
        }
    }
}

extension ApiEnvelope {
    func requireData() throws -> T {
        if let error {
            throw ApiEnvelopeError.api(error)
        }
        guard let data else {
            throw ApiEnvelopeError.missingData
        }
        return data
    }
}
