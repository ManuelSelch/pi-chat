# Session inbox — Requirements

## Goal
Implement the approved revision 14, concept B, from [the mockup](../../mockups/session-inbox/DESIGN.md): an optional session inbox replacing horizontal tabs, with an explicit Later queue separate from archive.

## Requirements
- **R1** — A remembered Settings toggle, “Show open sessions in sidebar,” enables Inbox and hides horizontal tabs. Disabling restores tabs without losing selection, drafts, open sessions or Later membership. Initially off for existing users.
- **R2** — Inbox lists Needs you, Ready, then Working. Needs you means blocked prompts only; completed responses become Ready. Selecting does not dismiss prompts. Working starts expanded and is collapsible. Preserve existing status colors.
- **R3** — Rows show project, title, time and available branch context without activity summaries. Search covers title/project/branch and filters section counts. Later stays collapsed during search and parking.
- **R4** — Move to Later closes an idle runtime without archiving/deleting its conversation. Remember parked session paths per browser/server across reloads. Explicit resume reopens and selects it. Preserve drafts during the current page lifetime, including when runtime identity changes. Running/blocked sessions cannot be parked; running sessions cannot be archived.
- **R5** — Header × clears selection only, preserving all session work and membership. Show an empty workspace with New session, not another session's transcript. Ordinary inventory updates must not reopen a deliberately closed view.
- **R6** — Header shows project → session breadcrumb, available branch, status, Later/archive/close-view controls and New session. New session uses the selected project or Quick Chats with no selection and remains available during other work. Settings moves to the fixed sidebar bottom. Preserve extension header slots.
- **R7** — Archive remains the existing server-backed action. Remove successfully archived sessions from Inbox/Later and offer Undo for the most recent archive. Keep existing archived-history access through existing navigation outside Inbox.
- **R8** — Reuse desktop non-modal sidebar and existing phone modal drawer breakpoints. Selection leaves navigation open; opening Settings dismisses the phone drawer. Inbox omits project browsing and sidebar New session. Preserve quickswitcher, keyboard access, focus ownership, widgets and composer positioning.
- **R9** — Failed parking/resume/archive operations leave recoverable membership and display errors; do not automatically retry ambiguous server outcomes. Reconcile stored Later entries with authoritative history and currently open runtimes; do not hide a runtime opened elsewhere.

## Assumptions
- Later membership is browser-local, not synchronized across devices. Drafts do not need reload persistence.
- Revision 14's visual time label will use available catalogue modification times; do not add a protocol timestamp solely for this presentation.

## Implementation Plan
### S1 — Inbox state and lifecycle
Description: Implement R2, R4, R5 and R9 using tested presentation state, server-scoped Later storage, safe SDK operations, and page-lifetime draft ownership. Verify explicit deselection, identity replacement, failures and reload reconciliation.

### S2 — Inbox navigation and settings
Description: After S1, implement R1, R3 and R8 with pure sidebar components and a container using existing responsive navigation. Verify search, collapse behavior, preference toggling and keyboard/focus access.

### S3 — Header actions and end-to-end regression coverage
Description: After S2, implement R6 and R7 and verify the complete flow through integration/browser drivers, including archive Undo, both navigation modes, responsive layout, per-session drafts, background work and extension slots. Run relevant tests, typecheck and build.

## Open Questions
None.
