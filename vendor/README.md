# Pinned local server and SDK artifacts

Pi Chat no longer owns server/SDK sources or package workspaces. The server is installed as `@manuelselch/pi-server` from a compiled tarball with its pinned SDK bundled; Chat still directly pins its browser SDK. The independent repositories are `pi-sdk-typescript` and `pi-sdk-swift`, under the approved `47 Agents/Pi Agent` grouping folder. Package names remain `@manuelselch/pi-sdk` and `PiSDK`.

- `manuelselch-pi-sdk-0.0.0.tgz`: compiled TypeScript SDK, public `/protocol` module and generated `/protocol/schema/**` and `/protocol/fixtures/**` artifacts. No `/contract` alias.
- `pi-sdk-swift.bundle`: complete local Git bundle of the pinned Swift SDK, used only by Chat's Swift integration tests. This avoids a developer-specific checkout path or unpublished remote in CI. It is not a second source authority: make all SDK changes in their independent repositories.
- [sdk-artifacts.json](sdk-artifacts.json): source revisions and SHA-256 receipts. `npm run verify:sdk` checks these artifacts and the installed protocol module.

Nothing is pushed or published. The SDKs began with clean initial commits attributed to Pi Chat revision `f3b1c616b140ac4c82d19d465b6205a3200b54f3`; the pre-extraction rollback baseline is `495637bcf4ae3597406b05f9327a51962d94eb21`. No license grant existed in the source; preserve notices and resolve licensing before publication.

## Update deliberately

1. Change, test and commit the independent TypeScript SDK. Run its `npm pack --pack-destination <pi-chat>/vendor` and record that commit and the new tarball's SHA-256 in the receipt.
2. If protocol artifacts changed, explicitly import that clean TypeScript revision with Swift's `python3 scripts/protocol-artifacts.py import <typescript-checkout>`. Run Swift tests and commit the pinned manifest/snapshot together.
3. Create a full Swift bundle with `git bundle create <pi-chat>/vendor/pi-sdk-swift.bundle main`; record its revision and SHA-256. Do not substitute a shallow/incremental bundle that needs an external repository to clone.
4. Refresh the npm lockfile/package installation for the tarball. Because this local SDK version is still `0.0.0`, remove the old installed SDK and its lockfile entry before reinstalling a different tarball with that same name/version; never retain a stale integrity hash.
5. Review/remove only the clean ignored `test/swift-integration/.sdk` checkout if its pin changed. The runner refuses mismatched or modified checkouts rather than silently overwriting them.
6. Run Chat build/unit/browser/production smoke and `npm run test:swift-integration`; commit artifacts, receipt and lockfile together. No automatic publication is involved.

## Server updates

- `manuelselch-pi-server-0.0.0.tgz` and [server-artifact.json](server-artifact.json) pin server version, independent Git revision, original Chat source revision and SHA-256. `npm run verify:server` validates the bytes and public import; `verify:dependencies` validates both server and SDK artifacts.
- Make server changes/tests/commits in the independent repository, then build and pack there into Chat’s `vendor/`. Update the receipt and refresh `package-lock.json` using an explicit tarball install. Check that its SHA-512 integrity matches the new bytes; same-version artifacts must not retain a stale lock/cache entry.
- Run fresh-clone install/build/unit/browser/Swift/lifecycle smoke before committing artifact, receipt and lockfile together. Never depend on an unpublished registry version or sibling source path. No package publication is implied.

## Swift integration

Run `npm ci --ignore-scripts`, then `npm run test:swift-integration` on macOS with Xcode 26.1.1/Swift 6.2.1. The runner clones the exact bundled Git revision into an ignored local harness dependency and sets up private agent storage. The default launcher is plain Node importing `@manuelselch/pi-server/testing/loopback`, with no tsx or Chat implementation sources. The fixture uses an ephemeral loopback listener, fake runtime, empty history, canonical private temporary metadata, stdout readiness and exclusive cleanup reporting. It never uses the live backend.

Standalone SDK unit/probe tests run in their own repositories. Chat additionally owns real-server create/stream/Stop/disconnect/reattach/close regression coverage. SwiftPM's local Git consumer was verified with a literal local repository path and revision; percent-encoded `file://` URLs containing spaces fail with this toolchain, so use the literal path form for local verification.
