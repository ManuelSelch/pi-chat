# Playwright Coverage — Design

Status: Approved and implemented; local verification passed. Remote Sonar import awaits CI.

## Approach

Collect native V8 coverage from Chromium and Playwright’s Node workers, convert it to source-mapped LCOV, and import it alongside Vitest coverage. Keep builds uninstrumented. Scope is root `src` only: frontend, backend and shared code. Both TypeScript and Swift SDKs remain excluded. Scope follows the conversation; no separate requirements document exists.

Confirmed current behavior: Vitest excludes `test/e2e`; Sonar imports only `coverage/lcov.info`. Browser scenarios serve `dist/web` through an in-process TypeScript server created by `PiChatBrowserDriver`, not a separate production-server process. Browser coverage therefore does not measure backend execution.

## Components & Data Flow

- **Changed:** `vite.config.ts` enables source maps only when `PI_CHAT_COVERAGE=1`. The CI build job opts in; ordinary builds remain unchanged. Its existing artifact carries bundles and maps into E2E.
- **New:** `test/infra/e2e/coverage/` owns collection and a shared Playwright fixture. Scenarios import its extended `test`; coverage mechanics stay out of scenario bodies.
- **Changed:** `BrowserBrowserDriver.Reload` checkpoints coverage before reloading, then starts a fresh collection interval before navigation. Other navigation methods must use the same helper. Session tabs are application tabs on one browser page, not additional Playwright pages.
- **New:** `scripts/report-playwright-coverage.mjs` converts browser segments and Node worker coverage into `coverage-e2e/lcov.info` using development-only `monocart-coverage-reports` (V8-to-LCOV conversion and source mapping).
- **Changed:** package scripts, `.gitignore`, CI workflow and Sonar report paths wire the opt-in run, artifact upload/download and import.

Flow: coverage-enabled build → browser segments + Node worker coverage → E2E LCOV artifact → Sonar imports Vitest and E2E reports.

## Key Implementation Details

The fixture starts collection before driver startup/navigation and flushes in teardown, including failed tests, before Playwright closes the page. Use test/retry/worker-specific output paths; clean only E2E outputs once per run. Collection is disabled during ordinary Playwright runs.

```ts
await page.coverage.startJSCoverage();
// Driver actions exercise the application.
const segment = await page.coverage.stopJSCoverage();
```

Do not rely on `resetOnNavigation: false`: Chromium can still discard navigation coverage. Explicitly save each pre-reload segment, restart collection, then reload. Tests must prove both sides survive. New browser pages/popups are outside the current scenarios; future support must install collection before their first navigation.

Launch Playwright with `NODE_V8_COVERAGE` pointing to an isolated raw-output directory before workers start. This captures the in-worker backend, including startup; run conversion after all workers exit and flush. Use an isolated `PWTEST_CACHE_DIR` to recover exact executed JavaScript alongside Node’s transform maps. Validate cache hashes, map identity and line lengths; do not approximate coverage using placeholder source text. Map back to `src/server/...` and reject unmapped application code.

Resolve browser maps from local `dist/web`, without a live server. Normalize paths to repository-relative `src/...`; exclude dependencies, generated bundles, tests, declarations and all `packages/` sources. Reject missing browser/backend data, missing application maps and unresolved application paths. Retain zero coverage for unexecuted root sources through Vitest’s existing include.

```properties
sonar.javascript.lcov.reportPaths=coverage/lcov.info,coverage-e2e/lcov.info
```

Sonar waits for both `unit` and `e2e`, downloads both artifacts, and combines coverage for matching source paths. Do not average percentages or concatenate LCOV manually. Preserve Vitest’s existing source denominator and exclusions.

## Complexity Guardrails

No production instrumentation, custom CDP framework, driver rewrite, artificial coverage exclusions or new percentage target. Add only the conversion dependency. Preserve `sonar.sources=src`; do not add SDK sources/tests or change SDK builds. SDK execution may occur, but its data is filtered out.

## Verification

Test normalization/filtering, invalid maps and isolated outputs. Prove distinct browser code before/after reload and an E2E-exercised backend method appear under original source paths. Verify SDK/test/dependency files are absent, unexecuted root files remain uncovered, worker-exit flushing, failure teardown and disabled mode. Run Vitest/build/Playwright checks and inspect Sonar import logs. No percentage increase is promised.

## Decisions for Approval

- Confirmed: Sonar waits for successful E2E completion; both SDKs are excluded for now.
- Approved: browser plus in-worker backend collection, `monocart-coverage-reports`, and coverage-only browser source maps.
