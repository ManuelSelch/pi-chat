import { snapshotSchema, eventSchema, type SessionSnapshot, type Event, type Result, type OpenSessionSummary, type SessionTheme } from "@manuelselch/pi-sdk";
export function themeData(): SessionTheme {
  return { name: "test", appearance: "dark", colors: {
    accent: "#123456", text: "#eeeeee", muted: "#aaaaaa", border: "#555555",
    selectedBg: "#333333", mdLink: "#123456", success: "#00aa00", warning: "#aaaa00", error: "#aa0000",
    userMessageBg: "#222222", userMessageText: "#eeeeee", thinkingText: "#aaaaaa", toolDiffAdded: "#00aa00", toolDiffRemoved: "#aa0000",
  }, surfaces: { pageBg: "#111111", cardBg: "#222222", infoBg: "#333333" } };
}
export function snapshotData(value: Partial<SessionSnapshot> & { sessionId: string }): SessionSnapshot {
  return snapshotSchema.parse({ throughSequence: 0, projectPath: "/project", messages: [], runtime: { status: "idle" }, steeringMessages: [], settings: { model: "p/m", availableModels: ["p/m"], thinkingLevel: "off", availableThinkingLevels: ["off", "high"] }, commands: [], prompts: [], presentation: { revision: value.throughSequence ?? 0, widgets: [], footer: [], extensions: { buttons: [], badges: [], state: {} } }, ...value });
}
export function snapshotEvent(value: Partial<SessionSnapshot> & { sessionId: string }): Extract<Event, { event: "session.snapshot" }> {
  return { version: 2, type: "event", serverInstanceId: "process", event: "session.snapshot", sessionId: value.sessionId, data: snapshotData(value) };
}
export function coreEvent<N extends Event["event"]>(name: N, data: unknown, sessionId: string, sequence: number): Extract<Event, { event: N }> {
  return eventSchema.parse({ version: 2, type: "event", serverInstanceId: "process", event: name, sessionId, sequence, data }) as Extract<Event, { event: N }>;
}
export function presentationEvent(data: Partial<NonNullable<SessionSnapshot["presentation"]>>, sessionId: string, revision: number): Extract<Event, { event: "presentation.changed" }> {
  return { version: 2, type: "event", event: "presentation.changed", serverInstanceId: "process", sessionId, data: { revision, widgets: [], footer: [], extensions: { buttons: [], badges: [], state: {} }, ...data } };
}
export function initializeResult(snapshots: SessionSnapshot[], catalogue: Result<"project.list">["catalogue"] = { projects: [] }): Result<"server.initialize"> {
  return { protocolVersion: 2, serverVersion: "test", serverInstanceId: "process", connectionId: "connection", capabilities: ["presentation", "directory.browse", "file.open", "command.complete", "session.archive", "project.pin", "project.remove"], inventory: { revision: 0, sessions: snapshots.map(summary) }, projects: { revision: 0, catalogue }, snapshots };
}
export function summary(snapshot: SessionSnapshot): OpenSessionSummary { return { sessionId: snapshot.sessionId, title: snapshot.sessionName ?? snapshot.sessionId, sessionPath: snapshot.sessionPath, projectPath: snapshot.projectPath, projectName: snapshot.projectPath.split("/").at(-1) ?? "", status: snapshot.runtime.status === "running" || snapshot.runtime.status === "aborting" ? "running" : snapshot.runtime.status }; }
