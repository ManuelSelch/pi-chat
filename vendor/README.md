# Dependency fixtures

Chat pins `@manuelselch/pi-sdk@0.1.1` and `@manuelselch/pi-server@0.1.2` from npm. No npm artifacts are vendored in Chat. Dependency tests verify exact versions, registry resolution and lockfile integrity.

Chat now consumes the published theme-capable SDK 0.1.1 directly. Server 0.1.2 still contains its bundled S2 SDK; this dependency update does not modify the published server’s internals. Mantine integration remains S4. The bundled SDK’s `file:vendor/...` dependency declaration makes `npm ls` report it as invalid, even though clean installation and runtime tests can load the bundled package. Removing that internal vendor reference requires a separately published server/SDK update, not a Chat-local patch.

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
