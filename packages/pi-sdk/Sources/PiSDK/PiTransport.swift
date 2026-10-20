import Foundation

/// Pull-based transport: one receive at a time, no unbounded incoming queue.
/// Implementations must unblock receive and send when close is called.
public protocol PiTransport: Sendable {
    func send(_ text: String) async throws
    func receive() async throws -> String
    func close() async
}

public actor URLSessionPiTransport: PiTransport {
    private let endpoint: URL
    private var session: URLSession?
    private var socket: URLSessionWebSocketTask?
    private var closed = false
    public init(endpoint: URL) { self.endpoint = endpoint }
    private func connection() throws -> URLSessionWebSocketTask {
        guard !closed else { throw PiError.disconnected }
        guard ["ws", "wss"].contains(endpoint.scheme), endpoint.host != nil else { throw PiError.invalidConfiguration("Expected a ws:// or wss:// endpoint") }
        if let socket { return socket }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 10
        configuration.timeoutIntervalForResource = 24 * 60 * 60
        let session = URLSession(configuration: configuration)
        let socket = session.webSocketTask(with: endpoint)
        socket.maximumMessageSize = 16 * 1024 * 1024
        self.session = session; self.socket = socket
        socket.resume()
        return socket
    }
    public func send(_ text: String) async throws {
        guard text.utf8.count <= 16 * 1024 * 1024 else { throw PiError.protocolViolation("Outgoing frame exceeds 16 MiB") }
        try await connection().send(.string(text))
    }
    public func receive() async throws -> String {
        switch try await connection().receive() {
        case .string(let text): return text
        case .data: throw PiError.protocolViolation("Binary v2 frames are unsupported")
        @unknown default: throw PiError.protocolViolation("Unknown WebSocket frame")
        }
    }
    public func close() async {
        closed = true
        socket?.cancel(with: .goingAway, reason: nil)
        session?.invalidateAndCancel()
        socket = nil; session = nil
    }
    deinit { socket?.cancel(with: .goingAway, reason: nil); session?.invalidateAndCancel() }
}
