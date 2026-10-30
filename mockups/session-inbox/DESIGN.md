# Session inbox — mockup

## Goal and scope
Explore an optional Settings toggle that hides the horizontal tabs and represents the same open sessions in the persistent sidebar. This request authorizes research and mockups only, not production implementation. All changes stay in the shared mockups workspace; production requirements and technical design are deferred until a direction is chosen.

## Revision and approval
- Revision: 1.
- Status: in review; not approved for implementation.
- Approval evidence: none.

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
- B: Inbox — one open queue with Needs you, Working, and Ready groups. Recommended starting point for the user's inbox idea.
- C: Project inbox — Needs you shelf followed by remaining open sessions grouped by project. No duplicated rows. A session needing attention moves out of its project group to the top shelf.

## Shared interactions
- Settings (top-right gear): Show open sessions in sidebar. On hides tabs and opens sidebar. Off restores tabs without changing the open-session set, selection, drafts or fake run states.
- Select a session without closing the sidebar, or clearing its attention state. Drafts belong to each session.
- Mark handled closes an idle session from the open queue, not an archive/delete. Hover/focus checkmark and persistent main-header button expose the same action.
- Handled shelf reopens a conversation. No automatic handling, archive, deletion, or auto-settlement.
- Working sessions cannot be marked handled in this mockup. Simulate response ready changes the selected Working session into Needs you.
- Send a local message to simulate Working. Nothing is actually sent. New session and project shortcuts create local fake sessions.
- Search title/project/branch; per-section counts reflect the filtered view; main inbox badge remains the total open count.
- Browse projects is deliberately subordinate to the open queue; clicking a project chip starts a fake session. It does not model the production history catalogue.
- Phone (760px and below) uses a modal drawer, retained until explicitly dismissed; desktop is non-modal. This approximates existing Pi Chat behavior rather than changing production breakpoints.
- No motion beyond library defaults; reduced-motion CSS is included.

## Direct review states
- /session-inbox/?concept=a
- /session-inbox/?concept=b (default)
- /session-inbox/?concept=c
- /session-inbox/?concept=b&tabs=true (tabs visible)
- /session-inbox/?concept=b&state=empty (all sessions handled)

## Fake or omitted behavior
React and local state only. No APIs, credentials, persistence, real agent work, real history, session archive, keyboard shortcut implementation, resizer, reorder, snooze, notifications, or runtime changes. All states reset on reload, except the selected concept is reflected in the URL. Reset demo restores the initial sessions and drafts.
The existing app exposes idle/running/blocked statuses. The mock's attention state includes both blocked input and a response ready for review; the latter would require an agreed attention/read model in production. Handled represents closing the runtime/navigation entry, not a new archive lifecycle. No production change is implied by prototype vocabulary.

## Outstanding questions
- Q1: Which layout should proceed: A (flat open list), B (status inbox), C (project inbox), or a combination?
- Q2: Should Needs you include every completed response until explicitly handled, or only blocked questions/approvals?
- Q3: Is Mark handled equivalent to closing the open session while preserving history, as mocked, or should it leave the session open in a separate section?

## Review and verification
Source inspection and HTTP serving checks only for the first preview. No browser automation, screenshots, builds or full suites requested or run. User performs visual and interaction review. Production planning and design approval are separate later steps.
