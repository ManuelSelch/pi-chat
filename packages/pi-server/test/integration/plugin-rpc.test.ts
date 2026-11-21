import { afterEach, beforeEach, test } from "vitest";
import { PluginRpcDriver } from "../infra/plugin-rpc-driver.js";

let app: PluginRpcDriver;
let other: PluginRpcDriver;
beforeEach(() => { app = new PluginRpcDriver(); other = new PluginRpcDriver(); });
afterEach(async () => { await Promise.all([app.dispose(), other.dispose()]); });

test("the SDK calls a stateful plugin over the existing socket without a Pi session", async () => {
  await app.start();
  await app.connect();

  await app.shouldRead("initial");
  await app.shouldWrite("first");
  await app.shouldRead("first");
});

test("connections share server activation and reconnect does not reset or replay calls", async () => {
  await app.start();
  await app.connect();
  await app.shouldWrite("first");
  await app.connect();

  await app.shouldRead("first", 1);
  await app.shouldWrite("second", 1);
  await app.reconnect();
  await app.shouldRead("second");
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

  await app.shouldRejectCall("contractUnavailable", { contractId: "private-state" });
  await app.shouldRejectCall("contractVersionMismatch", { contractVersion: 2 });
  await app.shouldRejectCall("methodUnavailable", { method: "constructor" });
  await app.shouldRead("initial");
});

test("separate servers keep independent activations", async () => {
  await app.start();
  await other.start();
  await app.connect();
  await other.connect();

  await app.shouldWrite("first");
  await other.shouldRead("initial");
  await other.shouldWrite("first");
  await app.shouldRead("first");
});

test("closing the server rejects a pending RPC call", async () => {
  await app.startPending();
  await app.connect();

  await app.shouldRejectPendingOnClose();
});

test("invalid input is rejected without changing plugin state", async () => {
  await app.start();
  await app.connect();

  await app.shouldRejectCall("operationFailed", { input: 42 });
  await app.shouldRead("initial");
});
