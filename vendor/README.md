# Dependency provenance

Chat pins the coordinated unpublished `/model` scope candidate of
`@manuelselch/pi-sdk` via a file archive in [model-search](model-search/).
[SOURCE.json](model-search/SOURCE.json) records its source revision and SHA-256
checksum; the lockfile records SHA-512 integrity. Pi Server temporarily uses
[live-checkouts](live-checkouts/SOURCE.json): the previous
[prompt-errors](prompt-errors/SOURCE.json) artifact plus live checkout discovery,
runtime-replacement catalogue refresh and protocol documentation compiled from
the recorded server revision. Its original Pi 1.0.2 dependencies are retained for
Chat's test harness; this is a local test artifact, not a published server release.

No dependency overrides or installed-source patches are used in Chat. A clean
Chat install needs no sibling checkouts. Both archives are local verification
snapshots, not registry releases.

To reproduce Pi Server source verification against the coordinated SDK
candidate, install the SDK archive without saving over its registry manifest,
then build/test:
`npm install --no-save --package-lock=false --ignore-scripts <SDK archive path>`.
The server source's registry SDK 0.2.0 alone does not contain model-scope metadata.

`npm run verify:dependencies` checks the installed public server API and wire
version; it is not a source-revision/checksum verifier or proof of publication.
[Dependency fixture tests](../test/infra-tests/npm-dependencies.test.ts) inspect
archive pins, source receipts, checksums, lock integrity, SDK deduplication and
the public API.
Use the [development workflow](../docs/development.md) after an authorized update.
Clean installation needs no sibling server/SDK checkout or Swift toolchain.

## Source ownership and attribution

The independent [TypeScript SDK](https://github.com/ManuelSelch/pi-sdk-typescript),
[Swift SDK](https://github.com/ManuelSelch/pi-sdk-swift) and
[server](https://github.com/ManuelSelch/pi-server) were extracted from Pi Chat.
The SDK clean initial commits `a3edbcdfbb88b83ef773d9f966ff9ab35115d661`
(TypeScript) and `73fae38f75c0e5eb80515c9ffa76876542097e7d` (Swift) attribute
Pi Chat source `f3b1c616b140ac4c82d19d465b6205a3200b54f3`. The server clean
initial commit `f47dfedbda627e18d2a7f7936874f4dad67d1e04` attributes Chat source
`d38192ed590574add58dd57c82e99e706a7680eb`. These are source attributions,
not the revisions of the current releases. Preserve package licenses and
third-party notices when updating artifacts.

Chat does not vendor a Swift SDK or own Swift compatibility testing. The
[Swift repository's integration package](https://github.com/ManuelSelch/pi-sdk-swift/tree/main/integration)
owns real-server create/stream/Stop/disconnect/reattach/cleanup scenarios using
its own dependency pin. Chat retains plain-Node fixture safety checks, not a
Swift/Xcode harness. Broader native parity is not implied by Chat's tests.
