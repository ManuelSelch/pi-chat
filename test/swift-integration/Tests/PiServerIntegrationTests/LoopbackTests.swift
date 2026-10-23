#if os(macOS)
import Foundation
import Testing
import PiSDK

@Test func actualServerCreatesOneRuntimeAndDisconnectRetainsIt() async throws {
    let fixture = try LoopbackFixture()
    let ready = try await fixture.start()
    let directory = URL(fileURLWithPath: ready.directory)
    var client = PiClient(endpoint: ready.endpoint)
    try await client.connect(takingControl: true)
    try #require(await client.catalogue.sessions.isEmpty)
    try await waitFor { await client.catalogue.projects.first?.quickChats == true }
    let session = try await client.createSession(projectPath: ready.directory)
    try #require(session.projectPath.hasSuffix(directory.lastPathComponent))
    try #require(await client.state == .ready(session))
    try await client.send("Say hello")
    try await waitFor { await client.projection?.messages.last?.isPartial == true }
    let prefix = await client.projection?.messages.last?.text
    try await waitFor { await client.projection?.status == .idle }
    try #require(await client.projection?.messages.map(\.text) == ["Say hello", "Hello from the isolated Swift demo."])
    try #require(prefix != "Hello from the isolated Swift demo.")
    await client.disconnect()
    client = PiClient(endpoint: ready.endpoint)
    try await client.connect(takingControl: true)
    try #require(await client.catalogue.sessions.count == 1)
    _ = try await client.attachSession(sessionId: session.sessionId)
    try #require(await client.projection?.messages.count == 2)
    try await client.send("A second response to stop")
    try await waitFor { await client.projection?.messages.last?.isPartial == true }
    try await client.stop()
    try await waitFor { await client.projection?.status == .idle }
    // Allow finishWork's authoritative snapshot to arrive as well.
    try await Task.sleep(for: .milliseconds(150))
    try #require(await client.projection?.messages.count == 4)
    try #require(await client.projection?.messages.last?.text.isEmpty == false)
    await client.disconnect()
    try await fixture.stop()
    struct Cleanup: Decodable { let created: Int; let retained: Int; let closed: Int }
    let cleanup = try JSONDecoder().decode(Cleanup.self, from: Data(contentsOf: directory.appendingPathComponent("cleanup.json")))
    try #require(cleanup.created == 1)
    try #require(cleanup.retained == 1)
    try #require(cleanup.closed == 1)
    try fixture.removeSuccessfulArtifacts()
}

@Test func unreachableEndpointFailsWithoutIndefiniteConnecting() async throws {
    let client = PiClient(endpoint: URL(string: "ws://127.0.0.1:1/ws")!, requestTimeout: .seconds(1))
    await #expect(throws: PiError.self) { try await client.connectDemo(projectPath: "/tmp/pi-studio-demo", takingControl: true) }
    guard case .failed = await client.state else { Issue.record("Expected failed state"); return }
    await client.disconnect()
}
#endif
