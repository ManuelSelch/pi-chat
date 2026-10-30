# Session inbox — mockup

## Goal and scope
Explore an optional Settings toggle that hides the horizontal tabs and represents the same open sessions in the persistent sidebar. This request authorizes research and mockups only, not production implementation. All changes stay in the shared mockups workspace; production requirements and technical design are deferred until a direction is chosen.

## Revision and approval
- Revision: 14.
- Status: in review; not approved for implementation.
- Direction selected: user prefers B (Inbox) and requested an untimed Later section, collapsed by default. Flat Later rows with project context are proposed for the user's small session count.
- Approval evidence: direction only; no approval for production implementation.

## Research
Reviewed the official T3 Code marketing screenshot and current upstream thread documentation for revision 1 (mutable sources, not a pinned release).
- Screenshot: https://t3.codes/_astro/app-desktop.BHuzLVLF_1h7zkL.webp
- Product: https://t3.codes
- Thread behavior: https://github.com/pingdotgg/t3code/blob/main/docs/user/thread-sidebar.md

Observed appearance: a persistent left column, no horizontal session tabs, stacked thread rows with project, title, branch, activity/status, search/new-thread actions, Working and Settled shelves near the bottom. The official screenshot uses a dark palette; these concepts preserve Pi Chat's current light palette instead.
Documented behavior: working threads can be folded separately and return to active work when finished, failed, or needing input. Opening a thread is distinct from explicitly settling it. Project grouping is an optional alternative; T3's grouping mode disables its Working section. T3 also documents snoozing, pinning, reordering and automatic settlement. Those are not proposed here.

The following are Pi Chat design proposals inspired by those patterns, not claims that T3 calls its navigation an Inbox.

## Concepts
- A: Open sessions — a flat vertical replacement for tabs, with project, branch and status context.
- B: Inbox — selected direction. One open queue ordered Needs you, Ready, then Working, followed by a collapsed Later shelf. Working has a clickable collapse/expand heading with its count visible; it starts expanded. Later is a flat list with project context, not nested project folders.
- C: Project inbox — Needs you shelf followed by remaining open sessions grouped by project. No duplicated rows. A session needing attention moves out of its project group to the top shelf.

## Shared interactions
- The header × closes only the current session view: clears selection and shows an empty workspace without changing its queue membership, status, drafts, messages, or running work. An idle session remains in Ready; a blocked/running session retains its actual status. Sidebar selection reopens it. This differs from Move to Later and Archive, and from the prototype tab-close action.
- Indicators reuse production status colors: Needs you/blocked = Mantine red-6, Working/running = yellow-6 (amber/orange), Ready/idle = green-6. Applies consistently to sidebar rows, header, tabs, and demo status dots.
- The current session title appears only in the header breadcrumb (project → session), not again above the transcript. Sidebar rows still identify their sessions.
- The duplicate Current session/title/metadata block above the conversation is removed. Branch context, status dot/label, and compact Move to Later action sit at the right of the same header. The mock data currently models branches only, not a distinct worktree name/path; no new worktree behavior is implied. On phones branch text truncates, status uses a dot with an accessible title, and the breadcrumb session title truncates rather than wrapping.
- Settings gear is anchored at the sidebar's bottom-left edge, outside its scrolling content. No header gear. Reopen a hidden sidebar using the header toggle to reach Settings. On phones, opening Settings dismisses the navigation drawer.
- Settings (sidebar bottom gear): Show open sessions in sidebar. On hides tabs and opens sidebar. Off restores tabs without changing the open-session set, selection, drafts or fake run states.
- Select a session without closing the sidebar, or clearing its attention state. Drafts belong to each session.
- Session rows omit activity summaries. Project, title, time and status remain; Ready rows show branch metadata only when a branch exists; no Personal conversation fallback. Fake activity text used inside the demo conversation is not sidebar content.
- Move to Later parks an idle session outside the open queue, equivalent in intent to the user's current close-tab workflow. It is not archiving, finishing, or deleting. Hover/focus clock action and main-header button expose the same action; closing a prototype tab parks the same session.
- Later is collapsed by default, shows a separate count, and stays collapsed when a session is moved into it. Expanded, it shows a flat list with project name above each title. No project grouping or extra grouping setting. Two seeded Later conversations demonstrate the list.
- Clicking a Later session explicitly restores it to its previous Inbox status and selects it. No timer, reminder, automatic wake-up, or background reopening. Drafts and local messages survive parking/resuming within the current page lifetime. The sidebar has no Inbox heading, icon, or total-count badge; the close control and section counts remain.
- Archive icon sits immediately beside Move to Later in the current-session header and sidebar row hover/focus actions. Local archiving removes a session from Inbox and Later without deleting its conversation or drafts. A notice offers Undo archive to restore the most recently archived session. Production archived-history browsing is not simulated. The old Handled vocabulary is removed.
- Working sessions cannot be moved to Later or archived in this revision. Simulate response ready changes the selected Working session into Needs you.
- Send a local message to simulate Working. Nothing is actually sent. The empty-state New session action creates a local fake session.
- Search title/project/branch; per-section counts reflect the filtered view; there is no total-count badge beside the Inbox heading. Later is filtered too and its count shows matches during a search, but search never automatically expands it.
- The sidebar New session button remains omitted. A plus icon at the top-right of the main header creates/selects a local session in the current project, or Quick Chats if no session is selected. It remains available while another session is working. The existing production quickswitcher remains an alternative (not simulated here).
- Browse projects and its project shortcuts are removed from the Inbox. The explanatory Later/archive footer note is also removed; the bottom gear remains.
- Phone (760px and below) uses a modal drawer, retained until explicitly dismissed; desktop is non-modal. This approximates existing Pi Chat behavior rather than changing production breakpoints.
- No motion beyond library defaults; reduced-motion CSS is included.

## Direct review states
- /session-inbox/?concept=a
- /session-inbox/?concept=b (default)
- /session-inbox/?concept=c
- /session-inbox/?concept=b&tabs=true (tabs visible)
- /session-inbox/?concept=b&state=empty (all sessions in Later)

## Fake or omitted behavior
React and local state only. No APIs, credentials, persistence, real agent work, real history, backend archiving, keyboard shortcut implementation, resizer, reorder, timed snooze, notifications, or runtime changes. All states reset on reload, except the selected concept is reflected in the URL. Reset demo restores the initial sessions and drafts.
The existing app exposes idle/running/blocked statuses. The mock's attention state includes both blocked input and a response ready for review; the latter would require an agreed attention/read model in production. Later represents the user's close-tab-for-now intent, not a new archive lifecycle. Actual runtime closure/persistence behavior is left to a future production design. No production change is implied by prototype vocabulary.

## Outstanding questions
- Q1 (resolved): user selected B (Inbox).
- Q2: Should Needs you include every completed response until explicitly moved to Later, or only blocked questions/approvals?
- Q3 (resolved): user clarified closing a tab means returning later, not finished work, and requested a separate untimed Later section collapsed by default. Archive remains separate.
- Flat Later rows with project labels are proposed for review; revisit grouping only if the list actually grows.

## Review and verification
Source inspection and HTTP serving checks for revisions 1–14. No browser automation, screenshots, builds or full suites requested or run. User performs visual and interaction review. Production planning and design approval are separate later steps.
