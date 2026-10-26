# Custom Server Endpoint — Verification

Implemented the approved design and mockup revision 1. User approval: “yes looks good. approved. implement”. The agent-owned mockup Vite process was stopped and its listener/process exit verified before production edits; approved files remain under `mockups/custom-server/`.

- Settings → Backend server supports an explicit WebSocket URL, browser-local persistence, confirmation before save/reset reload, redacted current-endpoint display, validation and storage errors.
- Startup consumes the stored override once per mount; no override preserves the original page-derived URL/query. Bad stored values fall back with a Settings warning. Failed connections do not silently revert.
- No SDK/server/dependency/origin-policy changes. Existing server runtimes survive disconnect; unsent drafts do not survive reload. The mockup's simulated connection/persistence is replaced by real browser storage and the SDK connection.
- Layout uses the existing production Panel/SectionHeader/Mantine controls; the panel remains independent of session capability availability. The live badge additionally distinguishes initial Connecting from Disconnected.

## Checks run

All configured pipeline suites passed, serially:

- Build, public dependency verification and TypeScript check.
- Unit/DOM: **779 tests across 94 files**.
- Browser: **43 passed**, one existing coverage-only test skipped outside coverage mode.
- Isolated production lifecycle smoke.
- `git diff --check`.

Four new real-browser scenarios verify confirmed/cancelled saving, restoration after reload, reset, write denial without disconnect, failed-path recovery without stale tabs/draft replay or runtime closure, and actual HTTP 403 rejection for another host followed by recovery. Unit/DOM checks cover default/override rules, URL validation, invalid/unavailable storage, save/reset failures, confirmation sequencing and disconnected controls. Initial browser cancellation assertion was corrected to preserve the unsaved field while checking that the connection/storage remained unchanged; all four scenarios then passed, including the full-suite rerun.

Existing Vite chunk-size warning remains. No live homelab/proxy deployment, live service restart, push, publication or server allowlist change was performed.
