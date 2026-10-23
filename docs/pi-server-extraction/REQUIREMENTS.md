# Pi Server and SDK Extraction — Requirements

## Goal
Extract `pi-server` and `pi-sdk` into independent Git repositories to unblock Swift application CI, without changing behavior. This is the active extraction plan; the [parent plan](../backend-sdk/REQUIREMENTS.md) retains migration history. The approved sequencing below supersedes its R19 Swift prerequisite.

## Requirements
- **R1** — Extract the backend as `@manuelselch/pi-server`; extract the shared contract, TypeScript SDK, Swift SDK and contract tests together into `pi-sdk`. Include their tests, build configuration, CI and documentation.
- **R2** — Place both repositories under `/Users/manuelselch/Documents/A_Personal/40 Projekte/47 Agents/Pi Agent`. The grouping folder is not a Git repository. Do not relocate Pi Chat or Pi Studio in this effort; keep runtime configuration, credentials and sessions under `~/.pi/agent`.
- **R3** — Preserve v2 behavior, session storage, extension registration identity and loopback defaults; the SDK remains the authoritative contract owner.
- **R4** — Run the compiled server headlessly or with explicit static assets, without Pi Chat sources, React, Vite or runtime TypeScript loaders. Use documented package APIs and declared dependencies; no sibling-source imports or workspace-hoisting assumptions.
- **R5** — Preserve Pi Chat launcher, restart, PID/log and shutdown behavior; standalone restart must not assume a source rebuild.
- **R6** — Pass clean-install server/package tests, existing TypeScript/Swift SDK tests, Pi Chat integration tests and production smoke checks. Verify Git-based SwiftPM consumption for application CI. Remove old sources only after verification; retain a rollback revision.
- **R7** — Extraction may proceed before full Swift conversation/dialog/reconnect verification; retain that milestone as follow-up work, not an extraction gate. Protocol changes, UI redesign, new Swift features and remote deployment are excluded.
- **R8** — Remote repository creation, pushing, publication and live service replacement require separate approval. Register extension-bearing local packages explicitly rather than requiring source repositories inside `~/.pi/agent/extensions`.

## Assumptions
- Existing semantics and completed migration evidence remain in [PROTOCOL.md](../backend-sdk/PROTOCOL.md) and [CUTOVER.md](../backend-sdk/CUTOVER.md).
- Local repository extraction, destination and clean initial commits are approved. Record the Pi Chat source revision for traceability; do not import filtered history. This plan records decisions, not completed implementation.

## Implementation Plan
### S1 — Define Boundaries
Description: Map server/shared/SDK files, dependencies and test ownership; define public embedding, extension and fixture APIs. Verify imports are covered and record the source revision before moving files.

### S2 — Package Independently
Description: Following S1, establish independent server/SDK artifacts, CLI, optional static hosting and restart/launcher adapters. Verify packed installations initialize an SDK client and shut down without Pi Chat sources; SwiftPM builds independently.

### S3 — Extract Repositories
Description: Following S2, create both local repositories in the approved grouping folder with clean initial commits referencing the Pi Chat source revision. Include tests, CI, documentation and attribution; verify fresh clones build/test with independent dependency artifacts. Do not rewrite Pi Chat history.

### S4 — Switch Pi Chat
Description: Following S3, consume server/SDK package APIs and update extension examples, fixtures and build/test configuration. Verify Swift application dependency resolution, integration and production smoke checks before removing old sources; document versions and rollback instructions.

## Open Questions
- **Q1 — Resolved:** Extract now to unblock Swift application CI; full Swift verification is follow-up work.
- **Q2 — Resolved:** Extract `pi-sdk` alongside `pi-server`.
- **Q3 — Resolved:** Both repositories belong under `47 Agents/Pi Agent` and start with clean initial commits referencing the Pi Chat source revision; no filtered history.
