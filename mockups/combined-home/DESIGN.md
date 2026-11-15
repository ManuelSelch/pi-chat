# Combined Home

- Revision: 1. Status: in review; not approved for production.
- Goal: combine Home and Inbox into one landing page without changing session views.
- One Home sidebar destination replaces separate Home/Inbox buttons. Project sessions and bottom Settings gear remain.
- Centered Lets cook heading and existing search-first entry above Blocked, Ready and collapsed Later. Empty input + Enter simulates new-session creation; typed input searches sessions/projects/branches. Preserve production Home search semantics when implementing.
- Project/worktree branch labels are large and bold; session names are small and gray underneath. No synthetic change totals.
- Working sessions remain accessible in project navigation, not the attention list. Opening a row keeps the existing production session view; mock drawer only explains that destination.
- Desktop sidebar can be hidden. Phone mock uses an overlaid sidebar dismissed with the toggle; production must retain its existing modal drawer, focus handling and explicit dismissal.
- Search results temporarily replace attention lists; clearing the query restores them. Later is untimed and collapsed initially. Idle rows can be parked/archived; parked rows can be explicitly resumed. All actions use local fake data only.
- Review states: `/combined-home/`, `?state=empty`, `?state=running`. Reload resets mock state.
- No runtime, persistence, filesystem, real settings or backend calls. No new composer behavior is implied. Preserve existing archive, discovery, drafts, running work and session creation journeys.
- Approval evidence: pending user review.
- Verification: HTTP/module serving only; no browser automation or screenshots requested.
