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
    let anchor: Int?
    let level: Level?

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
        case anchor = "anchor"
        case level = "level"
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

enum Level: String, Codable {
    case error = "error"
    case info = "info"
    case warning = "warning"
}

enum Role: String, Codable {
    case assistant = "assistant"
    case bash = "bash"
    case custom = "custom"
    case notice = "notice"
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
    let badges: [Badge]?
    let buttons: [Button]?
    let state: [String: JSONAny]?

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
    let slot: Slot
    let tone: Tone?

    enum CodingKeys: String, CodingKey {
        case id = "id"
        case label = "label"
        case slot = "slot"
        case tone = "tone"
    }
}

enum Slot: String, Codable {
    case composerBelow = "composer.below"
    case composerRight = "composer.right"
    case sessionHeaderRight = "session.header.right"
    case sessionStatus = "session.status"
    case settingsSection = "settings.section"
}

enum Tone: String, Codable {
    case green = "green"
    case neutral = "neutral"
    case red = "red"
    case yellow = "yellow"
}

// MARK: - Button
struct Button: Codable {
    let actionID: String
    let icon: String?
    let id: String
    let label: String
    let slot: Slot

    enum CodingKeys: String, CodingKey {
        case actionID = "actionId"
        case icon = "icon"
        case id = "id"
        case label = "label"
        case slot = "slot"
    }
}

// MARK: - FooterItem
struct FooterItem: Codable {
    let align: Align?
    let key: String
    let text: String
    let variant: Variant?

    enum CodingKeys: String, CodingKey {
        case align = "align"
        case key = "key"
        case text = "text"
        case variant = "variant"
    }
}

enum Align: String, Codable {
    case alignLeft = "left"
    case alignRight = "right"
}

enum Variant: String, Codable {
    case badge = "badge"
    case plain = "plain"
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

// MARK: - Encode/decode helpers

final class JSONNull: Codable, Hashable {

    public static func == (lhs: JSONNull, rhs: JSONNull) -> Bool {
        return true
    }

    public var hashValue: Int {
        return 0
    }

    public func hash(into hasher: inout Hasher) {
        // No-op
    }

    public init() {}

    public required init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if !container.decodeNil() {
            throw DecodingError.typeMismatch(JSONNull.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for JSONNull"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encodeNil()
    }
}

final class JSONCodingKey: CodingKey {
    let key: String

    required init?(intValue: Int) {
        return nil
    }

    required init?(stringValue: String) {
        key = stringValue
    }

    var intValue: Int? {
        return nil
    }

    var stringValue: String {
        return key
    }
}

final class JSONAny: Codable {

    let value: Any

    static func decodingError(forCodingPath codingPath: [CodingKey]) -> DecodingError {
        let context = DecodingError.Context(codingPath: codingPath, debugDescription: "Cannot decode JSONAny")
        return DecodingError.typeMismatch(JSONAny.self, context)
    }

    static func encodingError(forValue value: Any, codingPath: [CodingKey]) -> EncodingError {
        let context = EncodingError.Context(codingPath: codingPath, debugDescription: "Cannot encode JSONAny")
        return EncodingError.invalidValue(value, context)
    }

    static func decode(from container: SingleValueDecodingContainer) throws -> Any {
        if let value = try? container.decode(Bool.self) {
            return value
        }
        if let value = try? container.decode(Int64.self) {
            return value
        }
        if let value = try? container.decode(Double.self) {
            return value
        }
        if let value = try? container.decode(String.self) {
            return value
        }
        if container.decodeNil() {
            return JSONNull()
        }
        throw decodingError(forCodingPath: container.codingPath)
    }

    static func decode(from container: inout UnkeyedDecodingContainer) throws -> Any {
        if let value = try? container.decode(Bool.self) {
            return value
        }
        if let value = try? container.decode(Int64.self) {
            return value
        }
        if let value = try? container.decode(Double.self) {
            return value
        }
        if let value = try? container.decode(String.self) {
            return value
        }
        if let value = try? container.decodeNil() {
            if value {
                return JSONNull()
            }
        }
        if var container = try? container.nestedUnkeyedContainer() {
            return try decodeArray(from: &container)
        }
        if var container = try? container.nestedContainer(keyedBy: JSONCodingKey.self) {
            return try decodeDictionary(from: &container)
        }
        throw decodingError(forCodingPath: container.codingPath)
    }

    static func decode(from container: inout KeyedDecodingContainer<JSONCodingKey>, forKey key: JSONCodingKey) throws -> Any {
        if let value = try? container.decode(Bool.self, forKey: key) {
            return value
        }
        if let value = try? container.decode(Int64.self, forKey: key) {
            return value
        }
        if let value = try? container.decode(Double.self, forKey: key) {
            return value
        }
        if let value = try? container.decode(String.self, forKey: key) {
            return value
        }
        if let value = try? container.decodeNil(forKey: key) {
            if value {
                return JSONNull()
            }
        }
        if var container = try? container.nestedUnkeyedContainer(forKey: key) {
            return try decodeArray(from: &container)
        }
        if var container = try? container.nestedContainer(keyedBy: JSONCodingKey.self, forKey: key) {
            return try decodeDictionary(from: &container)
        }
        throw decodingError(forCodingPath: container.codingPath)
    }

    static func decodeArray(from container: inout UnkeyedDecodingContainer) throws -> [Any] {
        var arr: [Any] = []
        while !container.isAtEnd {
            let value = try decode(from: &container)
            arr.append(value)
        }
        return arr
    }

    static func decodeDictionary(from container: inout KeyedDecodingContainer<JSONCodingKey>) throws -> [String: Any] {
        var dict = [String: Any]()
        for key in container.allKeys {
            let value = try decode(from: &container, forKey: key)
            dict[key.stringValue] = value
        }
        return dict
    }

    static func encode(to container: inout UnkeyedEncodingContainer, array: [Any]) throws {
        for value in array {
            if let value = value as? Bool {
                try container.encode(value)
            } else if let value = value as? Int64 {
                try container.encode(value)
            } else if let value = value as? Double {
                try container.encode(value)
            } else if let value = value as? String {
                try container.encode(value)
            } else if value is JSONNull {
                try container.encodeNil()
            } else if let value = value as? [Any] {
                var container = container.nestedUnkeyedContainer()
                try encode(to: &container, array: value)
            } else if let value = value as? [String: Any] {
                var container = container.nestedContainer(keyedBy: JSONCodingKey.self)
                try encode(to: &container, dictionary: value)
            } else {
                throw encodingError(forValue: value, codingPath: container.codingPath)
            }
        }
    }

    static func encode(to container: inout KeyedEncodingContainer<JSONCodingKey>, dictionary: [String: Any]) throws {
        for (key, value) in dictionary {
            let key = JSONCodingKey(stringValue: key)!
            if let value = value as? Bool {
                try container.encode(value, forKey: key)
            } else if let value = value as? Int64 {
                try container.encode(value, forKey: key)
            } else if let value = value as? Double {
                try container.encode(value, forKey: key)
            } else if let value = value as? String {
                try container.encode(value, forKey: key)
            } else if value is JSONNull {
                try container.encodeNil(forKey: key)
            } else if let value = value as? [Any] {
                var container = container.nestedUnkeyedContainer(forKey: key)
                try encode(to: &container, array: value)
            } else if let value = value as? [String: Any] {
                var container = container.nestedContainer(keyedBy: JSONCodingKey.self, forKey: key)
                try encode(to: &container, dictionary: value)
            } else {
                throw encodingError(forValue: value, codingPath: container.codingPath)
            }
        }
    }

    static func encode(to container: inout SingleValueEncodingContainer, value: Any) throws {
        if let value = value as? Bool {
            try container.encode(value)
        } else if let value = value as? Int64 {
            try container.encode(value)
        } else if let value = value as? Double {
            try container.encode(value)
        } else if let value = value as? String {
            try container.encode(value)
        } else if value is JSONNull {
            try container.encodeNil()
        } else {
            throw encodingError(forValue: value, codingPath: container.codingPath)
        }
    }

    public required init(from decoder: Decoder) throws {
        if var arrayContainer = try? decoder.unkeyedContainer() {
            self.value = try JSONAny.decodeArray(from: &arrayContainer)
        } else if var container = try? decoder.container(keyedBy: JSONCodingKey.self) {
            self.value = try JSONAny.decodeDictionary(from: &container)
        } else {
            let container = try decoder.singleValueContainer()
            self.value = try JSONAny.decode(from: container)
        }
    }

    public func encode(to encoder: Encoder) throws {
        if let arr = self.value as? [Any] {
            var container = encoder.unkeyedContainer()
            try JSONAny.encode(to: &container, array: arr)
        } else if let dict = self.value as? [String: Any] {
            var container = encoder.container(keyedBy: JSONCodingKey.self)
            try JSONAny.encode(to: &container, dictionary: dict)
        } else {
            var container = encoder.singleValueContainer()
            try JSONAny.encode(to: &container, value: self.value)
        }
    }
}

