# Readable pending prompts — implementation

Implements the approved [mockup](../../mockups/quiz-prompts/DESIGN.md) and the cross-package design in `~/.pi/agent/extensions/docs/quiz/DESIGN.md`.

## Delivered

- Existing select/editor dialogs accept explicit plain/Markdown bodies. Question choices use explicit Continue; ordinary literal menus remain immediate. The existing lazy Markdown pipeline supplies code/math without enabling raw HTML or remote prompt images.
- Minimize/reopen is browser-only. Drafts are keyed by server instance, runtime and prompt identity, survive tab changes/reconnects, and are removed on authoritative removal/replacement. They are not persisted across refresh.
- Answer requests guard duplicate submissions and retain failed drafts for retry. Offline/superseded views cannot answer, but questions can still be reopened for reading.
- Minimize releases modal focus/scroll ownership; exit focus falls back to Reopen while the composer is disabled. Escape while minimized does not answer/cancel/abort; explicit Stop cancels the pending work. Message submission and command completion wait for prompt settlement.
- Scoped server presentation uses the existing registry/lifetime. Expiry remains five minutes; disconnect grace remains 60 seconds. Neither timer pauses on minimize.

## Coordinated local packages

Chat pins committed archives and SHA-512 lockfile integrity:

| Package | Version | Source revision |
|---|---|---|
| `@manuelselch/pi-sdk` | 0.1.1 | `5b747dd14acd3fb176b0b7b59dd54bdae33334e8` |
| `@manuelselch/pi-server` | 0.1.2 | `df9dd1b` |

The server bundles the matching SDK snapshot. Its lockfile/receipt pins the archive, while the bundled manifest declares the matching exact SDK version so installed dependency validation remains healthy. Packed-consumer verification checks exports and compiled prompt-contract/helper bytes, not only version strings. There is no mixed-version fallback, publication, push or live restart.

The quiz tool and teach instructions are owned by the extensions/native-skills directories, not copied into Chat. Swift owns its imported contract artifacts and its separate server integration suite.

## Verification

- TypeScript typecheck and production build pass.
- Full unit/DOM suite: **844 tests / 101 files pass**.
- Full Chromium suite: **51 pass, one existing skip**. New real-Pi extension scenarios cover desktop/390px layouts, code/math/Unicode, explicit choice, minimize/reopen, tab retention, reading feedback while the next question is pending, empty reasoning, literal menus, and explicit Stop without submitting evidence.
- Production lifecycle smoke passes with an isolated launcher/server: readiness, UI/health, failed-build retention, rebuild/restart, successor PID/logs and shutdown. This does not restart the user's live server.
- `npm ls @manuelselch/pi-sdk @manuelselch/pi-server --all` passes.
- During parallel cross-repository verification an existing lazy write-content Markdown test exceeded its wait. The complete Chat suite passed on serial rerun; no unrelated test was changed.

Browser scenarios use deterministic fixtures through the actual Pi runner, public SDK helpers and installed server. They do not claim real-model teaching/assessment quality or visible terminal interaction acceptance.
