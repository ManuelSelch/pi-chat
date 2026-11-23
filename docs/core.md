# What belongs in the core?

- **Proposed maintenance boundary**, based on the current implementation; not evidence that a feature is unused and not approval to remove it.
- Essential = needed for a trustworthy Pi chat shell. Optional = useful but not needed for that shell. Removable = retired code or a concrete cleanup candidate requiring the checks below.
- A feature can be optional without needing its own package. Keep direct code until a real ownership boundary justifies extraction.

## Essential: the minimal working shell

| Capability | Owner | Why keep it |
| --- | --- | --- |
| Serve/connect/initialize, validate requests, recover snapshots, report uncertain outcomes | Chat host + Server + SDK | Reliable commands and state, not infrastructure decoration |
| Create, select and explicitly close runtimes; reconnect without stopping background work | Server lifecycle + Chat navigation | Separate conversations without accidental data/work loss |
| Catalogue saved history and reopen by path | Server projects + Pi persistence | A chat shell must recover existing work |
| Composer, streamed transcript, tool results, errors, abort and basic Markdown | Chat + Pi adapter | The actual conversation interface |
| One navigation path: Home/search and Sessions sidebar/phone drawer | Chat sessions | Current retained UI; no alternate tab mode |
| Delegate native commands, skills, resources, model/thinking selection, compaction, reload and steering | Pi through the Server adapter | Reuse Pi's behavior instead of building another agent engine |
| Present native extension questions and submit answers safely | Server prompt registry + Chat presentation | Otherwise tools/extensions can wait on invisible interactions |
| In-page drafts, focus ownership and transcript scroll intent | Chat | Switching sessions/dialogs must not lose input or fight the reader |
| Deterministic disposal, safe host binding/origin checks and bounded diagnostics | Host + Server | Required safety and operational correctness |
| Behavioral tests and package/protocol checks | Owning package/testing infrastructure | Prevent simplification from silently changing retained behavior |

- Core does **not** mean every current control is mandatory: native model selection remains; the duplicate Settings controls have been removed.
- Persisted Pi history remains Pi-owned. Core must not add a second transcript database, tool runner, credential store or model scheduler.

## Optional: retain only when useful

| Capability | Current location | Boundary / trade-off |
| --- | --- | --- |
| Open another server folder through a picker | [folder-opening plugin](../plugins/folder-opening/README.md) | Optional browsing UI; core still creates a session for a supplied project path |
| Open local links in an OS application | [file-opening plugin](../plugins/file-opening/README.md) | Optional host/filesystem effect, not transcript rendering |
| Git diff/Changes panel | [diff-viewer plugin](../plugins/diff-viewer/README.md) | Independent Git workflow; shell only supplies a panel outlet |
| Completion chimes | [chimes plugin](../plugins/chimes/README.md) | Browser-only audio and preferences |
| Later parking and archive actions | Chat Inbox + Server archive metadata | Useful organization, not basic open/send/reopen; currently retained, archive always hidden |
| Repository/worktree discovery and branch-first labels | Server projects + Chat session projections | Richer discovery/context; a flat session catalogue could work without it |
| Argument suggestions, rich skill/tool previews, syntax/math rendering | Composer/transcript modules | Presentation/discovery beyond basic text and tool results |
| Widgets/footer, ANSI styling, dock/grid layout | Server extension registries + Chat extensions | Extension output compatibility; removing it affects users of those extensions |
| Compact transcript preference, rich Home activity groups, extra keyboard entry points | Chat features | Product convenience; distinguish shortcuts from the required underlying action |
| Agentation UI feedback | Chat Settings | Development aid; not part of the conversation contract |
| Alternate WebSocket endpoint preference | Chat Settings | Needed only when the page-derived endpoint is insufficient; not authentication |
| Managed build/restart launcher and version display | Chat extension/host/Settings | Operational convenience beyond starting a server directly |
| README capture tooling and bundled Classic palettes | Chat scripts/themes | Supporting assets, not runtime-core responsibilities |

- Existing plugins are explicitly bundled/registered, not dynamically installed or toggled as a group. Optional is an ownership classification, not a working runtime disable switch.
- Pi extension UI and workspace plugins are different extension mechanisms; do not move every native Pi feature behind workspace plugins merely to shrink a folder.

## Completed removals

- Legacy tab bar, Projects drawer and sidebar/path/archive preference branches are deleted; [usage](../packages/pi-chat/docs/usage.md#sessions) documents the retained behavior.
- Unused `StatusBadge` component and its types are deleted. No consumers or public exports remained.
- Take-control UX/API and superseded connection state are deleted; all socket closures use normal reconnect/backoff.
- Project pinning is deleted from SDK/Server methods, schemas, catalogue projection and metadata writes. Archive/project-removal metadata and Pi histories remain.
- Settings no longer has a Session section. Native `/model`, `/thinking` and `/compact` commands and their underlying Server/SDK operations remain.

## Removable: evidence and approval needed

| Candidate | Evidence today | Before removing |
| --- | --- | --- |
| Project remove and continue-recent API paths | Still public Server/SDK contracts; Chat has no project-removal control and does not call continue-recent in its normal open/create flow | Audit native/external consumers and persisted metadata; a missing Chat button is not proof of an unused API |
| Stale README capture assumptions | [Capture guide](../packages/pi-chat/docs/readme-showcase/CAPTURE.md) records retired UI selectors and unverified appearance assumptions | Decide whether to repair the workflow or retire it; keep approved mockups/assets unless separately authorized |

## Decision rule for the next cleanup

- Ask which optional capabilities are actually used; do not infer usage from feature size or test counts.
- Remove a capability end to end: UI, wiring, preferences, protocol only where safe, obsolete tests and documentation. Preserve unrelated tests and saved data.
- Public SDK/Server APIs also serve other clients. Removing them is a separate contract decision, not an automatic consequence of simplifying Chat.
- Prefer fewer concepts and owners over more plugin machinery. Keep shared protocol/lifecycle code where all clients need it.
- No additional capability is removed by this document. See the [architecture map](architecture.md) before choosing the next slice.
