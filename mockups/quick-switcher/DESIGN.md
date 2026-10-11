# Quick switcher — Slice 2

- Revision: 3. Review status: approved for production implementation.
- Goal: preserve the compact existing palette while making folders, worktrees, sessions and actions unmistakable.
- Each row: muted folder / git-branch / chat / lightning-action icon, regular-weight title, subdued context line. No visible right-hand type labels (including actions); icons identify types visually, while accessible row names retain the type for screen readers.
- Folder context: display path to distinguish duplicate names. Worktree context: parent repository and checkout path; title is branch when present. Detached worktrees show commit context instead. Session context: project, branch if available, relative age.
- Open session marker is plain muted text, not a blue badge. No current-tab/project background. Hover is subtle neutral gray; keyboard result selection uses a thin neutral outline, not a filled background.
- Scope controls expose `# Folders`, `% Worktrees`, `@ Sessions`, `/ Actions` without requiring users to remember syntax. Active scope uses an underline, not colored fill.
- Responsive width capped at 620px; narrow screens truncate long metadata and retain icons. Light/dark toggle is a review aid, not an application feature.
- `/` lists actions; `/settings` narrows to settings. Proposed initial examples: New session, Open folder…, Open settings. Actions also appear in unscoped searches. This extends the prior navigation-only scope; production action model/activation must be added after approval. No arbitrary slash-command execution is implied.
- Fake data only; substring filtering approximates the real slice-1 fuzzy model. Opening results is simulated. Home-screen shortcut integration remains slice 3; other app panels/tab-bar are not simulated here.
- Review states: `/quick-switcher/` mixed results; `?q=%25` worktrees; `?q=%23` folders; `?q=%40` sessions; `?q=%2F` actions; `?q=zzz` no matches; append `&theme=light` for light appearance.
- Approval evidence: user explicitly approved revision 3 with “looks good. implement it”. Approved scope includes `/` actions and icon-only type identification with screen-reader descriptions.
