import { describe, expect, it } from "vitest";
import { ProjectRequests } from "../../../../src/web/app/connection/project-requests.js";
import { PROTOCOL_VERSION } from "../../../../src/shared/protocol.js";
const command = { version: PROTOCOL_VERSION, type: "setSessionArchived" as const, path: "/a.jsonl", archived: true, requestId: "one" };
describe("project requests", () => {
  it("waits for its own correlated result and rejects server errors", async () => {
    const requests = new ProjectRequests();
    const promise = requests.request(command, () => {});
    requests.receive({ version: PROTOCOL_VERSION, type: "projectMutationResult", requestId: "other" });
    requests.receive({ version: PROTOCOL_VERSION, type: "projectMutationResult", requestId: "one", error: "disk full" });
    await expect(promise).rejects.toThrow("disk full");
  });
  it("resolves successes and rejects pending requests on disconnect", async () => {
    const requests = new ProjectRequests();
    const first = requests.request(command, () => {});
    requests.receive({ version: PROTOCOL_VERSION, type: "projectMutationResult", requestId: "one" });
    await expect(first).resolves.toBeUndefined();
    const pending = requests.request(command, () => {});
    requests.disconnect();
    await expect(pending).rejects.toThrow(/Connection lost/);
  });
});
