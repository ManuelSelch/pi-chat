# Pi Chat Production Server Build — Requirements

## Goal

Run the Pi Chat backend as ordinary production JavaScript instead of through `tsx`, while preserving its Pi runtime, extension, restart, logging, static-web, and launcher behavior. Make it possible to measure whether this reduces the server's high baseline memory use.

## Scope
### In Scope
- Compile `src/server/**` and the imported `src/shared/**` modules to Node-compatible JavaScript under `dist/server/` (for example, entry point `dist/server/server/index.js`). Keep `dist/server` under the repository root so Node resolves the checkout's installed dependencies and root `package.json` ESM mode.
- Keep the browser/Vite build and backend build coordinated by the normal production build command.
- Make the production start command execute the compiled entry point with Node, not `tsx`.
- Keep `tsx` available for development and tests as needed.
- Verify production startup and record comparable process-memory measurements.
- Update the Pi Chat launcher/build flow and documentation as needed so users are not required to build manually first.

### Out of Scope
- Changing Pi SDK/runtime behavior, extension discovery, or session lifetime to reduce memory.
- Bundling the backend into a single artifact unless required by compatibility findings.
- Claiming or targeting a particular memory reduction before measurements.
- Changing the existing web UI architecture or protocol.

## Requirements
- The production backend entry point must be emitted as JavaScript and started by the supported Node version without `tsx`, ts-node, or an equivalent runtime TypeScript loader.
- Backend compilation must include required `src/server` modules and imported `src/shared` runtime modules, but exclude tests, Vite configuration, and extension source files unless a verified dependency requires otherwise.
- Emitted relative ESM imports must resolve correctly under Node; package/module configuration and output paths must be explicit and reproducible.
- The production build must produce both `dist/web` and the backend output, and must fail if either build fails.
- Development startup must continue using the current TypeScript watch workflow.
- `extension/pi-chat.ts` startup and build/restart flow must work from a clean checkout and leave no orphaned server or stale PID state on build/start failure.
- Production server must continue serving the built web UI, report health, honor existing port/CWD/PID/log environment variables, handle graceful shutdown, and support the existing in-app restart path.
- Tests, type checking, and build checks must cover the emitted server contract. A smoke test must start the compiled server, verify health and static assets, then stop it cleanly.
- Compare fresh-process RSS for the compiled production server with the current `tsx` server under the same Node version, startup directory, Pi configuration, and initial-session state. Record measurement method and results without treating RSS alone as proof of a leak or heap usage.

## Assumptions
- The supported deployment remains a local checkout with `node_modules` installed; this work does not create a standalone distributable package.
- TypeScript ESM output is preferable to introducing a server bundler, subject to confirming runtime dynamic imports and extension resolution work from emitted paths.
- Backend output is emitted by TypeScript with `src` as its root, preserving the existing `.js` ESM specifiers and source directory structure; no bundler is needed based on the inspected server source.
- The Pi Chat extension should always run the production build before starting the server. Build artifacts are generated locally and are not checked in or distributed.

## Implementation Plan
### 1. Define the backend emit boundary
Description: **Completed.** The backend build boundary is `src/server/**` plus imported `src/shared/**`; emit with `src` as `rootDir` into `dist/server/`, yielding `dist/server/server/index.js` and `dist/server/shared/**`. The output remains inside the repository so dependencies resolve from root `node_modules` and inherit the root package's `type: module`. Existing relative imports already use `.js` specifiers. No server-source dynamic imports or runtime source-relative extension paths were found; the Pi SDK's own dynamic imports remain within its installed package. The server's static web directory and restart build command are cwd-relative, and the Pi Chat launcher starts from the checkout root. Validated the import closure by compiling `src/server/index.ts` with TypeScript using `--rootDir src --outDir /tmp/pi-chat-server-boundary-check`; compilation passed and emitted the expected server/shared tree. The production restart service already reuses the running Node executable and argv, so it can relaunch the emitted entry without a TypeScript loader. No production code changed in this slice.

### 2. Add production build and Node startup
Description: **Completed.** Added `tsconfig.server.json` with `src` as `rootDir`, `dist/server` as `outDir`, and server/shared source includes. Added `build:server`; the normal `build` now type-checks, emits the backend, and builds the web UI. `start` now runs `node dist/server/server/index.js`; development remains on `tsx watch`. Verified `npm run build` produces both `dist/server/server/index.js` and `dist/web/index.html`. A production smoke started the emitted Node entry, returned `{"ok":true}` from `/health`, served the built index page, and showed the process command as `node dist/server/server/index.js`. Existing Vite chunk-size/dynamic-import warnings remain unrelated. Launcher behavior is deferred to slice 3.

### 3. Preserve launcher and restart lifecycle
Description: Update the Pi Chat extension to always build before starting the compiled production entry point. Build artifacts are local-only. Handle build and startup failures without stale PID files or orphan processes. Verify launcher start, already-running detection, stop, and in-app restart behavior against the production build.

### 4. Production smoke and memory comparison
Description: Add or update automated checks for compiled-server startup, `/health`, static UI serving, configured port/PID/log/CWD behavior, and clean shutdown. Measure fresh-process RSS for `tsx` and compiled Node under matched conditions and record the results and limitations.

## Open Questions
None.
