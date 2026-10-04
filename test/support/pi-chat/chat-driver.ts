import assert from "node:assert/strict";
import { PROTOCOL_VERSION } from "../../../src/shared/protocol.js";
import { check, requireSession, type DriverContext } from "./driver-context.js";
import type { BrowserClient } from "./browser-client.js";

export interface ExpectedMessage {
  role: "user" | "assistant" | "system";
  text: string;
}

export class ChatDriver {
  private readonly pendingTurns = new Map<string, { client: BrowserClient; after: number }>();

  constructor(private readonly context: DriverContext) {}

  async SendPrompt(text: string): Promise<void> {
    const { client } = this.context;
    const sessionId = requireSession(this.context, "Chat.SendPrompt");
    check(this.context, "Chat.SendPrompt", () => {
      assert.equal(client.chat.status, "idle", "Conversation must be idle before sending a prompt");
      const expected = this.context.nextPrompt();
      assert.notEqual(expected, undefined, "No scripted response for this prompt");
      assert.equal(text.trim(), expected, "Prompt does not match the next scripted response");
    });
    const after = client.mark();
    client.send({ version: PROTOCOL_VERSION, type: "prompt", sessionId, message: text });
    this.pendingTurns.set(sessionId, { client, after });
    // There is no command-accepted ACK; the new user final confirms acceptance.
    // A history match must not acknowledge an identical prompt from an old turn.
    await client.waitForMessage("Chat.SendPrompt", "new accepted user message", after, m =>
      m.type === "messageFinal" && m.sessionId === sessionId && m.message.role === "user" && m.message.text === text.trim());
  }

  async Abort(): Promise<void> {
    const { client } = this.context;
    const sessionId = requireSession(this.context, "Chat.Abort");
    const after = client.mark();
    client.send({ version: PROTOCOL_VERSION, type: "abort", sessionId });
    await client.waitForMessage("Chat.Abort", "aborted turn settled", after, message =>
      message.type === "runtimeStatus" && message.sessionId === sessionId && message.status === "idle");
    await client.wait("Chat.Abort", "current conversation idle", () => client.chat.status === "idle");
    check(this.context, "Chat.Abort", () => assert.equal(client.chat.error, undefined, "Runtime failed while aborting"));
    this.pendingTurns.delete(sessionId);
  }

  ReleaseControlledResponse(): void {
    requireSession(this.context, "Chat.ReleaseControlledResponse");
    this.context.releaseControlledResponse();
  }

  async WaitUntilIdle(): Promise<void> {
    const { client } = this.context;
    const sessionId = requireSession(this.context, "Chat.WaitUntilIdle");
    const pending = this.pendingTurns.get(sessionId);
    // Bookmarks are local to a connection. After reconnect, the fresh snapshot
    // (and subsequent events) authoritatively describe whether a turn is idle.
    if (pending?.client === client) {
      const { after } = pending;
      await client.waitForMessage("Chat.WaitUntilIdle", "new turn settled", after, m =>
        m.type === "runtimeStatus" && m.sessionId === sessionId && m.status === "idle");
    }
    await client.wait("Chat.WaitUntilIdle", "current conversation idle", () => client.chat.status === "idle");
    check(this.context, "Chat.WaitUntilIdle", () => assert.equal(client.chat.error, undefined, "Runtime failed"));
    this.pendingTurns.delete(sessionId);
  }

  ShouldContainMessages(expected: readonly ExpectedMessage[]): void {
    check(this.context, "Chat.ShouldContainMessages", () => {
      const actual = this.context.client.chat.messages.map(m => ({ role: m.role, text: "text" in m ? m.text : undefined }));
      // Ordered containment; pair with ShouldHaveMessageCount for an exact transcript.
      let next = 0;
      for (const message of actual) {
        if (next < expected.length && message.role === expected[next]!.role && message.text === expected[next]!.text) next++;
      }
      assert.equal(next, expected.length, `Missing ordered transcript ${JSON.stringify(expected)}; actual ${JSON.stringify(actual)}`);
    });
  }

  ShouldHaveMessageCount(count: number): void {
    check(this.context, "Chat.ShouldHaveMessageCount", () => assert.equal(this.context.client.chat.messages.length, count));
  }

  ShouldHaveAssistantReply(text: string): void {
    check(this.context, "Chat.ShouldHaveAssistantReply", () => assert(this.context.client.chat.messages.some(m => m.role === "assistant" && m.text === text), `Missing assistant reply ${JSON.stringify(text)}`));
  }

  ShouldNotHaveAssistantReply(text: string): void {
    check(this.context, "Chat.ShouldNotHaveAssistantReply", () => assert(!this.context.client.chat.messages.some(m => m.role === "assistant" && m.text === text), `Unexpected assistant reply ${JSON.stringify(text)}`));
  }

  ShouldHaveNoDuplicateMessages(): void {
    check(this.context, "Chat.ShouldHaveNoDuplicateMessages", () => {
      const ids = this.context.client.chat.messages.map(m => m.id);
      assert.equal(new Set(ids).size, ids.length);
    });
  }

  ShouldHaveConsumedResponses(): void {
    check(this.context, "Chat.ShouldHaveConsumedResponses", () => assert.equal(this.context.remainingResponses(), 0, "Unused scripted responses"));
  }
}
