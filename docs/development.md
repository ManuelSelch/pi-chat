# Development

## Local workflow

Use Node.js 22.19 or newer. From the repository checkout:

```sh
npm ci --ignore-scripts
# Compile the pinned source-only test harness before build/test:
npx --ignore-scripts tsc --ignoreConfig --noCheck --module nodenext --target es2022 --declaration --outDir node_modules/@marcfargas/pi-test-harness/dist node_modules/@marcfargas/pi-test-harness/src/*.ts
npm run dev
```

The development command runs the backend with `tsx watch` and the frontend with
Vite. For a production build and compiled backend:

```sh
npm run build
npm start
```

Generated application `dist/` artifacts are local and are not committed. The server and TypeScript SDK are independent, precompiled packages; no sibling checkout, server source tree or package workspace is required. The SDK is registry-pinned to `0.1.0` and the server to `0.1.1` in package.json and package-lock.json. The published server replaces the temporary colored-widget tarball; no npm artifacts or Swift SDK are vendored, and Chat does not run Swift tests. Run `npm run verify:dependencies` to check the installed public server API and protocol version. `build:host` compiles only Chat’s process adapter to `dist/host/index.js`; `npm start` and the extension launcher use that entry. See
[Configuration](configuration.md) for server environment variables.

## Verification

```sh
npm test
npx tsc --noEmit
npm run test:e2e
npm run test:production-smoke
```

Browser tests require Chromium (`npx playwright install chromium`). Tests are
grouped under `test/modules/` (production modules), `test/scenarios/` (user
workflows), and `test/infra-tests/` (tests of reusable machinery). Reusable
support lives under `test/infra/`. See the [testing guide](../test/README.md) for
placement rules and focused commands.

Swift SDK unit and real-server integration tests run in the independent
[pi-sdk-swift repository](https://github.com/ManuelSelch/pi-sdk-swift/tree/main/integration),
using its local SDK source and a locked npm server dependency. Chat verification
requires no Swift toolchain or Xcode.

### E2E coverage

Run `npm run test:e2e:coverage` to build with browser source maps, collect
Chromium and Chat-owned worker V8 coverage, and generate
`coverage-e2e/lcov.info`. For an existing coverage-enabled build, use
`npm run test:e2e:coverage:run -- test/e2e/reload.spec.ts --workers=1`.
Regenerate the report from retained raw data with `npm run coverage:e2e:report`.

Ordinary `test:e2e` runs do not collect coverage. The coverage runner clears only
`coverage-e2e/`; Vitest's `coverage/` is independent. The independent server and both
SDKs are outside the measured scope (`sonar.sources=src`). CI waits for unit and
E2E success before importing both LCOV reports into Sonar. Vitest supplies
unexecuted root source files so they remain uncovered in combined analysis.

Coverage uses the exact Playwright transform cache and Node source maps for the
Chat-owned worker code. Server internals are covered by the independent server CI, not copied into Chat coverage. Browser execution is mandatory; external server execution does not satisfy Chat coverage. Upgrading Playwright requires rerunning the reload regression
and checking worker mappings; missing/mismatched maps or transformed sources fail
report generation. New page navigations must checkpoint collection through the
browser driver, as reload does. Popups/additional browser pages are not supported.
Raw data contains source code and stays local; CI uploads only LCOV.

Server memory and session-open profiling diagnostics now live in the independent `pi-server` repository. They are not rebuilt or copied by Chat.

To regenerate the README showcase, run `npm run capture:readme`. See the
[capture guide](readme-showcase/CAPTURE.md) for isolation, output files, and options.

## Server boundary

`src/host/index.ts` translates `PI_CHAT_*` settings, supplies explicit web assets and owns PID/log/signal lifecycle over `@manuelselch/pi-server`. `src/host/restart-service.ts` injects Chat’s trusted build-before-restart policy; failed builds leave the listener running. The server owns generic restart and all application/runtime/transport/catalogue implementations.

Consumers use only public root, `/extensions`, `/testing` and `/testing/loopback` APIs. The former source registry alias is removed: migrate extensions to `@manuelselch/pi-server/extensions`; registration names and the global symbol remain unchanged. Register local extension-bearing packages explicitly by path; no runtime settings or registration paths are relocated.

Chat keeps browser/domain drivers, UI tests, host/build/extension boundary tests and production lifecycle smoke. Fakes come from compiled server testing exports. Plain-Node loopback package checks retain workspace isolation and cleanup-file safety coverage without a Swift harness; server internals and Swift compatibility suites belong to their respective package repositories. See the [historical S4 handover](pi-server-extraction/S4-CUTOVER.md) for extraction pins and rollback, and [Swift test ownership](swift-test-ownership/REQUIREMENTS.md) for the current boundary.

## Frontend organization

`src/web/` has six responsibility owners:

- `app/`: startup, composition, state/transport, shell, overlays, and global keyboard routing.
- `chat/`: transcript, Markdown, tool results, and composer.
- `sessions/`: Home, tabs, project/folder browsing, Quick Switcher, and session dialogs.
- `settings/`: settings controls and persistent browser preferences.
- `extensions/`: runtime slots, prompts, widgets, and footer metadata.
- `ui/`: application-independent primitives, theme, and generic confirmation.

Application services depend on shared types and other services, not presentation.
Feature containers may consume app context/state and overlay coordination; views
stay prop-driven. Only app composition imports the shell and `AppOverlays`.
Shared UI has no app/feature dependencies; extension views do not import chat or
shell components. Use direct file imports, including type-only imports, without
barrels or compatibility shims.

`AppOverlays` assembles overlays in their existing order; providers remain in
`App`. Settings stays mounted while closed to preserve chime playback. App owns
Home/transcript selection, composer height, and widget docking.

See the [web organization plan](web-organization/REQUIREMENTS.md) for detailed
boundaries and migration history, and the [architecture overview](architecture.md)
for component diagrams and data flow.
