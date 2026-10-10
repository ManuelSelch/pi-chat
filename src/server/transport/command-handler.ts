import { WebSocket } from "ws";
import { PROTOCOL_VERSION, type ClientMessage } from "../../shared/protocol.js";
import type { ChatApplicationService } from "../application/chat-application-service.js";
import { ServerPublisher } from "./server-publisher.js";
import { fileOpenFailure } from "../files/file-open-error.js";

export interface CommandHandlerDependencies {
  chat: ChatApplicationService;
  publisher: ServerPublisher;
  isController(socket: WebSocket): boolean;
  openTab(open: () => Promise<string>, socket?: WebSocket, requestId?: string): void;
}

/** Dispatches already-parsed browser commands; socket ownership stays injectable. */
export function handleClientCommand(socket: WebSocket, command: ClientMessage, dependencies: CommandHandlerDependencies): void {
  if (!dependencies.isController(socket)) return;
  const { chat, publisher } = dependencies;
  if (command.type === "openFile") {
    // Even synchronous lookup failures must remain requester-scoped replies.
    Promise.resolve().then(() => chat.openFile(command.sessionId, command.path)).then(
      (result) => publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "fileOpenResult", sessionId: command.sessionId, requestId: command.requestId, result }),
      () => publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "fileOpenResult", sessionId: command.sessionId, requestId: command.requestId, result: fileOpenFailure("openFailed", "Unable to open this file on the server.") }),
    );
  } else if (command.type === "completeCommandArguments") {
    // Start in a promise so a missing/closed session is also a correlated error.
    Promise.resolve().then(() => chat.completeCommandArguments(command.sessionId, command.commandName, command.argumentPrefix)).then(
      (items) => publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "commandArgumentCompletions", sessionId: command.sessionId, requestId: command.requestId, items }),
      (error: unknown) => publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "commandArgumentCompletions", sessionId: command.sessionId, requestId: command.requestId, items: [], error: error instanceof Error ? error.message : "Unable to complete command arguments." }),
    );
  } else if (command.type === "browseDirectories") {
    chat.browseDirectories(command).then(
      (listing) => publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "directoryListing", requestId: command.requestId, listing }),
      (error: unknown) => publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "directoryBrowseError", requestId: command.requestId, error: publisher.errorText(error) }),
    );
  } else if (command.type === "abort") {
    chat.abort(command.sessionId).catch((error: unknown) => publisher.publishError(command.sessionId, error));
  } else if (command.type === "prompt") {
    chat.prompt(command.sessionId, command.message)
      .then((sessionId) => publisher.sendSnapshot(sessionId))
      .catch((error: unknown) => publisher.publishError(command.sessionId, error));
  } else if (command.type === "uiPromptResponse") {
    chat.respondToPrompt(command.sessionId, command.promptId, command.result);
  } else if (command.type === "runFeature" || command.type === "runExtensionAction") {
    chat.runFeature(command)
      .then(() => {
        void publisher.sendSnapshot(command.sessionId);
        publisher.sendTabs();
      })
      .catch((error: unknown) => publisher.publishError(command.sessionId, error));
  } else if (command.type === "focusTab") {
    chat.focusTab(command.sessionId);
    publisher.sendTabs();
  } else if (command.type === "setSessionArchived" || command.type === "pinProject") {
    Promise.resolve().then(() => command.type === "setSessionArchived"
      ? chat.archiveSession(command.path, command.archived)
      : chat.pinProject(command.path, command.pinned))
      .then(async () => {
        publisher.sendTabs();
        await publisher.sendCatalogue();
        publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "projectMutationResult", requestId: command.requestId });
      })
      .catch((error: unknown) => publisher.replyTo(socket, { version: PROTOCOL_VERSION, type: "projectMutationResult", requestId: command.requestId, error: publisher.errorText(error) }));
  } else if (command.type === "closeTab") {
    chat.closeTab(command.sessionId)
      .then(() => {
        publisher.sendTabs();
        return publisher.sendCatalogue();
      })
      .catch((error: unknown) => publisher.publishError(chat.activeSessionId(), error));
  } else if (command.type === "openProject") {
    dependencies.openTab(() => chat.openProject(command.path), socket);
  } else if (command.type === "openSession") {
    dependencies.openTab(() => chat.openSession(command.path), socket);
  } else if (command.type === "newSession") {
    dependencies.openTab(() => chat.newSession(command.path), socket, command.requestId);
  }
}
