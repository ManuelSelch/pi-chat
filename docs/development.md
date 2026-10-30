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

Generated application `dist/` artifacts are local and are not committed. The
server and TypeScript SDK are independent, precompiled packages; no sibling
checkout, server source tree or package workspace is required. The SDK and server
are both registry-pinned to `0.2.0` in `package.json`/`package-lock.json`; these
releases replace the temporary prompt-capable archives. No npm artifacts or
Swift SDK are vendored, and Chat does not run Swift tests. See
[dependency provenance](../vendor/README.md) for installed-package ownership.
`npm run verify:dependencies` checks the installed public server API and protocol
version, not every package byte or behavior. `build:host` compiles only Chat's
process adapter to `dist/host/index.js`; `npm start` and the extension launcher
use that entry. See [Configuration](configuration.md) for environment variables.

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
`coverage-e2e/`; Vitest's `coverage/` is independent. Vitest includes `src/` and
the E2E converter accepts Chat's `src/web/`, `src/host/` and `src/shared/`;
independent server/SDK coverage belongs to those repositories. Sonar analysis
uses the exclusions in `sonar-project.properties`, not an explicit source-root
setting. CI waits for unit and E2E success before importing both LCOV reports.
Vitest supplies unexecuted source files so they remain uncovered in combined
analysis.

Coverage uses the exact Playwright transform cache and Node source maps for the
Chat-owned worker code. Server internals are covered by the independent server CI, not copied into Chat coverage. Browser execution is mandatory; external server execution does not satisfy Chat coverage. Upgrading Playwright requires rerunning the reload regression
and checking worker mappings; missing/mismatched maps or transformed sources fail
report generation. New page navigations must checkpoint collection through the
browser driver, as reload does. Popups/additional browser pages are not supported.
Raw data contains source code and stays local; CI uploads only LCOV.

Server memory and session-open profiling diagnostics now live in the independent `pi-server` repository. They are not rebuilt or copied by Chat.

To regenerate the README showcase, run `npm run capture:readme`. See the
[capture guide](readme-showcase/CAPTURE.md) for isolation, output files, and options.
Run suites/capture serially when they share `dist/`: production lifecycle smoke
can rebuild and replace assets while another browser run is serving them.

### CI and static analysis

[Tests workflow](../.github/workflows/tests.yml) builds on Node 24, runs isolated
production lifecycle smoke and uploads assets. Unit tests produce Vitest LCOV;
E2E depends on the build, downloads those assets and produces browser/worker
LCOV. Only E2E runs in the official Playwright container; keep its image version
aligned with the lockfile. The container avoids per-run browser/system-library
installation; Node setup and Bash remain explicit.

Sonar waits for unit/E2E, imports both reports and waits for the quality gate.
It requires `SONAR_PROJECT_KEY`, `SONAR_ORGANIZATION` and `SONAR_TOKEN`; fork PRs
without access to the token are not scanned. Mockups are excluded from analysis;
coverage exclusions are separate. Source fixes or a local green suite do not
prove closure of an issue in a fresh remote analysis.

## Documentation and scenario workflow

Executable scenarios permanently describe approved behavior. Prepare and approve
changed outcomes before implementation; keep selectors, waits and transport
mechanics inside drivers. Pure documentation cleanup does not require inventing
new behavioral scenarios or weakening existing ones.

Maintain implemented responsibilities, state lifetimes, contracts and operational
guidance under `docs/` alongside code. Temporary proposals/supporting designs
belong under `plans/<feature>/`; they are not current-system references. Preserve
approved baselines through review and explicit acceptance, then remove temporary
artifacts at authorized closeout. Link relevant scenario files rather than
maintaining a second Markdown requirements catalogue.

## Server boundary

`src/host/index.ts` translates `PI_CHAT_*` settings, supplies explicit web assets and owns PID/log/signal lifecycle over `@manuelselch/pi-server`. `src/host/restart-service.ts` injects Chat’s trusted build-before-restart policy; failed builds leave the listener running. The server owns generic restart and all application/runtime/transport/catalogue implementations.

Consumers use only public root, `/extensions`, `/testing` and `/testing/loopback` APIs. The former source registry alias is removed: migrate extensions to `@manuelselch/pi-server/extensions`; registration names and the global symbol remain unchanged. Register local extension-bearing packages explicitly by path; no runtime settings or registration paths are relocated.

Chat keeps browser/domain drivers, UI tests, host/build/extension boundary tests
and production lifecycle smoke. Fakes come from compiled server testing exports.
Plain-Node loopback package checks retain workspace isolation and cleanup-file
safety coverage without a Swift harness; server internals and Swift compatibility
suites belong to their respective package repositories. See the
[driver guide](integration-tests/DRIVERS.md), [testing guide](../test/README.md)
and [package ownership](architecture.md#package-boundaries).

## Frontend organization

`src/web/` has six responsibility owners:

- `app/`: startup, composition, state/transport, shell, overlays, and global keyboard routing.
- `chat/`: transcript, Markdown, tool results, and composer.
- `sessions/`: Home, tabs, project/folder browsing, Quick Switcher, and session dialogs.
- `settings/`: settings controls and persistent browser preferences.
- `extensions/`: runtime slots, prompts, widgets, and footer metadata.
- `ui/`: application-independent primitives, theme, and generic confirmation.

These are responsibility groups, not strict architectural layers. Containers
bind application context/state and overlay coordination to prop-driven views;
shared `ui/` primitives have no app/feature imports. App composition imports the
shell and `AppOverlays`; features do not import those composition components.

`app/state/` and `app/connection/` depend on SDK/shared types and application
state, not feature presentation. The composition boundary is broader:
`usePiChat` integrates Inbox lifecycle and endpoint loading, while
`AppControllerProvider` composes prompt presentation, runtime themes, session
drafts and file actions. Most imports address files directly; server settings
has an existing public entry point at `settings/server/index.ts`. Include
type-only imports when reviewing dependency boundaries.

`AppOverlays` assembles runtime prompts, session dialogs, Quick Switcher,
Inbox/Projects navigation, folder selection and Settings. Settings stays mounted
while closed to preserve chime playback. App owns Home/transcript selection,
composer height and responsive workspace geometry. Widget rendering, dock
geometry and pure placement rules live separately in `extensions/widgets/`;
App and the composer share the placement helper.

Runtime prompts represent server/extension interactions, distinct from generic
application confirmations in `ui/confirm/`. Rich prompts reuse chat's lazy
Markdown renderer; it is not exclusively a transcript/tool dependency. Home and
Quick Switcher share ranking helpers within `sessions/`. Global layer order,
Markdown styles and shared animations remain in `app/styles.css`; component CSS
modules stay beside their consumers.

See the [architecture overview](architecture.md) for component diagrams and data
flow, and the [testing guide](../test/README.md) for permanent workflow coverage.
