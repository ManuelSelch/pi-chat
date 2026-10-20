#if os(macOS)
import Foundation
import Testing
@testable import PiSDK

@Test func actualServerCreatesOneRuntimeAndDisconnectRetainsIt() async throws {
    let package = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("pi-swift-\(UUID())")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let canonical = directory.resolvingSymlinksInPath()
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = ["node", "--import", "tsx", package.appendingPathComponent("Tests/Fixtures/loopback-server.ts").path, canonical.path]
    process.currentDirectoryURL = package.deletingLastPathComponent().deletingLastPathComponent()
    let log = directory.appendingPathComponent("server.log")
    FileManager.default.createFile(atPath: log.path, contents: nil)
    let handle = try FileHandle(forWritingTo: log)
    process.standardOutput = handle; process.standardError = handle
    try process.run()
    defer {
        if process.isRunning { process.terminate() }
        try? handle.close()
        // On failure retain logs for diagnosis; success removes the directory below.
    }
    let endpointFile = directory.appendingPathComponent("endpoint")
    for _ in 0..<200 {
        if FileManager.default.fileExists(atPath: endpointFile.path) { break }
        if !process.isRunning { break }
        try await Task.sleep(for: .milliseconds(50))
    }
    guard let endpoint = try? String(contentsOf: endpointFile, encoding: .utf8), let url = URL(string: endpoint) else {
        Issue.record("Fixture failed: \(try String(contentsOf: log, encoding: .utf8))")
        return
    }
    let client = PiClient(endpoint: url)
    let session = try await client.connectDemo(projectPath: canonical.path, takingControl: true)
    #expect(session.projectPath.hasSuffix(directory.lastPathComponent))
    #expect(await client.state == .ready(session))
    try await client.send("Say hello")
    try await waitFor { await client.projection?.messages.last?.isPartial == true }
    let prefix = await client.projection?.messages.last?.text
    try await waitFor { await client.projection?.status == .idle }
    #expect(await client.projection?.messages.map(\.text) == ["Say hello", "Hello from the isolated Swift demo."])
    #expect(prefix != "Hello from the isolated Swift demo.")
    try await client.send("A second response to stop")
    try await waitFor { await client.projection?.messages.last?.isPartial == true }
    try await client.stop()
    try await waitFor { await client.projection?.status == .idle }
    // Allow finishWork's authoritative snapshot to arrive as well.
    try await Task.sleep(for: .milliseconds(150))
    #expect(await client.projection?.messages.count == 4)
    #expect(await client.projection?.messages.last?.text.isEmpty == false)
    await client.disconnect()
    process.terminate()
    for _ in 0..<120 { if !process.isRunning { break }; try await Task.sleep(for: .milliseconds(50)) }
    try #require(!process.isRunning)
    #expect(process.terminationStatus == 0)
    let cleanup = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: directory.appendingPathComponent("cleanup.json")))
    #expect(cleanup["created"] == .number(1))
    #expect(cleanup["retained"] == .number(1))
    #expect(cleanup["closed"] == .number(1))
    try FileManager.default.removeItem(at: directory)
}

@Test func unreachableEndpointFailsWithoutIndefiniteConnecting() async throws {
    let client = PiClient(endpoint: URL(string: "ws://127.0.0.1:1/ws")!, requestTimeout: .seconds(1))
    await #expect(throws: PiError.self) { try await client.connectDemo(projectPath: "/tmp/pi-studio-demo", takingControl: true) }
    guard case .failed = await client.state else { Issue.record("Expected failed state"); return }
    await client.disconnect()
}
#endif
