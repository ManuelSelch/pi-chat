import Foundation

/// Saved history identity is a server-side path, never a runtime ID.
public struct PiHistorySummary: Codable, Sendable, Equatable, Identifiable {
    public let path: String
    public let title: String
    public let modified: Double
    public let archivedAt: Double?
    public var id: String { path }
    public init(path: String, title: String, modified: Double = 0, archivedAt: Double? = nil) {
        self.path = path; self.title = title; self.modified = modified; self.archivedAt = archivedAt
    }
}

public struct PiWorktreeSummary: Codable, Sendable, Equatable {
    public let branch: String?
    public let primary: Bool
    public init(branch: String? = nil, primary: Bool = true) { self.branch = branch; self.primary = primary }
}

public struct PiProjectSummary: Codable, Sendable, Equatable, Identifiable {
    public let path: String
    public let name: String
    public let displayPath: String
    public let exists: Bool
    public let pinned: Bool?
    public let quickChats: Bool?
    public let repositoryPath: String?
    public let repositoryName: String?
    public let worktree: PiWorktreeSummary?
    public let sessions: [PiHistorySummary]
    public var id: String { path }
    public init(path: String, name: String, displayPath: String? = nil, exists: Bool = true,
                pinned: Bool? = nil, quickChats: Bool? = nil, repositoryPath: String? = nil,
                repositoryName: String? = nil, worktree: PiWorktreeSummary? = nil, sessions: [PiHistorySummary] = []) {
        self.path = path; self.name = name; self.displayPath = displayPath ?? path; self.exists = exists
        self.pinned = pinned; self.quickChats = quickChats; self.repositoryPath = repositoryPath
        self.repositoryName = repositoryName; self.worktree = worktree; self.sessions = sessions
    }
}

public struct PiRuntimeSummary: Codable, Sendable, Equatable, Identifiable {
    public let sessionId: String
    public let title: String
    public let sessionPath: String?
    public let projectPath: String
    public let projectName: String
    public let status: String
    public var id: String { sessionId }
    public init(sessionId: String, title: String, sessionPath: String? = nil, projectPath: String,
                projectName: String, status: String = "idle") {
        self.sessionId = sessionId; self.title = title; self.sessionPath = sessionPath
        self.projectPath = projectPath; self.projectName = projectName; self.status = status
    }
}

/// Complete conflated catalogue; revisions are independent and server-owned.
public struct PiCatalogue: Sendable, Equatable {
    public internal(set) var projectRevision: Double
    public internal(set) var inventoryRevision: Double
    public internal(set) var projects: [PiProjectSummary]
    public internal(set) var sessions: [PiRuntimeSummary]
    public init(projects: [PiProjectSummary] = [], sessions: [PiRuntimeSummary] = [],
                projectRevision: Double = -1, inventoryRevision: Double = -1) {
        self.projects = projects; self.sessions = sessions
        self.projectRevision = projectRevision; self.inventoryRevision = inventoryRevision
    }
    internal mutating func applyProjects(_ value: JSONValue) throws {
        guard let revision = value["revision"].number, revision > projectRevision else { return }
        projects = try decodeCatalogueValue(value["catalogue"]["projects"])
        projectRevision = revision
    }
    internal mutating func applyInventory(_ value: JSONValue) throws {
        guard let revision = value["revision"].number, revision > inventoryRevision else { return }
        sessions = try decodeCatalogueValue(value["sessions"])
        inventoryRevision = revision
    }
}
internal func decodeCatalogueValue<T: Decodable>(_ value: JSONValue) throws -> T {
    try JSONDecoder().decode(T.self, from: JSONEncoder().encode(value))
}

/// Browsing and explicit selection on one connection. Disconnect retains server work.
public protocol PiSessionConnection: PiDemoConnection {
    func connect(takingControl: Bool) async throws
    func catalogues() async -> AsyncStream<PiCatalogue>
    func attachSession(sessionId: String) async throws -> DemoSession
    func openSession(sessionPath: String) async throws -> DemoSession
    func createSession(projectPath: String) async throws -> DemoSession
}
