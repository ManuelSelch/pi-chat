# Dependency fixtures

The SDK remains pinned to `@manuelselch/pi-sdk@0.1.0` from npm. For the approved [colored-widget experiment](../docs/widget-colors/DESIGN.md), Chat temporarily pins a locally packed `pi-server` archive in its manifest and lockfile. [widget-colors-server.json](widget-colors-server.json) records the independent source revision and archive checksum; dependency tests verify the checksum and lockfile integrity. No absolute sibling path or installed-source patch is required.

After separate approval to publish the verified server, replace the file pin with its registry version and remove only the temporary server archive/receipt. Do not publish automatically. Run the commands in [development.md](../docs/development.md) after dependency changes. `npm run verify:dependencies` checks the installed public server API and protocol version.

## Swift test ownership

Chat no longer vendors a Swift SDK bundle, clones a fixture SDK, or runs Swift tests.
The independent [pi-sdk-swift repository](https://github.com/ManuelSelch/pi-sdk-swift/tree/main/integration)
owns its unit tests and real-server create/stream/Stop/disconnect/reattach/cleanup
compatibility suite, using its local SDK source and a locked published npm server.
No Swift/Xcode installation is needed for Chat verification.

Historical extraction attribution remains in [the handover](../docs/pi-server-extraction/HANDOVER.md).
Its old bundle and verification commands describe extraction history, not the
current install or test workflow.
