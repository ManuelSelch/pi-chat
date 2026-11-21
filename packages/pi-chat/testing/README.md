# Tests

- **`<module>/__test__/`** — unit, DOM and boundary tests beside the owning module in `src/` or `extension/`, including module-local helpers.
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
Scenarios use real Pi sessions and WebSocket transport, not a rendered browser. They embed the installed server through its public API; server-internal suites now live in the independent `pi-server` repository. Chat retains `src/host/__test__/` build/environment/extension identity tests. Swift SDK unit and real-server integration tests belong to [pi-sdk-swift](https://github.com/ManuelSelch/pi-sdk-swift/tree/main/integration), not this repository. `infra-tests/loopback-fixture.test.ts` retains plain-Node package safety checks for the public fixture (private workspace, rejected caller paths, and cleanup-file/symlink overwrite protection), without Swift sources or toolchain requirements. `npm run test:production-smoke` exercises the real extension launcher and successful/failed build-before-restart lifecycle in isolated storage/ports.

`e2e/skills.spec.ts` covers skill command discovery/selection, compact invocation and read cards, reload, per-tab resources, disabled discovery, and skill steering during streaming (including reconnect). `e2e/chat.spec.ts` also verifies that `!` / `!!` remain blocked during steering. `app.tabs.create({ skills, responses })` installs temporary skills per session; response `readSkill` scripts a real SDK read before its reply. Only the model stream is scripted. Skill UI selectors and assertions live in `app.skills`.

## Session storage isolation

- Worktree-command fixtures must pass an explicit session directory inside the disposable test project.
- The harness extension context retains its initial in-memory manager, even after TestWorld replaces the session's manager. Its `getSessionDir()` is undefined; passing that to `SessionManager.create` leaks files into the user's real Pi history.
- [TestWorld safety tests](infra-tests/pi-chat/test-world.test.ts) reject that fallback before it writes and verify replacement files disappear on disposal.

## E2E coverage

Import `test` (and `expect`) from `infra/e2e/coverage/fixtures.ts` in browser specs,
not directly from Playwright, so opt-in coverage starts before navigation and
flushes before page teardown. Navigations must checkpoint through the browser
driver. `e2e/coverage.spec.ts` verifies real reload retention; `infra-tests/e2e/coverage/`
checks collection and conversion guards. Both coverage reports exclude colocated
`__test__/` files; host builds exclude them too. See [coverage commands and scope](../../../docs/development.md#e2e-coverage).

## Composer focus regressions

[DOM focus tests](../src/web/app/__test__/composer-focus.dom.test.tsx) and
[browser focus scenarios](e2e/composer-focus.spec.ts) cover restoration after
loading, tab changes, overlay exits, nested confirmations and prompt handover.
See [current focus ownership](../../../docs/architecture.md#focus-and-overlays).
Browser assertions check focus before keyboard typing; do not replace them with
`fill()`, a composer click or explicit focusing, which would conceal a regression.

`infra/ui/finish-ui-transitions.ts` lets React commit between simulated transition
phases. Delayed-commit regressions deliberately batch exit plus the former frame
window to expose stale-DOM ordering; both kinds of tests remain meaningful.
Browser waits observe actual overlay detachment, not a guessed animation delay.
DOM tests cannot establish real Chromium focus/geometry; retain both boundaries.

```sh
npm test -- src/web/app/__test__/composer-focus.dom.test.tsx
npm run build
npx playwright test testing/e2e/composer-focus.spec.ts
# Coverage requires the source-map build:
PI_CHAT_COVERAGE=1 npm run build
node scripts/run-playwright-coverage.mjs testing/e2e/composer-focus.spec.ts --workers=2
```

## Transcript scroll regressions

- [Browser scenarios](e2e/transcript-scroll.spec.ts) assert that opening, switching and reloading a long session show the latest reply above the composer, while completion preserves manual scroll-up.
- DOM hook tests cover follow intent, delayed layout growth and StrictMode cleanup; they do not prove actual scrolling.
- Review opening/navigation outcomes separately from streaming opt-out. Do not infer preserved scroll intent just because a newly mounted transcript starts far from the bottom.
- `toBeVisible()` only proves rendering, not viewport placement. Scroll assertions must not scroll/focus the target into view themselves.

## Contract locations

These are permanent checks, not a second prose specification or a promise of
complete legacy coverage. Review actual assertions and driver semantics for the
change in question; historical counts/logs are not current verification.

| Area | Existing contract locations |
|---|---|
| SDK protocol/public package boundary | [SDK contract](../src/shared/__test__/sdk-contract.test.ts), [client](../src/shared/__test__/sdk-client.test.ts), [dependency fixtures](infra-tests/npm-dependencies.test.ts), [server boundary](infra-tests/server-boundary.test.ts) |
| Host commands, build/restart and trusted executable lookup | [extension commands](../extension/__test__/pi-chat-commands.test.ts), [restart build](../src/host/__test__/restart-build.test.ts), [signal](../src/host/__test__/restart-signal.test.ts), [npm lookup](../src/shared/node/__test__/npm-command.test.ts), [production smoke](../scripts/production-server-smoke.mjs) |
| Prompt/reply, abort, steering and reconnect | [Chat scenarios](scenarios/chat), [browser-connection scenarios](scenarios/browser), [tab scenarios](scenarios/tabs) |
| Session title projection and rename removal | [title rendering](../src/web/app/components/__test__/session-title.dom.test.tsx), [settings](../src/web/features/settings/__test__/settings-drawer.dom.test.tsx) |
| Quick Switcher and shared local actions | [browser navigation](e2e/quick-open.spec.ts), [action guards](../src/web/features/sessions/actions/__test__/session-actions.test.ts), [menu parity](../src/web/features/sessions/actions/__test__/shared-menus.dom.test.tsx) |
| Projects, worktrees, pins and archive | [project model](../src/web/features/sessions/projects/__test__/project-panel-model.test.ts), [archive](e2e/project-archive.spec.ts), [pins](e2e/project-pin.spec.ts), [sidebar](e2e/projects-sidebar.spec.ts) |
| Inbox and page-lifetime drafts | [Inbox lifecycle](../src/web/features/sessions/inbox/__test__/inbox-lifecycle.dom.test.tsx), [drafts](../src/web/features/sessions/drafts/__test__/session-drafts.dom.test.tsx), [browser Inbox](e2e/session-inbox.spec.ts), [labels](e2e/inbox-worktree-labels.spec.ts) |
| Completion, bash display and streaming guards | [argument semantics](../src/web/features/chat/composer/__test__/argument-completion.test.ts), [composer interaction](../src/web/features/chat/composer/__test__/composer-completion.dom.test.tsx), [bash cards](../src/web/features/chat/bash/__test__/bash-card.dom.test.tsx), [browser chat](e2e/chat.spec.ts) |
| Files, links, Markdown and edit/read/write rendering | [local links](../src/web/features/chat/markdown/__test__/local-link.test.ts), [file actions](../src/web/features/chat/markdown/__test__/file-actions.dom.test.tsx), [file content](../src/web/features/chat/tools/__test__/file-content.dom.test.tsx), [write content](../src/web/features/chat/tools/__test__/write-content.test.ts), [edit lifecycle](../src/web/features/chat/tools/__test__/edit-diff-lifecycle.test.ts) |
| Rich prompts, answer drafts and explicit Stop | [prompt model](../src/web/features/extensions/prompts/__test__/prompt-drafts.test.ts), [presentation](../src/web/features/extensions/prompts/__test__/prompt-presentation.dom.test.tsx), [browser prompt workflows](e2e/prompt-presentation.spec.ts) |
| Widgets/OSC 8, AppTheme and runtime-theme isolation | [widget DOM](../src/web/features/extensions/widgets/__test__/widget-panel.dom.test.tsx), [widget browser](e2e/widgets.spec.ts), [app theme](../src/web/lib/theme/__test__/app-theme.dom.test.tsx), [runtime cache isolation](../src/web/lib/theme/__test__/session-theme.dom.test.tsx), [browser themes](e2e/theme.spec.ts) |
| Coverage, loopback safety and showcase composition | [coverage machinery](infra-tests/e2e/coverage), [fixture safety](infra-tests/loopback-fixture.test.ts), [showcase composition](infra-tests/readme-showcase.test.ts) |

## Run

```sh
npm run lint                     # TypeScript naming conventions
npm run test:tooling             # Linter rule regression tests
npm test                         # All tests
npm test -- __test__              # Colocated module tests
npm test -- testing/scenarios       # User workflows
npm test -- testing/infra-tests     # Test machinery
npx playwright install chromium  # Once per machine
npm run test:e2e                 # Build and run Playwright E2E tests
npm run build                   # Typecheck and build
```
