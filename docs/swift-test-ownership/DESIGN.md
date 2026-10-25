# Swift Test Ownership — Design

## Overview
Move Chat's cross-language harness into pi-sdk-swift as a separate integration SwiftPM package. Reuse the published server's compiled fixture; keep Node out of ordinary Swift product/unit builds.

## Components
| Package/module | Component | Change | Responsibility |
|---|---|---|---|
| pi-sdk-swift | Proposed integration harness | New, relocated from Chat | Depend on root SDK via local SwiftPM path; own scenarios, bounded fixture driver and per-test diagnostics |
| pi-sdk-swift | Proposed integration npm manifest/lock and runner | New | Pin @manuelselch/pi-server@0.1.0; prepare installed fixture and run Swift harness |
| pi-sdk-swift | Tests workflow and README | Changed | Run dedicated mandatory macOS integration job; document separate prerequisites |
| pi-server | src/testing/loopback.ts and package checks | Reused | Own isolated server process, fake deterministic runtime and shutdown receipt |
| Pi Chat | test/swift-integration, Swift scripts/vendor assets and workflow | Removed | No remaining ownership of Swift compatibility testing |

Fixture workspace lifetime belongs to the server process and test driver; each scenario owns its client and process. Successful artifacts are removed; failed diagnostics are retained.

## Runtime flow
1. Swift integration CI checks out pi-sdk-swift, selects stable Xcode and Node 24, and installs its exact npm lock with lifecycle scripts disabled.
2. The integration runner invokes the separate SwiftPM harness, which imports the root checkout's PiSDK product, not a bundled older revision.
3. The driver starts a plain-Node launcher importing @manuelselch/pi-server/testing/loopback. It reads the bounded stdout readiness record and connects using the real URLSession transport.
4. Scenarios exercise initialization, create, streaming, stop, disconnect/reattach and retained-runtime cleanup. Driver guarantees process termination on failure and retains diagnostics.
5. Only after replacement tests pass, remove the old Chat harness and Swift-only vendoring/tooling. Preserve Chat's unrelated colored-widget server tarball.

## Contracts & API changes
| Provider → consumer | Current → proposed contract | Compatibility |
|---|---|---|
| pi-server → Swift harness | Existing public loopback export → same export from locked npm0.1.0 | No server API or protocol changes |
| Swift SDK → integration harness | Chat's vendored Swift revision → local root product | Tests cover the actual SDK checkout |
| CI → Swift tests | Unit/probe tests only → unit/probe plus separate required integration job | Node remains integration-only |
| Chat → Swift validation | Chat owns mandatory suite → no Swift validation | Replacement coverage must pass before removal |

## Decisions & Trade-offs
- A separate harness avoids requiring npm for normal swift test and consumer builds. Missing fixture dependencies fail rather than silently skip integration tests.
- Use npm ci --ignore-scripts and explicit invocation; no global installs, sibling discovery or live agent state. Resolve process executables explicitly and use argument arrays, avoiding newly introduced PATH-based Sonar findings.
- Published server0.1.0 suffices for existing streaming scenarios; widget-color behavior is outside scope. No package publication, remote changes or production SDK changes.
- Existing fixture uses a real server with a fake runtime; this verifies transport compatibility, not a real-model conversation or full Swift parity.

## Verification
- First demonstrate missing integration prerequisite failure, then run relocated scenarios against installed npm server and local SDK checkout, including successful cleanup receipt and unreachable endpoint failure.
- Run Swift unit/probe and protocol-artifact checks separately; ensure missing npm dependencies do not prevent those tests.
- Run server compiled fixture/package checks and inspect required CI job wiring; local checks do not claim a remote workflow run.
- After removal, run Chat unit tests, build and browser suite; scan active references to removed Swift tooling. Keep historical extraction documents intact and update current ownership instructions.

## Open Questions
None.
