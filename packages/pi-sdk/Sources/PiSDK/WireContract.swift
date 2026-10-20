import Foundation

// Internal JSON representation; the app never parses wire data.
indirect enum JSONValue: Codable, Sendable, Equatable {
    case object([String: JSONValue]), array([JSONValue]), string(String), number(Double), bool(Bool), null
    init(from decoder: any Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([JSONValue].self) { self = .array(v) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }
    func encode(to encoder: any Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }
    subscript(_ key: String) -> JSONValue {
        get { if case .object(let v) = self { return v[key] ?? .null }; return .null }
        set { if case .object(var v) = self { v[key] = newValue; self = .object(v) } }
    }
    var string: String? { if case .string(let v) = self { v } else { nil } }
    var array: [JSONValue]? { if case .array(let v) = self { v } else { nil } }
    var number: Double? { if case .number(let v) = self { v } else { nil } }
}

/// Evaluates the JSON Schema vocabulary emitted by the authoritative Zod v2
/// exporter, not arbitrary third-party schemas. Bundled files are exact copies;
/// fixture/drift tests fail when the contract changes.
struct WireContract: Sendable {
    static let schemas = ["Request", "ServerMessage", "result.server.initialize", "result.session.create", "result.message.send", "result.run.abort"]
    private var roots: [String: JSONValue] = [:]
    init() throws {
        for name in Self.schemas { roots[name] = try JSONDecoder().decode(JSONValue.self, from: Self.load(name)) }
    }
    private static func load(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name + ".schema", withExtension: "json", subdirectory: "Contract") else { throw PiError.protocolViolation("Missing bundled contract") }
        return try Data(contentsOf: url)
    }
    func data(_ name: String) throws -> Data { try Self.load(name) }
    func validate(_ value: JSONValue, schema: String) throws {
        guard let root = roots[schema], matches(value, root, root: root) else {
            throw PiError.protocolViolation("Malformed or unsupported v2 \(schema)")
        }
    }
    private func matches(_ value: JSONValue, _ schema: JSONValue, root: JSONValue) -> Bool {
        if schema == .bool(false) { return false }
        if schema == .bool(true) { return true }
        guard case .object(let rules) = schema else { return false }
        if let ref = rules["$ref"]?.string {
            guard ref.hasPrefix("#/") else { return false }
            let target = ref.dropFirst(2).split(separator: "/").reduce(root) { $0[String($1).replacingOccurrences(of: "~1", with: "/").replacingOccurrences(of: "~0", with: "~")] }
            if !matches(value, target, root: root) { return false }
        }
        if let choices = rules["anyOf"]?.array, !choices.contains(where: { matches(value, $0, root: root) }) { return false }
        if let choices = rules["oneOf"]?.array, choices.filter({ matches(value, $0, root: root) }).count != 1 { return false }
        if let not = rules["not"], matches(value, not, root: root) { return false }
        if let constant = rules["const"], constant != value { return false }
        if let options = rules["enum"]?.array, !options.contains(value) { return false }
        if let type = rules["type"]?.string {
            switch (type, value) {
            case ("object", .object), ("array", .array), ("string", .string), ("boolean", .bool), ("null", .null): break
            case ("number", .number(let n)): if !n.isFinite { return false }
            case ("integer", .number(let n)): if !n.isFinite || n.rounded() != n { return false }
            default: return false
            }
        }
        switch value {
        case .object(let object):
            for key in rules["required"]?.array ?? [] { if object[key.string ?? ""] == nil { return false } }
            for (key, item) in object {
                if let names = rules["propertyNames"], !matches(.string(key), names, root: root) { return false }
                if case .object(let properties) = rules["properties"], let property = properties[key] {
                    if !matches(item, property, root: root) { return false }
                } else if let extra = rules["additionalProperties"], !matches(item, extra, root: root) { return false }
            }
        case .array(let items):
            if let max = rules["maxItems"]?.number, Double(items.count) > max { return false }
            if let itemSchema = rules["items"], !items.allSatisfy({ matches($0, itemSchema, root: root) }) { return false }
        case .string(let text):
            // JSON Schema string lengths count Unicode code points, not graphemes.
            let length = Double(text.unicodeScalars.count)
            if let min = rules["minLength"]?.number, length < min { return false }
            if let max = rules["maxLength"]?.number, length > max { return false }
            if let pattern = rules["pattern"]?.string, text.range(of: pattern, options: .regularExpression) == nil { return false }
            if rules["x-pi-normalization"] == .string("trim"), text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return false }
        case .number(let n):
            if let min = rules["minimum"]?.number, n < min { return false }
            if let max = rules["maximum"]?.number, n > max { return false }
            if let min = rules["exclusiveMinimum"]?.number, n <= min { return false }
        default: break
        }
        return true
    }
}
