# Pi theme — S1 approval and S2 verification

## Scope delivered
- User approved mockup revision 1 and the revised technical design, then requested S2 only.
- S1: preserved [approved mockup](../../mockups/pi-theme/DESIGN.md); stopped the agent-owned managed preview and verified PID 89897 and port 4187 were no longer active.
- S2: independent TypeScript SDK initial commit `f84ef0b`, corrected by `661fecd` to require theme without backward compatibility, in [pi-sdk-typescript](/Users/manuelselch/Documents/A_Personal/40%20Projekte/47%20Agents/Pi%20Agent/pi-sdk-typescript).
- No server implementation, production Chat UI, dependency/lockfile change, package version bump/publication, project push or live-service restart.

## Contract and client behavior
- Successful open/create results gain a sibling `theme`; summaries, snapshots, initialization, presentation events, methods and revisions are unchanged.
- Exported `SessionTheme` / `sessionThemeSchema`: bounded non-control name, explicit appearance, fixed semantic roles and page/card/info surfaces; colors must be six-digit RGB hex.
- Every successful open/create result requires a concrete palette. Missing, null or malformed palettes are protocol errors; no backward-compatibility path exists. Server production of the required palette is S3.
- Deeply immutable `ClientState.themes` caches by runtime ID, populated before publishing the opened session. Valid open/create results replace its entry; malformed results never clear it.
- Ordinary snapshots/presentation changes and reload leave the cache untouched. Same-server reconnect retains entries only for still-inventoried runtimes; close/removal/replacement/server-instance change clears them. No palette transfers to a replacement identity.
- New clients/browser refresh cannot recover themes through initialization. Theme refresh on reload remains deferred.

## Verification executed in the SDK
- Red: new contract/cache tests failed against the previous SDK (33 failing tests); a separate prototype-like runtime-ID regression also reproduced before its fix.
- Initial green: `npm run test:coverage` — **217 tests / 13 files passed**. After the user rejected backward compatibility, missing-theme rejection tests reproduced 5 failures before the correction. Final green: **219 tests / 13 files passed**, including generated JSON Schema/fixture drift checks and Swift-generation-probe drift.
- `npm run typecheck` — passed.
- `npm run verify:package` — passed after the correction: fresh packed installation, required-theme public result types, public protocol exports, ES-only typed consumer, palette caching, deeply immutable palette types/runtime values and dependency isolation.
- `git diff --check` — passed.
- Regenerated authoritative schema/fixtures: only open/create result schemas plus the new standalone theme schema and palette fixtures changed. The checked-in Swift feasibility probe required no content change.

## Not yet verified / next boundary
- S3 must produce palettes using real Pi themes in the independent server. S4 must consume verified package versions/artifacts and implement Mantine mapping.
- Native Swift and end-to-end real server/browser behavior were not executed in S2; do not infer native/runtime integration from schema/probe checks. Older-server interoperability is explicitly not supported or required.
- SDK package remains version 0.1.0 locally; published registry packages and Chat's pinned dependencies are unchanged.
