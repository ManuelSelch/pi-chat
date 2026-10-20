import Foundation
import Testing
@testable import PiSDK

/// Transport fixture mechanics stay behind the browsing test driver.
private actor BrowsingTransport: PiTransport {
    let base = FakeTransport()
    var responses: [String: JSONValue] = [:]
    var requests: [JSONValue] = []
    var heldMethod: String?
    var heldRequest: JSONValue?
    var rejectOpen = false
    func send(_ text: String) async throws {
        let request = try JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
        requests.append(request)
        if request["method"].string == heldMethod { heldRequest = request; return }
        try await answer(request)
    }
    func answer(_ request: JSONValue) async throws {
        let method = request["method"].string!
        var value = try responses[method] ?? result(method)
        if method == "server.initialize" { value["capabilities"] = .array([]) }
        let response: JSONValue = rejectOpen && method == "session.open"
            ? .object(["version": .number(2), "type": .string("response"), "requestId": request["requestId"], "ok": .bool(false), "error": .object(["code": .string("notFound"), "message": .string("History unavailable")])])
            : .object(["version": .number(2), "type": .string("response"), "requestId": request["requestId"], "ok": .bool(true), "result": value])
        try await emit(response)
    }
    func emit(_ value: JSONValue) async throws { await base.push(String(decoding: try JSONEncoder().encode(value), as: UTF8.self)) }
    func receive() async throws -> String { try await base.receive() }
    func close() async { await base.close() }
    func configure(_ method: String, _ value: JSONValue) { responses[method] = value }
    func hold(_ method: String) { heldMethod = method }
    func release() async throws { let request = heldRequest!; heldRequest = nil; heldMethod = nil; try await answer(request) }
    func rejectOpening() { rejectOpen = true }
}

private struct BrowsingDriver {
    let server = BrowsingTransport()
    let client: PiClient
    init() { client = PiClient(transport: server, requestTimeout: .seconds(2)) }
    static func run(_ scenario: (BrowsingDriver) async throws -> Void) async throws {
        let app = BrowsingDriver()
        do { try await scenario(app); await app.client.disconnect() }
        catch { await app.client.disconnect(); throw error }
    }
    func connect() async throws { try await client.connect(takingControl: true) }
    func methods() async -> [String] { await server.requests.compactMap { $0["method"].string } }
    func publishCatalogue(revision: Int) async throws {
        let project: JSONValue = .object([
            "path": .string("/home/pi"), "displayPath": .string("~"), "name": .string("Quick Chats"),
            "exists": .bool(true), "modified": .number(0), "sessionCount": .number(0), "quickChats": .bool(true), "sessions": .array([])
        ])
        try await server.emit(.object(["version": .number(2), "type": .string("event"), "serverInstanceId": .string("server"), "event": .string("project.list.changed"), "data": .object(["revision": .number(Double(revision)), "catalogue": .object(["projects": .array([project])])])]))
    }
    func configureRunningSnapshot() async throws {
        var snapshot = try result("session.snapshot")
        snapshot["runtime"] = runtime("running")
        snapshot["messages"] = .array([.object(["id": .string("u"), "role": .string("user"), "text": .string("Continue working")])])
        await server.configure("session.snapshot", snapshot)
    }
}

@Test func browsingConnectDoesNotCreateOrSelectASessionAndReceivesColdCatalogue() async throws {
    try await BrowsingDriver.run { app in
        try await app.connect()
        #expect(await app.methods() == ["server.initialize"])
        #expect(await app.client.state == .connected)
        #expect(await app.client.projection == nil)
        try await app.publishCatalogue(revision: 1)
        try await waitFor { await app.client.catalogue.projects.first?.quickChats == true }
        #expect(await app.client.catalogue.sessions.first?.sessionId == "runtime")
        try await app.publishCatalogue(revision: 0)
        #expect(await app.client.catalogue.projectRevision == 1)
    }
}

@Test func runtimeAttachmentUsesSnapshotNotCreateAndPreservesRunningState() async throws {
    try await BrowsingDriver.run { app in
        try await app.configureRunningSnapshot()
        try await app.connect()
        let session = try await app.client.attachSession(sessionId: "runtime")
        #expect(session.sessionId == "runtime")
        #expect(await app.client.projection?.status == .running)
        #expect(await app.client.projection?.messages.map(\.text) == ["Continue working"])
        #expect(await app.methods() == ["server.initialize", "session.snapshot"])
        #expect(await app.server.requests.last?["sessionId"].string == "runtime")
    }
}

@Test func historyOpeningAndQuickChatCreationUseServerPaths() async throws {
    try await BrowsingDriver.run { app in
        try await app.connect()
        _ = try await app.client.openSession(sessionPath: "/history/saved.jsonl")
        #expect(await app.server.requests.last?["params"]["sessionPath"].string == "/history/saved.jsonl")
        _ = try await app.client.createSession(projectPath: "/home/pi")
        #expect(await app.server.requests.last?["params"]["projectPath"].string == "/home/pi")
        #expect(await app.methods() == ["server.initialize", "session.open", "session.create"])
    }
}

@Test func rejectedHistoryOpenLeavesConnectionUsableAndNeverCreatesFallback() async throws {
    try await BrowsingDriver.run { app in
        try await app.connect()
        await app.server.rejectOpening()
        await #expect(throws: PiError.self) { try await app.client.openSession(sessionPath: "/missing") }
        #expect(await app.client.state == .connected)
        #expect(await app.methods() == ["server.initialize", "session.open"])
        _ = try await app.client.attachSession(sessionId: "runtime")
    }
}

@Test func attachmentBuffersEventsUntilSnapshotAndRejectsDuplicateOpen() async throws {
    try await BrowsingDriver.run { app in
        try await app.connect()
        await app.server.hold("session.snapshot")
        let opening = Task { try await app.client.attachSession(sessionId: "runtime") }
        try await waitFor { await app.server.heldRequest != nil }
        await #expect(throws: PiError.self) { try await app.client.attachSession(sessionId: "runtime") }
        try await app.server.emit(event("runtime.status", 1, runtime("running")))
        try await app.server.emit(event("message.delta", 2, delta("Live text")))
        try await app.server.release()
        _ = try await opening.value
        #expect(await app.client.projection?.messages.last?.text == "Live text")
        #expect(await app.client.projection?.status == .running)
        #expect(await app.methods() == ["server.initialize", "session.snapshot"])
    }
}

@Test func reattachingSameRuntimeRetainsObservedPartialText() async throws {
    try await BrowsingDriver.run { app in
        try await app.connect()
        _ = try await app.client.attachSession(sessionId: "runtime")
        try await app.server.emit(event("runtime.status", 1, runtime("running")))
        try await app.server.emit(event("message.delta", 2, delta("Observed prefix")))
        try await waitFor { await app.client.projection?.sequence == 2 }
        var snapshot = try result("session.snapshot")
        snapshot["runtime"] = runtime("running")
        snapshot["throughSequence"] = .number(2)
        await app.server.configure("session.snapshot", snapshot)
        _ = try await app.client.attachSession(sessionId: "runtime")
        #expect(await app.client.projection?.messages.last?.text == "Observed prefix")
    }
}

@Test func knownHistoryAttachesWithoutReopeningAndMismatchedSnapshotFails() async throws {
    try await BrowsingDriver.run { app in
        var initialization = try result("server.initialize")
        var summary = initialization["inventory"]["sessions"].array![0]
        summary["sessionPath"] = .string("/known")
        initialization["inventory"]["sessions"] = .array([summary])
        await app.server.configure("server.initialize", initialization)
        try await app.connect()
        _ = try await app.client.openSession(sessionPath: "/known")
        #expect(await app.methods() == ["server.initialize", "session.snapshot"])
        var snapshot = try result("session.snapshot")
        snapshot["sessionId"] = .string("wrong")
        await app.server.configure("session.snapshot", snapshot)
        await #expect(throws: PiError.self) { try await app.client.attachSession(sessionId: "runtime") }
        guard case .failed = await app.client.state else { Issue.record("Expected identity failure"); return }
    }
}

@Test func initializationCanListBlockedBackgroundSessionsWithoutAttachingThem() async throws {
    try await BrowsingDriver.run { app in
        var initialization = try result("server.initialize")
        var snapshot = initialization["snapshots"].array![0]
        snapshot["prompts"] = .array([.object(["id": .string("q"), "title": .string("Question"), "kind": .string("confirm"), "message": .string("Allow?")])])
        initialization["snapshots"] = .array([snapshot])
        await app.server.configure("server.initialize", initialization)
        try await app.connect()
        #expect(await app.client.state == .connected)
    }
}
