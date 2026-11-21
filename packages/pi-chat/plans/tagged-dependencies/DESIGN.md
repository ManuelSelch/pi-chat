> **Retained legacy baseline, not current-system documentation.** Relocated from `docs/tagged-dependencies/DESIGN.md` during documentation cleanup. Original status/approval statements below are historical; outstanding scope and final acceptance are not inferred. Content is preserved with link repairs only. Missing former SDK workspace links now point to the owning SDK repository. See [retained scope](../docs-cleanup/RETAINED.md).

# Pi Tagged Dependencies — Design

## Proposed Design
- Add MIT `LICENSE` files to all four repositories, set npm license metadata to `MIT`, and preserve third-party notices. Use `0.1.0` package versions and annotated `v0.1.0` tags.
- Commit generated `dist/` release output in the TypeScript SDK and server repositories. Keep existing build/prepack commands; include compiled exports, declarations, protocol resources and licenses in packaged files. CI rebuilds and rejects generated-output drift before release.
- Declare exact `git+https://github.com/ManuelSelch/<repository>.git#v0.1.0` npm dependencies. Lockfiles pin resolved commits. Remove server SDK bundling and all active vendor archive dependencies.
- Replace Chat's archive receipts with a release-pin manifest outside `vendor/`, verified against npm lock entries, package versions, public exports and Swift resolution. Include repository/tag/commit identities and protocol provenance, not machine-local paths.
- Change Chat's Swift integration package to a remote exact `0.1.0` SwiftPM dependency with committed `Package.resolved`. Retain the isolated fixture launcher and temporary agent storage; remove local bundle cloning only.
- Release verified SDK commits/tags first, then server, then Chat. Update the release matrix and active installation/update documentation. Preserve runtime behavior and do not restart the live service.

## Decisions & Trade-offs
- A disposable Git-package experiment with Node 26.5/npm 11.17 confirmed that `--ignore-scripts` suppresses preparation and installs no compiled output when `dist/` is untracked. Retest with CI's Node 24/npm before publishing.
- Committing compiled release output preserves clean `npm ci --ignore-scripts`, requires no consumer compiler bootstrap and avoids enabling arbitrary dependency scripts. The cost is generated Git diffs; deterministic rebuild checks catch stale output. Normal script-enabled Git installs may still rebuild through existing lifecycle commands.
- Use existing SDK heads after reviewing their differences from Chat pins: intervening changes are CI/configuration and package-verification fixes, not protocol/runtime changes. Swift's protocol snapshot remains intentional source-owned data; verify byte identity and record its corresponding TypeScript release provenance.
- No npm registry publishing, GitHub binary assets, new framework or application architecture changes are needed.

## Verification
- Prove cold-cache Git/tag installation and lockfile replay on supported Node/npm, including the server's transitive SDK dependency and packed isolated consumers.
- Run SDK protocol/typecheck/unit/Swift checks, server unit/package/export/CLI tests and generated-output drift checks.
- Run Chat build/unit/browser coverage, remote SwiftPM integration and isolated production restart/shutdown smoke from fresh checkouts. Check remote CI and peeled tag commits before downstream adoption.

## Open Questions
None.
