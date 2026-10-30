# Dependency provenance

Chat pins `@manuelselch/pi-sdk@0.2.0` and `@manuelselch/pi-server@0.2.0`
from npm. The manifest and lockfile select exact registry releases with SHA-512
integrity; no npm archives are committed in Chat. These releases replace the
temporary prompt-capable snapshots.

Server 0.2.0 still bundles an SDK labeled 0.1.1; Chat consumes SDK 0.2.0 directly.
The published server is consumed unchanged, without dependency overrides or
local archive references in Chat's direct dependencies. Do not patch installed
`node_modules` sources.

`npm run verify:dependencies` checks the installed public server API and wire
version; it is not a source-revision/checksum verifier or proof of publication.
[Dependency fixture tests](../test/infra-tests/npm-dependencies.test.ts) inspect
exact release pins, registry resolution, lock integrity and the public API.
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
