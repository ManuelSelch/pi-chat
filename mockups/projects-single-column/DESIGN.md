# Projects panel redesign — single column

- Revision: 3
- Status: approved and implemented; revision 3 removes the filter input and the "Chats" label at the user's request after implementation.
- Revision 2 was the revision approved for implementation.
- Approval evidence: user said “looks good. implement it” after reviewing revision 2 (single column, filter, inline worktree-labelled sessions, no session borders, no date/message meta, left-aligned sessions).
- Goal: make the projects panel readable at a glance by removing the second sessions pane and the duplicated project grouping, following the model of the GitHub Copilot app and T3 Code: a folder/repository is stable, and a worktree/branch is a property of a session.

## Why (diagnosis of the current panel)

- Two panes force two selections (project, then session). With ~one session per worktree the right pane usually holds a single row.
- Worktree checkouts are modeled as projects, so a repository expands into branch rows which then expand into sessions: two levels of nesting for one unit of work.
- “Pinned projects” is “Recent projects” re-sorted under a second heading, so pinning reads as duplication.
- Rows are dominated by chrome: chevron, folder/fork icon, branch, `current`/`primary` badges, counts, path.
- Quick Chats adds a further axis to a list already sorted by pin, recency, repository, and worktree.

## Agreed direction (Option A)

Single column. Sessions are shown inline under their project; worktrees are no longer project entries.

### Layout

- Header “Projects”, one scrolling list, “Open folder” at the bottom. Drawer width 400px; full width on narrow screens.
- Quick Chats is the first row (speech-bubble icon), with no section label, filter, or pin control.
- `Projects` are one row per folder/repository. There are **no** “Pinned projects” / “Recent projects” headings: pinned projects show a filled pin glyph, sort to the top, and a hairline divider separates them from the rest.
- A project row is: chevron, folder icon, name, session count (only when > 0), then hover actions: pin/unpin and New session. The full path is the row tooltip, not a visible line.
- Clicking a project expands its sessions **inline**, left-aligned with the project rows and without indent, guide line, or per-row border. One session therefore reads as a single row in one list.
- A session row is: title and hover archive/restore. There is no separator line; date and message count are not shown. The only meta ever rendered is the branch chip when several sessions share one worktree.
- **Worktree sessions**: when exactly one session runs in a worktree, its row is labeled with the **branch (worktree) name** and the session title is hidden — the worktree is what the user navigates by. Only when several sessions share one worktree do the rows show session titles, with the branch as a chip in the meta line.
- Archived sessions stay in the project but behind a small `Archived (n)` toggle at the bottom of the expanded project.
- No separate “Manage sessions” view: archive/restore stays on the session row.

### Behavior

- Project row click selects the project and toggles its inline sessions.
- Session click opens it (sets the current tab) and closes the panel.
- Hover `+` starts a new session (or chat, for Quick Chats) directly in that project.
- Pin toggles `pinned`; the row moves between the pinned block and the rest.
- Keyboard: native buttons, visible focus, dialog focus containment, Escape closes and returns focus to Projects. Reduced-motion is honored. No added animation beyond the 120ms chevron rotation.

## Review states

- `/projects-single-column/`: populated, `pi-chat` expanded, several worktree sessions with branch chips.
- `/projects-single-column/?state=many`: extra projects and sessions for density and scrolling.
- `/projects-single-column/?state=empty`: no sessions anywhere; every project still shows its empty state.
- `/projects-single-column/?state=project`: `dotfield` selected instead of `pi-chat`.
- Append `&theme=dark`, or use `?theme=dark` alone. Reload resets fake data.

## Assumptions and limitations

- Standalone HTML/CSS/JS with fake data: no backend, filesystem, persistence, folder picker, or real session content.
- Worktree **creation** is out of scope (pi-chat only discovers worktrees today); the mockup shows branch/worktree as session metadata only.
- Archive/delete/bulk management intentionally stays in the panel; a separate manage view was declined.
- Open question: whether the single “Chats” label is wanted for the home folder, or Quick Chats should sit unlabeled above the projects.
- Open question: whether the session count should stay on project rows or be dropped for an even quieter list.
