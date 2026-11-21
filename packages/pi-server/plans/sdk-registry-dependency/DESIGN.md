# Registry SDK Dependency — Design

## Overview
Pi Server currently pins SDK 0.1.1 and bundles its locally installed contents. Replace that with an exact registry SDK 0.2.0 dependency. No server runtime or protocol changes, publication, tag, push, live restart or Chat pin changes are included.

## Decisions & Trade-offs
- Remove SDK bundleDependencies and obsolete SDK archives/receipts; regenerate the lockfile from npm. Keep server version 0.2.0 until a separately authorized release bump.
- Update scripts/verify-package.mjs to require registry resolution and no packed SDK files. Its isolated consumer must install the SDK transitively from npm, resolve the same SDK from server and consumer, and retain public export/type, SDK initialization, CLI/restart/signals and loopback safety scenarios.
- Remove bundled-byte comparison in favor of installed registry version, integrity and resolution assertions. Do not add overrides or compatibility fallbacks.
- Update current README/releasing instructions; preserve historical test ownership evidence.

## Verification
- [Dependency regression](../../test/modules/sdk-dependency.test.ts): assert no SDK bundling, matching manifest/lockfile specifiers and registry resolution. Do not hardcode an SDK version in tests; the manifest owns the selected version.
- Existing compiled and installed-consumer scenarios: unchanged behavioral outcomes, different SDK installation mechanism. Extend packaging assertions to reject bundled SDK files and verify shared resolution.
- Run clean install, typecheck, full unit/compiled tests and installed-tarball verification. The latter uses real npm but fake runtimes, not real-model acceptance.

## Open Questions
None.
