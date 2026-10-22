# Diagnostic Script Hardening — Design

## Approach

Implement only the confirmed helper-hardening work (requirements R8, slice 5). Fixed English model collation is recorded in the requirements but is not part of this implementation scope.

The confirmed fixture weakness was canonicalizing a caller-selected directory without confining writes. Remove that capability rather than build a general sandbox. The user subsequently chose to delete the unused reconnect diagnostic (`262c05e`), superseding its hardening design. Fixture design approved for implementation; unrelated Sonar work remains separate.

## Components & Data Flow

- **Changed:** `packages/pi-sdk/Tests/Fixtures/loopback-server.ts` rejects positional output-directory arguments, creates a private temporary directory itself, and keeps sessions/metadata/output files there. Its fake runtime and loopback server remain unchanged.
- **Changed:** `packages/pi-sdk/Tests/PiSDKTests/LoopbackTests.swift` launches the fixture without a directory argument. It reads a marked readiness record from stdout containing the canonical project directory and endpoint, then uses that directory for session creation and cleanup assertions. Its existing parent-owned temporary directory retains diagnostic logs.
- **Removed:** `scripts/verify-reconnect.ts`; do not recreate it.
- **New, test-only:** `LoopbackFixture.swift` owns the Swift subprocess and diagnostics. `test/infra/swift-fixture-driver.ts` owns subprocess setup, readiness, teardown and assertions for `test/infra-tests/swift-fixture.test.ts`. No production service layer.

## Key Implementation Details

Create the fixture directory with `mkdtemp` under the OS temporary directory, canonicalize it, and use restrictive permissions. No CLI argument controls its location. Create output files exclusively (`wx`) so existing files or symlinks are rejected rather than followed or replaced. The old endpoint-file polling is replaced by one prefixed JSON stdout record emitted only after listening:

```ts
type FixtureReady = { directory: string; endpoint: string };
// PI_FIXTURE_READY {"directory":"…","endpoint":"ws://127.0.0.1:…/ws"}
```

The Swift driver directs stdout/stderr to its existing style of regular diagnostic file (avoiding pipe backpressure and concurrent readers), polls complete lines for the readiness prefix, and enforces the ten-second startup deadline. All other output remains available as diagnostics. Parent-side cleanup removes the reported private fixture directory after success, but retains artifacts on failure. Register bounded termination early so startup failures do not leave a server running. Keep cleanup reports exclusively created in the fixture directory. This protects against accidental/argument-driven overwrites, not hostile processes running as the same OS user.

The Swift driver permits six seconds for graceful shutdown, then kills/reaps the child if necessary. Failure/cancellation before readiness and driver destruction also terminate the subprocess. Throwing test assertions preserve failure artifacts instead of deleting diagnostics after a failed expectation.

## Complexity Guardrails

No new dependencies, DNS resolution, remote-host override, generic filesystem sandbox, production transport changes, or unrelated Sonar fixes. Standard OS temporary-directory configuration remains trusted.

## Verification

Four new subprocess regressions failed on the old fixture and pass after hardening: argument rejection, private/canonical workspace and readiness handoff with clean shutdown, and exclusive-write failure on preexisting files and symlinks. The old Swift caller also failed against the new argument contract before its handoff was updated. Full Vitest suite: 1,162 passed; Swift Testing: 35 passed; XCTest: 6 passed. Production build/typecheck and whitespace checks pass. A fresh Sonar analysis remains necessary to confirm findings close.

## Decisions for Approval

None. The user approved fixture hardening and the stdout readiness handoff, and separately approved deletion of the reconnect script.
