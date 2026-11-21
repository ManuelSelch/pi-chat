# Monorepo packages

- Chat remains at the repository root (`src/`, `testing/`, `extension/`).
- [TypeScript SDK](../packages/pi-sdk-typescript/README.md) lives in `packages/pi-sdk-typescript`; it owns protocol schemas/artifacts, transport and client projections.
- [Server](../packages/pi-server/README.md) lives in `packages/pi-server`; it owns hosting, Pi runtimes, persistence and host plugin activation.
- One root `package-lock.json` installs npm workspaces. Matching dependency versions resolve to local workspace links, not vendored tarballs or sibling repositories.
- Imports still use public package exports backed by compiled `dist/` entries. No source aliases or changed wire/runtime behavior are introduced.
- Chat's Vitest runner externalizes compiled SDK/Server workspace entries, preserving the installed-package boundary so Chat module mocks do not rewrite package internals.
- Swift remains external and owns its compatibility tests. Generating its portable protocol probe requires no Swift toolchain.

## Development and verification

- Run `npm ci --ignore-scripts` at the root, then `npm run build` or `npm run dev`.
- `build` compiles the source-only test harness, then SDK → Server → Chat. `dev` builds packages first and watches package compilation alongside the host and Vite.
- `npm test` runs Chat tests. `npm run test:packages` runs SDK and Server tests; build packages first when running this command alone.
- `npm run typecheck:packages`, `npm run test:packages:coverage`, `npm run verify:packages` and `npm run verify:protocol` cover package typing, coverage, isolated tarball consumers and generated-artifact drift.
- Run the root Pi pipeline for all suites, including browser tests and production restart smoke. CI runs all three packages; normalized workspace LCOV feeds the root Sonar analysis.
- SDK and Server retain independent package exports and packability. Isolated Server verification packs and installs both local artifacts, without requiring unpublished versions from npm.
- Installation outside this workspace requires published matching package versions or explicitly supplied tarballs. Migration neither publishes candidates nor verifies Git-package distribution.

## Imported history

- SDK history imported at `b4531f67af247571144723e1d00986eac944cf07` from `pi-sdk-typescript`'s `refactor/plugin-arch`.
- Server history imported at `5ed800eae3b3f6981ff5acd98cdc2b985ce29738` from `pi-server`'s `main`.
- Non-squashed subtree imports retain original commits as ancestors. Earlier commits use original repository-root paths; use their commit IDs to inspect them.
- The original repositories are unchanged. Ongoing changes belong here; the imports are not a synchronization mechanism.
- Plugin feature colocation and shell contribution APIs remain subsequent work, not part of this migration.
