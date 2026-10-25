# Ownership boundaries — Slice 3 verification

Verified locally on 2026-10-25. S1–S3 of [the approved requirements](REQUIREMENTS.md)
are complete; no production API, protocol or dependency changes were needed in S3.

## Independent package results

| Owner / source tested | Verification |
|---|---|
| pi-server `2e25017`, version 0.1.1 | Clean locked install; typecheck; **435 unit tests / 60 files**; **16 compiled-package tests**; coverage; packed isolated consumer repeats **16 tests** and checks public types/exports/transitive SDK |
| pi-sdk-swift `6c41df3` | Clean source build; **34 Swift Testing + 6 XCTest tests**, with no Node/npm on PATH and no integration npm install; protocol drift; **9 converter tests** and coverage conversion |
| Swift integration, same SDK source | Node 24.22.1; **4 prerequisite tests**; actual missing-install failure; locked npm install; **2 real URLSession/server scenarios**, including retained-runtime shutdown receipt |
| Chat `4b740e1` | **8 focused boundary, installed-fixture safety and dependency tests** passed; no tracked Swift sources, bundle, runner, npm command or macOS job |

Server and Swift verification used independent Git source exports in temporary
directories with spaces, without Chat sources, sibling packages or old build caches.
Chat's complete build/unit/browser verification remains recorded in [S2](S2-VERIFICATION.md).

## Confirmed responsibility

- Server owns its compiled loopback implementation and server/package regressions.
- Swift SDK owns ordinary Swift tests and the separate real-transport compatibility
  suite using the checkout's SDK source; npm remains integration-only.
- Chat owns web/Node application checks, not Swift. Its four plain-Node
  installed-fixture acceptance checks remain, preserving private workspace,
  argument and existing-cleanup-file/symlink protections. The two overwrite
  checks are not duplicated in the current server suite; they were not silently
  dropped or claimed as server-owned coverage.

Current package instructions and detailed evidence are in pi-server's
`docs/TEST-OWNERSHIP.md` and pi-sdk-swift's
`docs/server-integration/S3-VERIFICATION.md`; their READMEs link those records.

## Versions and limits

Swift remains pinned to published **server 0.1.0**. Server source/package checks
verify **0.1.1**, and Chat now consumes registry **0.1.1** following a separate
concurrent dependency change (`4b740e1`), left intact by S3. The temporary archive
was preserved during S2; its later replacement is not part of this task.
Passing the 0.1.0 Swift suite is not a Swift/0.1.1 compatibility claim.

Inspected unconditional Swift integration CI wiring and separate Node-free Swift
job; no remote workflow or branch-protection setting was changed. Local npm
installs report existing audit findings: server **4 moderate + 1 high**, Swift
integration **2 moderate + 1 high**. No audit fixes or dependency updates were made.

No full Swift parity, real-model acceptance, remote CI/Sonar result, publication,
push or live-service restart is claimed. Changes are committed independently in
the affected repositories.
