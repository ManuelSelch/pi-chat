# Pi Server Extraction — Slice 1 Design

## Proposed Design
- S1 is a read-only code audit plus a checked-in `BOUNDARIES.md` beside this design. Do not move sources, add exports, change dependencies or create destination repositories yet.
- Record the audited Pi Chat source revision (`495637bcf4ae3597406b05f9327a51962d94eb21`) and distinguish existing APIs from proposed package APIs.
- Map tracked server, shared, extension, SDK, script, configuration and test files to their future owner. Follow static imports, re-exports, dynamic imports, package scripts and runtime path assumptions; list every cross-boundary dependency and its disposition.
- Keep `packages/pi-sdk` together: authoritative contract, generated artifacts, TypeScript, Swift, experiments and tests. Keep web UI, navigation and Pi Chat launcher/build orchestration in Pi Chat. Assign shared helpers by actual consumers, not their current folder name.
- Define a minimal server embedding surface around the existing bootstrap: construction/options, HTTP listening and asynchronous disposal, runtime injection and required service contracts. Define an extension subpath preserving registration identity and a testing subpath for isolated fake-runtime/loopback fixtures. Internal transport/application classes stay private unless the consumer audit demonstrates a need.
- Record test and CI ownership, declared runtime/build dependencies and the implementation handoffs to S2–S4. No protocol or Swift feature changes.

## Decisions & Trade-offs
- Document boundaries before implementing package facades; avoid turning all existing deep imports into permanent public APIs.
- The Swift loopback fixture currently imports Pi Chat server sources. Specify its replacement through a server-owned fixture API and an explicit test dependency; keep production SDK dependencies server-free.
- Separate Pi Chat's rebuild-before-launch adapter from standalone compiled-server restart. Preserve runtime state under `~/.pi/agent`, loopback defaults and explicit static hosting.
- Retain existing layout during the audit; broad architectural restructuring is outside this slice.

## Verification
- Resolve and classify tracked import edges and non-import file references, including extension examples, test drivers, Swift fixture launch paths and CI scripts. Document intentional exceptions and unresolved findings rather than claiming unsupported isolation.
- Cross-check proposed exports against every external consumer and map each affected test/configuration file to its owner.
- Verify the source revision exists and `git diff --check` passes. S1 changes documentation only; independent installs, packed consumers, SwiftPM consumption and behavioral suites remain S2–S4 verification gates.

## Open Questions
None.
