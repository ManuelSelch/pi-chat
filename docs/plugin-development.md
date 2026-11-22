# Plugin development tooling

- Each `plugins/<name>` directory with a `package.json` is an npm workspace via `plugins/*`. Keep its identity, exports, dependencies and standard scripts local; no application registration is inferred from workspace discovery.
- [Shared configuration](../config/plugins/) owns TypeScript, test-typecheck, Vitest coverage and ESLint defaults. Plugin configs extend/import them; UI plugins retain their React types and DOM test setup.
- TypeScript `${configDir}` keeps source/output paths local to the consuming plugin. Production builds exclude colocated tests; test typechecks include them without emitting files.
- [Shared cleanup](../scripts/clean-dist.mjs) removes only the invoking workspace's `dist/`. Local package scripts still run from their workspace directory.
- [Artifact verification](../scripts/verify-plugin-package.mjs) checks every declared export/type/condition against `npm pack` contents and rejects source/test leakage. Local verification scripts retain feature-specific assertions and runtime entry checks.
- [Plugin discovery](../scripts/plugin-workspaces.mjs) orders declared plugin dependencies before consumers and rejects duplicate names/cycles. Root build runs SDK, plugins, then Server; lint, test, typecheck, artifact, watch and coverage commands reuse discovery.
- Chat's development server watches `plugins/*/dist/**/*.js`; plugin compiler watchers are managed by Concurrently with sibling cleanup on exit.
- Adding a plugin needs no root command or coverage-list edits. Declare dependencies and explicitly register its runtime/UI capabilities in the embedding app as needed.
- Shared tooling is repository-owned development infrastructure, not a runtime dependency. Build/prepack from this checkout; published artifacts contain compiled exports and do not require these configs.
