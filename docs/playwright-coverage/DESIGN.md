# Playwright Coverage — Design

Status: Proposed; requires approval before implementation.

## Approach

Collect native Chromium JavaScript coverage during the existing Playwright scenarios, convert it to source-mapped LCOV, and let Sonar import it alongside Vitest coverage. Keep the production-like browser build uninstrumented. Scope follows the preceding coverage discussion; no separate requirements document exists for this change.

Confirmed current behavior: Vitest excludes `test/e2e`; Sonar imports only `coverage/lcov.info`. Browser scenarios serve `dist/web` through an in-process TypeScript server created by `PiChatBrowserDriver`, not a separate production-server process. Browser coverage therefore does not measure backend execution.

## Components & Data Flow

- **Changed:** `vite.config.ts` enables source maps only when `PI_CHAT_COVERAGE=1`. The CI build job opts in; ordinary builds remain unchanged. Its existing artifact carries bundles and maps into E2E.
- **New:** `test/infra/e2e/coverage/` owns collection and a shared Playwright fixture. Scenarios import its extended `test`; coverage mechanics stay out of scenario bodies.
- **Changed:** `BrowserBrowserDriver.Reload` checkpoints coverage before reloading, then starts a fresh collection interval before navigation. Other navigation methods must use the same helper. Session tabs are application tabs on one browser page, not additional Playwright pages.
- **New:** `scripts/report-playwright-coverage.mjs` converts per-test raw data into `coverage-e2e/lcov.info` using the development-only `monocart-coverage-reports` dependency.
- **Changed:** package scripts, `.gitignore`, CI workflow and Sonar report paths wire the opt-in run, artifact upload/download and import.

Flow: coverage-enabled build → Playwright raw segments → E2E LCOV artifact → Sonar imports Vitest and E2E reports.

## Key Implementation Details

The fixture starts collection before driver startup/navigation and flushes in teardown, including failed tests, before Playwright closes the page. Use test/retry/worker-specific output paths; clean only E2E outputs once per run. Collection is disabled during ordinary Playwright runs.

```ts
await page.coverage.startJSCoverage();
// Driver actions exercise the application.
const segment = await page.coverage.stopJSCoverage();
```

Do not rely on `resetOnNavigation: false`: Chromium can still discard navigation coverage. Explicitly save each pre-reload segment, restart collection, then reload. Tests must prove both sides survive. New browser pages/popups are outside the current scenarios; future support must install collection before their first navigation.

The converter resolves source maps from local `dist/web`, so reporting does not require the temporary server to remain running. Normalize original paths to repository-relative `src/...`; filter out dependencies, generated bundles, tests and declarations. Reject empty reports, missing application maps and unresolved application paths rather than silently uploading misleading coverage.

```properties
sonar.javascript.lcov.reportPaths=coverage/lcov.info,coverage-e2e/lcov.info
```

Sonar waits for both `unit` and `e2e`, downloads both artifacts, and combines coverage for matching source paths. Do not average percentages or concatenate LCOV manually. Preserve Vitest’s existing source denominator and exclusions.

## Complexity Guardrails

No production instrumentation, custom CDP framework, test-driver rewrite, coverage exclusions to inflate results, or new percentage target. Add only the report-conversion dependency. Backend E2E coverage and SDK coverage are separate work; `NODE_V8_COVERAGE` on a standalone server would not cover this suite’s in-worker server automatically.

## Verification

Test path normalization/filtering, invalid maps and isolated output names. Add a deterministic browser regression covering distinct code before and after reload and verify both appear under original source paths. Check failure teardown, disabled-mode behavior and representative TSX mapping. Run existing Vitest/build/Playwright checks and inspect Sonar import logs for unresolved paths. No particular percentage increase is promised.

## Decisions for Approval

- Include browser coverage only; defer backend/SDK collection.
- Add `monocart-coverage-reports` and coverage-only source maps.
- Require successful E2E coverage generation before Sonar analysis, increasing analysis latency and coupling it to browser-test success.
