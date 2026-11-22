import { once } from "node:events";
import { expect, it } from "vitest";
import { createPiServer } from "../../../../src/index.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";
import { v2Socket } from "../../../infra/v2-socket.js";

it("rejects removed slot actions and publishes only native presentation", async () => {
  const runtime = new FakeRuntimeAdapter();
  const server = await createPiServer({ runtime, catalogue: { homeDirectory: null, lister: { listAll: async () => [] } } });
  try {
    server.httpServer.listen(0, "127.0.0.1");
    await once(server.httpServer, "listening");
    const connection = await v2Socket(server);
    const frames: unknown[] = [];
    connection.socket.on("message", data => frames.push(JSON.parse(data.toString())));

    const initial = await connection.initialize(["presentation"]);
    const sessionId = initial.snapshots[0]!.sessionId;
    expect(frames).toContainEqual(expect.objectContaining({ type: "response", requestId: "init", result: expect.objectContaining({
      snapshots: [expect.objectContaining({ presentation: { revision: 0, widgets: [], footer: [] } })],
    }) }));

    connection.send("extension.run", "removed", { actionId: "old.action" }, sessionId);
    expect(await connection.response("removed")).toMatchObject({ ok: false, error: { code: "unsupportedOperation" } });

    const answer = runtime.uiContext().confirm("Native question", "Still supported?");
    const opened = await connection.wait(message => message.type === "event" && message.event === "prompt.list.changed" && message.data.prompts.length === 1);
    if (opened.type !== "event" || opened.event !== "prompt.list.changed") throw new Error("Expected native prompt");
    connection.send("prompt.answer", "answer", { promptId: opened.data.prompts[0]!.id, result: { cancelled: false, value: true } }, sessionId);
    expect(await connection.response("answer")).toMatchObject({ ok: true });
    await expect(answer).resolves.toBe(true);
  } finally {
    await server.close();
  }
});
