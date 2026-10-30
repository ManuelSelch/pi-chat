> **Retained legacy baseline, not current-system documentation.** Relocated from `docs/pi-server-extraction/DESIGN.md` during documentation cleanup. Original status/approval statements below are historical; outstanding scope and final acceptance are not inferred. Content is preserved with link repairs only. Missing former SDK workspace links now point to the owning SDK repository. See [retained scope](../docs-cleanup/RETAINED.md).

# Pi Server Extraction — Design

## Proposed Design
- Replace the delivered [SDK design](https://github.com/ManuelSelch/pi-chat/blob/3e0eb8585340a67e510270af4ceed071b9b1b0a1/docs/pi-server-extraction/SDK-DESIGN.md) with this server proposal. Prepare an isolated package under `packages/pi-server`, then extract it into the approved `Pi Agent/pi-server` repository. Retain existing feature organization; no architectural rewrite.
- Reuse bootstrap/application/runtime/transport implementations. Export `createPiServer(options)` with runtime/factory, catalogue/storage, extensions, files, logger, restart and optional static-directory injection. Return `httpServer` and `close()`; keep transport, mapping and catalogue implementations private. Export required structural types and `createPiRuntimeAdapter` for existing real-Pi drivers.
- Export `/extensions` with existing names and `Symbol.for("pi-chat.extension-registry")`. Export compiled fakes/fixture data and registry reset through `/testing`; `/testing/loopback` owns the isolated Swift fixture implementation. Chat retains its Swift suite and a plain-Node launcher.
- Compile an ESM CLI with declarations and explicit host/port/project/static/PID/log options. Default to headless `127.0.0.1:8788`. Keep runtime state under `~/.pi/agent`; preserve v2 behavior. Chat owns a thin compiled entry translating existing `PI_CHAT_*` settings, explicit web assets, launcher tracking and build-before-restart. Generic restart re-executes without building; supervised development disables it. Caller owns injected logger disposal.

## Decisions & Trade-offs
- Declare direct dependencies, including Pi 1.0.2; retain Node >=22.19 and Node 24 CI. Import the authoritative SDK `/protocol`; move server-only shared helpers into their consuming features. Add no utility package or protocol copy.
- Before publication, vendor pinned SDK/server tarballs with revision/checksum receipts and lockfiles. Bundle the installed SDK dependency in the server tarball using npm bundled dependencies, avoiding nested developer-local `file:` resolution. Verify packing explicitly; accept temporary artifact duplication rather than require registry publication.
- Move server-internal tests/diagnostics and independent CI with the package. Chat retains UI/domain/browser drivers, cross-repository Swift coverage and build-policy tests. Split coverage ownership, not assertions.
- Use a clean initial server commit with source attribution. Preserve notices; licensing remains a publication gate. No remote creation, pushing, publication, live replacement or runtime-state migration. Remove Chat's duplicated implementation only after acceptance; preserve rollback revisions.

## Verification
- Use small red/green tests through package/host drivers: public imports/declarations, lazy runtime creation, headless/static hosting, SDK initialization, extension singleton, shutdown and no-build restart. Cover Chat build-failure retention and successor PID rewrite.
- Test clean clones and isolated packed consumers without Chat/sibling sources, hoisting, frontend dependencies or TypeScript loaders. Verify fixture readiness, private storage and bounded cleanup.
- Run server suites, standalone SDK suites, Git-based SwiftPM consumption, Chat build/unit/browser/mandatory Swift integration and isolated production smoke. Repeat after source deletion; reject remaining private imports and obsolete compiled paths.

## Open Questions
None.
