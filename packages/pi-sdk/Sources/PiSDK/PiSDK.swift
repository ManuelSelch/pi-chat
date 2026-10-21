import Foundation

public struct DemoSession: Sendable, Equatable {
    public let sessionId: String
    public let projectPath: String
    public init(sessionId: String, projectPath: String) {
        self.sessionId = sessionId; self.projectPath = projectPath
    }
}

public enum PiConnectionState: Sendable, Equatable {
    case disconnected, connecting, connected, ready(DemoSession), failed(PiError)
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
public actor PiClient: PiSessionConnection {
    public private(set) var catalogue = PiCatalogue()
    private var catalogueObservers: [UUID: AsyncStream<PiCatalogue>.Continuation] = [:]
    private var selectionEvents: [JSONValue] = []
    private var selectionEventBytes = 0
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
    private var pending: (id: String, method: String, sessionId: String?, continuation: CheckedContinuation<JSONValue, Error>, timer: Task<Void, Never>)?
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

    public func catalogues() -> AsyncStream<PiCatalogue> {
        let id = UUID()
        let (stream, continuation) = AsyncStream<PiCatalogue>.makeStream(bufferingPolicy: .bufferingNewest(1))
        continuation.yield(catalogue)
        if disposed { continuation.finish(); return stream }
        catalogueObservers[id] = continuation
        continuation.onTermination = { [weak self] _ in Task { await self?.removeCatalogueObserver(id) } }
        return stream
    }
    private func removeCatalogueObserver(_ id: UUID) { catalogueObservers.removeValue(forKey: id) }
    private func publishCatalogue() { for observer in catalogueObservers.values { observer.yield(catalogue) } }

    public func connectDemo(projectPath: String, takingControl: Bool) async throws -> DemoSession {
        guard projectPath.hasPrefix("/") else { throw PiError.invalidConfiguration("Use an absolute server-side directory.") }
        try await connect(takingControl: takingControl)
        do { return try await createSession(projectPath: projectPath) }
        catch { let failure = normalize(error); await fail(failure); throw failure }
    }

    public func connect(takingControl: Bool) async throws {
        guard takingControl else { throw PiError.invalidConfiguration("Explicit controller consent is required.") }
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
            // Initialization lists runtimes but does not select one.
            guard initialization["capabilities"].array?.isEmpty == true else { throw PiError.protocolViolation("Server selected unrequested capabilities") }
            publish(.connected)
        } catch {
            let failure = normalize(error)
            await fail(failure)
            throw failure
        }
    }

    public func attachSession(sessionId: String) async throws -> DemoSession {
        guard canSelect, catalogue.sessions.contains(where: { $0.sessionId == sessionId && $0.status != "closing" }) else { throw PiError.invalidState }
        _ = try await request("session.snapshot", params: .object([:]), sessionId: sessionId)
        guard let projection else { throw PiError.invalidState }
        return projection.session
    }
    public func openSession(sessionPath: String) async throws -> DemoSession {
        guard canSelect, !sessionPath.isEmpty else { throw PiError.invalidState }
        if let existing = catalogue.sessions.first(where: { $0.sessionPath == sessionPath }) {
            return try await attachSession(sessionId: existing.sessionId)
        }
        _ = try await request("session.open", params: .object(["sessionPath": .string(sessionPath)]))
        guard let projection else { throw PiError.invalidState }
        return projection.session
    }
    public func createSession(projectPath: String) async throws -> DemoSession {
        guard canSelect, projectPath.hasPrefix("/") else { throw PiError.invalidState }
        _ = try await request("session.create", params: .object(["projectPath": .string(projectPath)]))
        guard let projection else { throw PiError.invalidState }
        return projection.session
    }
    private var canSelect: Bool {
        guard !disposed, pending == nil, settlementTimer == nil else { return false }
        switch state { case .connected, .ready: return true; default: return false }
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
    private var pendingMutation: Bool { pending != nil && !["server.initialize", "session.snapshot", "session.list", "project.list"].contains(pending!.method) }

    private func request(_ method: String, params: JSONValue, sessionId: String? = nil) async throws -> JSONValue {
        guard !disposed, pending == nil, totalRequests < 4096 else { throw PiError.invalidState }
        try Task.checkCancellation()
        totalRequests += 1
        let id = UUID().uuidString
        var value = JSONValue.object(["version": .number(2), "type": .string("request"), "requestId": .string(id), "method": .string(method), "params": params])
        if let sessionId { value["sessionId"] = .string(sessionId) }
        if method == "message.send" || method == "run.abort" {
            guard let projection else { throw PiError.invalidState }
            value["sessionId"] = .string(projection.session.sessionId)
        }
        if method == "message.send" { sendRequestId = id }
        if ["session.create", "session.open", "session.snapshot"].contains(method) {
            selectionEvents = []; selectionEventBytes = 0
        }
        try contract?.validate(value, schema: "Request")
        let text = String(decoding: try JSONEncoder().encode(value), as: UTF8.self)
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let timer = Task { [weak self, requestTimeout] in
                    do { try await Task.sleep(for: requestTimeout) } catch { return }
                    await self?.expire(id)
                }
                pending = (id, method, sessionId, continuation, timer)
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
                selectionEvents = []; selectionEventBytes = 0
                pending = nil; request.timer.cancel(); request.continuation.resume(throwing: error)
                return
            }
            try contract?.validate(value["result"], schema: "result.\(request.method)")
            if request.method == "server.initialize" {
                serverInstanceId = value["result"]["serverInstanceId"].string
                try catalogue.applyProjects(value["result"]["projects"])
                try catalogue.applyInventory(value["result"]["inventory"])
                publishCatalogue()
            }
            if ["session.create", "session.open"].contains(request.method) {
                let opened = value["result"]
                guard opened["summary"]["sessionId"] == opened["snapshot"]["sessionId"],
                      opened["summary"]["projectPath"] == opened["snapshot"]["projectPath"] else { throw PiError.protocolViolation("Opened session identity mismatch") }
                try selectSnapshot(opened["snapshot"])
                let summary: PiRuntimeSummary = try decodeCatalogueValue(opened["summary"])
                if let index = catalogue.sessions.firstIndex(where: { $0.sessionId == summary.sessionId }) { catalogue.sessions[index] = summary }
                else { catalogue.sessions.append(summary) }
                publishCatalogue()
            }
            if request.method == "session.snapshot" {
                guard value["result"]["sessionId"].string == request.sessionId else { throw PiError.protocolViolation("Snapshot response identity mismatch") }
                try selectSnapshot(value["result"])
            }
            pending = nil; request.timer.cancel(); request.continuation.resume(returning: value["result"])
        case "event":
            guard let serverInstanceId, value["serverInstanceId"].string == serverInstanceId else { throw PiError.protocolViolation("Unexpected server identity or event before initialization") }
            if value["event"].string == "server.stopping" { throw PiError.disconnected }
            if value["event"].string == "project.list.changed" { try catalogue.applyProjects(value["data"]); publishCatalogue() }
            if value["event"].string == "session.list.changed" { try catalogue.applyInventory(value["data"]); publishCatalogue() }
            if value["event"].string == "session.replaced", value["data"]["previousSessionId"].string == projection?.session.sessionId {
                try selectSnapshot(value["data"]["snapshot"], replaySelection: false)
            }
            if let method = pending?.method, ["session.create", "session.open", "session.snapshot"].contains(method), value["sessionId"].string != nil {
                selectionEventBytes += text.utf8.count
                guard selectionEvents.count < 512, selectionEventBytes <= 16 * 1024 * 1024 else { throw PiError.protocolViolation("Session attachment event buffer exceeded") }
                selectionEvents.append(value)
            }
            if value["event"].string == "session.closed", value["sessionId"].string == projection?.session.sessionId {
                projection = nil; publish(.connected); return
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
    private func selectSnapshot(_ snapshot: JSONValue, replaySelection: Bool = true) throws {
        var next: DemoSessionProjection
        if var current = projection, current.session.sessionId == snapshot["sessionId"].string {
            try current.applySnapshot(snapshot); next = current
        } else { next = try DemoSessionProjection(snapshot: snapshot) }
        if replaySelection {
            for event in selectionEvents where event["sessionId"].string == next.session.sessionId {
                try next.apply(event, sendRequestId: sendRequestId)
            }
            selectionEvents = []; selectionEventBytes = 0
        }
        projection = next; publishProjection(); publish(.ready(next.session))
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
        for observer in catalogueObservers.values { observer.finish() }
        catalogueObservers.removeAll(); selectionEvents = []; selectionEventBytes = 0
        await transport.close()
    }
    deinit {
        receiver?.cancel(); sender?.cancel(); pending?.timer.cancel(); settlementTimer?.cancel()
        for observer in observers.values { observer.finish() }
        for observer in projectionObservers.values { observer.finish() }
        for observer in catalogueObservers.values { observer.finish() }
        let transport = transport
        Task { await transport.close() }
    }
}
