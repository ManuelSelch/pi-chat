# S3 — Standalone server repository

## Delivered

- Local repository: [pi-server](/Users/manuelselch/Documents/A_Personal/40%20Projekte/47%20Agents/Pi%20Agent/pi-server).
- Clean initial commit: **`f47dfedbda627e18d2a7f7936874f4dad67d1e04`** on `main`, attributed to Pi Chat **`d38192ed590574add58dd57c82e99e706a7680eb`**, package preparation `0388a1f`. No filtered history, remote creation, push or publication.
- Copied tracked S2 package sources unchanged, including compiled CLI, embedding/extensions/testing exports, fixture, independent lockfile and pinned bundled SDK. `SOURCE.json` records provenance and SDK revision/hash. No Chat/root configuration, Sonar settings, secrets, dependencies, build caches or runtime state copied.
- Repository owns its tests, diagnostics, Node 24 GitHub Actions workflow, coverage and usage/configuration/extension/protocol/ownership docs. TypeScript SDK remains protocol authority; generated SDK protocol sources were not duplicated.
- Migrated **53 of 56 server test files**, plus edit-diff, fake runtime, agent isolation and memory-metric suites: **57 files / 422 tests**. Kept feature layout and assertions; adapted positional Chat host calls to public options. The catalogue-blocking test spies on the private service rather than adding a public injection seam, and restores the spy after each test.
- Three adapter suites remain Chat-owned: `bootstrap/host-binding` (PI_CHAT environment), `bootstrap/restart-build` (npm build policy), `extensions/extension-registry-compatibility` (legacy import). Chat also retains UI/domain/browser drivers, mandatory Swift host scenarios, launcher and production web smoke. Nothing was deleted from Chat in S3.
- Source profiling and zero-session memory diagnostics moved with the server; the latter now invokes explicit standalone CLI flags and isolates agent/PID/log storage. Profile command is opt-in, uses real local settings/history/extensions and may create sessions; not run as extraction acceptance. Historical `verify-slice1.ts` uses obsolete v1 and real-model prompting, so was deliberately not imported. Chat's app-specific diagnostics remain there.

## Verification

- Red: migrated tests initially failed on old Chat source imports. Green: all **422 tests / 57 files** pass with standalone paths/APIs. No production source changes were needed after S2.
- Final revision was checked out in a fresh independent clone under a path containing spaces. Under **Node 24.22.1**: `npm ci --ignore-scripts`, typecheck, all 422 unit tests, **16 package/CLI/fixture tests**, coverage and packed-consumer verification pass; Git stays clean. The installed tarball runs without Chat/sibling sources, React/Vite/tsx or hoisting and validates public declarations and private-export rejection.
- Package scenarios cover health/headless, SDK initialize/create/close, explicit static SPA assets, signals, caller-owned logger, extension singleton, compiled fixture streaming/Stop/disconnect retention/path rejection/cleanup, supervised restart, no-build restart, relative paths with spaces and successor PID rewrite. The packed consumer repeats all 16 scenarios.
- Unit LCOV/text coverage: **80.62% statements / 76.78% branches / 79.89% functions / 84.21% lines**. CLI/compiled fixture subprocess scenarios are separate from this Vitest coverage and are not claimed as instrumented coverage.
- macOS/Xcode **26.1.1 / Swift 6.2.1**: the fresh extracted clone was packed/installed separately; pinned standalone SDK **34 Swift Testing + 6 XCTest probe tests** and Chat-owned **2 Swift host scenarios** pass through the installed compiled fixture with plain Node 24, without Chat sources or tsx at runtime. Chat's unchanged default source-fixture suite also passes both tests.
- Standalone TypeScript SDK: **174 tests / 12 files**, test typecheck, offline packed consumer and protocol regeneration/drift pass on installed Node **26.5.0**, leaving its repository clean. An attempted npx-provided Node 24 run hit that SDK's existing adjacent-npm-path assumption (173 passed / 1 failed); it is not claimed as a Node 24 standalone-SDK pass. Server/packed/Swift acceptance itself passed under Node 24.
- A separate fresh SwiftPM executable pinned literal Git path/revision `73fae38f75c0e5eb80515c9ffa76876542097e7d` compiled/ran. Consumer uses macOS 15, matching SDK minimum; macOS 14 was rejected by SwiftPM as expected. No SDK repository changes.
- Pi Chat regression: explicit source-only harness compilation, production build/typecheck, **1,124 tests / 141 files**, **32 browser tests / 1 pre-existing skip**, **2 default Swift host tests** and isolated production health/UI/PID/log/shutdown smoke pass. No live backend takeover.
- Source/compiled memory diagnostic smoke passes with short isolated samples. Existing Vite warnings remain; independent npm install reports **3 moderate advisories**, not silently auto-fixed. CI configuration was checked through equivalent local commands; no remote workflow execution, full Swift parity or real-model conversation is claimed.

## Reproduction and next step

From an independent fresh server clone:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run test:coverage
npm run verify:package
```

On macOS, from Pi Chat, with server dependencies installed in the target checkout:

```sh
npm run test:server-package:swift -- "<independent pi-server checkout>"
```

The optional package-root argument is the only Chat test-tooling change; it does not switch Chat's runtime dependency. The harness still owns its pinned Swift bundle and scenarios. No sibling repository is needed for the server's own install/build/tests/CI.

**S4 is still pending:** pin server package bytes/version/source/SHA-256 in Chat, migrate public imports and launcher/fixture/build/CI/coverage ownership, verify source-free fresh consumers, then delete duplicated sources/helpers/tests. Until then, Chat's original implementation and temporary `packages/pi-server` are retained; reconcile any intervening fixes before cutover. Runtime configuration/credentials/sessions remain under `~/.pi/agent`; no applications relocated.

Rollback: retain the attributed Chat revision and earlier rollback revisions; before S4 simply keep Chat's existing server dependency. Never reset unrelated user changes or remove SDK repositories. Resolve source licensing before publication; extraction does not create a license grant or authorize remote deployment.
