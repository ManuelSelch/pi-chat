# Diagnostic Script Hardening — Design

## Approach

Implement only the confirmed helper-hardening work (requirements R8, slice 5). Fixed English model collation is recorded in the requirements but is not part of this implementation scope.

The fixture currently canonicalizes a caller-selected directory without confining writes. The reconnect diagnostic accepts any URL and can wait indefinitely for a first message. These capabilities are confirmed in source; production exploitability was not established. Remove the unnecessary capabilities rather than build a general sandbox.

## Components & Data Flow

- **Changed:** `packages/pi-sdk/Tests/Fixtures/loopback-server.ts` rejects positional output-directory arguments, creates a private temporary directory itself, and keeps sessions/metadata/output files there. Its fake runtime and loopback server remain unchanged.
- **Changed:** `packages/pi-sdk/Tests/PiSDKTests/LoopbackTests.swift` launches the fixture without a directory argument. It reads a marked readiness record from stdout containing the canonical project directory and endpoint, then uses that directory for session creation and cleanup assertions. Its existing parent-owned temporary directory retains diagnostic logs.
- **Changed:** `scripts/verify-reconnect.ts` validates its optional URL before opening sockets, bounds each attempt, and guarantees cleanup. Keep small exported functions in this script for tests, with execution guarded to run only as the CLI entry point.
- **New, test-only:** focused helper tests and a small fixture-process driver owning startup, bounded readiness reads, termination, and cleanup. Reuse existing test-driver conventions where applicable; no production service layer.

## Key Implementation Details

Create the fixture directory with `mkdtemp` under the OS temporary directory, canonicalize it, and use restrictive permissions. No CLI argument controls its location. Create output files exclusively (`wx`) so existing files or symlinks are rejected rather than followed or replaced. The old endpoint-file polling is replaced by one prefixed JSON stdout record emitted only after listening:

```ts
type FixtureReady = { directory: string; endpoint: string };
// PI_FIXTURE_READY {"directory":"…","endpoint":"ws://127.0.0.1:…/ws"}
```

The Swift reader drains stdout, recognizes only the readiness prefix, enforces the existing startup deadline, and retains other output as diagnostics. Stderr remains logged. Parent-side cleanup removes the reported private fixture directory after success, but retains artifacts on failure. Register bounded termination early so startup failures do not leave a server running. Keep cleanup reports exclusively created in the fixture directory. This protects against accidental/argument-driven overwrites, not hostile processes running as the same OS user.

Reconnect validation parses a `URL` and accepts only `ws:`/`wss:` with numeric hosts `127.0.0.1` or `[::1]`, no username/password or fragment, and valid ports. Reject hostnames (including `localhost`) and non-loopback addresses. Retain the current default endpoint and custom loopback ports. Pass the validated URL to `ws` with redirects explicitly disabled.

```ts
export function validateReconnectTarget(value: string): URL;
export async function attemptOnce(target: URL, timeoutMs: number): Promise<string>;
```

Use a five-second maximum per attempt, clipped to the remaining sixty-second overall budget. Bound retry sleeps to that budget. On timeout, parse failure, premature close, or socket error, settle once, clear timers, and terminate the socket. Bound graceful success closure too. Invalid targets fail immediately without retries or network access.

## Complexity Guardrails

No new dependencies, DNS resolution, remote-host override, generic filesystem sandbox, production transport changes, or unrelated Sonar fixes. Standard OS temporary-directory configuration remains trusted.

## Verification

Use TDD for URL acceptance/rejection, redirect refusal, connection/read timeouts, malformed messages, retry recovery, and socket cleanup against isolated servers. Test fixture argument rejection, private-directory creation, readiness handoff, exclusive-write failure on preexisting files/symlinks, and bounded process teardown through a test driver. Run the updated macOS Swift loopback test, focused Vitest tests, full suite, typecheck/build, and whitespace checks. A fresh Sonar analysis remains necessary to confirm findings close.

## Decisions for Approval

Approve the stdout readiness handoff replacing the fixture's directory argument, and the numeric-loopback-only reconnect policy with five-second attempts within the existing sixty-second budget. This design requires explicit approval before source or test changes.
