# Pi theme — S4 verification

## Delivered
- Chat consumes the already-pinned published SDK 0.1.1 and server 0.1.2; no dependency changes or installed-source patches.
- Application state projects the SDK-owned runtime theme map. A memoized provider below the controller and above file notices, shell and overlay providers applies only the selected runtime's palette.
- Exact Pi semantic anchors map to Mantine variables and existing named-color vocabulary, covering direct status-dot/card references as well as component props. Primary controls use contrasting labels; only missing interaction shades are derived. Neutral shades map to Pi surfaces/borders because Mantine components also read them directly.
- Message text/background, thinking text, selected tabs/native selection and diff backgrounds use their dedicated roles. Info notices use the Pi info surface. Layout, fonts, syntax-highlighting palettes, widget ANSI rendering and clearing behavior are unchanged.
- No theme persistence, refresh/reconnect requests, new wire payloads, selector or watcher. Missing runtime palettes use existing Mantine auto-scheme defaults.
- Custom-theme setup and cache/refresh/replacement limitations are documented in [configuration](../configuration.md#pi-themes).

## Executed verification
- Red/green adapter tests; DOM/socket integration also exposed and fixed provider ordering for file-error notices before moving the root Mantine provider.
- Theme unit/DOM checks: exact anchors in both appearances, derived interaction shades, contrasting primary labels, actual portalled Modal, local selection and background snapshots, ordinary snapshots, same-server reconnect, close/replacement/server-instance clearing, missing/null/invalid required-theme rejection, initialization without a palette.
- Isolated browser scenario uses actual custom Pi JSON files and Pi's loader, seeds the isolated harness resource list, then exercises the published server's resolver/socket, public SDK and production UI. No live model call or live resource discovery is claimed.
- Real browser computed styles cover dark/light page/text/status/borders and portalled Settings. A real extension emits Pi semantic ANSI, bold and literal RGB widgets. Explicit Pi reload retains the palette while clearing widget presentation; subsequent widget output remains correctly colored. Same-server reconnect, tab switching and browser-refresh fallback pass.
- Full Chat suite: **731 tests / 89 files**.
- Full browser suite: **39 passed, 1 existing coverage-only skip**.
- Production build/typecheck and dependency public-API verification passed; isolated production lifecycle smoke passed (readiness, health/UI, failed-build retention, rebuild/restart, successor PID, logs, shutdown). `git diff --check` passed.
- Existing Vite chunk-size warning remains. The server 0.1.2 bundled-SDK declaration/audit caveats remain as recorded in [S3 verification](S3-VERIFICATION.md); no unrelated remediation.

## Boundaries
- Only Chat changed; no server/SDK source changes, publication, version bump, push, remote CI/Sonar or Swift UI work.
- Only isolated test servers were started/restarted. The user's live service was not restarted.
- Browser refresh/initialization and runtime replacement without open/create still lack palette delivery by design. Theme-file edits and browser light/dark preferences do not refresh an existing runtime's resolved theme.
