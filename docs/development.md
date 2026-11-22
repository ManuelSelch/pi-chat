# Development

## Workspace workflow

- Requires Node >=22.19; CI uses Node 24.
- Install once at the root with `npm ci --ignore-scripts`.
- `npm run dev` builds dependencies and watches SDK/plugin/Server compilation, Chat's host and Vite.
- `npm run build` builds SDK → folder plugin → Server → Chat and compiles the source-only test harness explicitly. `npm start` runs Chat from its package directory.
- Chat's package-local build/test hooks use root composition for dependency builds. No sibling checkout, candidate archive or Swift toolchain is required.
- The root manifest is private and contains orchestration only. Runtime dependencies, the Pi extension declaration, configs, assets, examples, mockups, retained plans and application tests belong to `packages/pi-chat`.
- [Workspace layout and history](monorepo.md), [Chat development](../packages/pi-chat/docs/development.md), [Server](../packages/pi-server/README.md), [SDK](../packages/pi-sdk-typescript/README.md).

## Verification

- Run the root Pi pipeline for lint, tooling, build, Chat tests, SDK/plugin/Server typing/tests/coverage, isolated tarball consumers, protocol drift, browser tests and production restart smoke.
- Focused commands: `npm test -- <filter>`, `npm run test:packages`, `npm run verify:packages`, `npm run verify:protocol`, `npm run test:e2e`, `npm run test:production-smoke`.
- Browser tests require Chromium: `npm exec -w pi-chat -- playwright install chromium`.
- Chat keeps colocated module tests plus package-local cross-feature scenarios and drivers. See the [testing guide](../packages/pi-chat/testing/README.md).
- Swift unit/probe and real-server compatibility tests remain in the separate [Swift SDK repository](https://github.com/ManuelSelch/pi-sdk-swift/tree/main/integration).
- Run suites serially when they share compiled assets; production restart smoke intentionally rebuilds them.

## CI and coverage

- The root [workflow](../.github/workflows/tests.yml) verifies all workspace packages. Chat build artifacts live in `packages/pi-chat/dist`; E2E downloads them there.
- Each package owns its local coverage output. `scripts/report-package-coverage.mjs` normalizes LCOV source paths for root Sonar analysis without conflating different packages' `src/` trees.
- `npm test -- --coverage` collects Chat unit coverage. `npm run test:e2e:coverage` collects browser/Chat-worker coverage. Raw E2E data stays package-local and is not uploaded.
- E2E conversion requires exact Playwright transform-cache/Node source maps and matching browser bundles; missing maps or sources fail. Browser execution is mandatory. Report scope remains Chat-owned source, not Server dependency execution.
- CI's Playwright container must match the lockfile. Only E2E runs inside it.
- Sonar waits for Chat unit/E2E and package verification, imports normalized LCOV and waits for its quality gate. Configure `SONAR_PROJECT_KEY`, `SONAR_ORGANIZATION` and `SONAR_TOKEN`; inaccessible fork secrets skip scanning. Local tests do not prove a remote quality gate passed.

## Runtime and extension development

- Chat's host owns `PI_CHAT_*` settings, assets, PID/log/signal lifecycle and the version route. Server owns execution, sessions, persistence and host plugins; SDK owns protocol and client projections.
- Register the Pi extension from `packages/pi-chat` rather than the private workspace root. `PI_CHAT_HOME`, when set, points to that package directory.
- Chat's managed restart still installs dependencies and builds before signaling replacement. Failed builds leave the current server running; install changes have no rollback guarantee.
- Consumers use compiled public package exports, never private source aliases. Chat's Vitest externalization preserves this boundary for workspace symlinks.
- Server diagnostics live in `packages/pi-server/scripts`; Chat screenshot tooling lives in `packages/pi-chat/scripts`.

## Documentation and scenarios

- Keep system architecture and development here in `docs/`; package-specific guides live alongside their owners.
- Preserve executable scenarios and driver assertions as behavioral contracts. Mechanical relocation does not authorize weakening assertions or changing user journeys.
- Retained Chat plans and approved mockups move with Chat, not into system docs. Do not delete them without acceptance and cleanup authorization.
- Maintain code and current-system docs together. Temporary proposals are not documentation of implemented reality.
