import Foundation

public enum DemoRunStatus: String, Sendable, Equatable {
    case idle, starting, running, aborting
}

public struct DemoMessage: Sendable, Equatable, Identifiable {
    public let id: String
    public let role: String
    public internal(set) var text: String
    public let isPartial: Bool
    public init(id: String, role: String, text: String, isPartial: Bool = false) {
        self.id = id; self.role = role; self.text = text; self.isPartial = isPartial
    }
}

/// Complete, conflatable plain-text projection of the one owned demo session.
/// It deliberately does not render thinking, tools or optional presentation.
public struct DemoSessionProjection: Sendable, Equatable {
    public let session: DemoSession
    public internal(set) var messages: [DemoMessage]
    public internal(set) var status: DemoRunStatus
    public internal(set) var error: String?
    public internal(set) var sequence: Double = 0
    internal var stopRequested = false
    internal var activeDraftId: String?

    public init(session: DemoSession, messages: [DemoMessage] = [], status: DemoRunStatus = .idle, error: String? = nil) {
        self.session = session; self.messages = messages; self.status = status; self.error = error
    }
    internal init(snapshot: JSONValue) throws {
        self.init(session: DemoSession(sessionId: snapshot["sessionId"].string!, projectPath: snapshot["projectPath"].string!))
        try applySnapshot(snapshot)
    }
    internal mutating func applySnapshot(_ snapshot: JSONValue) throws {
        guard snapshot["sessionId"].string == session.sessionId,
              snapshot["projectPath"].string == session.projectPath else { throw PiError.protocolViolation("Snapshot identity changed") }
        guard let watermark = snapshot["throughSequence"].number, watermark >= sequence else { return }
        try rejectQuestions(snapshot["prompts"])
        let previous = messages
        let wasStarting = status == .starting
        let refreshed = (snapshot["messages"].array ?? []).compactMap(Self.textMessage)
        // A stopped run may never produce a finalized message. Preserve its
        // observed text unless the snapshot supplies its newly finalized answer.
        let newAnswers = refreshed.filter { candidate in
            candidate.role == "assistant" && !previous.contains { $0.id == candidate.id }
        }
        let partials = previous.filter { partial in
            partial.isPartial && (partial.id != activeDraftId || !newAnswers.contains { $0.text.hasPrefix(partial.text) })
        }
        messages = refreshed
        for partial in partials {
            let previousIndex = previous.firstIndex { $0.id == partial.id }!
            let anchor = previous[..<previousIndex].reversed().first { old in messages.contains { $0.id == old.id } }
            let insertion = anchor.flatMap { old in messages.firstIndex { $0.id == old.id } }.map { $0 + 1 } ?? 0
            messages.insert(partial, at: insertion)
        }
        sequence = watermark
        try applyRuntime(snapshot["runtime"])
        if wasStarting && status == .idle { status = .starting }
        try checkBounds()
    }
    internal mutating func apply(_ event: JSONValue, sendRequestId: String?) throws {
        if event["event"].string == "presentation.changed" { return }
        if event["event"].string == "session.snapshot" { try applySnapshot(event["data"]); return }
        guard let next = event["sequence"].number else { throw PiError.protocolViolation("Missing session sequence") }
        if next <= sequence { return }
        guard next == sequence + 1 else { throw PiError.protocolViolation("Session event gap; reconnect/recovery is unsupported in this MVP") }
        sequence = next
        let data = event["data"]
        switch event["event"].string {
        case "runtime.status": try applyRuntime(data)
        case "session.closed": throw PiError.protocolViolation("The demo session was closed on the server")
        case "prompt.list.changed": try rejectQuestions(data["prompts"])
        case "message.delta":
            let id = "draft:\(data["runId"].string!)"
            activeDraftId = id
            if let index = messages.firstIndex(where: { $0.id == id }) { messages[index].text += data["delta"].string! }
            else { messages.append(DemoMessage(id: id, role: "assistant", text: data["delta"].string!, isPartial: true)) }
        case "message.finalized":
            if let message = Self.textMessage(data["message"]) {
                let draftId = "draft:\(data["runId"].string!)"
                if let index = messages.firstIndex(where: { $0.id == message.id }) { messages[index] = message }
                else if message.role == "assistant", let index = messages.firstIndex(where: { $0.id == draftId }) { messages[index] = message }
                else { messages.append(message) }
                if message.role == "assistant" { messages.removeAll { $0.id == draftId } }
            }
        case "operation.finished":
            if data["requestId"].string == sendRequestId, data["outcome"].string == "failed" {
                error = data["error"]["message"].string
                if status == .starting { status = .idle }
            }
        case "notification.created":
            if data["level"].string == "error" { error = data["message"].string }
        case "steering.queue.changed":
            if data["messages"].array?.isEmpty == false { throw PiError.protocolViolation("Queued steering is unsupported in this MVP") }
        default: break // Known thinking/tool/settings events still advance the watermark.
        }
        try checkBounds()
    }
    private mutating func applyRuntime(_ runtime: JSONValue) throws {
        switch runtime["status"].string {
        case "idle": status = .idle; stopRequested = false
        case "running": status = stopRequested ? .aborting : .running
        case "aborting": status = .aborting
        default: throw PiError.protocolViolation("Demo runtime is closing or unsupported")
        }
        if let lastError = runtime["lastError"].string { error = lastError }
        else if status == .running { error = nil }
    }
    private func rejectQuestions(_ prompts: JSONValue) throws {
        if prompts.array?.isEmpty == false { throw PiError.protocolViolation("Structured question unsupported in this MVP; server work may remain blocked") }
    }
    private static func textMessage(_ value: JSONValue) -> DemoMessage? {
        guard let role = value["role"].string, ["user", "assistant", "system", "custom"].contains(role), let text = value["text"].string else { return nil }
        return DemoMessage(id: "message:\(value["id"].string!)", role: role, text: text)
    }
    private func checkBounds() throws {
        guard messages.count <= 4096, messages.reduce(0, { $0 + $1.text.utf8.count }) <= 16 * 1024 * 1024 else {
            throw PiError.protocolViolation("Demo transcript exceeded its bounded capacity")
        }
    }
}
