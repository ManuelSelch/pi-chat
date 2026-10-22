import { randomUUID } from "node:crypto";
import type { Request } from "@manuelselch/pi-sdk/contract";
import { SessionBusyError, type ChatApplicationService } from "../application/chat-application-service.js";
import type { ServerPublisher } from "./server-publisher.js";
import { DirectoryOperationError } from "../projects/directory-browser-service.js";
import { V2OperationError, type V2Execution } from "./v2-connection.js";

/** Validates/admit synchronously; no admitted work runs before its receipt. */
export async function executeOperation(command: Exclude<Request, Request<"server.initialize">>, chat: ChatApplicationService, publisher: ServerPublisher): Promise<V2Execution> {
  const raw = command.sessionId ? publisher.rawId(command.sessionId, command.method === "session.close") : undefined;
  const completed = (result?: unknown, afterResponse?: () => Promise<void> | void): V2Execution => ({ kind: "completed", result: result === undefined ? { state: "completed" } : result, afterResponse });
  const accepted = (run: () => Promise<void>): V2Execution => ({ kind: "accepted", operationId: randomUUID(), run });
  // Metadata-only mutations (archive/pin/remove) reuse the last catalogue scan;
  // anything that can introduce sessions, titles, projects or worktrees rescans.
  const refresh = async (metadataOnly = false) => { publisher.inventoryChanged(); await publisher.refreshProjects(metadataOnly); };
  const finishWork = async (run: () => Promise<unknown>) => {
    await run();
    try {
      if (raw && chat.openSessionIds().includes(raw)) { publisher.settingsChanged(raw); await publisher.sendSnapshot(raw); }
      await refresh();
    } catch { /* Work succeeded; failed nonessential publication cannot reject it. */ }
  };
  try {
    if (raw && !["session.snapshot", "prompt.answer", "run.abort", "command.complete", "file.open"].includes(command.method)) chat.assertMutable(raw);
    if (raw && ["model.select", "thinking.level"].includes(command.method) && chat.captureSnapshot(raw).isStreaming) throw new V2OperationError("sessionBusy", "Wait for the current run before changing settings.");
    switch (command.method) {
      case "server.ping": return completed();
      case "session.list": return completed(publisher.inventory());
      case "project.list": await publisher.refreshProjects(); return completed(publisher.projects());
      case "session.snapshot": { const capture = await publisher.prepareSnapshot(command.sessionId); return completed(capture()); }
      case "session.create": return completed(await publisher.opened(await chat.newSession(command.params.projectPath)), refresh);
      case "session.open": return completed(await publisher.opened(await chat.openSession(command.params.sessionPath)), refresh);
      case "session.close": {
        publisher.closing(raw!);
        try { await chat.closeTab(raw!); }
        catch { throw new V2OperationError("operationFailed", "Runtime teardown failed; the runtime may be partially closed. Retry close explicitly.", { partial: true }); }
        publisher.closed(raw!, "requested"); return completed(undefined, refresh);
      }
      case "directory.browse": return completed(await chat.browseDirectories(command.params));
      case "command.complete": return completed({ items: await chat.completeCommandArguments(raw!, command.params.commandName, command.params.argumentPrefix) });
      case "file.open": {
        const result = await chat.openFile(raw!, command.params.path);
        if (!result.ok) throw new V2OperationError(result.error.code, result.error.message);
        return completed();
      }
      case "project.pin": await chat.pinProject(command.params.path, command.params.pinned); return completed(undefined, () => refresh(true));
      case "project.remove": await chat.removeProject(command.params.path); return completed(undefined, () => refresh(true));
      case "session.archive":
        try { await chat.archiveSession(command.params.path, command.params.archived); }
        catch (error) {
          if (error instanceof SessionBusyError) throw error;
          throw new V2OperationError("operationFailed", "Archiving failed; metadata may already have changed.", { mayHavePersisted: true });
        }
        return completed(undefined, () => refresh(true));
      case "prompt.answer": {
        const prompt = chat.captureSnapshot(raw!).prompts.find(prompt => prompt.id === command.params.promptId);
        if (!prompt) throw new V2OperationError("invalidPromptAnswer", "This prompt is no longer pending.");
        const answer = command.params.result;
        if (!answer.cancelled && (prompt.kind === "confirm" ? typeof answer.value !== "boolean" : typeof answer.value !== "string" || (prompt.kind === "select" && !prompt.options?.includes(answer.value)))) throw new V2OperationError("invalidPromptAnswer", "Answer does not match the prompt kind or offered options.");
        chat.respondToPrompt(raw!, command.params.promptId, answer); return completed();
      }
      case "model.select":
        await chat.runFeature({ type: "runFeature", featureId: "model.select", sessionId: raw!, input: command.params });
        publisher.settingsChanged(raw!); return completed(publisher.settings(chat.captureSnapshot(raw!)), () => publisher.sendSnapshot(raw!));
      case "thinking.level":
        await chat.runFeature({ type: "runFeature", featureId: "thinking.level", sessionId: raw!, input: command.params });
        publisher.settingsChanged(raw!); return completed(publisher.settings(chat.captureSnapshot(raw!)), () => publisher.sendSnapshot(raw!));
      case "message.send": return accepted(() => finishWork(() => chat.prompt(raw!, command.params.message)));
      case "run.abort":
        if (!chat.captureSnapshot(raw!).isStreaming) return completed();
        return accepted(() => finishWork(() => chat.abort(raw!)));
      case "session.compact":
        if (chat.captureSnapshot(raw!).isStreaming) throw new V2OperationError("sessionBusy", "Stop the current run before compacting.");
        return accepted(() => finishWork(() => chat.runFeature({ type: "runFeature", sessionId: raw!, featureId: "session.compact", input: {} })));
      case "session.reload": return accepted(() => finishWork(() => chat.reloadSession(raw!)));
      case "extension.run": return accepted(() => finishWork(() => chat.runFeature({ type: "runExtensionAction", sessionId: raw!, actionId: command.params.actionId })));
      case "server.restart": return accepted(async () => {
        publisher.stopping();
        await chat.runFeature({ type: "runFeature", sessionId: "app", featureId: "app.restart", input: {} });
      });
    }
  } catch (error) {
    if (error instanceof V2OperationError) throw error;
    if (error instanceof DirectoryOperationError || error instanceof SessionBusyError) throw new V2OperationError(error.code, error.message);
    if (command.method === "session.open" && (error as { code?: string })?.code === "ENOENT") throw new V2OperationError("notFound", "Saved session not found on the server.");
    throw new V2OperationError("operationFailed", "The server operation failed.");
  }
}
