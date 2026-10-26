# Custom Server Settings Mockup

- Revision: 1. Review status: approved. User approved revision 1 and the technical design: “yes looks good. approved. implement”. Preview stopped before production edits; approved source preserved.
- Scope: one Backend server section at the top of the existing right-hand Settings drawer. Keep other settings recognizable, not redesigned.
- Controls: full WebSocket URL, current endpoint, connection badge, Save and reload, Reset to default. Blank field means the page-derived default. Actions disabled when nothing changes.
- Interaction: confirmation warns that reloading discards unsent drafts but does not close server sessions. Inline URL validation and storage error; disconnected state retains Settings and reset. Cross-host/port warning explains the unchanged origin restriction.
- Responsive: Mantine md drawer, capped by viewport; actions wrap on narrow screens. No animation beyond Mantine defaults.
- Fake behavior: local React state only. Applying simulates a reload/connection result without persistence or networking. No server, proxy, credentials, or real application integration.
- Review URLs: /custom-server/ (default), ?state=custom, ?state=disconnected, ?state=storage-error. State resets on page reload. Fake default is wss://pi.home.example/ws.
- Outstanding design questions: none. User review/approval of revision 1 is required.
