# SDK Extraction Handover

## Delivered scope

S5 (public protocol rename) and S6 (direct separate SDK repositories) are implemented. **S2 packaging and S3 standalone server extraction are also implemented**; see [S2-PACKAGING.md](S2-PACKAGING.md) for package boundaries and [S3-EXTRACTION.md](S3-EXTRACTION.md) for the independent repository, ownership and verification. The running Chat server remains unchanged. S4 consumer cutover is not complete.

| Repository | Local location | Initial revision |
|---|---|---|
| TypeScript SDK | [pi-sdk-typescript](/Users/manuelselch/Documents/A_Personal/40%20Projekte/47%20Agents/Pi%20Agent/pi-sdk-typescript) | `a3edbcdfbb88b83ef773d9f966ff9ab35115d661` |
| Swift SDK | [pi-sdk-swift](/Users/manuelselch/Documents/A_Personal/40%20Projekte/47%20Agents/Pi%20Agent/pi-sdk-swift) | `73fae38f75c0e5eb80515c9ffa76876542097e7d` |

The grouping folder is not Git. Both repositories start with clean initial commits attributed to Pi Chat source `f3b1c616b140ac4c82d19d465b6205a3200b54f3`. Pi Chat S5 commit is `f3b1c61`; pre-extraction rollback baseline is `495637bcf4ae3597406b05f9327a51962d94eb21`. No filtered history or live-service replacement occurred. This session did not create remotes, push or publish. GitHub `origin` remotes and matching `origin/main` refs appeared on both SDK repositories during verification; they were preserved without modification or push.

## Package boundaries

- TypeScript retains npm identity `@manuelselch/pi-sdk`, currently private version `0.0.0`. Repository root owns its manifest/lockfile, tests, CI, generators, authoritative Zod source and generated artifacts. Public `/protocol` replaces `/contract` without an alias; `/protocol/schema/**` and `/protocol/fixtures/**` remain available. Copying generated artifacts preserves compiled protocol JS/declarations.
- Swift retains product/module `PiSDK`; `Package.swift` is at repository root. Its CI/build/unit/probe tests need no Node, server or sibling checkout. `protocol/SOURCE.json` pins the TypeScript revision and artifact hashes. Explicit import/check tooling and tests verify snapshot, bundle and probe drift.
- Embedded SDK sources were removed only after SDK fresh-clone/packed/Git consumers and Chat build/unit/browser/Swift integration/production smoke verification. Source history remains available at the rollback revision.
- Chat installs the checked-in npm tarball with its lockfile. A checked-in full Swift Git bundle makes the integration harness reproducible before remote hosting exists. [Receipts and update instructions](../../vendor/README.md) document these temporary local artifacts and their provenance. No development installations/caches are committed.
- The real-server Swift loopback fixture and suite now belong to `test/swift-integration`. Chat CI has a mandatory macOS integration job. SDK unit tests did not silently replace or skip these host tests.
- Pi Studio primary checkout's SDK default now points to the extracted Swift repository; its fixture script uses the relocated Chat fixture and stdout readiness rather than caller-selected paths. Consumer wiring verified with 85 PiUI package tests and isolated launcher tests. No native app/Simulator UI automation was run.

## Verification

- Red/green: new public `/protocol` import failed against the old export; now passes with generated JSON alongside compiled JS/declarations. Removed public `/contract` is rejected.
- TypeScript fresh clone: `npm ci --ignore-scripts`, build, **174 tests / 12 files**, typecheck, offline packed ESM/type consumer, protocol/probe regeneration and zero generated drift.
- Swift fresh clone: artifact receipt checks, **34 Swift Testing tests plus 6 XCTest generation-probe tests**, no sibling dependencies. A separate Git-revision-pinned SwiftPM consumer compiled and ran using the literal local repository path. Percent-encoded local file URLs containing spaces failed in SwiftPM; the literal Git path works.
- Chat: TypeScript build/typecheck, **1,124 tests / 141 files**, **32 browser tests passed / 1 pre-existing skip**, **2 real-server Swift integration tests**, and isolated production health/UI/PID/log/shutdown smoke passed before embedded source removal. Repeated the full build/unit/browser/Swift integration/production smoke sequence successfully in a fresh clone of extraction commit `7bbe40d`, using `npm ci --ignore-scripts` and explicit compilation of the source-only harness. No embedded SDK sources, sibling repositories or existing build caches were available in that clone.
- Pi Studio: **85 package tests**, one new fixture-handshake launcher test, four existing simulator-selection isolation tests and shell syntax checks passed. Primary consumer update committed as `f7b8ee6`.
- Existing Vite dynamic-import/chunk-size warnings remain. No real-model conversation, full Swift parity, remote CI execution or native device acceptance is claimed. Workflow files were prepared, not run on GitHub.

## Rollback and next step

To restore the pre-extraction source layout, use the recorded Pi Chat rollback revision in a separate checkout; do not reset unrelated user work. Current artifacts/receipts pin the exact extracted SDK revisions. Pi Studio's consumer wiring can be reverted independently if necessary.

Next: S4 switches Chat to the verified extracted server only after its consumer acceptance. S3 is delivered; see [S3-EXTRACTION.md](S3-EXTRACTION.md). Existing S1 inventory is baseline evidence, not a description of today's SDK locations or implemented S2 surfaces. No license/notice file existed at extraction; resolve licensing with the owner before publication.
