import { afterEach, beforeEach, it } from "vitest";
import { LifecycleCommandDriver } from "../../infra/pi-chat/lifecycle-command-driver.js";

let app: LifecycleCommandDriver;
beforeEach(() => { app = new LifecycleCommandDriver(); });
afterEach(() => app.dispose());

it("registers only pi-chat and completes lifecycle subcommands", async () => {
  await app.shouldOfferLifecycleCommands();
});
it("shows status with no arguments and never signals a restart", async () => {
  app.withRunningServer();

  await app.run("");

  app.shouldNotify("running on", "info");
  app.shouldNotHaveRequestedReplacement();
});
it.each(["invalid", "stop extra", "restart extra"])("rejects invalid usage: %s", async args => {
  await app.run(args);

  app.shouldNotify("Usage:", "warning");
  app.shouldNotHaveSignaledProcesses();
  app.shouldNotHaveExecutedCommands();
});
it("start preserves already-running behavior without a rebuild or browser when --no-open", async () => {
  app.withRunningServer();

  await app.run("start --no-open");

  app.shouldNotify("already runs", "info");
  app.shouldNotHaveExecutedCommands();
  app.shouldNotHaveSpawnedProcesses();
});
it("start preserves port and project options when launching", async () => {
  app.withFreePort();

  await app.run("start --port 9988 --cwd /chosen --no-open");

  app.shouldHaveStartedOn(9988, "/chosen");
});
it("stop terminates the managed process group", async () => {
  app.withRunningServer();
  app.withUnhealthyServer();

  await app.run("stop");

  app.shouldHaveStoppedProcessGroup();
  app.shouldNotify("stopped", "info");
});
it.each([0, -1, 1.5, "12345", null])("rejects unsafe PID %s before probing or signaling it", async pid => {
  app.withRunningServer({ pid });

  await app.run("restart");

  app.shouldNotHaveSignaledProcesses();
  app.shouldNotify("managed", "warning");
});
it("does not start a concurrent restart when the lock is held", async () => {
  app.withRestartLockHeld();

  await app.run("restart");

  app.shouldFinishWith("restart lock", "error");
  app.shouldNotHaveExecutedCommands();
  app.shouldNotHaveSignaledProcesses();
});
it("restart refuses unmanaged servers", async () => {
  await app.run("restart");

  app.shouldNotify("managed", "warning");
  app.shouldNotHaveSignaledProcesses();
});
it("restart refuses a PID record without explicit signal support", async () => {
  app.withoutSignalSupport();

  await app.run("restart");

  app.shouldNotify("support", "error");
  app.shouldNotHaveRequestedReplacement();
});
it("refuses to replace a server whose Node executable is unavailable", async () => {
  app.withRunningServer({ nodePath: "" });

  await app.run("restart");

  app.shouldNotHaveExecutedCommands();
  app.shouldNotHaveRequestedReplacement();
  app.shouldFinishWith("Node executable", "error");
});
it("restart refuses unhealthy servers", async () => {
  app.withRunningServer();
  app.withUnhealthyServer();

  await app.run("restart");

  app.shouldNotHaveRequestedReplacement();
  app.shouldNotify("healthy", "error");
});
it("restart signals once and reports only a healthy successor", async () => {
  app.withRunningServer();
  app.withHealthySuccessor();

  await app.run("restart");

  app.shouldHaveRequestedReplacementOnce();
  app.shouldHaveInstalledThenBuilt();
  app.shouldNotHaveSpawnedProcesses();
  app.shouldFinishWith("restarted", "info");
});
it("reports installation failure without signaling the running server", async () => {
  app.withRunningServer();
  app.withInstallFailure();

  await app.run("restart");

  app.shouldHaveExecutedOneCommand();
  app.shouldNotHaveRequestedReplacement();
  app.shouldFinishWith("registry unavailable", "error");
});
it("reports build failure without signaling the running server", async () => {
  app.withRunningServer();
  app.withBuildFailure();

  await app.run("restart");

  app.shouldNotHaveRequestedReplacement();
  app.shouldFinishWith("compile failed", "error");
});
it("restart reports signaling errors without a retry", async () => {
  app.withRunningServer();
  app.withSignalFailure();

  await app.run("restart");

  app.shouldFinishWith("permission denied", "error");
});
it("restart times out honestly without killing the current server or repeating the request", async () => {
  app.withRunningServer();

  await app.restartUntilDeadline();

  app.shouldHaveOnlyRequestedReplacement();
  app.shouldFinishWith("not confirmed", "error");
});
