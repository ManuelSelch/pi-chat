# Session inbox — Design

## Overview
Implement revision 14 concept B as an optional browser presentation over existing PiClient inventory and catalogue. Keep server/SDK wire contracts unchanged: Later uses existing close/open operations, archive retains its existing server lifecycle, and closing a view only changes browser selection.

### Production-review correction proposal

The user's production review supersedes the original runtime-only interpretation of Ready and the replacement empty workspace:

- **Ready:** every saved, unarchived idle conversation, excluding those explicitly parked in Later. Derive membership from the catalogue, then overlay live inventory by session path. Blocked/running conversations appear only in their respective sections; unsaved live sessions remain visible. Deduplicate loaded and saved representations. No separate remembered-open-session list or automatic runtime reopening is needed.
- **Selection and actions:** selecting a loaded row focuses its runtime; selecting an unloaded Ready row opens its saved path through the existing SDK operation. Parking an unloaded saved row only stores Later membership; parking a loaded idle row retains the existing close lifecycle. Archive/Undo continue to use server metadata; unarchiving an unloaded conversation makes it Ready again without creating a runtime. The inbox model and lifecycle controller own these decisions; views receive values and callbacks.
- **Closing empty sessions:** the original close cleanup must remain for an idle session with no conversation messages and no pending prompts/run. Header × calls the existing runtime-close operation for that case, removing the empty session from live inventory rather than leaving a Ready row. This is disposal of an empty runtime, not deletion of saved conversation history. Nonempty sessions retain close-view behavior: header × clears selection without stopping work or changing membership. Do not infer emptiness solely from absence in the catalogue; a first conversation may be running or not yet persisted.
- **Home:** reuse the original `Home` component whenever no conversation is selected/open, including after header ×, parking/archiving the last runtime, and starting with catalogue history but no live runtimes. Preserve its search, New session and Open folder actions. Remove the replacement `InboxEmpty` component. Header without selection says No session open, not Inbox clear when saved Ready rows exist.
- **Visual correction:** `main.tsx` imports unlayered Mantine CSS, whose UnstyledButton reset overrides layered Tailwind width/display/padding utilities. This explains the collapsed row hitboxes and control overlap in the supplied screenshot. Use scoped Mantine layout/spacing props for the affected inbox buttons and text, and match the approved mock's row/context typography, spacing and action reservation. The same correction must cover the top-right header controls: reserve non-shrinking space for each action, truncate breadcrumb/branch text first, and prevent extension slots or status labels from overlapping adjacent icons at narrow widths. Do not change the global CSS cascade or redesign the mock.
- **Verification:** add catalogue-only Ready, loaded/history deduplication, Later exclusion, unloaded-row actions and original-Home regressions. Browser tests must recreate the backend with saved history but no live runtimes, then open a Ready row. Assert actual row padding/hitbox geometry and non-overlap of metadata, title and action controls at desktop and phone widths, not just element presence. Retest existing sessions, focus and navigation flows.

The user explicitly approved these corrections before implementation. The original baseline below is retained for review history where superseded above.

### Worktree-first labels — approved refinement

- User requested linked worktrees to show branch/worktree name as the large primary row label and the conversation title as smaller muted text. Keep project context above with the status indicator beside the project name, leaving the primary and secondary labels unindented. Do not repeat an identical branch/title.
- Scope is Inbox rows (Needs you, Ready, Working and Later), not the header, stored names, lifecycle or original Projects panel.
- The pure inbox model will derive proposed primary/secondary display labels using existing catalogue worktree metadata: only `worktree.primary === false` with a nonempty branch promotes the branch. Main checkouts, missing metadata and non-worktree sessions retain their session title.
- `InboxRowView` receives the derived display labels; retain original title/path/runtime identity for actions and search. Multiple sessions in a linked worktree retain distinct secondary titles.
- Internal row presentation values change; SDK/server/storage contracts and dependencies remain unchanged. Keep truncation and action reservation for non-running rows; running rows omit Move to Later/Archive entirely and reclaim that text width.
- Planned model/component regressions cover linked versus primary, missing branch, repeated title, multiple sessions, live/history and Later. Existing lifecycle and responsive browser checks remain applicable.
- Section headings use 2px left padding, including Needs you for consistent alignment.
- Visual baseline: [isolated label mockup](../../mockups/session-inbox-worktree-labels/DESIGN.md), revision 4. User approved the linked refinement and reviewed mockup with “looks good. impelement”. No blocking questions.

### Worktree repository-name regression — approved correction

- Confirmed cause: saved Inbox rows use checkout `name`; live rows overwrite context with `tab.projectName`. Neither uses the existing catalogue `repositoryName`, unlike the original Projects grouping.
- The Inbox domain model will resolve project context from catalogue `repositoryName ?? name` for saved rows and catalogue-backed live rows. Live rows without a catalogue entry retain their runtime project name. This is handling incomplete discovery, not supporting an older protocol.
- Preserve branch-first labels, conversation subtitles, identities, lifecycle, non-repository names and Quick Chats. Scope excludes header, SDK/server, stored names and original Projects panel. No layout redesign or new dependency.
- The browser fixture accepts an explicit `repositoryName` and creates the real primary Git checkout directory with that name; it must be a safe directory name distinct from the linked checkout. The scenario supplies `my-project` rather than depending on a hidden fixture constant.
- Regression contract: [repository-name browser scenario](../../test/e2e/inbox-worktree-labels.spec.ts) uses a real linked Git worktree whose repository, checkout and branch have distinct names. Assert the exact project-context text for live, backend-restarted unloaded Ready, Later on desktop/phone, and resumed rows, while retaining branch/subtitle assertions.
- Supporting unit tests will cover catalogue-based naming across live statuses, saved history and missing catalogue metadata. Existing worktree-label and lifecycle scenarios remain unchanged.
- Verification planned: focused unit/browser regressions, full relevant suites, build/typecheck. Scenario preparation has not run tests yet. No blocking questions.

## Components
| Package/module | Component | Change | Responsibility |
|---|---|---|---|
| Chat application | [app-state](../../src/web/app/state/app-state.ts), [usePiChat](../../src/web/app/use-pi-chat.ts) | Changed | Own explicit selection, runtime actions and reconciliation; distinguish empty selection from absent runtime |
| Sessions inbox | Proposed inbox model, Later storage adapter and controller | New | Derive sections from inventory, store parked paths scoped to normalized server endpoint, coordinate parking/resume/archive/Undo |
| Sessions inbox | Proposed InboxView / InboxContainer | New | Pure accessible rows/sections; container binds presentation to application operations |
| Chat composer | [ComposerContainer](../../src/web/chat/composer/ComposerContainer.tsx) | Changed | Use application-owned page-lifetime drafts keyed by session path when available, runtime ID otherwise; transfer drafts when an unsaved runtime gains a path |
| Shell / navigation | [App](../../src/web/app/App.tsx), [HeaderView](../../src/web/app/shell/HeaderView.tsx), overlays | Changed | Mode-dependent header height, explicit empty workspace, responsive sidebar/drawer, existing extension slots |
| Settings | [SettingsContainer](../../src/web/settings/SettingsContainer.tsx) and proposed preference hook | Changed | Persist mode preference, initially off; enabling opens sidebar |
| SDK / server | PiClient inventory/catalogue and close/open/archive operations | Reused | Authoritative runtime, conversation persistence and archive ownership |

Later is durable browser-local membership, keyed by conversation path; it is not inferred from all closed history. Search and collapse state are view-local; Later starts collapsed and Working expanded. Drafts and the single archive-Undo record live for this page only.

## Runtime flow
1. Enabling Inbox hides tabs and opens the existing responsive navigation panel. Derive Needs you from blocked status only, Ready from idle, Working from running. Selection does not alter these statuses.
2. Parking rechecks the current idle runtime and captures its path/draft. Persist a pending parking intent before close, suppress duplicate actions, and call PiClient.closeSession. Confirmed success commits Later membership; a definite failure rolls back. An ambiguous outcome is reconciled against authoritative inventory, without retry. A session without a saved path cannot be parked until its path is available.
3. Resume calls PiClient.openSession(path); remove Later membership only after confirmed opening and select the returned identity. Stable-path drafts survive this identity change. Failure leaves the Later entry recoverable.
4. Header × explicitly clears selection without calling closeSession. SDK updates preserve this empty selection. Render no session transcript, composer, widgets or prompts until explicit selection/new-session creation. Removed selected runtimes may still use the existing next-session fallback, distinct from deliberate deselection.
5. Archive calls the existing archive operation, which also closes an open idle runtime. Only confirmed success clears Later membership and records Undo. Undo unarchives; restore prior Later membership or reopen the formerly open session. Failure remains visible and recoverable.
6. On connection/catalogue refresh, reconcile Later with non-archived catalogue history and open inventory. Open inventory wins over stored Later so externally reopened work remains visible. Do not prune entries before authoritative catalogue availability. Reconcile pending parking intentions before treating open inventory as a resume.

## Contracts & API changes
| Provider → consumer | Current → proposed contract | Compatibility |
|---|---|---|
| SDK/server → Chat | Existing inventory, catalogue, close/open/archive operations → unchanged | No protocol, package or dependency changes |
| Browser state → shell | Selection implicitly falls back to first session → explicit no-selection state supported | Internal behavior change; audit activeSession/atHome callers to prevent leaked fallback content |
| Browser storage → inbox | No Later membership → validated server-scoped saved paths and pending parking intents | New local data only; no legacy compatibility shim |
| Actions → tabs/inbox | Tab close closes runtime → in Inbox mode close-tab action means idle-only Move to Later; header × is close-view | Tab mode retains existing running-close confirmation; Later membership is retained across mode toggles |
| Catalogue → inbox | Existing project/worktree and modified-time metadata → labels/search/time display | No fabricated branch values or backend timestamp additions |

## Decisions & Trade-offs
- User resolved attention semantics: completed responses become Ready, not unread attention. No read/acknowledgment model is introduced.
- User approved remembering Later across reloads by closing idle runtimes and reopening on resume; drafts only persist during the page lifetime. Never reopen Later automatically.
- Keep Inbox separate from project browsing; tab mode and quickswitcher retain existing discovery/history access. No new navigation mode beyond the approved toggle.
- Guard parking/archive against busy state in controller and UI. Server operations remain authoritative; state races can fail and must not silently lose membership or drafts.
- Browser-local storage is not shared across devices. Storage failures must be surfaced rather than falsely promising durable parking.
- Reuse Mantine, current breakpoints/theme tokens and feature-first component/container conventions. No new dependencies, React Grab or prototype state machinery enters production.

## Verification
- Reducer/model tests: explicit deselection across SDK updates, status mapping, server-scoped storage validation, pending parking reconciliation, removed/archived entries and externally reopened runtimes.
- Controller tests: close/open success/failure and ambiguous outcomes, duplicate action guards, busy guards, runtime replacement, draft transfer, archive/Undo and preference switching.
- Component tests: filtered counts, collapsed Later, Working toggle, row actions, accessible controls and truncation structure.
- Driver-based browser/integration coverage: park/reload/resume, archive/Undo, empty view while background work continues, drafts across reopen, mode toggling, desktop/phone navigation and existing extension/focus behavior.
- Run relevant suites, TypeScript and production build. These are planned checks, not results.

## Open Questions
None. Technical design approval is still required before production implementation.
