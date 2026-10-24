# npm dependency migration — Verification

- Both direct dependencies are pinned to npm version `0.1.0`; `npm ls` confirms pi-server uses the deduplicated SDK. The lockfile records registry URLs and integrity hashes.
- Removed the npm archives, server receipt/verifier and archive-specific tests. Swift fixture bundle/revision/hash verification remains independent of normal npm builds and tests.
- Regression checks failed against the previous vendored configuration, then passed with registry dependencies and Swift-only artifact verification.
- Clean `npm ci --ignore-scripts` succeeded; compiled the existing source-only test harness using the documented command.
- Full Vitest: **703 tests / 86 files passed**.
- Production build, TypeScript checks and installed-public-API/protocol verification passed. Existing Vite chunk-size/dynamic-import warnings remain.
- Production lifecycle smoke passed, including isolated launcher, failed-build retention, rebuild/restart, successor PID, logs and shutdown.
- Swift integration: **2 tests passed** against the installed server's isolated loopback fixture.
- Browser tests: **32 passed, 1 coverage-only test skipped**. The first run overlapped the production smoke's real build, temporarily removing shared `dist/web` assets and causing six startup failures. Confirmed the smoke rebuilds this worktree; reran the complete browser suite separately with no failures. Run these suites serially when they share build output.
- No package publication, push or explicit live-service restart was performed. Widget styling implementation remains separate.
