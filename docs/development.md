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
checkout, server source tree or package workspace is required. This branch uses
committed SDK/server candidate archives with source/integrity receipts rather than published releases. No Swift SDK is
vendored, and Chat does not run Swift tests. See
[dependency provenance](../vendor/README.md) for installed-package ownership.
`npm run verify:dependencies` checks the installed public server API and protocol
version, not every package byte or behavior. `build:host` compiles only Chat's
process adapter to `dist/host/index.js`; `npm start` and the extension launcher
use that entry. See [Configuration](configuration.md) for environment variables. The [counter plugin demo](counter-demo.md) is available from the header without extra configuration.

## Verification

```sh
npm run lint
npm run test:tooling
npm test
npx tsc --noEmit
npm run test:e2e
npm run test:production-smoke
```

ESLint checks TypeScript naming in `src/`, `testing/`, `extension/` and Vite config:
methods and properties use camelCase, with exceptions for external wire keys,
quoted non-identifiers, static constants and React component identifiers. Variables
also allow PascalCase for React and UPPER_CASE constants. Tooling tests verify the
rules. TypeScript 7 (`@typescript/native`) remains the compiler; the `typescript`
package aliases TypeScript 6 for typescript-eslint's compiler API compatibility.
The local pipeline and GitHub Actions run lint and its regression tests.

Browser tests require Chromium (`npx playwright install chromium`). Module tests
live in `__test__/` inside their owning source module. Shared user workflows,
browser specs and reusable machinery remain under `testing/scenarios/`,
`testing/e2e/`, `testing/infra/` and `testing/infra-tests/`. See the [testing guide](../testing/README.md) for
placement rules and focused commands.

Swift SDK unit and real-server integration tests run in the independent
[pi-sdk-swift repository](https://github.com/ManuelSelch/pi-sdk-swift/tree/main/integration),
using its local SDK source and a locked npm server dependency. Chat verification
requires no Swift toolchain or Xcode.

### E2E coverage

Run `npm run test:e2e:coverage` to build with browser source maps, collect
Chromium and Chat-owned worker V8 coverage, and generate
`coverage-e2e/lcov.info`. For an existing coverage-enabled build, use
`npm run test:e2e:coverage:run -- testing/e2e/reload.spec.ts --workers=1`.
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

[Tests workflow](../.github/workflows/tests.yml) runs lint on Node 24, builds, runs isolated
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

`src/host/index.ts` translates `PI_CHAT_*` settings, supplies explicit web assets and owns PID/log/signal lifecycle over `@manuelselch/pi-server`. The `/pi-chat restart` extension runs `npm ci` and `npm run build` before signaling process replacement; failed installs/builds leave the listener running, but installation replaces shared dependencies in place without rollback. The server owns generic restart and all application/runtime/transport/catalogue implementations.

Chat’s host adds `/api/pi-chat/version` with a startup-captured server version and no-store responses. Vite captures the installed frontend SDK version plus clean exact Git tag (otherwise `dev`) into the browser build. Settings fetches runtime metadata only while open and connected; failures display Unavailable without affecting the transport. No SDK/server protocol changes are needed.

Consumers use only public root, `/plugins`, `/extensions`, `/testing` and `/testing/loopback` APIs. Await `createPiServer()` before listening; it owns host plugin startup and shutdown. The former source registry alias is removed: migrate extensions to `@manuelselch/pi-server/extensions`; registration names and the global symbol remain unchanged. Register local extension-bearing packages explicitly by path; no runtime settings or registration paths are relocated.

Chat keeps browser/domain drivers, UI tests, host/build/extension boundary tests
and production lifecycle smoke. Fakes come from compiled server testing exports.
Plain-Node loopback package checks retain workspace isolation and cleanup-file
safety coverage without a Swift harness; server internals and Swift compatibility
suites belong to their respective package repositories. See the
[driver guide](integration-tests/DRIVERS.md), [testing guide](../testing/README.md)
and [package ownership](architecture.md#package-boundaries).

## Frontend organization

- Follows [Bulletproof React’s folder conventions](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md), without changing runtime behavior or existing dependency boundaries.
- `src/web/app/` owns startup, composition, transport binding (`lib/`), application state (`stores/`), hooks, shell and overlays.
- `src/web/features/` contains `chat/`, `sessions/`, `settings/` and `extensions/`. Each retains its capability modules, such as `sessions/inbox/` and `chat/composer/`.
- Within a capability, `components/` owns views and containers, `hooks/` owns React coordination, `stores/` owns stateful providers, `lib/` owns storage/I/O adapters and `utils/` owns pure rules. Only needed folders exist; there are no `domain/`, `infra/` or nested feature `app/` layers.
- Shared `components/`, `hooks/`, `config/`, `lib/`, `types/` and `utils/` sit directly under `src/web/`. Shared primitives and theme modules do not import app or feature presentation.
- Keep `*Container` names for state/context wiring and `*View`/prop-driven components for presentation. A container is not necessarily a navigable page; existing Home/Inbox page components retain their names. CSS modules stay beside their components.
- Module tests and local fixtures live in `__test__/` inside their module, for example `features/chat/composer/__test__/`. Cross-feature scenarios, reusable drivers and runner setup live in root `testing/`.
- Prefer direct file imports. Server settings retains its existing entry at `features/settings/server/index.ts`; no new barrel files or cross-feature import restrictions are introduced.
- Existing composition remains explicit: `usePiChat` coordinates Inbox lifecycle and endpoint loading; `AppControllerProvider` composes prompt presentation, theme, drafts and file actions. Feature containers still consume app context, and rich prompts still reuse chat’s lazy Markdown renderer.
- `AppOverlays` assembles prompts, session dialogs, navigation, folders and Settings. Settings stays mounted while closed to preserve chime playback. App owns Home/transcript selection, responsive workspace geometry and composer height.
- Global layer order, Markdown styles, widget container queries and shared animations remain in `app/styles.css`; widget rendering, geometry and placement remain separate modules under `features/extensions/widgets/`.

See the [architecture overview](architecture.md) for state ownership and runtime flow, and the [testing guide](../testing/README.md) for placement and workflow coverage.
