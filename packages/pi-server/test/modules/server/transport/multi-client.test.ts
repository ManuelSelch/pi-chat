import { afterEach, beforeEach, expect, it } from "vitest";
import { MultiClientDriver } from "../../../infra/multi-client-driver.js";

let app: MultiClientDriver;
beforeEach(async () => { app = new MultiClientDriver(); await app.start(); });
afterEach(async () => { await app.close(); });

it("runs different sessions concurrently and broadcasts ordered events without leaking responses", async () => {
  const client1 = await app.connect();
  const client2 = await app.connect();
  const session1 = client1.session();
  const session2 = await client2.createSession();
  await client1.shouldSeeBothSessions();
  await client2.shouldSeeBothSessions();
  app.holdRuns();

  await client1.send(session1, "first input");
  await client2.send(session2, "second input");
  app.releaseRuns();

  await client1.shouldReceiveRuns(session1, session2);
  await client2.shouldReceiveRuns(session1, session2);
  session1.shouldContainInput("first input");
  session2.shouldContainInput("second input");
});

it("filters snapshots and optional operations independently for each client", async () => {
  const richClient = await app.connect();
  const coreClient = await app.connect([]);
  const session = richClient.session();

  await richClient.changeSettings(session);

  await richClient.shouldReceivePresentation(true);
  await coreClient.shouldReceivePresentation(false);
  await coreClient.shouldRejectFileOpen(session);
});

it("keeps dialogs answerable while another client remains", async () => {
  const client1 = await app.connect();
  const client2 = await app.connect();
  const session = client2.session();
  const confirmation = session.askForConfirmation();

  await client1.disconnect();
  session.shouldHavePendingConfirmation();
  await client2.answerConfirmation(session);

  expect(await confirmation).toBe(true);
});

it("preserves dialogs beyond a minute without clients and recovers them on reconnect", async () => {
  const client = await app.connect();
  const candidate = await app.connectUninitialized();
  const session = client.session();
  app.useDialogClock();
  const confirmation = session.askForConfirmation();

  await client.disconnect();
  await candidate.disconnect();
  await app.advanceTime(60_001);
  session.shouldHavePendingConfirmation();
  const reconnected = await app.connect();
  reconnected.shouldRecoverConfirmation(session);
  await reconnected.answerConfirmation(session);

  expect(await confirmation).toBe(true);
});

it("retains the original five-minute timeout across disconnect and reconnect", async () => {
  const client = await app.connect();
  const session = client.session();
  app.useDialogClock();
  const confirmation = session.askForConfirmation();

  await client.disconnect();
  await app.advanceTime(240_000);
  const reconnected = await app.connect();
  reconnected.shouldRecoverConfirmation(session);
  await reconnected.disconnect();
  await app.advanceTime(59_999);
  session.shouldHavePendingConfirmation();
  await app.advanceTime(1);

  expect(await confirmation).toBe(false);
  session.shouldHaveNoDialogs();
});

it("uses the five-minute timeout for dialogs created without clients", async () => {
  const client = await app.connect();
  const session = client.session();
  await client.disconnect();
  app.useDialogClock();
  const confirmation = session.askForConfirmation();

  await app.advanceTime(299_999);
  session.shouldHavePendingConfirmation();
  await app.advanceTime(1);

  expect(await confirmation).toBe(false);
  session.shouldHaveNoDialogs();
});

it("disconnects an overloaded client without preventing publication or work on another client", async () => {
  const slowClient = await app.connect();
  const healthyClient = await app.connect();
  const session = healthyClient.session();
  slowClient.overload();

  await healthyClient.changeSettings(session);

  await healthyClient.shouldReceivePresentation(true);
  await healthyClient.shouldRemainUsable();
  await slowClient.shouldDisconnect();
});
