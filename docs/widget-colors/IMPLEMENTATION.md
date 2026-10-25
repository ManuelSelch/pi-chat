# Colored widgets — implementation and verification

## Implemented boundaries

- Independent `pi-server` revision: `0f04d8768b3f97bc81335a4f19836cc9000104f5` (`feat: preserve themed ANSI widgets through server transport`).
- Chat uses `fancy-ansi@0.2.2` to render widget strings as ANSI-styled plain text. Markdown syntax remains literal in widgets; ordinary chat Markdown is unchanged. Disclosure, responsive placement and dock behavior remain intact.
- Widget strings retain SGR styling through server normalization, snapshots, presentation events and SDK state. Color-only changes publish; identical styled content remains suppressed. Styled trailing blank lines are trimmed, and empty/undefined content clears the widget.
- Widget text is joined once with newlines. ANSI state spans lines but not widgets/renders. CSS preserves whitespace and wraps long words; hyperlinks remain disabled.
- Notifications, status labels and dialog fields retain plain-text normalization after the real theme replaces the identity theme.

## Headless theme compatibility seam

The pinned Pi 1.0.2 package publicly exports `Theme` but not its built-in theme loader. Server `src/runtime/pi/infra/headless-theme.ts` resolves the loader and dark palette relative to the installed package entry. It explicitly selects truecolor, does not initialize global terminal state, and starts no watcher.

Pi's convenience decoration methods use TTY-detected Chalk, which stripped decorations in the first failing test. The server's own theme instance delegates these methods to Pi's `Theme.style()` ANSI implementation instead. This preserves combined decorations without changing Chalk globally. Package/installed-consumer and real-browser tests exercise this pinned internal compatibility seam; reverify it when upgrading Pi.

## Temporary server dependency

The user approved a local packed server for testing. Chat pins:

- Archive: `vendor/pi-server-0.1.0-widget-colors-0f04d87.tgz`.
- SHA-256: `072941c868c3f99b6ab14704f3425cd9a8b5263522874a49eb78ed7969d24b44`.
- Source/checksum receipt: [widget-colors-server.json](../../vendor/widget-colors-server.json).

The manifest and lockfile reference that archive; tests verify SHA-256 provenance metadata and npm SHA-512 integrity. A clean source-only copy installed and tested successfully without the server checkout or patched installed files. The SDK remains registry-pinned to 0.1.0. Fancy-ANSI's optional Tailwind peer is satisfied by Chat's existing Tailwind 4 dependency; no plugin or additional framework was introduced.

Nothing was published, pushed, merged into Chat main or installed into a live service. After separate server-publication approval, replace the temporary server pin with a registry release and remove its archive/receipt, preserving the unrelated Swift fixture.

## Verification results

Tests were developed red → green for ANSI retention, color-only updates, styled trimming, real headless decorations, plain-text dialogs and the replacement widget renderer.

| Check | Result |
|---|---|
| Server `npm run typecheck` | Pass |
| Server `npm run test:unit` | 435 tests / 60 files pass |
| Server `npm run test:package` | 16 compiled package scenarios pass |
| Server `npm run verify:package` | Fresh packed install and the same 16 compiled scenarios pass |
| Chat `npm test` | 716 tests / 88 files pass after the named-widget driver refactor |
| Chat `npm run build` | Dependency verification, typecheck, host and web build pass |
| Chat `npx playwright test` | 36 pass; 1 existing coverage-only test skipped |
| Chat `npm run test:swift-integration` | 2 pass |
| Chat `npm run test:production-smoke` | Real isolated launcher, health/UI, failed-build retention, rebuild/restart, PID/log/signal shutdown pass |
| Clean source-only Chat copy | `npm ci --ignore-scripts`, documented harness compilation, all 707 unit tests, build and both widget browser scenarios pass |

The server transport scenario uses the production UI context, normalization registry, real loopback server, schemas and SDK to verify initial themed state, color-only changes, explicit snapshots, reconnect and clearing.

The widget browser scenarios use `app.Widgets.named(key)` handles with `show(text, { color, styles })`, `updateStyle(...)`, rendering assertions and `clear()`. The small driver delegates to explicit `app.Extensions.setWidget(key, content)` and `clearWidget(key)` inputs through a real Pi extension context in the installed packed server, not fabricated presentation events or artificial slash commands. Color-only updates retain text and decorations; the style list replaces rather than accumulates. Repeated names share a handle; different widget keys retain separate inputs. The fixture retains the live extension context, so its `ctx.ui` getter reaches the server's bound UI rather than freezing the harness's initial UI. It rejects missing/ambiguous sessions instead of silently targeting a different runtime; single-session fixtures are the current supported scope.

Four focused browser scenarios cover color/decorations/update/reload/clear separately from multiline/HTML/layout edge cases in both docked and composer layouts. Three fixture tests cover real registration/update/clear, lifecycle/ambiguity guards and app isolation. Six named-driver tests cover style preservation/replacement/reset, shared handles and key isolation, copying mutable inputs, update lifecycle guards and rejected updates. Typecheck, the full 716-test unit suite and all 36 ordinary browser tests passed after the test-only refactor; the existing coverage-only test remains skipped. No model calls are needed. All test metadata and runtimes are isolated from live sessions.

## Deferred behavior and warnings

- OSC handling is deferred as requested. Unknown OSC payloads, C1 controls, malformed controls, hidden SGR, carriage returns and backspaces retain Fancy-ANSI's limitations described in [the probe](ANSI-PROBE.md). This is not a terminal emulator or comprehensive sanitizer.
- Representative HTML-injection cases remain inert, but generated-HTML rendering is not claimed to constitute a full security audit.
- Swift integration verifies its existing lifecycle scenarios, not Swift-side ANSI rendering parity.
- Current `npm ci` reports 17 dependency advisories (4 low, 5 moderate, 5 high, 3 critical). No unrelated dependency upgrades/audit fixes were made. Vite still reports the large-chunk warning.
- Verification ran locally under Node 26.5.0; no remote CI or live rollout is claimed.
