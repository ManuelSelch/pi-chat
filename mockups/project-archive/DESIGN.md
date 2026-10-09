# Project archive panel — revision 1

Review status: in review. No user approval yet; no production implementation authorized.

## Goal and layout

Explore a collapsed archive section within Pi Chat's existing on-demand, two-pane Projects and sessions drawer. Compact open-session tabs remain behind the drawer. Saved project pins keep occasional projects discoverable, independently of active session counts.

- Left pane: pinned/recent project navigation, active counts, Open folder placeholder.
- Right pane: selected checkout, pin/unpin, New session, active rows, then collapsed Archived disclosure with a separate count.
- Archived rows use slightly quieter titles, archive date, and explicit Restore action. Clicking their title opens a normal session tab without immediately restoring them.
- Archive action on active rows preserves fake history and closes the corresponding tab. Undo restores catalogue state, not the closed tab.
- Pin/unpin, project selection, tab switching/closing, simulated creation, archive/restore, and restore-on-send are interactive.
- Empty pinned project remains accessible. Narrow viewports retain two columns with tighter spacing, matching the current drawer structure.
- Light theme by default; header theme toggle and `?theme=dark` provide dark review.
- Keyboard controls, Escape to close, drawer focus loop, native details disclosure, and visible focus outlines. No animation.

## Review URLs

- `/project-archive/`: archive collapsed, populated pi-chat project.
- `/project-archive/?state=expanded`: archive expanded.
- `/project-archive/?state=empty`: pinned autodeko with no active sessions and one archived session.
- `/project-archive/?state=expanded&theme=dark`: expanded dark view.
- Select study-notes for no active or archived sessions.

## Fake/omitted behavior

All data and changes are in memory and reset on reload. No backend, persistence, real session files, agent turns, running-session guards, Git discovery, transcript fidelity, missing-worktree handling, deletion, global archive search, or folder picker. The background conversation only provides layout context. Symbols approximate the production icon set. The layout approximates Mantine using plain CSS; it is not a production component.

## Outstanding design questions

- Does the collapsed Archived section feel discoverable enough without cluttering the panel?
- Keep the label Archived, or use Finished?
- Confirm restore-on-send versus requiring explicit Restore before new work.

## Checks performed

Browser-reviewed expanded layout at 1280×720 in light mode and inside a 390×690 iframe in dark mode. Exercised archive (counts update and tab closes), Undo, opening an archived session, simulated send restoring Active, and the empty-active pinned project state. No browser console errors or failed requests observed. Mockup dependency audit reports zero vulnerabilities. Production tests were not run because production files are unchanged.

Approval evidence: none.
