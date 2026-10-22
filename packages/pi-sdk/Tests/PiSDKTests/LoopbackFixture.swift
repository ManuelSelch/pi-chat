#if os(macOS)
import Darwin
import Foundation

/// Process ownership, bounded readiness/termination, and retained failure diagnostics.
final class LoopbackFixture {
    struct Ready: Decodable {
        let directory: String
        let endpoint: URL
    }

    private struct Failure: Error, CustomStringConvertible {
        let description: String
    }

    private let process = Process()
    private let diagnostics: URL
    private let log: URL
    private let handle: FileHandle
    private var ready: Ready?

    init() throws {
        let package = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        diagnostics = FileManager.default.temporaryDirectory.appendingPathComponent("pi-swift-logs-\(UUID())")
        try FileManager.default.createDirectory(at: diagnostics, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
        log = diagnostics.appendingPathComponent("server.log")
        FileManager.default.createFile(atPath: log.path, contents: nil, attributes: [.posixPermissions: 0o600])
        handle = try FileHandle(forWritingTo: log)
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["node", "--import", "tsx", package.appendingPathComponent("Tests/Fixtures/loopback-server.ts").path]
        process.currentDirectoryURL = package.deletingLastPathComponent().deletingLastPathComponent()
        // A regular file drains stdout without a blocking pipe reader or concurrency machinery.
        process.standardOutput = handle
        process.standardError = handle
    }

    deinit {
        if process.isRunning {
            kill(process.processIdentifier, SIGKILL)
            process.waitUntilExit()
        }
        try? handle.close()
        // Retain log and fixture workspace unless the scenario explicitly succeeds.
    }

    func start() async throws -> Ready {
        var started = false
        defer { if !started { forceStop() } }
        try process.run()
        let deadline = ContinuousClock.now + .seconds(10)
        while ContinuousClock.now < deadline {
            let text = (try? String(contentsOf: log, encoding: .utf8)) ?? ""
            // Ignore incomplete lines and unrelated server output.
            for line in text.split(separator: "\n", omittingEmptySubsequences: false).dropLast() {
                let prefix = "PI_FIXTURE_READY "
                guard line.hasPrefix(prefix) else { continue }
                let record = try JSONDecoder().decode(Ready.self, from: Data(line.dropFirst(prefix.count).utf8))
                ready = record
                started = true
                return record
            }
            if !process.isRunning { break }
            try await Task.sleep(for: .milliseconds(50))
        }
        throw Failure(description: "Fixture readiness failed. Logs: \(log.path)\n\((try? String(contentsOf: log, encoding: .utf8)) ?? "unreadable")")
    }

    func stop() async throws {
        defer { forceStop() }
        if process.isRunning { process.terminate() }
        let deadline = ContinuousClock.now + .seconds(6)
        while process.isRunning && ContinuousClock.now < deadline {
            try await Task.sleep(for: .milliseconds(50))
        }
        if process.isRunning {
            forceStop()
            throw Failure(description: "Fixture termination timed out. Logs: \(log.path)")
        }
        guard process.terminationStatus == 0 else {
            throw Failure(description: "Fixture exit \(process.terminationStatus). Logs: \(log.path)")
        }
    }

    private func forceStop() {
        if process.isRunning {
            kill(process.processIdentifier, SIGKILL)
            process.waitUntilExit()
        }
    }

    func removeSuccessfulArtifacts() throws {
        precondition(!process.isRunning)
        try handle.close()
        if let ready { try FileManager.default.removeItem(atPath: ready.directory) }
        try FileManager.default.removeItem(at: diagnostics)
    }
}
#endif
