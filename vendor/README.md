# Dependency fixtures

Chat pins `@manuelselch/pi-sdk@0.2.0` and `@manuelselch/pi-server@0.2.0` from npm. No npm artifacts are vendored in Chat. Dependency tests verify exact versions, registry resolution and lockfile integrity.

The published 0.2.0 releases replace the temporary prompt-capable SDK/server archives. Server 0.2.0 still bundles an SDK labeled 0.1.1; Chat consumes SDK 0.2.0 directly. This migration preserves the published server unchanged, without dependency overrides or local archive references in Chat’s direct dependencies.

Run the commands in [development.md](../docs/development.md) after dependency changes. `npm run verify:dependencies` checks the installed public server API and protocol version.

## Swift test ownership

Chat no longer vendors a Swift SDK bundle, clones a fixture SDK, or runs Swift tests.
The independent [pi-sdk-swift repository](https://github.com/ManuelSelch/pi-sdk-swift/tree/main/integration)
owns its unit tests and real-server create/stream/Stop/disconnect/reattach/cleanup
compatibility suite, using its local SDK source and a locked published npm server.
No Swift/Xcode installation is needed for Chat verification.

Historical extraction attribution remains in [the handover](../docs/pi-server-extraction/HANDOVER.md).
Its old bundle and verification commands describe extraction history, not the
current install or test workflow.
