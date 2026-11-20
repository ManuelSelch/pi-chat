# Dependency provenance

This branch consumes unpublished SDK/server npm candidates stored here. The
[manifest](../package.json) and lockfile pin the local archives; [candidate receipts](candidates.json)
record their source revisions, SHA-256 and SHA-512 integrity. No publishing,
dependency overrides or installed-source patches are used. A clean install needs
no sibling checkout. Supply both archives when installing these candidates elsewhere;
the server does not bundle a private SDK.

`npm run verify:dependencies` checks installed public server/plugin APIs and wire
version; it is not proof of publication. [Dependency fixture tests](../testing/infra-tests/npm-dependencies.test.ts)
verify archive checksums, receipt/manifest/lock agreement, SDK deduplication and
the installed lifecycle API.
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
