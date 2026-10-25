# Remove Chat Swift infrastructure — Slice 2 verification

Verified locally on 2026-10-25. Implements S2 of [the approved requirements](REQUIREMENTS.md); S3 remains separate.

## Removed ownership

- Removed Chat's SwiftPM integration harness and launcher, bundled Swift SDK and receipt, bundle checksum verifier and its obsolete test, npm Swift command, Swift-specific ignore entries, and macOS CI job.
- Updated current development, testing and vendor instructions. Historical extraction and earlier verification documents remain historical; their old Swift commands are not the current workflow.
- Added a boundary regression requiring Swift scripts/artifacts/harness to remain absent and forbidding Swift/macOS wiring in Chat's workflow.
- Retained the temporary colored-widget server archive, receipt, manifest dependency and lockfile unchanged.

The old harness, including its clean ignored SDK checkout and build caches, was moved to a temporary backup rather than discarded.

## Coverage retained

Before removal, reran the independent pi-sdk-swift integration suite at commit `b9ad3e0`: both real-server compatibility scenarios pass. That repository owns Swift create/stream/Stop/disconnect/reattach/shutdown testing.

Chat's four plain-Node fixture safety checks were retained as `infra-tests/loopback-fixture.test.ts`, with `LoopbackFixtureDriver` generating a private launcher for the installed public server export. They no longer use any Swift files or tools. These cover rejected caller-selected output paths, canonical/private loopback workspace, and refusal to overwrite existing cleanup files or symlinks. Server-owned tests already cover workspace isolation/argument rejection, but did not duplicate both overwrite checks; keeping them avoids silently dropping coverage. Further package-boundary ownership verification belongs to S3.

## Red → green and results

- New no-Swift boundary regression failed while the old harness existed, then passed after removal.
- Focused boundary, fixture-safety and dependency tests: **8 passed**.
- `npm test -- --coverage`: **716 passed / 87 files**, **95.38% line coverage**. Removing one obsolete bundle-verifier test and adding one ownership regression preserves the total test count.
- Approved pipeline build: passed, including TypeScript checks and installed public dependency verification.
- Approved pipeline E2E: **36 passed / 1 expected coverage-only skip**.
- Active-code/configuration reference scan: removed Swift paths occur only in absence assertions; current docs point to the independent SDK suite.
- Whitespace checks pass. Existing Vite chunk-size warning remains.

No server implementation changes, package publication, project push, live-service restart, remote CI or new Sonar analysis is claimed. Removing the obsolete runner removes the source locations of its previous PATH findings, but a remote quality-gate result requires a new analysis.
