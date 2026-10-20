import Foundation
import Testing
@testable import PiSDK

func event(_ name: String, _ sequence: Int, _ data: JSONValue, session: String = "runtime") -> JSONValue {
    .object(["version": .number(2), "type": .string("event"), "event": .string(name), "serverInstanceId": .string("server"), "sessionId": .string(session), "sequence": .number(Double(sequence)), "data": data])
}
func runtime(_ status: String) -> JSONValue { .object(["status": .string(status), "runId": .string("run")]) }
func delta(_ text: String) -> JSONValue { .object(["runId": .string("run"), "delta": .string(text)]) }
func finalized(_ id: String, _ role: String, _ text: String) -> JSONValue {
    .object(["runId": .string("run"), "message": .object(["id": .string(id), "role": .string(role), "text": .string(text)])])
}
extension FakeTransport {
    func emit(_ value: JSONValue) throws { push(String(decoding: try JSONEncoder().encode(value), as: UTF8.self)) }
    func setMode(_ value: String) { mode = value }
}
func waitFor(_ predicate: () async -> Bool) async throws {
    for _ in 0..<400 { if await predicate() { return }; try await Task.sleep(for: .milliseconds(5)) }
    Issue.record("Timed out waiting for condition")
    throw PiError.requestExpired(outcomeUnknown: false)
}

@Test func streamingPreservesOrderDeduplicatesAndAllowsTwoTurns() async throws {
    let transport = FakeTransport(); let client = PiClient(transport: transport)
    _ = try await client.connectDemo(projectPath: "/p", takingControl: true)
    try await client.send("Say hello")
    #expect(await client.projection?.status == .starting) // acceptance is not completion
    await #expect(throws: PiError.self) { try await client.send("duplicate") }
    try await transport.emit(event("message.finalized", 1, finalized("u1", "user", "Say hello")))
    try await transport.emit(event("runtime.status", 2, runtime("running")))
    try await transport.emit(event("message.delta", 3, delta("Hello ")))
    try await waitFor { await client.projection?.messages.last?.text == "Hello " }
    try await transport.emit(event("message.delta", 3, delta("Hello "))) // duplicate sequence
    try await transport.emit(event("message.delta", 4, delta("world")))
    try await transport.emit(event("message.finalized", 5, finalized("a1", "assistant", "Hello world")))
    try await waitFor { await client.projection?.messages.last?.isPartial == false }
    #expect(await client.projection?.status == .running)
    try await transport.emit(event("runtime.status", 6, runtime("idle")))
    try await waitFor { await client.projection?.status == .idle }
    #expect(await client.projection?.messages.map(\.text) == ["Say hello", "Hello world"])
    try await client.send("Again")
    try await transport.emit(event("message.finalized", 7, finalized("u2", "user", "Again")))
    try await transport.emit(event("runtime.status", 8, runtime("running")))
    try await transport.emit(event("message.delta", 9, delta("Second")))
    try await transport.emit(event("message.finalized", 10, finalized("a2", "assistant", "Second")))
    try await transport.emit(event("runtime.status", 11, runtime("idle")))
    try await waitFor { await client.projection?.status == .idle }
    #expect(await client.projection?.messages.map(\.text) == ["Say hello", "Hello world", "Again", "Second"])
    #expect(await transport.requests.last?["sessionId"].string == "runtime")
    await client.disconnect()
}

@Test func stopReceiptIsNotSettlementAndRetainsPartialText() async throws {
    let transport = FakeTransport(); let client = PiClient(transport: transport)
    _ = try await client.connectDemo(projectPath: "/p", takingControl: true)
    try await client.send("Say hello")
    try await transport.emit(event("runtime.status", 1, runtime("running")))
    try await transport.emit(event("message.delta", 2, delta("Partial")))
    try await waitFor { await client.projection?.status == .running }
    try await client.stop()
    #expect(await client.projection?.status == .aborting)
    try await transport.emit(event("runtime.status", 3, runtime("idle")))
    try await waitFor { await client.projection?.status == .idle }
    #expect(await client.projection?.messages.last?.text == "Partial")
    await client.disconnect()
    #expect(await client.projection?.messages.last?.text == "Partial")
}

@Test func idleSnapshotKeepsStoppedTextWhenServerHasNoFinalMessage() throws {
    var projection = try DemoSessionProjection(snapshot: result("session.create")["snapshot"])
    try projection.apply(event("runtime.status", 1, runtime("running")), sendRequestId: nil)
    try projection.apply(event("message.delta", 2, delta("Stopped partial")), sendRequestId: nil)
    try projection.apply(event("runtime.status", 3, runtime("idle")), sendRequestId: nil)
    var snapshot = try result("session.create")["snapshot"]
    snapshot["throughSequence"] = .number(3)
    try projection.applySnapshot(snapshot)
    #expect(projection.messages.last?.text == "Stopped partial")
    #expect(projection.status == .idle)
}

@Test func definiteSendRejectionDoesNotPoisonIdleSession() async throws {
    let transport = FakeTransport(); let client = PiClient(transport: transport)
    _ = try await client.connectDemo(projectPath: "/p", takingControl: true)
    await transport.setMode("sendDenied")
    await #expect(throws: PiError.self) { try await client.send("Keep draft") }
    #expect(await client.projection?.status == .idle)
    #expect(await client.state != .disconnected)
    await transport.setMode("success")
    try await client.send("Retry explicitly")
    await client.disconnect()
}

@Test func lostSendResponseIsUnknownAndNeverReplayed() async throws {
    let transport = FakeTransport(); let client = PiClient(transport: transport, requestTimeout: .milliseconds(300))
    _ = try await client.connectDemo(projectPath: "/p", takingControl: true)
    await transport.setMode("sendTimeout")
    do { try await client.send("Keep draft"); Issue.record("Expected unknown outcome") }
    catch let error as PiError { #expect(error.isOutcomeUnknown) }
    #expect(await transport.requests.filter { $0["method"].string == "message.send" }.count == 1)
    #expect(await transport.closed)
}

@Test(arguments: [false, true])
func missingStartOrStopSettlementHasBoundedDeadline(stopping: Bool) async throws {
    let transport = FakeTransport(); let client = PiClient(transport: transport, requestTimeout: .milliseconds(500))
    _ = try await client.connectDemo(projectPath: "/p", takingControl: true)
    try await client.send("Hi")
    if stopping {
        try await transport.emit(event("runtime.status", 1, runtime("running")))
        try await waitFor { await client.projection?.status == .running }
        try await client.stop()
    }
    try await waitFor { await transport.closed }
    guard case .failed(let error) = await client.state else { Issue.record("Expected bounded settlement failure"); return }
    #expect(error.isOutcomeUnknown)
}

@Test func slowProjectionConsumerGetsCompleteTextAndDisconnectIgnoresLateEvents() async throws {
    let transport = FakeTransport(); let client = PiClient(transport: transport)
    _ = try await client.connectDemo(projectPath: "/p", takingControl: true)
    let stream = await client.projections()
    try await client.send("Hi")
    try await transport.emit(event("runtime.status", 1, runtime("running")))
    for sequence in 2...30 { try await transport.emit(event("message.delta", sequence, delta("x"))) }
    try await waitFor { await client.projection?.sequence == 30 }
    var iterator = stream.makeAsyncIterator()
    let latest = await iterator.next()
    #expect(latest?.messages.last?.text == String(repeating: "x", count: 29))
    await client.disconnect()
    try await transport.emit(event("message.delta", 31, delta("obsolete")))
    #expect(await client.projection?.sequence == 30)
}

@Test func staleSnapshotsCannotRegressWatermarkAndTranscriptBoundFailsExplicitly() throws {
    var projection = try DemoSessionProjection(snapshot: result("session.create")["snapshot"])
    try projection.apply(event("message.delta", 1, delta("keep")), sendRequestId: nil)
    try projection.applySnapshot(result("session.create")["snapshot"])
    #expect(projection.messages.last?.text == "keep")
    #expect(projection.sequence == 1)
    #expect(throws: PiError.self) {
        try projection.apply(event("message.delta", 2, delta(String(repeating: "x", count: 16 * 1024 * 1024))), sendRequestId: nil)
    }
}

@Test(arguments: ["gap", "prompt", "malformed"])
func invalidStreamingFailsExplicitly(reason: String) async throws {
    let transport = FakeTransport(); let client = PiClient(transport: transport)
    _ = try await client.connectDemo(projectPath: "/p", takingControl: true)
    try await client.send("Hi")
    try await transport.emit(event("runtime.status", 1, runtime("running")))
    try await transport.emit(event("message.delta", 2, delta("Keep this")))
    try await waitFor { await client.projection?.messages.last?.text == "Keep this" }
    if reason == "gap" { try await transport.emit(event("message.delta", 4, delta("lost"))) }
    if reason == "malformed" { try await transport.emit(event("message.delta", 3, .object(["runId": .string("run")]))) }
    if reason == "prompt" { try await transport.emit(event("prompt.list.changed", 3, .object(["prompts": .array([.object(["id": .string("q"), "title": .string("Question"), "kind": .string("confirm"), "message": .string("Allow?")])])]))) }
    try await waitFor { await transport.closed }
    guard case .failed(let error) = await client.state else { Issue.record("Expected explicit failure"); return }
    if reason == "prompt" { #expect(error.localizedDescription.contains("question")) }
    #expect(await client.projection?.messages.last?.text == "Keep this")
}
