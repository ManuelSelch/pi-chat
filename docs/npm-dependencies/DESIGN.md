# Published Server and SDK Dependencies — Design

## Proposed Design
- Replace Pi Chat's two `file:vendor/*.tgz` dependencies with exact npm versions `@manuelselch/pi-server: 0.1.0` and `@manuelselch/pi-sdk: 0.1.0`. Regenerate the lockfile and install cleanly.
- Remove the obsolete npm tarballs, server artifact receipt, server checksum verifier and its artifact-specific tests. Remove the TypeScript entry from the SDK artifact receipt; retain the Swift bundle and its checksum/revision because the Swift integration harness still consumes them.
- Narrow SDK artifact verification and its tests to Swift. Update `run-swift-integration.mjs` to stop requiring removed npm artifacts. Keep normal npm dependency integrity in the lockfile rather than adding replacement receipts.
- Simplify package verification scripts/hooks so ordinary build, test and development commands no longer require npm vendor archives. Retain verification of the installed public server API and protocol version where useful, and keep Swift bundle checks at the Swift harness boundary.
- Update current architecture/development/vendor documentation and the widget-colors design's dependency-update instructions. Historical extraction records remain historical.

## Decisions & Trade-offs
- Pin both packages to `0.1.0`, not a floating range. Use registry resolution, not Git dependencies or direct tarball URL workarounds.
- The npm metadata endpoint for pi-server currently returns 404 although its version endpoint responds. Clean installation must succeed before completion is claimed; do not hide registry failures.
- Preserve Swift test reproducibility rather than removing the entire vendor directory. Migrating Swift distribution is outside this change.
- No application behavior, protocol, widget implementation, package publication, project push or explicit live-server restart is included.

## Verification
- Add/update regression tests for remaining Swift artifact checks and public dependency smoke checks; remove only tests for deleted npm archive machinery.
- Verify lockfile registry URLs, exact installed versions and absence of npm vendor references in active scripts.
- Run clean install, full unit suite, production build, browser tests, production lifecycle smoke and Swift integration tests. Keep test state isolated from the live backend.

## Open Questions
None.
