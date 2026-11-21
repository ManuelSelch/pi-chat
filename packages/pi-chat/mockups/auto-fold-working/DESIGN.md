# Auto-fold Working (PIC-2)

- Revision: 1
- Status: approved
- Approval: user explicitly approved revision 1 in chat ("approved").
- Goal: preserve the existing sidebar layout, but default Working to collapsed.
- Working heading and count remain visible; explicit expansion shows running sessions.
- Expansion persists while at least one session remains working, including when another joins.
- When the last working session leaves, the section disappears and expansion resets.
- A later working session recreates the section collapsed; page reload also starts collapsed.
- Ready, Needs you, Later, session selection and session actions retain existing behavior.
- Demo uses fake sessions and explicit start/finish controls; no backend or persistence.
- Responsive layout is a browser approximation; no production layout changes proposed.
- Review states: initial collapsed, manually expanded, no working sessions, working again.
- No animation added. Existing keyboard-accessible toggle retained.
