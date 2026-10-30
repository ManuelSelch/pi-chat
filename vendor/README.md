# Dependency provenance

Pi Chat currently installs **committed local npm archives**, not registry-resolved
SDK/server releases. The manifest and lockfile are authoritative for this
checkout. Package version strings alone do not identify these prompt-capable
snapshots.

| Package | Version | Committed archive | Recorded source revision |
|---|---|---|---|
| `@manuelselch/pi-sdk` | 0.1.1 | [SDK archive](pi-sdk-0.1.1-prompts-5b747dd.tgz) | `5b747dd14acd3fb176b0b7b59dd54bdae33334e8` |
| `@manuelselch/pi-server` | 0.1.2 | [Server archive](pi-server-0.1.2-prompts-df9dd1b.tgz) | `df9dd1b` |

The server archive bundles the matching SDK snapshot. Its bundled manifest
references the matching exact SDK version. The root lockfile records archive
resolution and SHA-512 integrity. Keep these archive bytes, manifest selections
and lockfile together; do not patch installed `node_modules` sources.

`npm run verify:dependencies` checks the installed public server API and wire
version; it is not a source-revision/checksum verifier or proof of publication.
[Dependency fixture tests](../test/infra-tests/npm-dependencies.test.ts) inspect
the committed archive selection, lock integrity and prompt-capable public API.
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
not the revisions of the current archives. Preserve package licenses and
third-party notices when updating artifacts.

Chat does not vendor a Swift SDK or own Swift compatibility testing. The
[Swift repository's integration package](https://github.com/ManuelSelch/pi-sdk-swift/tree/main/integration)
owns real-server create/stream/Stop/disconnect/reattach/cleanup scenarios using
its own dependency pin. Chat retains plain-Node fixture safety checks, not a
Swift/Xcode harness. Broader native parity is not implied by Chat's tests.
