import Foundation
import Testing
@testable import PiSDK

/// Fixture for switching the observed session while another request is in flight.
/// Requests are held per method so a send and a selection can overlap deterministically.
private actor SwitchingTransport: PiTransport {
    let base = FakeTransport()
    var requests: [JSONValue] = []
    private var responses: [String: JSONValue] = [:]
    private var snapshots: [String: JSONValue] = [:]
    private var held: [String: [JSONValue]] = [:]
    private var holdAfter: [String: Int] = [:]
    private var counts: [String: Int] = [:]

    func send(_ text: String) async throws {
        let request = try JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
        requests.append(request)
        let method = request["method"].string!
        counts[method, default: 0] += 1
        if let after = holdAfter[method], counts[method]! > after {
            held[method, default: []].append(request)
            return
        }
        try await answer(request)
    }
    func answer(_ request: JSONValue) async throws {
        let method = request["method"].string!
        var value: JSONValue
        if method == "session.snapshot", let id = request["sessionId"].string, let snapshot = snapshots[id] {
            value = snapshot
        } else if let configured = responses[method] {
            value = configured
        } else {
            value = try result(method)
        }
        if method == "server.initialize" { value["capabilities"] = .array([]) }
        try await emit(.object(["version": .number(2), "type": .string("response"),
                                "requestId": request["requestId"], "ok": .bool(true), "result": value]))
    }
    func release(_ method: String) async throws {
        guard var queue = held[method], !queue.isEmpty else { return }
        let request = queue.removeFirst()
        held[method] = queue
        try await answer(request)
    }
    func emit(_ value: JSONValue) async throws {
        await base.push(String(decoding: try JSONEncoder().encode(value), as: UTF8.self))
    }
    func receive() async throws -> String { try await base.receive() }
    func close() async { await base.close() }
    func configure(_ method: String, _ value: JSONValue) { responses[method] = value }
    func configureSnapshot(_ sessionId: String, _ value: JSONValue) { snapshots[sessionId] = value }
    func hold(_ method: String, after: Int = 0) { holdAfter[method] = after; held[method] = [] }
    func heldCount(_ method: String) -> Int { held[method]?.count ?? 0 }
    func methods() -> [String] { requests.compactMap { $0["method"].string } }
}

private struct SwitchingDriver {
    let server = SwitchingTransport()
    let client: PiClient
    init(timeout: Duration = .seconds(2)) { client = PiClient(transport: server, requestTimeout: timeout) }

    static func run(timeout: Duration = .seconds(2),
                    _ scenario: (SwitchingDriver) async throws -> Void) async throws {
        let app = SwitchingDriver(timeout: timeout)
        do { try await scenario(app); await app.client.disconnect() }
        catch { await app.client.disconnect(); throw error }
    }

    /// One initialization with two open runtimes; `second` is never selected at connect.
    func connect() async throws {
        var initialization = try result("server.initialize")
        initialization["inventory"] = .object(["revision": .number(0), "sessions": .array([
            summary("runtime", status: "idle"), summary("second", status: "idle"),
        ])])
        initialization["snapshots"] = .array([try snapshot("runtime"), try snapshot("second")])
        await server.configure("server.initialize", initialization)
        await server.configureSnapshot("runtime", try snapshot("runtime"))
        await server.configureSnapshot("second", try snapshot("second"))
        try await client.connect(takingControl: true)
    }

    private func summary(_ sessionId: String, status: String) -> JSONValue {
        .object(["sessionId": .string(sessionId), "title": .string(sessionId), "projectPath": .string("/p"),
                 "projectName": .string("p"), "status": .string(status)])
    }
    private func snapshot(_ sessionId: String) throws -> JSONValue {
        var value = try result("session.snapshot")
        value["sessionId"] = .string(sessionId)
        return value
    }
}

@Test func selectingAnotherSessionIsAllowedWhileASendIsAdmitted() async throws {
    try await SwitchingDriver.run { app in
        try await app.connect()
        _ = try await app.client.attachSession(sessionId: "runtime")
        try await app.client.send("Keep working")
        #expect(await app.client.projection?.status == .starting)
        // The admitted run left a settlement deadline armed; switching tabs must still work.
        let second = try await app.client.attachSession(sessionId: "second")
        #expect(second.sessionId == "second")
        #expect(await app.client.projection?.session.sessionId == "second")
        #expect(await app.client.state == .ready(second))
    }
}

@Test func overlappingSelectionAndSendResponsesAreMatchedByIdentity() async throws {
    try await SwitchingDriver.run { app in
        try await app.connect()
        _ = try await app.client.attachSession(sessionId: "runtime")
        await app.server.hold("message.send")
        let sending = Task { try await app.client.send("Settle me") }
        try await waitFor { await app.server.heldCount("message.send") == 1 }
        await app.server.hold("session.snapshot")
        let switching = Task { try await app.client.attachSession(sessionId: "second") }
        try await waitFor { await app.server.heldCount("session.snapshot") == 1 }
        // The earlier send settles while the snapshot request is still pending.
        try await app.server.release("message.send")
        try await sending.value
        try await app.server.release("session.snapshot")
        let second = try await switching.value
        #expect(second.sessionId == "second")
        #expect(await app.client.projection?.session.sessionId == "second")
        #expect(await app.server.methods() == ["server.initialize", "session.snapshot", "message.send", "session.snapshot"])
    }
}

@Test func staleSettlementDeadlineCannotFailAnotherSession() async throws {
    try await SwitchingDriver.run(timeout: .milliseconds(400)) { app in
        try await app.connect()
        _ = try await app.client.attachSession(sessionId: "runtime")
        // The next observed runtime is already stopping, so a stale deadline aimed at
        // the previous runtime would otherwise look like it belongs to this one.
        var aborting = try result("session.snapshot")
        aborting["sessionId"] = .string("second")
        aborting["runtime"] = .object(["status": .string("aborting"), "runId": .string("run")])
        await app.server.configureSnapshot("second", aborting)
        try await app.client.send("First session run")
        #expect(await app.client.projection?.status == .starting)
        _ = try await app.client.attachSession(sessionId: "second")
        #expect(await app.client.projection?.status == .aborting)
        try await Task.sleep(for: .milliseconds(700))
        guard case .ready(let observed) = await app.client.state else {
            Issue.record("A settlement deadline armed for another session failed this connection")
            return
        }
        #expect(observed.sessionId == "second")
        #expect(await app.client.projection?.status == .aborting)
    }
}

@Test func settlementDeadlineIsNotLeftBehindOnAnotherIdentity() async throws {
    try await SwitchingDriver.run(timeout: .milliseconds(400)) { app in
        try await app.connect()
        _ = try await app.client.attachSession(sessionId: "runtime")
        try await app.client.send("Keep going")
        #expect(await app.client.projection?.status == .starting)
        var replacement = try result("session.snapshot")
        replacement["sessionId"] = .string("replacement")
        replacement["runtime"] = .object(["status": .string("aborting"), "runId": .string("run")])
        try await app.server.emit(.object([
            "version": .number(2), "type": .string("event"), "serverInstanceId": .string("server"),
            "event": .string("session.replaced"),
            "data": .object(["previousSessionId": .string("runtime"), "snapshot": replacement]),
        ]))
        try await waitFor { await app.client.projection?.session.sessionId == "replacement" }
        #expect(await app.client.projection?.status == .aborting)
        // The deadline was armed for the previous identity; it must not fail this one.
        try await Task.sleep(for: .milliseconds(700))
        guard case .ready(let observed) = await app.client.state else {
            Issue.record("A settlement deadline armed for the previous identity failed the replacement")
            return
        }
        #expect(observed.sessionId == "replacement")
    }
}

@Test func closingTheSelectedSessionIsObservableAndKeepsTheConnectionUsable() async throws {
    try await SwitchingDriver.run { app in
        try await app.connect()
        _ = try await app.client.attachSession(sessionId: "runtime")
        var events = await app.client.sessionEvents().makeAsyncIterator()
        try await app.server.emit(event("session.closed", 1, .object(["reason": .string("requested")])))
        #expect(await events.next() == .closed(sessionId: "runtime"))
        #expect(await app.client.projection == nil)
        #expect(await app.client.state == .connected)
        _ = try await app.client.attachSession(sessionId: "second")
    }
}

@Test func replacingTheSelectedSessionPublishesIdentityAndSwapsInventory() async throws {
    try await SwitchingDriver.run { app in
        try await app.connect()
        _ = try await app.client.attachSession(sessionId: "runtime")
        var events = await app.client.sessionEvents().makeAsyncIterator()
        var replacement = try result("session.snapshot")
        replacement["sessionId"] = .string("replacement")
        try await app.server.emit(.object([
            "version": .number(2), "type": .string("event"), "serverInstanceId": .string("server"),
            "event": .string("session.replaced"),
            "data": .object(["previousSessionId": .string("runtime"), "snapshot": replacement]),
        ]))
        #expect(await events.next() == .replaced(previous: DemoSession(sessionId: "runtime", projectPath: "/p"),
                                                 current: DemoSession(sessionId: "replacement", projectPath: "/p")))
        #expect(await app.client.projection?.session.sessionId == "replacement")
        let ids = await app.client.catalogue.sessions.map(\.sessionId)
        #expect(ids.contains("replacement"))
        #expect(!ids.contains("runtime"))
    }
}

@Test func sessionIdentityEventsAreAvailableThroughTheSessionContract() async throws {
    try await SwitchingDriver.run { app in
        try await app.connect()
        _ = try await app.client.attachSession(sessionId: "runtime")
        // The application observes the session contract, not the concrete client.
        let connection: any PiSessionConnection = app.client
        var events = await connection.sessionEvents().makeAsyncIterator()
        try await app.server.emit(event("session.closed", 1, .object(["reason": .string("requested")])))
        #expect(await events.next() == .closed(sessionId: "runtime"))
    }
}
