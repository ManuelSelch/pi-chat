# S2 — Independent server package preparation

S2 is implemented on `feat/server-packaging` in `packages/pi-server`, implementation commit `0388a1f`. The server-focused design was explicitly approved. S3 repository creation and S4 Pi Chat consumption/source deletion are **not** implemented.

## Ownership and boundaries

- The package has an independent manifest/lockfile, ESM/declaration build, compiled CLI, package/host test drivers and public export map. No root workspace or parent source imports are required.
- Root embedding exports `createPiServer(options)`, `createPiRuntimeAdapter`, restart/logger factories and required structural types. Options cover runtime/factory, extensions, files, logger, static assets and catalogue/storage injection. Handles expose only `httpServer` and idempotent `close()`; injected logger disposal stays caller-owned.
- `/extensions` preserves existing names and `Symbol.for("pi-chat.extension-registry")`; test reset is restricted to `/testing`.
- `/testing` provides compiled fake runtime and v2 fixture data. `/testing/loopback` exports the compiled isolated Swift fixture, with canonical private workspace, empty history, ephemeral loopback, stdout readiness, rejected caller-selected paths and bounded explicit retained-runtime cleanup.
- Contract/domain imports use SDK `/protocol` directly. Bash-input/edit-diff helpers live under runtime/pi; session-title lives under projects. Markdown local-path interpretation and trusted npm resolution remain Chat-owned.
- Chat's current server/helpers/test sources remain in place deliberately until S4. The staged package reuses the existing feature implementations; it is not a second long-term source authority. Reconcile any intervening backend fixes before extraction. Internal server test ownership migration remains S3/S4; these package tests do not replace those assertions.
- Standalone CLI owns explicit options, health/headless/static startup, PID/log handling, signals and no-build restart. It does not auto-open/create sessions or interpret Chat launcher environment flags. Chat retains its existing build-before-restart adapter and build-failure retention behavior unchanged.
- Source attribution and the pinned SDK revision/hash are in package `SOURCE.json`; SDK tarball is vendored. Bundling the installed SDK avoids nested unpublished/local file resolution in installed consumers. No protocol authority or SDK source moved.

## Independent-install finding

A fresh install of Pi 1.0.2 initially selected codemode 1.4.0 through its broad dependency range and failed at import: missing `MCP_TYPESCRIPT_PREAMBLE`. The package explicitly pins Chat's working Pi dependency family: agent-core/AI/coding-agent 1.0.2; codemode/MCP/TUI/telemetry/chord 1.0.3. This is a compatibility baseline, not a Pi upgrade. Direct pins survive consumer installation, unlike a package-local npm override.

## Verification

- Red/green public entry tests first failed because no compiled package existed; API/CLI tests then passed after implementation.
- Packed-consumer verification exposed a fixture launcher resolving its package from an unrelated temporary cwd; resolve the public export before creating the isolated launcher.
- Paths-with-spaces tests exposed encoded URL path handling in CLI test drivers; use `fileURLToPath`, not URL pathname.
- Swift packed-host verification first failed because the copied harness still required tsx. The test-only `PI_SWIFT_FIXTURE_ENTRY` override selects a plain-Node launcher; the default Chat fixture remains unchanged until S4.
- Package tests: **16 passed**, both directly and through installed tarballs. They cover public/private export boundaries, declarations, SDK initialize/create/close, extension identity reaching the host, explicit static hosting, disposal/logger ownership, signals, disabled supervised restart, no-build restart/PID rewrite, failed build retention, relative paths with spaces, and fixture stream/Stop/disconnect retention/path rejection/cleanup.
- Independent package-only copy: clean install, typecheck, tests and packed-consumer checks passed without Chat sources or parent dependencies.
- Fresh Git clone of `0388a1f`, in a path containing spaces, with only `npm ci --ignore-scripts --prefix packages/pi-server`: package typecheck, all 16 tests, packed-consumer verification and compiled-host Swift verification passed under **Node 24.22.1**. Node 26.5.0 verification also passed.
- Pinned standalone Swift SDK: **34 Swift Testing tests + 6 XCTest probe tests** passed. Chat-owned host scenarios: **2 tests passed** against the installed compiled server with no Chat sources/tsx, and separately against the unchanged default Chat fixture.
- Chat after the repository's explicit source-only test-harness compilation: build/typecheck, **1,124 tests / 141 files**, **32 browser tests** (one pre-existing skip), and production health/UI/PID/log/shutdown smoke passed. Existing Vite warnings remain.
- New workflow defines Node 24 independent-package checks and a macOS/Xcode 26.1.1 packed Swift host job. Commands were verified locally; no remote CI execution is claimed. This slice did not rerun the unchanged TypeScript SDK's entire standalone source suite or Swift Git-dependency consumer; their prior extraction evidence remains in HANDOVER.md and their package integration is exercised here.

## Commands

From Pi Chat:

```sh
npm ci --ignore-scripts --prefix packages/pi-server
npm --prefix packages/pi-server test
npm --prefix packages/pi-server run typecheck
npm --prefix packages/pi-server run verify:package
npm run test:server-package:swift
```

The last command requires macOS/Xcode, builds/packs the server, installs it in an isolated consumer, clones the pinned Swift bundle, runs SDK tests and copies only Chat-owned Swift scenario sources into a temporary harness. Root Chat npm dependencies are not required.

## Next and rollback

- S3: create only the approved local `pi-server` repository with a clean initial commit, source attribution, its own test/diagnostic/CI/docs ownership and fresh-clone verification. Do not recreate SDK repositories.
- S4: pin the verified server artifact in Chat; migrate launchers/drivers/examples/coverage and make compiled Swift fixture consumption the default. Remove old server sources only after full acceptance, then rerun it.
- Until cutover, main and the live launcher are unchanged. Abandon/revert the S2 commits in an isolated checkout to restore the preparation baseline; preserve unrelated work and existing SDK repositories.
- No new independent repository, remote, push, publication, live service replacement, credentials/session move or license grant occurred. POSIX restart waiter portability and full Swift parity remain outside this slice; resolve licensing before publication.
