# Pi Server / SDK Extraction Boundaries

## Scope and baseline

S1 defines ownership and package seams; it does not implement them. The approved [design](DESIGN.md) and [requirements](REQUIREMENTS.md) govern subsequent work.

- Audited/rollback source: **`495637bcf4ae3597406b05f9327a51962d94eb21`** in Pi Chat. Preserve this revision until S4 acceptance; reference the actual extraction source revision as well in both repositories' clean initial commits if later preparation changes it.
- Destination: `/Users/manuelselch/Documents/A_Personal/40 Projekte/47 Agents/Pi Agent/{pi-server,pi-sdk}`. The parent remains non-Git. No destination was created in S1.
- [INVENTORY.md](INVENTORY.md) classifies every baseline tracked file and lists resolved relative boundary/consumer edges. The AST audit found 1,418 import/re-export edges, no unresolved relative imports and no computed import/require arguments across 528 tracked files. This does **not** prove independent packaging.
- No runtime state, credentials, sessions, applications or live services move. No remote creation, push or publication is authorized. Full Swift parity/real-Pi conversation acceptance is still follow-up, not an extraction gate.

## Ownership and dependency direction

`Pi Chat → pi-server + pi-sdk`; `pi-server → pi-sdk + Pi runtime`; `pi-sdk production → Zod (TypeScript) / Foundation (Swift)`. SDK verification may install server artifacts, but SDK production code must never depend on the server. No repository imports sibling source trees.

| Current area | Future owner and disposition |
|---|---|
| `src/server/application`, `projects`, `runtime`, `transport`, `files`, `logging`, `extensions` | Server, retaining current feature structure and semantics. Server application/publisher/transport implementations are private. |
| `src/server/bootstrap/server.ts` | Server embedding composition root. Replace positional wiring with a documented options surface, not exported application internals. |
| `src/server/index.ts` | Split generic compiled server CLI/lifecycle into Server and Pi Chat static/build/environment policy into a Chat adapter. No default `dist/web` in standalone CLI. |
| `src/server/bootstrap/restart-service.ts` | Server owns successor planning, waiter/spawn and shutdown orchestration; Chat owns `npm run build` policy and trusted npm resolution. Standalone default never builds. |
| `src/server/extension-registry.ts` | Old re-export shim is not the future API. Chat can retain a temporary package re-export until all known consumers switch; do not copy a second registry implementation. |
| `packages/pi-sdk/**` | SDK repository, preserving root `Package.swift`, Swift sources/resources/tests/probe, `protocol/**` and TypeScript package/test/generator layout. Loopback fixture implementation is the exception described below. |
| `src/web/**`, `extension/pi-chat.ts`, `examples/**` | Chat. Launcher still builds Chat, serves Chat assets, tracks PID and opens/stops the browser backend. Examples import the server's extension API. |

### Shared files: explicit decisions

- `protocol.ts`, `directories.ts`: SDK already owns all definitions. Replace Server imports with `@manuelselch/pi-sdk/contract`; Chat may retain its import bridges during S4. Do not extract these shims as a competing contract.
- `files.ts`: all Server consumers use SDK schemas/types, not `localPathFromHref`. Import those directly from SDK. Keep Markdown destination interpretation in Chat; do not move it into SDK merely because it shares a file with re-exports.
- `bash-input.ts`, `edit-diff.ts`, `session-title.ts`: move to the Server features that consume them. Only Server production consumes these helpers; the fake runtime moves with Server. No new shared utility package or SDK helper export is needed.
- `node/npm-command.ts`: Chat build/capture tooling retains it. SDK's `verify-package.mjs` currently imports this file outside its boundary: give SDK a local build-tool copy and equivalent resolver/pack-command tests. This small tooling duplication avoids a production dependency on Chat or speculative utility package. Standalone restart no longer needs it.

### Dependencies and build tooling

- Server direct runtime imports: `@manuelselch/pi-sdk/contract`, `@earendil-works/pi-coding-agent`, `express`, `ws`, `zod`, and Node built-ins. Declare these explicitly in its own manifest. Use the baseline Pi version **1.0.2** initially; current source uses named package exports, not Pi deep-source imports. A standalone install must actually supply Pi, not rely on Chat's dev dependency or a parent `node_modules`.
- Server build/test dependencies: TypeScript, Node/Express/WS declarations, Vitest; tests using Pi AI/core or the pinned harness must declare their own direct dependencies. Harness reference remains `7ade82c6c7de2ae85f69df1c442a515b63c6dadc`. Its source-only compilation is explicit CI preparation, not an assumed install lifecycle.
- SDK npm runtime dependency remains only Zod. Existing local manifest declares Ajv, quicktype, tsx, TypeScript, Vitest and Node declarations for development. Its generation/copy/pack scripts are SDK-owned; preserve exact shared schemas/fixtures and Swift bundled-schema drift checks.
- Keep Node `>=22.19` package baseline and Node 24 CI initially. Swift tools 6.2 / iOS 26.1 / macOS 15 are unchanged. SwiftPM package root must be the future SDK Git root.
- Server has no React, Mantine, Vite, Tailwind, jsdom, Playwright or runtime tsx dependency. Tests/tooling may use TypeScript runners explicitly. Chat keeps UI/build/browser dependencies. Recreate independent manifests/lockfiles rather than copying the hoisted root manifest wholesale.

## Proposed package APIs (not yet implemented)

### Server embedding: `@manuelselch/pi-server`

- Export `createPiServer(options)` and its handle/options types. Reuse the existing bootstrap, with optional `runtime`, `runtimeFactory`, `staticDirectory`, `restart`, `extensions`, `files`, `logger` and catalogue configuration. Omitted static assets means headless, retaining `/health` and `/ws`.
- Handle exposes Node `httpServer` for explicit listen/address/error management plus asynchronous `close()`. Existing `transport` access remains private: external consumers use the SDK or WebSocket protocol. Disposal closes transport/listener/runtimes; caller owns an injected logger's final flush/close as today.
- Export `RuntimeAdapter`, `RuntimeAdapterFactory`, `RuntimeSnapshot`, `RuntimeEvent` and required structural restart/file/logger contracts that occur in options. Export a narrow `createPiRuntimeAdapter(runtime)` wrapper over `PiRuntimeAdapter.fromRuntime` for Chat's real-Pi harness. Do not export the concrete adapter class or its private state/mapping methods.
- Catalogue options must cover current browser fixtures: injected history lister, session directory, discovery, metadata file path and home directory. Construct `ProjectSessionService` / `ProjectMetadataStore` internally. These classes need not become public just because tests currently instantiate them.
- CLI bin `pi-server` executes compiled JS. Support explicit host, port, project directory, static directory, PID file and log directory; use loopback and port 8788 by default. No auto-open, auto-create session or source rebuild. Chat maps current `PI_CHAT_*` behavior into options; preserve existing model/log settings during transition rather than silently renaming them.
- Restart service is a documented root export with optional pre-restart build callback. Default: restart the installed executable/argv after shutdown without compilation. Chat provides its existing build-before-shutdown callback; failure keeps the old process serving. Supervised dev mode still disables restart.

### Extensions: `@manuelselch/pi-server/extensions`

- Export existing `getPiChatExtensionRegistry`, `createPiChatExtensionRegistry` and registration/action/hook/snapshot types. Preserve public PiChat-prefixed names, owner replacement and state semantics; extraction is not a rename exercise.
- Preserve **`Symbol.for("pi-chat.extension-registry")`** exactly. Internal runtime imports and external extension imports must reach the same global registry, including reloaded/multiple sessions. Test the singleton through both paths.
- Reset-for-tests belongs in the testing surface, not the extension API. Update the demo and `docs/extension-api.md`; explicitly register local extension-bearing packages by path. Do not change user settings or existing symlinks in S1.

### Test fixtures: `@manuelselch/pi-server/testing`

- Ship compiled fake-runtime and v2 fixture-data exports derived from `test/infra/fake-runtime-adapter.ts` and `test/infra/v2-fixtures.ts`. Export registry reset here. They must not import Vitest/Playwright at runtime. Keep `v2-socket.ts` as Server test-internal support.
- Provide an isolated loopback fixture launcher module at `@manuelselch/pi-server/testing/loopback`, moving the implementation currently under SDK `Tests/Fixtures/loopback-server.ts` into Server. Preserve deterministic streaming/Stop, ephemeral loopback port, empty history, private canonical temporary workspace, rejected caller-supplied paths, `PI_FIXTURE_READY { directory, endpoint }`, bounded shutdown, explicit retained-runtime close and exclusive `cleanup.json` creation.
- SDK keeps a thin test-only JS launcher importing that compiled module. Swift's driver launches it with plain Node from SDK's root, without `--import tsx`, Chat cwd assumptions or parent traversal. Install an explicit Server test artifact before loopback tests; never silently skip them when unavailable. Swift library consumers need no Node/server dependency.
- Chat `TestWorld` and browser/domain drivers remain Chat-owned. Use the root embedding/runtime APIs and testing fakes instead of deep imports. Real-Pi playbook/harness logic stays test-only in Chat; it is not a new Server production abstraction.

## Consumer and test migration

The inventory's edge table is the exhaustive source-level relative consumer list at this revision. The following dispositions cover its groups:

| Consumer group | Replacement / ownership |
|---|---|
| Server → shared shims/helpers | Direct SDK contract imports or Server-local helpers, as above. |
| SDK fixture → Server, Chat fake and shared protocol | Server-owned compiled fixture + SDK contract imports; remove every upward source import. |
| SDK pack verifier → npm resolver | SDK-local tooling helper; move matching verifier mock/invocation cases from `test/infra-tests/npm-invocations.test.js`. Chat keeps capture cases. |
| Demo extension and docs | `/extensions` API. Existing compatibility test follows singleton identity rather than requiring duplicate source. |
| Chat `test/infra/pi-chat/**`, browser root driver and browser-client tests | Root embedding API, structural runtime types, `createPiRuntimeAdapter`, catalogue options. Fake fixture users consume `/testing`. |
| Web tests importing `snapshot.ts`, `tool-mapping.ts`, `message-mapping.ts` | Split cross-layer cases: Server owns runtime-to-wire mapping assertions; Chat owns rendering assertions with SDK domain values or test fixtures. Do not publish mapping internals to satisfy tests. |
| Server tests under `test/modules/server/**` | Move with mirrored Server feature paths; keep deep imports internal. Split restart build-policy cases into Chat. Host tests target generic CLI plus Chat adapter separately. |
| `test/modules/shared/edit-diff.test.ts` | Server mapping coverage. |
| `test/modules/shared/protocol.test.ts` | SDK contract coverage, importing SDK-owned/shared fixture data rather than Chat test paths. |
| `test/modules/shared/sdk-client.test.ts` | Server integration suite against public SDK, fake-runtime loopback and isolated storage. |
| `test/modules/shared/sdk-contract.test.ts` | Chat bridge identity regression until bridges are removed; SDK already tests root/contract exports. |
| `test/modules/shared/files.test.ts`, npm resolver tests | Chat-owned bridge/tooling checks; SDK copy gets its own resolver safety checks. |
| Fake-runtime, Swift-fixture drivers/tests | Server testing support and fixture-safety suite. Agent-directory-isolation tests split Server metadata safety and Chat test-world isolation. Preserve isolated `PI_CODING_AGENT_DIR` setup. |
| `scripts/profile-session-open.ts`, `list-models.ts`, `verify-slice1.ts` | Server diagnostics; the last is historical backend-sdk verification, **not** this extraction S1 gate. |
| Capture/showcase, memory comparison/metrics and production smoke | Chat retains UI comparison/smoke orchestration; replace hard-coded compiled Server paths with public package entry/CLI. Server adds its own headless/package smoke. |

## Non-import seams and CI

- Root scripts `prepare`, `build:sdk`, pre-test/pre-dev and workspace linkage currently ensure SDK `dist` exists. Replace with explicit artifact installation in independent consumers; no parent workspace/sibling build assumptions. Root `build:server`, `start`, launcher and smoke currently depend on `dist/server/server/index.js`; migrate to a small Chat-owned adapter over Server APIs.
- Current server production entry unconditionally serves cwd-relative `dist/web`. Generic CLI must not. Chat supplies its built asset directory explicitly; keep health and SPA fallback behavior when assets are requested.
- Preserve launcher port probing, 60-second readiness bound, detached process tracking, `pi-chat-server.pid` record `{ pid, port, cwd }`, listener PID rewrite after restart, failed-start cleanup and process-group stop. Preserve `PI_CHAT_HOME` resolution and normal log location/rotation. Do not repoint the live launcher before S4 verification.
- `getAgentDir()` and session/metadata paths remain runtime inputs/defaults under existing agent state. Tests must set private `PI_CODING_AGENT_DIR` before imports and inject catalogue history/metadata paths; never read real conversation history for packaging verification.
- `tsconfig.server.json` currently includes **all** shared files, even Chat-only link interpretation. Replace with Server-owned build inputs and declaration generation. SDK's TS configuration is already local; pack checks must also run locally. Chat TS config loses extracted inputs.
- Split `test/setup.ts`: Server/SDK get storage isolation where needed; Mantine/jsdom shims remain Chat. Existing root Vitest discovery also reaches SDK tests; independent suites must not rely on that incidental discovery.
- Existing GitHub workflow has build, unit, e2e and Sonar jobs; it uploads both Server/UI `dist` and workspace SDK output. Server CI needs clean install, build/typecheck, internal + public SDK integration tests, headless/static/CLI/restart packed-consumer smoke. SDK CI needs clean TS build/typecheck/tests/contract drift/offline pack and macOS Swift/loopback tests using explicit Server artifacts. Existing workflow has **no Swift job** to inherit.
- Chat retains Vite, browser scenarios/drivers, Playwright configuration/container, coverage capture, screenshot assets and Sonar UI reporting. Current coverage scripts require executed `src/server/**` in Chat: revise scope/validation and corresponding report tests for package boundaries rather than falsifying coverage with copied Server sources. Server/SDK own their separate coverage. Do not copy Chat Sonar credentials/project settings into new repositories.
- No tracked `LICENSE`, `NOTICE` or `COPYING` file exists at the baseline, and the root manifest declares no license. Preserve existing source notices and record source/revision in new READMEs; do not invent a license grant. Record this absence in the extracted private repositories and resolve licensing with the owner before any publication. Copy/adapt authoritative protocol and relevant server configuration/extension/lifecycle docs; SDK owns protocol normative text and artifacts. Historical parent plans/cutover evidence remain Chat links/copies for context, not independent source contracts. New repos need their own ignore rules, lockfiles, scripts and CI.

## Handoff and acceptance

- **S1 verified:** complete baseline file classification, resolved literal import graph, reviewed runtime/configuration seams, public API decisions and source/rollback revision. No production or test changes, installs, package moves or live-service replacement.
- **S2:** implement these surfaces and dependency splits in the existing checkout; prove packed Server headless and explicit-static startup, SDK initialization, cleanup and no-build restart without Chat sources/hoisting/loaders. Build/test Swift independently with compiled fixture artifacts. No independent-install success is claimed by this audit.
- **S3:** create the two approved local Git repositories with clean initial commits, source traceability/attribution, independent locks/CI/docs; verify fresh clones against explicit dependency artifacts. Remote provisioning/publication remains separately approved work.
- **S4:** switch Chat and extension examples to package surfaces; verify Git-based SwiftPM consumption using a local Git URL/revision without creating a remote, existing TS/Swift suites, integration/browser suites and production launcher/restart/PID/log/shutdown smoke before removing old sources. Document artifact versions and rollback to the recorded revision.
- No blocking design questions remain. Package installation, cross-platform fixture launch and actual independent consumer compatibility are implementation verification obligations, not proven facts or silently waived checks.
