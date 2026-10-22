# MCP Runtime — Design

## Approach
Enable the upstream MCP and tool-search extensions in pi-chat's server-side Pi runtime composition root. Confirmed cause: `createPiRuntime()` currently registers codemode only; upstream SDK sessions do not automatically load the CLI's built-in MCP extensions.

This belongs in pi-server (currently `src/server`), not the transport/client package `packages/pi-sdk`. MCP connections, credentials and subprocesses belong to the server that runs the agent. All clients using that server then benefit without protocol changes.

## Components & Data Flow
- **Changed:** `src/server/runtime/pi/runtime-factory.ts` imports and registers the upstream MCP and tool-search factories alongside codemode.
- **Reused:** `PiRuntimeAdapter` already calls `session.bindExtensions()`, which emits the startup event needed to connect MCP servers.
- **Reused:** Upstream MCP configuration loading, project trust, exposure, authentication, reload and disposal behavior.
- **Changed tests:** mirrored runtime-factory tests cover registration and configured activation without using personal credentials or external servers.

## Key Implementation Details
Keep the existing codemode behavior and add the two factories:

```ts
extensionFactories: [
  createCodemodeExtension(),
  createToolSearchExtension(),
  createMcpExtension(),
]
```

Do not force tool activation or change user settings. Let configured default tools and MCP exposure control activation as documented upstream. No Sonar-specific configuration or credential changes.

## Complexity Guardrails
No client SDK changes, new protocol fields, additional dependencies, custom MCP implementation or UI. Preserve the existing runtime lifecycle and resource discovery. Do not reorganize the server for this small wiring fix.

## Verification
Extend isolated runtime-factory regression coverage to verify `tool_search` registration, settings-controlled activation and availability of the MCP command after binding. Preserve existing codemode and default-tool assertions. Run focused runtime tests and TypeScript checking. A live Sonar authentication check is separate and requires valid credentials in the server environment.

## Decisions for Approval
Approve server-side registration only, preserving upstream configuration and activation defaults. No changes to the client SDK or authentication settings.
