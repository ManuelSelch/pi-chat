# Tests

- **`modules/`** — unit, DOM, and boundary tests grouped like `src/`.
- **`scenarios/`** — user workflows grouped by feature, using `app.*` drivers.
- **`infra/`** — reusable drivers, fixtures, clients, and fakes.
- **`infra-tests/`** — tests of that reusable machinery.
- **`e2e/`** — visible Chromium workflows driven through Playwright.
- **`setup.ts`** — shared Vitest setup.

Keep test cases out of the root folder. Separate scenario phases with blank lines.
Scenarios use real Pi sessions and WebSocket transport, not a rendered browser. They embed the installed server through its public API; server-internal suites now live in the independent `pi-server` repository. Chat retains `modules/host` build/environment/extension identity tests. Swift SDK unit and real-server integration tests belong to [pi-sdk-swift](https://github.com/ManuelSelch/pi-sdk-swift/tree/main/integration), not this repository. `infra-tests/loopback-fixture.test.ts` retains plain-Node package safety checks for the public fixture (private workspace, rejected caller paths, and cleanup-file/symlink overwrite protection), without Swift sources or toolchain requirements. `npm run test:production-smoke` exercises the real extension launcher and successful/failed build-before-restart lifecycle in isolated storage/ports.

`e2e/skills.spec.ts` covers skill command discovery/selection, compact invocation and read cards, reload, per-tab resources, disabled discovery, and skill steering during streaming (including reconnect). `e2e/chat.spec.ts` also verifies that `!` / `!!` remain blocked during steering. `app.Tabs.Create({ skills, responses })` installs temporary skills per session; response `readSkill` scripts a real SDK read before its reply. Only the model stream is scripted. Skill UI selectors and assertions live in `app.Skills`.

## E2E coverage

Import `test` (and `expect`) from `infra/e2e/coverage/fixtures.ts` in browser specs,
not directly from Playwright, so opt-in coverage starts before navigation and
flushes before page teardown. Navigations must checkpoint through the browser
driver. `e2e/coverage.spec.ts` verifies real reload retention; `infra-tests/e2e/coverage/`
checks collection and conversion guards. See [coverage commands and scope](../docs/development.md#e2e-coverage).

## Composer focus regressions

`modules/web/app/composer-focus.dom.test.tsx` and `e2e/composer-focus.spec.ts` cover restoration after session loading, tab changes, overlay exits, nested confirmations, and extension-prompt handover. See [the red-to-green results and reproduction commands](../docs/composer-focus/REGRESSIONS.md). Browser assertions check focus before keyboard typing; do not replace them with `fill()` or explicit focusing. Simulated-clock tests use `infra/ui/finish-ui-transitions.ts` to let React commit between transition phases, rather than batching the entire lifecycle in one timer advance.

## Run

```sh
npm test                         # All tests
npm test -- test/modules         # Module tests
npm test -- test/scenarios       # User workflows
npm test -- test/infra-tests     # Test machinery
npx playwright install chromium  # Once per machine
npm run test:e2e                 # Build and run Playwright E2E tests
npm run build                   # Typecheck and build
```
