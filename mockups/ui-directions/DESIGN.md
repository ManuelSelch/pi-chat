# UI directions

- Revision: 2. Status: in review. Approval: not yet requested or received.
- Goal: compare colour, density and home-screen purpose without production changes.
- Isolated React prototype; all sessions, runtime labels, agent replies, files and test results are fake.

## Directions

- Studio: cool grey, blue, low-noise command centre. Codex-inspired multi-agent organisation.
- Warm paper: ivory, clay, serif headings and more generous rows. Claude-inspired conversational calm.
- Night shift: graphite, violet, tighter rows and branch metadata. T3 Code-inspired developer density.
- Inspiration, not replicas. Source research used public product descriptions, not authenticated app inspection.

## Home comparison

- Current home: existing Home.tsx search-first structure, restyled with the chosen theme. Not a pixel-exact current-theme reproduction.
- Inbox: spacious cards for blocked decisions and ready reviews only. Working sessions stay out of the inbox; Later is collapsed by default. No filters, search, project selector or summary counters. Added/removed LOC is prominent where a diff exists. No mandatory new-session composer.
- Lets cook: exact requested title, project/model composer, shortcuts and an inbox attention nudge.
- Sidebar retained for navigation; toggle it for an edge-to-edge inbox.
- Desktop uses persistent sidebar; below 800px it is hidden and all homes remain accessible through the explorer.

## Interactive states

- Query parameters: `theme=studio|paper|night`, `home=current|inbox|cook`, `state=empty|running` (default: populated).
- Theme/home selections update the URL. Reset restores populated fake sessions.
- Open session cards in a session-preview drawer; expand Later to see parked sessions. Working sessions remain accessible in the existing sidebar, not the inbox.
- Blocked session offers a simulated decision; replying marks the session working.
- Move to Later, restore from Later, simulate agent completion, start simulated sessions.
- Composer has local model/project selection and a mock context attachment. Selection does not route to a backend.
- All-working and empty states show a caught-up inbox; fake completion moves a working session into Ready to review.
- Cmd/Ctrl+Enter submits the composer. No real folder picker, runtime, diff, settings or provider connection.
- Static update: no timers, persistence or backend calls. No production behavior is approved for removal.

## Research / comparison

- [Codex](https://openai.com/index/introducing-the-codex-app/): parallel agents, project threads and reviewing changes. Borrow task-first hierarchy rather than a chat-only landing page.
- [Claude](https://claude.com/product/overview): conversational starting point, projects and user-controlled review. Warm palette and editorial type are an inspired design interpretation.
- [T3 Code](https://t3.codes/): coding-agent control plane, branches and inline review. Borrow useful branch/status context without turning home into an IDE.
- Existing Pi Chat: search-first home is intentionally quiet and only shows results after typing; sidebar already groups Needs you, Ready, Working and Later.
- Recommendation to evaluate: Inbox as default for parallel-agent work; Lets cook as the new-session destination, with search preserved.

## Review and limits

- User-led visual/interaction review. Agent browser automation and screenshots not requested or performed.
- Readiness checks confirm HTTP/module serving only, not browser runtime or rendering.
- Agentation: annotate from bottom-right toolbar, copy the Markdown batch and paste into chat.
- No production pipeline required for mockup-only work. Explicit design approval required before implementation.
