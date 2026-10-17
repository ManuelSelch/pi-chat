# Tests

- **`modules/`** — unit, DOM, and boundary tests grouped like `src/`.
- **`scenarios/`** — user workflows grouped by feature, using `app.*` drivers.
- **`infra/`** — reusable drivers, fixtures, clients, and fakes.
- **`infra-tests/`** — tests of that reusable machinery.
- **`e2e/`** — visible Chromium workflows driven through Playwright.
- **`setup.ts`** — shared Vitest setup.

Keep test cases out of the root folder. Separate scenario phases with blank lines.
Scenarios use real Pi sessions and WebSocket transport, not a rendered browser.

`e2e/skills.spec.ts` covers skill command discovery/selection, compact invocation and read cards, reload, per-tab resources, disabled discovery, and skill steering during streaming (including reconnect). `e2e/chat.spec.ts` also verifies that `!` / `!!` remain blocked during steering. `app.Tabs.Create({ skills, responses })` installs temporary skills per session; response `readSkill` scripts a real SDK read before its reply. Only the model stream is scripted. Skill UI selectors and assertions live in `app.Skills`.

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
