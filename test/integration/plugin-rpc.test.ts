import { afterEach, beforeEach, test } from "vitest";
import { PluginRpcDriver } from "../infra/plugin-rpc-driver.js";

let app: PluginRpcDriver;
let other: PluginRpcDriver;
beforeEach(() => { app = new PluginRpcDriver(); other = new PluginRpcDriver(); });
afterEach(async () => { await Promise.all([app.dispose(), other.dispose()]); });

test("the SDK calls the counter over the existing socket without a Pi session", async () => {
  await app.start();
  await app.connect();

  await app.shouldRead(0);
  await app.shouldIncrement(1);
  await app.shouldRead(1);
});

test("connections share server activation and reconnect does not reset or replay calls", async () => {
  await app.start();
  await app.connect();
  await app.shouldIncrement(1);
  await app.connect();

  await app.shouldRead(1, 1);
  await app.shouldIncrement(2, 1);
  await app.reconnect();
  await app.shouldRead(2);
});

test("plugin RPC is disabled unless explicitly exposed", async () => {
  await app.start(false);
  await app.connect();

  await app.shouldRejectCall("unsupportedOperation");
});

test("plugin calls require capability negotiation and initialization", async () => {
  await app.start();
  await app.shouldRejectUninitializedCall();
  await app.shouldRejectWireCallWithoutCapability();
  await app.connect([]);

  await app.shouldRejectCall("unsupportedOperation");
});

test("only exposed contract revisions and methods can be called", async () => {
  await app.start();
  await app.connect();

  await app.shouldRejectCall("contractUnavailable", { contractId: "private-counter" });
  await app.shouldRejectCall("contractVersionMismatch", { contractVersion: 2 });
  await app.shouldRejectCall("methodUnavailable", { method: "constructor" });
  await app.shouldRead(0);
});

test("separate servers keep independent activations", async () => {
  await app.start();
  await other.start();
  await app.connect();
  await other.connect();

  await app.shouldIncrement(1);
  await other.shouldRead(0);
  await other.shouldIncrement(1);
  await app.shouldRead(1);
});

test("closing the server rejects a pending RPC call", async () => {
  await app.startPending();
  await app.connect();

  await app.shouldRejectPendingOnClose();
});

test("invalid input is rejected without changing the counter", async () => {
  await app.start();
  await app.connect();

  await app.shouldRejectCall("operationFailed", { input: 42 });
  await app.shouldRead(0);
});
