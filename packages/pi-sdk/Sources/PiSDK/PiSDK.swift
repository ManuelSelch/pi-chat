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
        case .invalidState: "Action is not available in the current connection or session state."
        case .disconnected: "Disconnected."
        case .rejected(let code, let message): "\(code): \(message)"
        case .requestExpired(let unknown): unknown ? "Request outcome unknown; server work may continue. Do not retry automatically." : "Request timed out."
        case .transport(let message, let unknown): unknown ? "\(message) Request outcome unknown; server work may continue." : message
        }
    }
}

public protocol PiDemoConnection: Sendable {
    func states() async -> AsyncStream<PiConnectionState>
    func connectDemo(projectPath: String, takingControl: Bool) async throws -> DemoSession
    func projections() async -> AsyncStream<DemoSessionProjection>
    func send(_ text: String) async throws
    func stop() async throws
    func disconnect() async
}

/// One connection attempt per instance. Reconnect is deliberately not implemented.
/// Initialization transfers controller access: the caller must obtain explicit
/// user consent before passing takingControl: true.
public actor PiClient: PiDemoConnection {
    public private(set) var state: PiConnectionState = .disconnected
    public private(set) var projection: DemoSessionProjection?
    private var projectionObservers: [UUID: AsyncStream<DemoSessionProjection>.Continuation] = [:]
    private var sendRequestId: String?
    private var mutationGeneration = UUID()
    private var settlementTimer: Task<Void, Never>?
    private var settlementToken: UUID?
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
    public func projections() -> AsyncStream<DemoSessionProjection> {
        let id = UUID()
        let (stream, continuation) = AsyncStream<DemoSessionProjection>.makeStream(bufferingPolicy: .bufferingNewest(1))
        if let projection { continuation.yield(projection) }
        if disposed { continuation.finish(); return stream }
        projectionObservers[id] = continuation
        continuation.onTermination = { [weak self] _ in Task { await self?.removeProjectionObserver(id) } }
        return stream
    }
    private func removeProjectionObserver(_ id: UUID) { projectionObservers.removeValue(forKey: id) }
    private func publishProjection() {
        guard let projection else { return }
        for observer in projectionObservers.values { observer.yield(projection) }
        if projection.status == .idle || projection.status == .running {
            settlementTimer?.cancel(); settlementTimer = nil; settlementToken = nil
        }
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

    public func send(_ text: String) async throws {
        guard !disposed, case .ready = state, projection?.status == .idle, pending == nil else { throw PiError.invalidState }
        let message = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty, message.unicodeScalars.count <= 1_048_576, !message.hasPrefix("/"), !message.hasPrefix("!") else {
            throw PiError.invalidConfiguration("Enter a nonempty plain-text message (no slash or bash commands).")
        }
        let mutation = UUID(); mutationGeneration = mutation
        projection?.activeDraftId = nil
        projection?.status = .starting; projection?.error = nil; publishProjection()
        do {
            _ = try await request("message.send", params: .object(["message": .string(message)]))
            if !disposed, mutationGeneration == mutation, projection?.status == .starting { armSettlementDeadline() }
        } catch {
            if !disposed, mutationGeneration == mutation, projection?.status == .starting { projection?.status = .idle; publishProjection() }
            throw error
        }
    }
    public func stop() async throws {
        guard !disposed, case .ready = state, projection?.status == .running, pending == nil else { throw PiError.invalidState }
        let mutation = UUID(); mutationGeneration = mutation
        projection?.stopRequested = true; projection?.status = .aborting; publishProjection()
        do {
            let receipt = try await request("run.abort", params: .object([:]))
            guard !disposed, mutationGeneration == mutation else { return }
            if receipt["state"].string == "completed" { projection?.status = .idle; projection?.stopRequested = false; publishProjection() }
            else if !disposed, projection?.status == .aborting { armSettlementDeadline() }
        } catch {
            if !disposed, mutationGeneration == mutation, projection?.status == .aborting { projection?.stopRequested = false; projection?.status = .running; publishProjection() }
            throw error
        }
    }
    private func armSettlementDeadline() {
        settlementTimer?.cancel()
        let token = UUID(); settlementToken = token
        settlementTimer = Task { [weak self, requestTimeout] in
            do { try await Task.sleep(for: requestTimeout) } catch { return }
            await self?.settlementExpired(token)
        }
    }
    private func settlementExpired(_ token: UUID) async {
        guard settlementToken == token, projection?.status == .starting || projection?.status == .aborting else { return }
        await fail(PiError.transport(message: "Server did not settle the admitted start/stop request in time.", outcomeUnknown: true))
    }
    private var pendingMutation: Bool { pending != nil && pending?.method != "server.initialize" }

    private func request(_ method: String, params: JSONValue) async throws -> JSONValue {
        guard !disposed, pending == nil, totalRequests < 4096 else { throw PiError.invalidState }
        try Task.checkCancellation()
        totalRequests += 1
        let id = UUID().uuidString
        var value = JSONValue.object(["version": .number(2), "type": .string("request"), "requestId": .string(id), "method": .string(method), "params": params])
        if method == "message.send" || method == "run.abort" {
            guard let projection else { throw PiError.invalidState }
            value["sessionId"] = .string(projection.session.sessionId)
        }
        if method == "message.send" { sendRequestId = id }
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
        } onCancel: { Task { await self.cancelWait(id) } }
    }
    private func sendFailed(_ error: any Error, id: String) async {
        guard pending?.id == id else { return }
        await fail(error)
    }
    private func expire(_ id: String) async {
        guard pending?.id == id else { return }
        await fail(PiError.requestExpired(outcomeUnknown: pendingMutation))
    }
    private func cancelWait(_ id: String) async {
        guard pending?.id == id else { return }
        await fail(PiError.transport(message: "Local wait cancelled.", outcomeUnknown: pendingMutation))
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
            if request.method == "session.create" {
                let opened = value["result"]
                guard opened["summary"]["sessionId"] == opened["snapshot"]["sessionId"],
                      opened["summary"]["projectPath"] == opened["snapshot"]["projectPath"] else { throw PiError.protocolViolation("Created session identity mismatch") }
                let initial = try DemoSessionProjection(snapshot: opened["snapshot"])
                guard initial.status == .idle else { throw PiError.protocolViolation("Created demo is not idle") }
                projection = initial; publishProjection()
            }
            pending = nil; request.timer.cancel(); request.continuation.resume(returning: value["result"])
        case "event":
            guard let serverInstanceId, value["serverInstanceId"].string == serverInstanceId else { throw PiError.protocolViolation("Unexpected server identity or event before initialization") }
            if value["event"].string == "server.stopping" { throw PiError.disconnected }
            if value["event"].string == "session.replaced", value["data"]["previousSessionId"].string == projection?.session.sessionId {
                throw PiError.protocolViolation("Demo runtime was replaced; reconnect is unsupported")
            }
            if let current = projection, value["sessionId"].string == current.session.sessionId {
                var next = current
                try next.apply(value, sendRequestId: sendRequestId)
                projection = next; publishProjection()
            }
        case "protocolError":
            throw PiError.rejected(code: value["error"]["code"].string!, message: value["error"]["message"].string!)
        default: throw PiError.protocolViolation("Unsupported envelope")
        }
    }
    private func normalize(_ error: any Error) -> PiError {
        let unknown = pendingMutation
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
        let error: PiError = pendingMutation ? .transport(message: "Disconnected.", outcomeUnknown: true) : .disconnected
        await finish(.disconnected, error: error)
    }
    private func finish(_ finalState: PiConnectionState, error: PiError) async {
        disposed = true
        receiver?.cancel(); receiver = nil
        sender?.cancel(); sender = nil
        settlementTimer?.cancel(); settlementTimer = nil
        if let request = pending {
            pending = nil; request.timer.cancel(); request.continuation.resume(throwing: error)
        }
        publish(finalState)
        for observer in observers.values { observer.finish() }
        observers.removeAll()
        for observer in projectionObservers.values { observer.finish() }
        projectionObservers.removeAll()
        await transport.close()
    }
    deinit {
        receiver?.cancel(); sender?.cancel(); pending?.timer.cancel(); settlementTimer?.cancel()
        for observer in observers.values { observer.finish() }
        for observer in projectionObservers.values { observer.finish() }
        let transport = transport
        Task { await transport.close() }
    }
}
