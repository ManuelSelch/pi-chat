# Monorepo packages

- `packages/pi-chat`: browser shell, Chat backend, launcher extension, application tests/assets/configs/docs, examples, mockups and retained plans.
- `packages/pi-server`: HTTP/WebSocket hosting, Pi runtimes, persistence and host plugin activation.
- `packages/pi-sdk-typescript`: authoritative protocol/artifacts, client transport and synchronized projections.
- Root: private workspace composition, one lockfile, CI, Pi pipeline, coverage aggregation, system architecture and development docs.
- `plugins/folder-opening`: independent folder contract, browser client/state/UI, host provider and filesystem browsing, with colocated `__tests__` folders. Chat composes its public exports; Server reuses its directory service for existing directory operations and path validation.

## Boundaries and commands

- Dependencies resolve through matching workspace versions; no vendored candidates or sibling checkouts.
- Public exports stay compiled `dist/` entries. Chat's Vitest externalizes SDK/Server compiled entries to keep Chat mocks out of their internals.
- Root `npm run build`, `npm run dev`, `npm start`, `npm test` and browser/lifecycle commands delegate to the owning packages. Forward test filters with `npm test -- <filter>`.
- `test:packages`, `typecheck:packages`, `test:packages:coverage`, `verify:packages` and `verify:protocol` cover SDK/plugin/Server verification. The root Pi pipeline runs all suites.
- Package-local generated artifacts stay local. Root coverage aggregation only rewrites LCOV paths for combined analysis.
- Register the Chat extension from `packages/pi-chat`. Swift remains external and owns its compatibility tests.
- SDK/Server remain separately packable; isolated consumer verification installs local SDK, plugin and Server artifacts. External installation needs published matching versions or explicit tarballs. Nothing here publishes candidates or verifies Git-package distribution.

## Imported history

- SDK imported at `b4531f67af247571144723e1d00986eac944cf07` from `pi-sdk-typescript`'s `refactor/plugin-arch`.
- Server imported at `5ed800eae3b3f6981ff5acd98cdc2b985ce29738` from `pi-server`'s `main`.
- Non-squashed subtree imports retain original commits as ancestors. Earlier commits use original repository-root paths; inspect them by commit ID.
- Original repositories are unchanged. New work belongs here; imports are not ongoing synchronization.
