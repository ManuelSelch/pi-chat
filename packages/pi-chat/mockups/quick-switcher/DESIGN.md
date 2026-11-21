# Quick switcher — interaction follow-up

- Revision: 5. Review status: approved for implementation; revision 3 remains approved only for its original scope.
- Goal: preserve the compact existing palette while making folders, worktrees, sessions and actions unmistakable.
- Each row: muted folder / git-branch / chat / lightning-action icon, regular-weight title, subdued context line. No visible right-hand type labels (including actions); icons identify types visually, while accessible row names retain the type for screen readers.
- Folder context: display path to distinguish duplicate names. Worktree context: parent repository and checkout path; title is branch when present. Detached worktrees show commit context instead. Session context: project, branch if available, relative age.
- Open session marker is plain muted text, not a blue badge. No current-tab/project background. Hover is subtle neutral gray; keyboard result selection uses a thin neutral outline, not a filled background.
- Scope controls expose `# Folders`, `% Worktrees`, `@ Sessions`, `/ Actions` without requiring users to remember syntax. Active scope uses an underline, not colored fill.
- Responsive width capped at 620px; narrow screens truncate long metadata and retain icons. Light/dark toggle is a review aid, not an application feature.
- Searching for a folder (including `#`) shows two choices under each matching folder: **Open latest session** and **Open new session**. The latest-session choice is disabled when that folder has no session yet. Duplicate folder names retain full paths in both choices. General `/` actions remain unchanged.
- Fake data only; substring filtering approximates the production fuzzy model. Opening either folder choice is simulated.
- Pointer hover styling activates only after mouse pointer movement; keyboard input clears pointer modality so a stationary/stale CSS hover cannot look like the selected option. Keyboard selection remains a thin neutral outline.
- Review folder queries with and without a latest session, and compare mouse-hover with arrow-key selection when the pointer stays still.
- Approval evidence: user said “looks good. implement it” for revision 5.
- Review states: `/quick-switcher/` mixed results; `?q=%25` worktrees; `?q=%23` folders; `?q=%40` sessions; `?q=%2F` actions; `?q=zzz` no matches; append `&theme=light` for light appearance.
- Approval evidence: user explicitly approved revision 3 with “looks good. implement it”. Approved scope includes `/` actions and icon-only type identification with screen-reader descriptions.
