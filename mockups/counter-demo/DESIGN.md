# Counter demo

- Revision: 1. Status: approved for implementation.
- Goal: a minimal server-plugin demo inside the existing Chat shell.
- Placement: compact Counter trigger beside Settings, available on Home and session screens. Popover fits desktop and phone widths.
- Controls: current count, Increment, and Read current count. No reset: the contract has no reset method.
- States: default/ready, `?state=loading`, `?state=disconnected`, `?state=error`, `?state=unavailable`.
- Increment shows pending feedback. Errors with an uncertain result disable further increments until an explicit read succeeds. Disconnection disables calls; no mutation replay.
- Production intent: register the demo directly in Chat's host plugin list and RPC allowlist; use the existing SDK connection, not a second socket. User explicitly rejected adding a demo environment flag; no flag or special URL is required. Reopening/reading must not reset server-owned state. Existing navigation/chat journeys remain unchanged.
- Mock only: local count and simulated request delays; no SDK/server calls, files, sessions or persistence. Shell navigation/search/composer are context only, not functional.
- Review: check placement, count readability, Increment, close/reopen, and error/read recovery. Agentation is available through its toolbar; copy/paste annotations into chat.
- Approval: user explicitly approved revision 1: “approved. the samll counter panel looks good”. Approved files preserved; mockup preview stopped before implementation.
