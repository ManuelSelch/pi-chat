import Foundation

public struct DemoSession: Sendable, Equatable {
    public let sessionId: String
    public let projectPath: String
    public init(sessionId: String, projectPath: String) {
        self.sessionId = sessionId; self.projectPath = projectPath
    }
}

public enum PiConnectionState: Sendable, Equatable {
    case disconnected, connecting, ready(DemoSession), failed(PiError)
}

public enum PiError: Error, Sendable, Equatable, LocalizedError {
    case invalidConfiguration(String), invalidState, disconnected
    case protocolViolation(String), rejected(code: String, message: String)
    case requestExpired(outcomeUnknown: Bool), transport(message: String, outcomeUnknown: Bool)
    public var isOutcomeUnknown: Bool {
        switch self {
        case .requestExpired(let unknown), .transport(_, let unknown): unknown
        default: false
        }
    }
    public var errorDescription: String? {
        switch self {
        case .invalidConfiguration(let message), .protocolViolation(let message): message
        case .invalidState: "A connection is already in progress or this client has been disposed."
        case .disconnected: "Disconnected."
        case .rejected(let code, let message): "\(code): \(message)"
        case .requestExpired(let unknown): unknown ? "Session creation outcome unknown; do not retry automatically." : "Initialization timed out."
        case .transport(let message, let unknown): unknown ? "\(message) Session creation outcome unknown; server work may continue." : message
        }
    }
}

public protocol PiDemoConnection: Sendable {
    func states() async -> AsyncStream<PiConnectionState>
    func connectDemo(projectPath: String, takingControl: Bool) async throws -> DemoSession
    func disconnect() async
}

/// One connection attempt per instance. Reconnect is deliberately not implemented.
/// Initialization transfers controller access: the caller must obtain explicit
/// user consent before passing takingControl: true.
public actor PiClient: PiDemoConnection {
    public private(set) var state: PiConnectionState = .disconnected
    private let transport: any PiTransport
    private let requestTimeout: Duration
    private var contract: WireContract?
    private var receiver: Task<Void, Never>?
    private var sender: Task<Void, Never>?
    private var pending: (id: String, method: String, continuation: CheckedContinuation<JSONValue, Error>, timer: Task<Void, Never>)?
    private var disposed = false
    private var started = false
    private var serverInstanceId: String?
    private var totalRequests = 0
    private var observers: [UUID: AsyncStream<PiConnectionState>.Continuation] = [:]

    public init(transport: any PiTransport, requestTimeout: Duration = .seconds(10)) {
        self.transport = transport
        self.requestTimeout = requestTimeout
    }
    public init(endpoint: URL, requestTimeout: Duration = .seconds(10)) {
        self.transport = URLSessionPiTransport(endpoint: endpoint)
        self.requestTimeout = requestTimeout
    }
    /// Conflated complete state, not an unbounded queue of protocol events.
    public func states() -> AsyncStream<PiConnectionState> {
        let id = UUID()
        let (stream, continuation) = AsyncStream<PiConnectionState>.makeStream(bufferingPolicy: .bufferingNewest(1))
        continuation.yield(state)
        if disposed { continuation.finish(); return stream }
        observers[id] = continuation
        continuation.onTermination = { [weak self] _ in Task { await self?.removeObserver(id) } }
        return stream
    }
    private func removeObserver(_ id: UUID) { observers.removeValue(forKey: id) }
    private func publish(_ value: PiConnectionState) {
        state = value
        for observer in observers.values { observer.yield(value) }
    }

    public func connectDemo(projectPath: String, takingControl: Bool) async throws -> DemoSession {
        guard takingControl else { throw PiError.invalidConfiguration("Explicit controller consent is required.") }
        guard projectPath.hasPrefix("/"), !projectPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw PiError.invalidConfiguration("Use an absolute, isolated server-side demo directory.")
        }
        guard !started, !disposed else { throw PiError.invalidState }
        started = true
        publish(.connecting)
        do {
            contract = try WireContract()
            receiver = Task { [weak self, transport] in
                do {
                    while !Task.isCancelled {
                        let text = try await transport.receive()
                        guard let self else { return }
                        try await self.receive(text)
                    }
                } catch { await self?.fail(error) }
            }
            let initialization = try await request("server.initialize", params: .object([
                "client": .object(["name": .string("Pi Studio"), "version": .string("0.1.0")]), "capabilities": .array([])
            ]))
            guard !disposed else { throw PiError.disconnected }
            // The complete result was validated before the response was admitted.
            // Existing runtime snapshots are never attached to the demo.
            guard initialization["capabilities"].array?.isEmpty == true else { throw PiError.protocolViolation("Server selected unrequested capabilities") }
            let opened = try await request("session.create", params: .object(["projectPath": .string(projectPath)]))
            guard !disposed else { throw PiError.disconnected }
            guard let id = opened["summary"]["sessionId"].string,
                  opened["snapshot"]["sessionId"].string == id,
                  let canonicalPath = opened["summary"]["projectPath"].string,
                  opened["snapshot"]["projectPath"].string == canonicalPath,
                  opened["snapshot"]["runtime"]["status"].string == "idle",
                  opened["snapshot"]["prompts"].array?.isEmpty == true else {
                throw PiError.protocolViolation("Created demo session is not usable or has inconsistent identity")
            }
            let session = DemoSession(sessionId: id, projectPath: canonicalPath)
            publish(.ready(session))
            return session
        } catch {
            let failure = normalize(error)
            await fail(failure)
            throw failure
        }
    }

    private func request(_ method: String, params: JSONValue) async throws -> JSONValue {
        guard !disposed, pending == nil, totalRequests < 4096 else { throw PiError.invalidState }
        try Task.checkCancellation()
        totalRequests += 1
        let id = UUID().uuidString
        let value = JSONValue.object(["version": .number(2), "type": .string("request"), "requestId": .string(id), "method": .string(method), "params": params])
        try contract?.validate(value, schema: "Request")
        let text = String(decoding: try JSONEncoder().encode(value), as: UTF8.self)
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let timer = Task { [weak self, requestTimeout] in
                    do { try await Task.sleep(for: requestTimeout) } catch { return }
                    await self?.expire(id)
                }
                pending = (id, method, continuation, timer)
                sender = Task { [weak self, transport] in
                    do {
                        try Task.checkCancellation()
                        try await transport.send(text)
                    } catch { await self?.sendFailed(error, id: id) }
                }
            }
        } onCancel: { Task { await self.cancelWait() } }
    }
    private func sendFailed(_ error: any Error, id: String) async {
        guard pending?.id == id else { return }
        await fail(error)
    }
    private func expire(_ id: String) async {
        guard pending?.id == id else { return }
        await fail(PiError.requestExpired(outcomeUnknown: pending?.method == "session.create"))
    }
    private func cancelWait() async {
        await fail(PiError.transport(message: "Local wait cancelled.", outcomeUnknown: pending?.method == "session.create"))
    }
    private func receive(_ text: String) throws {
        guard !disposed else { return }
        guard text.utf8.count <= 16 * 1024 * 1024 else { throw PiError.protocolViolation("Incoming frame exceeds 16 MiB") }
        let value = try JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
        try contract?.validate(value, schema: "ServerMessage")
        switch value["type"].string {
        case "response":
            guard let request = pending, value["requestId"].string == request.id else {
                throw PiError.protocolViolation("Unexpected response identity")
            }
            if value["ok"] == .bool(false) {
                let error = PiError.rejected(code: value["error"]["code"].string!, message: value["error"]["message"].string!)
                pending = nil; request.timer.cancel(); request.continuation.resume(throwing: error)
                return
            }
            try contract?.validate(value["result"], schema: "result.\(request.method)")
            if request.method == "server.initialize" { serverInstanceId = value["result"]["serverInstanceId"].string }
            pending = nil; request.timer.cancel(); request.continuation.resume(returning: value["result"])
        case "event":
            guard let serverInstanceId, value["serverInstanceId"].string == serverInstanceId else { throw PiError.protocolViolation("Unexpected server identity or event before initialization") }
            if value["event"].string == "server.stopping" { throw PiError.disconnected }
            // Streaming projections belong to the next slice. Validate core events,
            // but do not attach to, render, or mutate any existing server runtime.
            if case .ready(let session) = state, value["sessionId"].string == session.sessionId,
               ["session.closed", "prompt.list.changed", "runtime.status"].contains(value["event"].string ?? "") {
                throw PiError.protocolViolation("Demo runtime changed; live session projections are not supported in this slice")
            }
        case "protocolError":
            throw PiError.rejected(code: value["error"]["code"].string!, message: value["error"]["message"].string!)
        default: throw PiError.protocolViolation("Unsupported envelope")
        }
    }
    private func normalize(_ error: any Error) -> PiError {
        let unknown = pending?.method == "session.create"
        if let error = error as? PiError {
            if unknown, !error.isOutcomeUnknown, case .rejected = error { return error }
            if unknown, !error.isOutcomeUnknown { return .transport(message: error.localizedDescription, outcomeUnknown: true) }
            return error
        }
        return .transport(message: error.localizedDescription, outcomeUnknown: unknown)
    }
    private func fail(_ error: any Error) async {
        guard !disposed else { return }
        let failure = normalize(error)
        await finish(.failed(failure), error: failure)
    }
    public func disconnect() async {
        if disposed { publish(.disconnected); return }
        let error: PiError = pending?.method == "session.create" ? .transport(message: "Disconnected.", outcomeUnknown: true) : .disconnected
        await finish(.disconnected, error: error)
    }
    private func finish(_ finalState: PiConnectionState, error: PiError) async {
        disposed = true
        receiver?.cancel(); receiver = nil
        sender?.cancel(); sender = nil
        if let request = pending {
            pending = nil; request.timer.cancel(); request.continuation.resume(throwing: error)
        }
        publish(finalState)
        for observer in observers.values { observer.finish() }
        observers.removeAll()
        await transport.close()
    }
    deinit {
        receiver?.cancel(); sender?.cancel(); pending?.timer.cancel()
        for observer in observers.values { observer.finish() }
        let transport = transport
        Task { await transport.close() }
    }
}
