# S4 — Pi Chat server consumer cutover

## Delivered boundaries and pins

- Implemented on `feat/server-consumer-cutover`, implementation commit `5ba233e`; primary/live backend not replaced. Pre-cutover rollback revision is **`5508e42`**. Earlier SDK and extraction rollback revisions remain in history.
- Chat installs private **`@manuelselch/pi-server@0.0.0`** from `vendor/manuelselch-pi-server-0.0.0.tgz`, with independent server revision **`0c08c5bc4c6d7e05ff0c157aadf97226bfda6306`**, original Chat source **`d38192ed590574add58dd57c82e99e706a7680eb`**, SHA-256 **`f4ce8b8a3aef43a0e932438fea29ce619756f6289cdc31e1b5dcfa9efc3a8bef`**. [Receipt](../../vendor/server-artifact.json), lockfile and tarball are committed together. `verify:server` checks provenance/hash/public import; `verify:dependencies` checks server and SDK artifacts.
- SDK pins are unchanged: TypeScript `a3edbcdfbb88b83ef773d9f966ff9ab35115d661`, Swift `73fae38f75c0e5eb80515c9ffa76876542097e7d`. Server bundles its SDK; Chat directly pins its browser SDK. No unpublished registry release, sibling checkout, parent workspace or private server source/distribution imports.
- Thin `src/host/index.ts` retains Chat settings, static assets, PID/log tracking, signals and supervision behavior through public embedding. `src/host/restart-service.ts` injects trusted `npm run build` policy into generic server restart. `build:host` emits `dist/host/index.js`; start/dev/extension launcher use the new entry. Standalone default remains no-build/headless.
- Domain/browser drivers use public server APIs, structural runtime contracts and `createPiRuntimeAdapter`. Browser catalogue injection uses public options. Driver failure injection moved to the test-owned world rather than spying on private runtime classes. The fake and Swift loopback fixture use compiled testing exports; the default Swift launcher is plain Node, no tsx.
- Known extensions/examples/docs use `@manuelselch/pi-server/extensions`. The old source registry alias is deliberately removed; registration names and `Symbol.for("pi-chat.extension-registry")` remain unchanged. Register local extension-bearing packages explicitly by path; runtime settings/credentials/sessions remain under `~/.pi/agent` and existing registered paths are not moved.
- Removed both `src/server` and staged `packages/pi-server`, server-only shared bash/edit/title helpers, copied server tests/fakes/fixture and obsolete build/dependencies/package CI. Server memory/profiling diagnostics live only in its repository; obsolete v1 `verify-slice1` was removed. Express/Zod/type dependencies are no longer declared by Chat; Pi runtime test dependencies remain required by the real-Pi driver.

## Coverage and ownership

- Server owns **425 tests / 58 files** plus **16 compiled package scenarios**. Three write-content mapping/history assertions formerly misplaced in Chat's web test tree were preserved in server commit `0c08c5b`; Chat retains the projected live/snapshot assertion and session-title presentation test without private mapping imports.
- Chat owns host-binding, npm build policy and public extension singleton tests, domain/browser/UI suites, mandatory Swift host integration and expanded lifecycle smoke. Legacy source-alias comparison was replaced with public singleton/symbol/registration/reset assertions, not kept as a private compatibility path.
- Chat LCOV includes only `src/web`, `src/host` and `src/shared`; SDK/server coverage belongs to their repositories. E2E still requires executed browser coverage, exact maps/transforms and valid local source paths, but no longer demands removed server-source records. Host coverage is provided by Vitest/lifecycle tests, not invented from dependency JS. Sonar reporting and CI build artifacts reflect this split.
- The independent package-preparation CI workflow was removed; server CI now belongs to its repository. Chat's existing Node24 build/unit/browser/macOS Swift jobs remain; build additionally runs isolated launcher/restart smoke. That real rebuild preserves `PI_CHAT_COVERAGE=1` so uploaded `dist/` retains maps for E2E. No remote CI execution is claimed.

## Verification and red/green evidence

- Artifact tests first failed because verifier/package did not exist; now checksummed installed public host creation/disposal passes, and modified bytes/unsafe paths fail. Source-boundary test first failed while copies existed; now rejects old/private imports and requires source-free layout.
- Before removal: **1,132 unit tests**, **33 browser tests with coverage**, **2 Swift host tests**, production build/typecheck and expanded production lifecycle smoke passed against the installed server. Only then removed duplicates.
- After removal, repeated in the worktree and a **fresh Git clone of `5ba233e` in a path containing spaces**, with no sibling sources or previous build/dependency caches: `npm ci --ignore-scripts`, explicit pinned source-only harness compilation, **703 tests / 86 files**, unit coverage, production build/typecheck, **33 browser tests + E2E LCOV**, **2 Swift host tests**, production lifecycle smoke, clean Git diff. The decrease reflects test ownership transfer, not silently skipped server assertions.
- Fresh-clone Vitest coverage: **92.44% statements / 89.15% branches / 88.29% functions / 95.38% lines**. Browser report: **71.25% lines**. Browser reload coverage test is enabled during coverage mode, hence 33 rather than the ordinary 32 plus one skip.
- Lifecycle smoke runs the actual extension start/stop commands and compiled host in private temporary storage and an isolated loopback port. It verifies readiness, health/UI, real npm build, failed-build retention with unchanged PID/listener and fresh SDK handshake, successful real rebuild/restart with successor PID rewrite, logs and shutdown. Only the intentional build-failure switch is synthetic. It never reads/stops/restarts the live service. Server restart has no session-scoped `operation.finished` event; tests observe exited build/PID/health instead of inventing one.
- Independently fresh server clone at the pinned revision: clean install/typecheck, **425 internal tests**, **16 direct package tests**, **16 repeated installed-tarball tests** and public declaration/export/CLI/static/restart/fixture verification pass.
- Independently fresh pinned TypeScript SDK clone: **174 tests / 12 files**, test typecheck, offline packed consumer, generated protocol drift pass. Pinned Swift bundle: **34 Swift Testing + 6 XCTest probe tests**; fresh revision-pinned Git SwiftPM macOS15 executable builds/runs. Both SDK source/artifact ownerships remain unchanged.
- Node **24.22.1**, Xcode **26.1.1 / Swift 6.2.1**. A temporary Node24 executable paired with trusted adjacent npm was used: npx Node alone lacks npm beside it and correctly fails the trusted-npm resolver. Installed Node26.5 exhibited an undici `setTypeOfService EINVAL` during early smoke diagnostics; acceptance used the approved Node24 baseline. No product workaround or baseline change.
- Existing Vite warnings and npm audit findings remain (fresh Chat install: **12 advisories: 4 low / 3 moderate / 2 high / 3 critical**); no unrelated dependency upgrades. No real-model conversation, full Swift conversation/dialog/reconnect parity, native-device verification, remote deployment, publication or license grant is claimed.

## Reproduction

From a fresh Chat clone with Node24 and npm installed together:

```sh
npm ci --ignore-scripts
npx --ignore-scripts tsc --ignoreConfig --noCheck --module nodenext --target es2022 --declaration --outDir node_modules/@marcfargas/pi-test-harness/dist node_modules/@marcfargas/pi-test-harness/src/*.ts
npm test -- --coverage
PI_CHAT_COVERAGE=1 npm run build
npm run test:e2e:coverage:run
npm run test:swift-integration # macOS/Xcode
node scripts/production-server-smoke.mjs
```

No server package/source installation step or sibling checkout is needed. Standard `npm run test:production-smoke` builds before running the same scenario. Independent server/SDK suites run in their own repositories.

## Handover and rollback

All short-plan extraction slices are delivered; full Swift parity remains follow-up. This branch is not a live rollout. Merging, starting/restarting a live backend, remote provisioning/push/publication require their respective user approval. No project commits were pushed.

For rollback, open an isolated checkout at `5508e42` (never reset unrelated work); its sources and earlier launcher are intact. Alternatively revert the cutover commits as a unit, restoring old source/build/CI/lock/artifact wiring together. Do not move/delete runtime credentials/history or independent SDK/server repositories. New changes belong in the independent server; update its committed package bytes/receipt/lock only after deliberate cross-repository verification. Resolve source licensing before publication.
