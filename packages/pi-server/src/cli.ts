#!/usr/bin/env node
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { writeFile } from "node:fs/promises";
import { createPiServer, createRestartService, createFileLogger } from "./index.js";

async function main(): Promise<void> {
  const { values } = parseArgs({ options: {
    host: { type: "string", default: "127.0.0.1" },
    port: { type: "string", default: "8788" },
    project: { type: "string" },
    "static-directory": { type: "string" },
    "pid-file": { type: "string" },
    "log-directory": { type: "string" },
    "no-restart": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  }, strict: true, allowPositionals: false });
  if (values.help) {
    console.log("pi-server [--host 127.0.0.1] [--port 8788] [--project PATH] [--static-directory PATH] [--pid-file PATH] [--log-directory PATH] [--no-restart]");
    return;
  }
  if (!/^\d+$/.test(values.port)) throw new Error("Invalid port: expected an integer from 0 to 65535");
  const port = Number(values.port);
  if (!Number.isSafeInteger(port) || port > 65535) throw new Error("Invalid port: expected an integer from 0 to 65535");
  // Resolve flags before changing cwd so all relative paths share the invocation base.
  const project = resolve(values.project ?? process.cwd());
  const staticDirectory = values["static-directory"] ? resolve(values["static-directory"]) : undefined;
  const pidFile = values["pid-file"] ? resolve(values["pid-file"]) : undefined;
  const logDirectory = resolve(values["log-directory"] ?? `${homedir()}/.pi/agent/logs`);
  process.chdir(project);
  const logger = createFileLogger({ directory: logDirectory });
  let shuttingDown: Promise<void> | undefined;
  const shutdown = (code = 0): Promise<void> => shuttingDown ??= (async () => {
    try { await server.close(); await logger.close(); }
    catch (error) { console.error(error); code = 1; }
    process.exit(code);
  })();
  // Pin resolved paths in the successor argv: changing cwd must not reinterpret flags.
  const restartArgs = [process.argv[1]!, "--host", values.host, "--port", String(port), "--project", project,
    "--log-directory", logDirectory, ...(staticDirectory ? ["--static-directory", staticDirectory] : []),
    ...(pidFile ? ["--pid-file", pidFile] : [])];
  const restart = values["no-restart"] ? undefined : createRestartService({
    plan: { command: process.execPath, args: restartArgs, cwd: project }, shutdown: () => { void shutdown(); },
  });
  const server = createPiServer({ staticDirectory, logger, restart });
  process.on("SIGINT", () => { void shutdown(); });
  process.on("SIGTERM", () => { void shutdown(); });
  server.httpServer.on("error", error => { logger.error("server.error", { message: error.message }); console.error(error); void shutdown(1); });
  server.httpServer.listen(port, values.host, () => {
    void (async () => {
      const address = server.httpServer.address();
      if (!address || typeof address === "string") throw new Error("Missing server address");
      if (pidFile) await writeFile(pidFile, JSON.stringify({ pid: process.pid, port: address.port, cwd: project }));
      logger.info("server.started", { host: values.host, port: address.port, projectDirectory: project });
      const host = values.host.includes(":") ? `[${values.host}]` : values.host;
      console.log(`Pi Server: http://${host}:${address.port}`);
    })().catch(error => { console.error(error); void shutdown(1); });
  });
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
