# Session inbox — Design

## Overview
Implement revision 14 concept B as an optional browser presentation over existing PiClient inventory and catalogue. Keep server/SDK wire contracts unchanged: Later uses existing close/open operations, archive retains its existing server lifecycle, and closing a view only changes browser selection.

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
