# Tests

- **`modules/`** — unit, DOM, and boundary tests grouped like `src/`.
- **`scenarios/`** — user workflows grouped by feature, using `app.*` drivers.
- **`infra/`** — reusable drivers, fixtures, clients, and fakes.
- **`infra-tests/`** — tests of that reusable machinery.
- **`e2e/`** — visible Chromium workflows driven through Playwright.
- **`setup.ts`** — shared Vitest setup.

Keep test cases out of the root folder. Separate scenario phases with blank lines.
Use the [driver guide](../docs/integration-tests/DRIVERS.md) for application-driver
boundaries, setup and assertion semantics. Scenario outcomes are reviewed before
behavior changes; changed/removed assertions or weakened driver semantics require
renewed approval. Missing scaffolded methods must throw, not silently pass.
Scenarios use real Pi sessions and WebSocket transport, not a rendered browser. They embed the installed server through its public API; server-internal suites now live in the independent `pi-server` repository. Chat retains `modules/host` build/environment/extension identity tests. Swift SDK unit and real-server integration tests belong to [pi-sdk-swift](https://github.com/ManuelSelch/pi-sdk-swift/tree/main/integration), not this repository. `infra-tests/loopback-fixture.test.ts` retains plain-Node package safety checks for the public fixture (private workspace, rejected caller paths, and cleanup-file/symlink overwrite protection), without Swift sources or toolchain requirements. `npm run test:production-smoke` exercises the real extension launcher and successful/failed build-before-restart lifecycle in isolated storage/ports.

`e2e/skills.spec.ts` covers skill command discovery/selection, compact invocation and read cards, reload, per-tab resources, disabled discovery, and skill steering during streaming (including reconnect). `e2e/chat.spec.ts` also verifies that `!` / `!!` remain blocked during steering. `app.Tabs.Create({ skills, responses })` installs temporary skills per session; response `readSkill` scripts a real SDK read before its reply. Only the model stream is scripted. Skill UI selectors and assertions live in `app.Skills`.

## E2E coverage

Import `test` (and `expect`) from `infra/e2e/coverage/fixtures.ts` in browser specs,
not directly from Playwright, so opt-in coverage starts before navigation and
flushes before page teardown. Navigations must checkpoint through the browser
driver. `e2e/coverage.spec.ts` verifies real reload retention; `infra-tests/e2e/coverage/`
checks collection and conversion guards. See [coverage commands and scope](../docs/development.md#e2e-coverage).

## Composer focus regressions

[DOM focus tests](modules/web/app/composer-focus.dom.test.tsx) and
[browser focus scenarios](e2e/composer-focus.spec.ts) cover restoration after
loading, tab changes, overlay exits, nested confirmations and prompt handover.
See [current focus ownership](../docs/architecture.md#focus-and-overlays).
Browser assertions check focus before keyboard typing; do not replace them with
`fill()`, a composer click or explicit focusing, which would conceal a regression.

`infra/ui/finish-ui-transitions.ts` lets React commit between simulated transition
phases. Delayed-commit regressions deliberately batch exit plus the former frame
window to expose stale-DOM ordering; both kinds of tests remain meaningful.
Browser waits observe actual overlay detachment, not a guessed animation delay.
DOM tests cannot establish real Chromium focus/geometry; retain both boundaries.

```sh
npm test -- test/modules/web/app/composer-focus.dom.test.tsx
npm run build
npx playwright test test/e2e/composer-focus.spec.ts
# Coverage requires the source-map build:
PI_CHAT_COVERAGE=1 npm run build
node scripts/run-playwright-coverage.mjs test/e2e/composer-focus.spec.ts --workers=2
```

## Contract locations

These are permanent checks, not a second prose specification or a promise of
complete legacy coverage. Review actual assertions and driver semantics for the
change in question; historical counts/logs are not current verification.

| Area | Existing contract locations |
|---|---|
| SDK protocol/public package boundary | [SDK contract](modules/shared/sdk-contract.test.ts), [client](modules/shared/sdk-client.test.ts), [dependency fixtures](infra-tests/npm-dependencies.test.ts), [server boundary](infra-tests/server-boundary.test.ts) |
| Host commands, build/restart and trusted executable lookup | [extension commands](modules/extension/pi-chat-commands.test.ts), [restart build](modules/host/restart-build.test.ts), [signal](modules/host/restart-signal.test.ts), [npm lookup](modules/shared/node/npm-command.test.ts), [production smoke](../scripts/production-server-smoke.mjs) |
| Prompt/reply, abort, steering and reconnect | [Chat scenarios](scenarios/chat/), [browser-connection scenarios](scenarios/browser/), [tab scenarios](scenarios/tabs/) |
| Session title projection and rename removal | [title rendering](modules/web/app/shell/session-title.dom.test.tsx), [settings](modules/web/settings/settings-drawer.dom.test.tsx) |
| Quick Switcher and shared local actions | [browser navigation](e2e/quick-open.spec.ts), [action guards](modules/web/sessions/actions/session-actions.test.ts), [menu parity](modules/web/sessions/actions/shared-menus.dom.test.tsx) |
| Projects, worktrees, pins and archive | [project model](modules/web/sessions/projects/project-panel-model.test.ts), [archive](e2e/project-archive.spec.ts), [pins](e2e/project-pin.spec.ts), [sidebar](e2e/projects-sidebar.spec.ts) |
| Inbox and page-lifetime drafts | [Inbox lifecycle](modules/web/sessions/inbox/app/inbox-lifecycle.dom.test.tsx), [drafts](modules/web/sessions/drafts/app/session-drafts.dom.test.tsx), [browser Inbox](e2e/session-inbox.spec.ts), [labels](e2e/inbox-worktree-labels.spec.ts) |
| Completion, bash display and streaming guards | [argument semantics](modules/web/chat/composer/argument-completion.test.ts), [composer interaction](modules/web/chat/composer/composer-completion.dom.test.tsx), [bash cards](modules/web/chat/bash/bash-card.dom.test.tsx), [browser chat](e2e/chat.spec.ts) |
| Files, links, Markdown and edit/read/write rendering | [local links](modules/web/chat/markdown/local-link.test.ts), [file actions](modules/web/chat/markdown/file-actions.dom.test.tsx), [file content](modules/web/chat/tools/file-content.dom.test.tsx), [write content](modules/web/chat/tools/write-content.test.ts), [edit lifecycle](modules/web/chat/tools/edit-diff-lifecycle.test.ts) |
| Rich prompts, answer drafts and explicit Stop | [prompt model](modules/web/extensions/prompts/prompt-drafts.test.ts), [presentation](modules/web/extensions/prompts/prompt-presentation.dom.test.tsx), [browser prompt workflows](e2e/prompt-presentation.spec.ts) |
| Widgets/OSC 8 and runtime/remembered themes | [widget DOM](modules/web/extensions/widgets/widget-panel.dom.test.tsx), [widget browser](e2e/widgets.spec.ts), [remembered theme](modules/web/app/theme/remembered-theme.dom.test.tsx), [browser themes](e2e/theme.spec.ts) |
| Coverage, loopback safety and showcase composition | [coverage machinery](infra-tests/e2e/coverage/), [fixture safety](infra-tests/loopback-fixture.test.ts), [showcase composition](infra-tests/readme-showcase.test.ts) |

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
