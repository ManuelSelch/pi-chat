import Testing
import PiSDK

func waitFor(_ predicate: () async -> Bool) async throws {
    for _ in 0..<400 { if await predicate() { return }; try await Task.sleep(for: .milliseconds(5)) }
    Issue.record("Timed out waiting for condition")
    throw PiError.requestExpired(outcomeUnknown: false)
}
