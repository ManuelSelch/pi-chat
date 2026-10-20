import Foundation
import Testing
@testable import PiSDK

private let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
func fixtures() throws -> JSONValue {
    try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: root.appendingPathComponent("protocol/fixtures/v2/valid.json")))
}
func result(_ method: String) throws -> JSONValue {
    try #require(fixtures()["operations"].array?.first { $0["method"].string == method })["response"]["result"]
}

actor FakeTransport: PiTransport {
    var requests: [JSONValue] = []
    var queue: [String] = []
    var waiter: CheckedContinuation<String, Error>?
    var closed = false
    var mode: String
    init(_ mode: String = "success") { self.mode = mode }
    func send(_ text: String) async throws {
        let request = try JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
        requests.append(request)
        let method = request["method"].string!
        if mode == "timeout" || (mode == "createTimeout" && method == "session.create") { return }
        let response: JSONValue
        if mode == "denied" || (mode == "createDenied" && method == "session.create") {
            response = .object(["version": .number(2), "type": .string("response"), "requestId": request["requestId"], "ok": .bool(false), "error": .object(["code": .string("permissionDenied"), "message": .string("Not allowed")])])
        } else {
            response = .object(["version": .number(2), "type": .string("response"), "requestId": request["requestId"], "ok": .bool(true), "result": try negotiatedResult(method)])
        }
        push(String(decoding: try JSONEncoder().encode(response), as: UTF8.self))
    }
    private func negotiatedResult(_ method: String) throws -> JSONValue {
        var value = try result(method)
        if method == "server.initialize" { value["capabilities"] = .array([]) }
        return value
    }
    func receive() async throws -> String {
        if !queue.isEmpty { return queue.removeFirst() }
        if closed { throw PiError.disconnected }
        return try await withCheckedThrowingContinuation { waiter = $0 }
    }
    func push(_ text: String) {
        if let w = waiter { waiter = nil; w.resume(returning: text) } else { queue.append(text) }
    }
    func close() async { closed = true; waiter?.resume(throwing: PiError.disconnected); waiter = nil }
}

@Test func connectCreatesExactlyOneSessionAfterInitialization() async throws {
    let transport = FakeTransport()
    let client = PiClient(transport: transport)
    let session = try await client.connectDemo(projectPath: "/p", takingControl: true)
    #expect(session.sessionId == "runtime")
    #expect(await client.state == .ready(session))
    #expect(await transport.requests.map { $0["method"].string! } == ["server.initialize", "session.create"])
    #expect(await transport.requests.last?["params"]["projectPath"].string == "/p")
    await #expect(throws: PiError.self) { try await client.connectDemo(projectPath: "/p", takingControl: true) }
    await client.disconnect()
    #expect(await client.state == .disconnected)
    #expect(await transport.closed)
    #expect(await transport.requests.count == 2) // disconnect never closes the server runtime
}

@Test func explicitControlConsentIsRequired() async {
    let transport = FakeTransport()
    let client = PiClient(transport: transport)
    await #expect(throws: PiError.self) { try await client.connectDemo(projectPath: "/p", takingControl: false) }
    #expect(await transport.requests.isEmpty)
}

@Test(arguments: ["denied", "createDenied", "timeout", "createTimeout"])
func failuresAreBoundedAndDoNotRetry(mode: String) async {
    let transport = FakeTransport(mode)
    let client = PiClient(transport: transport, requestTimeout: .milliseconds(500))
    do {
        _ = try await client.connectDemo(projectPath: "/p", takingControl: true)
        Issue.record("Expected failure")
    } catch let error as PiError {
        if mode == "createTimeout" { #expect(error.isOutcomeUnknown) }
    } catch { Issue.record("Unexpected error: \(error)") }
    #expect(await transport.closed)
    #expect(await transport.requests.count == (mode.hasPrefix("create") ? 2 : 1))
}

@Test func disconnectSettlesPendingConnection() async throws {
    let transport = FakeTransport("timeout")
    let client = PiClient(transport: transport)
    let connect = Task { try await client.connectDemo(projectPath: "/p", takingControl: true) }
    while await transport.requests.isEmpty { await Task.yield() }
    await client.disconnect()
    await #expect(throws: PiError.self) { try await connect.value }
    #expect(await client.state == .disconnected)
    #expect(await transport.closed)
}

@Test func malformedAndObsoleteMessagesCannotChangeDisconnectedState() async throws {
    let transport = FakeTransport()
    let client = PiClient(transport: transport)
    _ = try await client.connectDemo(projectPath: "/p", takingControl: true)
    await transport.push("{\"version\":1,\"type\":\"event\"}")
    for _ in 0..<1000 { if await transport.closed { break }; await Task.yield() }
    guard case .failed = await client.state else { Issue.record("Expected protocol failure"); return }
    await client.disconnect()
    await transport.push("{}")
    #expect(await client.state == .disconnected)
}

@Test func disconnectDuringCreateReportsUnknownOutcome() async throws {
    let transport = FakeTransport("createTimeout")
    let client = PiClient(transport: transport)
    let connect = Task { try await client.connectDemo(projectPath: "/p", takingControl: true) }
    while await transport.requests.count < 2 { await Task.yield() }
    await client.disconnect()
    do { _ = try await connect.value; Issue.record("Expected unknown outcome") }
    catch let error as PiError { #expect(error.isOutcomeUnknown) }
    #expect(await client.state == .disconnected)
    #expect(await transport.requests.count == 2)
}

@Test func cancellingConnectDisposesLocalTransport() async throws {
    let transport = FakeTransport("timeout")
    let client = PiClient(transport: transport)
    let connect = Task { try await client.connectDemo(projectPath: "/p", takingControl: true) }
    while await transport.requests.isEmpty { await Task.yield() }
    connect.cancel()
    await #expect(throws: PiError.self) { try await connect.value }
    #expect(await transport.closed)
}

@Test func transportClosureEndsReadyConnection() async throws {
    let transport = FakeTransport()
    let client = PiClient(transport: transport)
    _ = try await client.connectDemo(projectPath: "/p", takingControl: true)
    await transport.close()
    for _ in 0..<1000 { if case .failed = await client.state { break }; await Task.yield() }
    guard case .failed = await client.state else { Issue.record("Expected failed state"); return }
    await #expect(throws: PiError.self) { try await client.connectDemo(projectPath: "/p", takingControl: true) }
}

@Test func sharedFixturesAndBundledContractStayInSync() throws {
    let contract = try WireContract()
    let valid = try fixtures()
    for entry in valid["operations"].array! {
        try contract.validate(entry["request"], schema: "Request")
        try contract.validate(entry["response"], schema: "ServerMessage")
        try contract.validate(entry["rejection"], schema: "ServerMessage")
    }
    for entry in valid["events"].array! { try contract.validate(entry, schema: "ServerMessage") }
    for method in ["server.initialize", "session.create"] {
        try contract.validate(result(method), schema: "result.\(method)")
    }
    for name in WireContract.schemas {
        let authoritative = try Data(contentsOf: root.appendingPathComponent("protocol/schema/v2/\(name).schema.json"))
        #expect(try contract.data(name) == authoritative)
    }
    var malformed = try result("server.initialize")
    malformed["futureOptionalField"] = .string("ignored")
    try contract.validate(malformed, schema: "result.server.initialize")
    malformed["protocolVersion"] = .number(1)
    #expect(throws: PiError.self) { try contract.validate(malformed, schema: "result.server.initialize") }
    let invalid = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: root.appendingPathComponent("protocol/fixtures/v2/invalid.json")))
    for entry in invalid.array! where WireContract.schemas.contains(entry["schema"].string ?? "") {
        #expect(throws: PiError.self, "\(entry["name"])") { try contract.validate(entry["input"], schema: entry["schema"].string!) }
    }
}
