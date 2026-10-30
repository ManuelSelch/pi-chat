# Pi Chat Projects Panel — Requirements

## Goal
Keep the projects panel open while working in a session: the transcript and message editor/composer remain usable alongside project navigation. Preserve the existing activity-based project ordering and grouping.

This extends the earlier recency plan in place. Existing recency requirements are retained below and assigned stable IDs. This is a planning-only change; production implementation requires mockup review and approved technical design.

## Requirements
- **R1** — Quick Chats remains first and separate from repository groups.
- **R2** — Pinned projects remain in their separate section, without duplication in recent or other projects.
- **R3** — Every unpinned project with at least one unarchived session appears in the recent list, with no five-project limit.
- **R4** — Other projects contains only visible unpinned projects with no unarchived sessions and remains collapsed by default.
- **R5** — Order recent projects by their latest unarchived session modification timestamp, newest first. Archived sessions must not promote a recent project.
- **R6** — Compute recency across all sessions in a repository group, including primary and linked worktree checkouts.
- **R7** — Resolve equal timestamps deterministically by project name, then group key.
- **R8** — Preserve existing session ordering within each project and current-project expansion behavior.
- **R9** — Archiving the last unarchived session moves an unpinned project into Other projects; restoring a session returns it to the recent list in recency order.
- **R10** — Keep project-history removal controls limited to Other projects.
- **R11** — On supported side-by-side layouts, opening Projects does not block transcript interaction, scrolling, message entry, submission, or session controls. The panel must not trap focus, lock page scrolling, dim the session, or mark the session inaccessible.
- **R12** — Users can deliberately move keyboard focus between the panel and session. Opening the panel does not discard the current draft or change the active session. Ordinary catalogue and streaming updates do not steal focus from either region.
- **R13** — The panel can remain open throughout work in a session, including streaming and tab changes. Clicking or typing in the session does not dismiss it. Retention after selecting or creating a session is subject to Q2.
- **R14** — Provide an accessible explicit Projects toggle/close control. When closing removes the focused control, return focus to an appropriate visible control; never override a real modal's focus ownership. Opening settings, folder selection, or another real modal retains that modal's blocking and focus behavior.
- **R15** — Keep the transcript, composer, header controls, and optional widget dock usable without overlap or clipping when the panel is open. Exact desktop layout and narrow-screen behavior are subject to Q1 and Q3.
- **R16** — Preserve project actions, archive visibility preferences, worktree grouping, session switching, and existing Quick Chats behavior. Do not change server persistence, catalogue discovery, recency timestamps, or session lifecycle semantics.
- **R17** — Distinguish non-modal project navigation from blocking dialogs in keyboard handling: keeping the panel open must not disable normal session shortcuts. Escape behavior must follow the approved focus/interaction design and must not bypass an actual modal.

## Assumptions
- “Editor” means the current session's message composer and surrounding chat workspace, not a separate file editor.
- Recency means session modification activity using the existing session.modified field; merely opening an old session does not count as new activity.
- Pinned projects and Other projects retain alphabetical ordering; recency ordering applies only to recent projects.
- The existing catalogue refresh lifecycle supplies updated session timestamps; no additional refresh mechanism is needed.
- Desktop recommendation, not yet approved: a docked left sidebar that reduces the workspace width rather than covering it.
- Recommended retention, not yet approved: selecting or creating a session keeps the desktop sidebar open.
- Recommended narrow-screen fallback, not yet approved: retain a modal drawer when side-by-side use would make the composer impractical.
- No new resizable-panel controls, auto-opening defaults, or reload-persisted panel preference are proposed. Persistence across a browser reload is outside this change.
- The prior recency slices are reflected in the current implementation. Their behavior is retained as regression scope, not scheduled for reimplementation. Unrelated root requirements remain unchanged.

## Implementation Plan
### S1 — Model Project Recency
Description: Retained earlier slice, already reflected in the current model. R5–R7 define repository-group recency from unarchived session modification times, deterministic ties, and linked-worktree aggregation. Preserve and rerun the focused pure-model tests; do not reimplement completed behavior.

### S2 — Remove the Recent Project Limit
Description: Retained earlier slice, already reflected in the current panel. Depends on S1. Preserve R1–R4, R8, and R10, checking more than five active projects, current-project expansion, and removal controls during the sidebar change.

### S3 — Verify Archive and Restore Transitions
Description: Retained earlier regression slice, dependent on S1–S2. Preserve R9 with catalogue-update tests covering archive/restore membership and ordering. Keep these checks in the new panel's verification scope rather than changing archive semantics.

### S4 — Approve Sidebar Interaction and Design
Description: Resolve Q1–Q3, create an isolated mockup showing the open panel beside a usable session and its narrow-screen state, and obtain explicit user approval. Browser automation for mockup review is opt-in. Then inspect the affected shell, panel, composer, widget layout, overlay state, focus helpers, and keyboard handling; write docs/projects-panel/DESIGN.md and obtain explicit approval before production code or tests. Covers R11–R17; no production implementation in this slice.

### S5 — Integrate Non-modal Project Navigation
Description: Depends on S4 approvals. Implement the approved panel placement, visibility lifecycle, and responsive behavior without changing list semantics. Make the transcript/composer and widget placement respect the available workspace. Separate non-modal navigation from blocking overlay behavior, including keyboard and focus handling. Verify typing/submission with the sidebar open, session changes, real-modal ownership, and explicit panel closure in focused DOM tests. Implements R11–R17 while preserving R1–R10.

### S6 — Verify Session and Responsive Workflows
Description: Depends on S5. Add browser regressions for opening Projects from an active session, typing without an extra focus-restoring click when appropriate to the approved interaction, submitting, scrolling the transcript, navigating sessions under the approved retention behavior, and opening/closing a real modal. Verify narrow-screen behavior and widget layout. Run relevant panel/focus/model tests, browser tests, typechecking, and the production build; distinguish baseline failures from regressions. Commit only verified task changes without pushing.

## Open Questions
- **Q1** — On desktop, should Projects dock beside the session and shrink the workspace (recommended), or float over its left edge while leaving the rest interactive?
- **Q2** — Should the desktop panel stay open after selecting an existing session or creating a new one (recommended)?
- **Q3** — On narrow screens, should Projects keep the current modal drawer behavior (recommended), or must the session remain usable with the panel open there too?
