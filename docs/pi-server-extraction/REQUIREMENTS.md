# Pi Server and SDK Extraction — Requirements

## Goal
Extract `pi-server`, `pi-sdk-typescript` and `pi-sdk-swift` into independent Git repositories to unblock Swift application CI, without changing wire behavior. Extract the SDKs first, directly into separate repositories rather than creating an intermediate combined SDK repository. This is the active extraction plan; the [parent plan](../backend-sdk/REQUIREMENTS.md) retains migration history. The approved sequencing below supersedes its R19 Swift prerequisite.

## Requirements
- **R1** — Extract the backend as `@manuelselch/pi-server`. Extract the TypeScript SDK and authoritative protocol into `pi-sdk-typescript` (npm name `@manuelselch/pi-sdk`), and Swift SDK into `pi-sdk-swift` (SwiftPM product `PiSDK`). Include their tests, build configuration, CI and documentation. This supersedes the earlier combined `pi-sdk` repository decision.
- **R2** — Place all three repositories under `/Users/manuelselch/Documents/A_Personal/40 Projekte/47 Agents/Pi Agent`. The grouping folder is not a Git repository. Do not relocate Pi Chat or Pi Studio in this effort; keep runtime configuration, credentials and sessions under `~/.pi/agent`.
- **R3** — Preserve v2 behavior, session storage, extension registration identity and loopback defaults; the SDK remains the authoritative contract owner.
- **R4** — Run the compiled server headlessly or with explicit static assets, without Pi Chat sources, React, Vite or runtime TypeScript loaders. Use documented package APIs and declared dependencies; no sibling-source imports or workspace-hoisting assumptions.
- **R5** — Preserve Pi Chat launcher, restart, PID/log and shutdown behavior; standalone restart must not assume a source rebuild.
- **R6** — Pass clean-install server/package tests, existing TypeScript/Swift SDK tests, Pi Chat integration tests and production smoke checks. Verify Git-based SwiftPM consumption for application CI. Remove old sources only after verification; retain a rollback revision.
- **R7** — Extraction may proceed before full Swift conversation/dialog/reconnect verification; retain that milestone as follow-up work, not an extraction gate. Protocol changes, UI redesign, new Swift features and remote deployment are excluded.
- **R8** — Remote repository creation, pushing, publication and live service replacement require separate approval. Register extension-bearing local packages explicitly rather than requiring source repositories inside `~/.pi/agent/extensions`.
- **R9** — Rename the TypeScript public `/contract` entry point to `/protocol` and update all maintained consumers, exports, tooling and current documentation without changing v2 messages. Preserve `/protocol/schema/**` and `/protocol/fixtures/**` artifact access; do not retain a compatibility alias.
- **R10** — Keep `Package.swift` at the Swift repository root. Swift consumes pinned generated protocol artifacts from the TypeScript repository; it must not own a second authoritative protocol definition or depend on a sibling checkout to build/test its standalone SDK.
- **R11** — Verify extracted SDKs and switch Pi Chat's SDK consumption before deleting embedded SDK sources. Retain real-server Swift loopback regression coverage as an explicitly owned integration suite while the server remains in Pi Chat; do not silently skip it or require server extraction to build the SDK.

## Assumptions
- Existing semantics and completed migration evidence remain in [PROTOCOL.md](../backend-sdk/PROTOCOL.md) and [CUTOVER.md](../backend-sdk/CUTOVER.md).
- Local repository extraction, destination and clean initial commits are approved. Record the Pi Chat source revision for traceability; do not import filtered history. This plan records decisions, not completed implementation.

## Implementation Plan
### S1 — Define Boundaries
Description: Map server/shared/SDK files, dependencies and test ownership; define public embedding, extension and fixture APIs. Verify imports are covered and record the source revision before moving files.

### S5 — Rename SDK Protocol Surface
Description: Following S1, implement R9 in the existing checkout. Verify public module imports, preserved generated artifacts, consumer typechecking and tests. No repository move or server extraction in this slice.

### S6 — Extract Separate SDK Repositories
Description: Following S5, implement R1, R2, R6, R10 and R11 for the SDKs. Create `pi-sdk-typescript` and `pi-sdk-swift` with clean initial commits referencing the Pi Chat source revision; verify independent installs, fresh-clone builds/tests, packed TypeScript and Git-based SwiftPM consumption. Switch Pi Chat's SDK dependency/build/test wiring and preserve server-backed Swift integration coverage before removing embedded SDK sources. No server extraction or remote publication in this slice.

### S2 — Package Independently
Description: Following S6, establish independent server artifacts, CLI, optional static hosting and restart/launcher adapters. Consume the extracted SDK. Verify packed installations initialize an SDK client and shut down without Pi Chat sources.

### S3 — Extract Repositories
Description: Following S2, create the local `pi-server` repository in the approved grouping folder with a clean initial commit referencing the Pi Chat source revision. The SDK repositories were already extracted in S6. Include tests, CI, documentation and attribution; verify fresh clones build/test with independent dependency artifacts. Do not rewrite Pi Chat history.

### S4 — Switch Pi Chat
Description: Following S3, consume server package APIs and update extension examples, fixtures and build/test configuration. Retain extracted SDK consumption from S6. Verify Swift application dependency resolution, integration and production smoke checks before removing old server sources; document versions and rollback instructions.

## Open Questions
- **Q1 — Resolved:** Extract now to unblock Swift application CI; full Swift verification is follow-up work.
- **Q2 — Resolved:** Extract SDKs before `pi-server`; split TypeScript and Swift directly into separate repositories. No intermediate combined SDK repository.
- **Q3 — Resolved:** All three repositories belong under `/Users/manuelselch/Documents/A_Personal/40 Projekte/47 Agents/Pi Agent` and start with clean initial commits referencing the Pi Chat source revision; no filtered history.
