# Home working sessions and sidebar

- Revision: 3. Status: approved for implementation.
- Revision 1 home Working section approved by user. It is collapsed by default, includes a count and opens existing session destinations. Existing project navigation and other home sections remain.
- Sidebar approximates the real project sidebar: close control, project count and collapsible project groups, hover actions, separate Later section and Settings.
- Show only the worktree name for a single session; when multiple sessions share a worktree, show each session name underneath to distinguish them. Fake data includes both cases.
- Place each status dot beside the primary session/worktree label; omit timestamps from sidebar rows. Home card timestamps remain unchanged.
- Fake data and illustrative session drawer only; no backend or persistence. `/home-working/?state=running` shows the working-only state; `?state=empty` shows an empty home. Sidebar actions are illustrative.
- Sections start collapsed where shown; no animation added. Revision 3 approved by user in chat ("approved. implement").
