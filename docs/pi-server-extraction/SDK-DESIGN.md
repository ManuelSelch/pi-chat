# Separate SDK Extraction — Design

## Proposed Design
- Implement S5–S6 only. Create `pi-sdk-typescript` and `pi-sdk-swift` directly under `/Users/manuelselch/Documents/A_Personal/40 Projekte/47 Agents/Pi Agent`; keep the grouping folder non-Git. Preserve S1's baseline audit as historical evidence; these decisions supersede its combined-SDK boundary.
- TypeScript repository root owns `package.json`, source, tests, generators and generated `protocol/schema` and `protocol/fixtures`. Preserve npm name `@manuelselch/pi-sdk`. Rename source/public `contract` to `protocol`, update consumers and omit the old export alias. Change artifact copying to replace only generated subdirectories: its current whole-directory deletion would erase the newly compiled protocol module.
- Swift repository root owns `Package.swift`, sources, unit tests and generation probe. Check in protocol artifacts with a TypeScript source revision/checksum manifest; provide explicit import/drift verification without sibling-source reads. Generators emit portable artifacts rather than writing into the other repository.
- Move real-server Swift loopback tests and their Node fixture into a Chat-owned SwiftPM integration harness depending on the extracted Swift SDK. Keep this suite mandatory in verification; standalone SDK tests use injected transports and pinned fixtures. Server packaging remains future work.
- Replace Chat's npm workspace with a checked-in local packed SDK artifact and lockfile dependency so fresh Chat checkouts do not require an absolute developer path or unpublished registry version. Update scripts, workflow and known SDK consumer references; remove embedded sources only after verification.

## Decisions & Trade-offs
- Use clean initial Git commits with Pi Chat source attribution. No remote, push, publication or live service replacement. Keep runtime state untouched.
- Root manifests make each language's tooling conventional. TypeScript remains the sole protocol authority; explicit artifact synchronization trades convenience for independent builds.
- A temporary vendored npm tarball permits reproducible consumption before publication. Document regeneration and artifact revision; do not commit dependency installations/build caches.
- Keeping loopback coverage in Chat avoids prematurely extracting the server or replacing a real-host test with a protocol mock. Both SDKs still have independent CI; Chat owns cross-repository integration.

## Verification
- Add failing public `/protocol` import and artifact-retention regressions before changing exports/copying.
- Run TypeScript clean install, build/typecheck/tests, schema drift and isolated packed consumer checks; Swift unit/probe tests, exact artifact checks and a local Git-based SwiftPM consumer build.
- Verify fresh clones, Chat build/typecheck/unit/browser suites, mandatory Swift loopback integration and production smoke with private test storage. Confirm no embedded-source imports, old public `/contract` consumers or accidental live-service changes remain.

## Open Questions
None.
