# Dependency fixtures

The SDK remains pinned to `@manuelselch/pi-sdk@0.1.0` from npm. For the approved [colored-widget experiment](../docs/widget-colors/DESIGN.md), Chat temporarily pins a locally packed `pi-server` archive in its manifest and lockfile. [widget-colors-server.json](widget-colors-server.json) records the independent source revision and archive checksum; dependency tests verify the checksum and lockfile integrity. No absolute sibling path or installed-source patch is required.

After separate approval to publish the verified server, replace the file pin with its registry version and remove only the temporary server archive/receipt. Do not publish automatically or remove the Swift fixture. Run the commands in [development.md](../docs/development.md) after dependency changes. `npm run verify:dependencies` checks the installed public server API and protocol version.

The Swift integration fixture remains independently vendored:

- `pi-sdk-swift.bundle`: complete local Git bundle of the pinned Swift SDK, used by Chat's real-server Swift integration tests. This avoids developer-specific paths and remains separate from the npm dependencies.
- [sdk-artifacts.json](sdk-artifacts.json): Swift source revision and SHA-256 receipt. `scripts/run-swift-integration.mjs` verifies it before cloning the fixture SDK. It refuses stale or modified checkouts rather than overwriting them.

## Update the Swift fixture deliberately

1. Test and commit changes in the independent `pi-sdk-swift` repository. If its protocol changes, import the authoritative protocol artifacts from the matching TypeScript SDK revision first.
2. Create a full bundle with `git bundle create <pi-chat>/vendor/pi-sdk-swift.bundle main`. Record its revision and SHA-256 in the receipt. Do not substitute an incremental bundle that needs another repository to clone.
3. Review/remove only the clean ignored `test/swift-integration/.sdk` checkout if its pin changed.
4. Run `npm run test:swift-integration`; commit the bundle and receipt together. No publication is implied.

## Swift integration

Run `npm ci --ignore-scripts`, then `npm run test:swift-integration` on macOS with Xcode 26.1.1/Swift 6.2.1. The runner clones the bundled Git revision into an ignored local harness dependency and sets up private agent storage. Its plain-Node launcher imports `@manuelselch/pi-server/testing/loopback`, using an ephemeral listener, fake runtime and private temporary metadata. It never uses the live backend.

Standalone SDK unit tests run in their own repositories. Chat additionally owns real-server create/stream/Stop/disconnect/reattach/close coverage. Historical extraction attribution remains in [the handover](../docs/pi-server-extraction/HANDOVER.md); old npm tarball receipts are not the current dependency mechanism.
