# Swift Test Ownership — Requirements

## Goal
Make the independent Swift SDK responsible for its real-server compatibility tests; remove Swift testing infrastructure from Pi Chat.

## Requirements
- **R1** — pi-sdk-swift runs the existing real-server create, streaming, stop, disconnect-retention, reattachment and shutdown-cleanup scenarios against an exact, lockfile-pinned published pi-server npm dependency.
- **R2** — Swift SDK CI runs the integration suite as a required job without Pi Chat, a sibling checkout, credentials or live model calls. Missing prerequisites fail explicitly.
- **R3** — Ordinary SDK unit/probe tests and product builds remain independent of Node/npm. Integration uses the SDK source in the checkout being tested.
- **R4** — Pi Chat no longer contains Swift integration scripts, test fixtures, vendored SDK bundle/checksum tooling, or its macOS Swift CI job after replacement coverage passes.
- **R5** — Reuse pi-server's public compiled loopback fixture and existing server-owned fixture/package safety tests; no wire or production API changes.
- **R6** — Preserve bounded process lifetime, private temporary state, failure diagnostics, explicit cleanup and existing test coverage.

## Assumptions
None.

## Implementation Plan
### S1 — Add Swift-owned server integration
Description: Move the integration scenarios/driver into a separate harness in pi-sdk-swift consuming its local SDK product and a locked npm server. Add mandatory macOS CI execution and verify scenarios independently of Chat.

### S2 — Remove Chat Swift infrastructure
Description: After S1 passes, remove Chat's Swift harness, runner, bundle, receipt/verifier tests and CI job; update active documentation and verify Chat build/unit/browser tests.

### S3 — Verify ownership boundaries
Description: Verify the existing server fixture/package checks and Swift unit/integration suites, document ownership in both packages, and commit task changes independently in each affected repository. No publication or push.

## Open Questions
None.
