// Generated feasibility probe with quicktype-core 26.0.0. Do not edit.
// NOT public PiSDK API and NOT sufficient wire validation.
// This file was generated from JSON Schema using quicktype, do not modify it directly.
// To parse the JSON, add this file to your project and do:
//
//   let chatMessage = try? JSONDecoder().decode(ChatMessage.self, from: jsonData)
//   let thinkingLevel = try? JSONDecoder().decode(ThinkingLevel.self, from: jsonData)
//   let extensionContributions = try? JSONDecoder().decode(ExtensionContributions.self, from: jsonData)
//   let footerItem = try? JSONDecoder().decode(FooterItem.self, from: jsonData)
//   let promptResult = try? JSONDecoder().decode(PromptResult.self, from: jsonData)

import Foundation

// MARK: - ChatMessage
struct ChatMessage: Codable {
    let bash: Bash?
    let id: String
    let role: Role
    let timestamp: Double?
    let skill: Skill?
    let text: String?
    let thinking: String?
    let tool: Tool?
    let customType: String?

    enum CodingKeys: String, CodingKey {
        case bash = "bash"
        case id = "id"
        case role = "role"
        case timestamp = "timestamp"
        case skill = "skill"
        case text = "text"
        case thinking = "thinking"
        case tool = "tool"
        case customType = "customType"
    }
}

// MARK: - Bash
struct Bash: Codable {
    let command: String
    let excludeFromContext: Bool
    let exitCode: Int?
    let fullOutputPath: String?
    let output: String
    let status: BashStatus
    let truncated: Bool

    enum CodingKeys: String, CodingKey {
        case command = "command"
        case excludeFromContext = "excludeFromContext"
        case exitCode = "exitCode"
        case fullOutputPath = "fullOutputPath"
        case output = "output"
        case status = "status"
        case truncated = "truncated"
    }
}

enum BashStatus: String, Codable {
    case cancelled = "cancelled"
    case error = "error"
    case running = "running"
    case success = "success"
}

enum Role: String, Codable {
    case assistant = "assistant"
    case bash = "bash"
    case custom = "custom"
    case system = "system"
    case tool = "tool"
    case user = "user"
}

// MARK: - Skill
struct Skill: Codable {
    let content: String
    let location: String
    let name: String

    enum CodingKeys: String, CodingKey {
        case content = "content"
        case location = "location"
        case name = "name"
    }
}

// MARK: - Tool
struct Tool: Codable {
    let argsText: String?
    let editDiff: EditDiff?
    let name: String
    let outputText: String?
    let status: ToolStatus
    let toolCallID: String
    let writeContent: WriteContent?

    enum CodingKeys: String, CodingKey {
        case argsText = "argsText"
        case editDiff = "editDiff"
        case name = "name"
        case outputText = "outputText"
        case status = "status"
        case toolCallID = "toolCallId"
        case writeContent = "writeContent"
    }
}

// MARK: - EditDiff
struct EditDiff: Codable {
    let firstChangedLine: Int?
    let format: Format
    let text: String
    let truncated: Bool

    enum CodingKeys: String, CodingKey {
        case firstChangedLine = "firstChangedLine"
        case format = "format"
        case text = "text"
        case truncated = "truncated"
    }
}

enum Format: String, Codable {
    case piDisplay = "pi-display"
    case unified = "unified"
}

enum ToolStatus: String, Codable {
    case error = "error"
    case running = "running"
    case success = "success"
}

// MARK: - WriteContent
struct WriteContent: Codable {
    let text: String
    let truncated: Bool

    enum CodingKeys: String, CodingKey {
        case text = "text"
        case truncated = "truncated"
    }
}

enum ThinkingLevel: String, Codable {
    case high = "high"
    case low = "low"
    case max = "max"
    case medium = "medium"
    case minimal = "minimal"
    case off = "off"
    case xhigh = "xhigh"
}

// MARK: - ExtensionContributions
struct ExtensionContributions: Codable {
    let badges: [Badge]
    let buttons: [Button]
    let state: [String: ExtensionContribution]

    enum CodingKeys: String, CodingKey {
        case badges = "badges"
        case buttons = "buttons"
        case state = "state"
    }
}

// MARK: - Badge
struct Badge: Codable {
    let id: String
    let label: String
    let slot: String
    let tone: String

    enum CodingKeys: String, CodingKey {
        case id = "id"
        case label = "label"
        case slot = "slot"
        case tone = "tone"
    }
}

// MARK: - Button
struct Button: Codable {
    let actionID: String
    let icon: String?
    let id: String
    let label: String
    let slot: String

    enum CodingKeys: String, CodingKey {
        case actionID = "actionId"
        case icon = "icon"
        case id = "id"
        case label = "label"
        case slot = "slot"
    }
}

enum ExtensionContribution: Codable {
    case bool(Bool)
    case double(Double)
    case string(String)
    case unionArray([ExtensionContribution])
    case unionMap([String: ExtensionContribution])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(Bool.self) {
            self = .bool(x)
            return
        }
        if let x = try? container.decode([ExtensionContribution].self) {
            self = .unionArray(x)
            return
        }
        if let x = try? container.decode(Double.self) {
            self = .double(x)
            return
        }
        if let x = try? container.decode([String: ExtensionContribution].self) {
            self = .unionMap(x)
            return
        }
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(ExtensionContribution.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for ExtensionContribution"))
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .bool(let x):
            try container.encode(x)
        case .double(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        case .unionArray(let x):
            try container.encode(x)
        case .unionMap(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

// MARK: - FooterItem
struct FooterItem: Codable {
    let align: String
    let key: String
    let text: String
    let variant: String

    enum CodingKeys: String, CodingKey {
        case align = "align"
        case key = "key"
        case text = "text"
        case variant = "variant"
    }
}

// MARK: - PromptResult
struct PromptResult: Codable {
    let cancelled: Bool
    let value: Value?

    enum CodingKeys: String, CodingKey {
        case cancelled = "cancelled"
        case value = "value"
    }
}

enum Value: Codable {
    case bool(Bool)
    case string(String)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(Bool.self) {
            self = .bool(x)
            return
        }
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        throw DecodingError.typeMismatch(Value.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for Value"))
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .bool(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        }
    }
}
