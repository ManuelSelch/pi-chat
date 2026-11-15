# UI directions

- Revision: 12. Status: in review. Approval: not yet requested or received.
- Goal: compare colour, density and home-screen purpose without production changes.
- Isolated React prototype; all sessions, runtime labels, agent replies, files and test results are fake.

## Directions

- Night shift only: graphite, violet, compact rows and branch metadata. T3 Code-inspired developer density. Earlier Studio and Warm paper explorations are no longer selectable.
- Session-state colours across all themes: blocked red, ready green, working orange, later gray. Theme accent colours remain independent.
- Inspiration, not replicas. Source research used public product descriptions, not authenticated app inspection.

## Home comparison

- Current home: existing Home.tsx search-first structure, restyled with the chosen theme. Not a pixel-exact current-theme reproduction.
- Inbox: compact cards with 14px vertical padding, red/green status dots instead of icons, no open arrow, and addition/deletion numbers without a LOC label for blocked decisions and ready reviews only. Working sessions stay out of the inbox; Later is collapsed by default. No filters, search, project selector or summary counters. Added/removed LOC is prominent where a diff exists. Cards show no agent description or summary; only title, project/branch, timestamp and change counts. No header New session button or mandatory new-session composer; use sidebar navigation to start a session. The caught-up empty state retains its start-session shortcut. Header is only “Inbox”, without eyebrow, description or dot; no inbox footer or divider above Later.
- Lets cook: only the requested title, single-line composer matching the current home search input and a single-line inbox attention nudge (no supporting description). No decorative icon, eyebrow, subtitle, suggestion buttons or keyboard hint. Composer attachment control removed (annotation 4 interpreted as the plus button).
- Sidebar retained for navigation; toggle it for an edge-to-edge inbox.
- Desktop uses persistent sidebar; below 800px it is hidden and all homes remain accessible through the explorer.

## Interactive states

- Query parameters: `home=current|inbox|cook`, `state=empty|running` (default: populated). Theme is always Night shift.
- Home selections update the URL. Reset restores populated fake sessions.
- Open session cards in a session-preview drawer; expand Later to see parked sessions. Working sessions remain accessible in the existing sidebar, not the inbox.
- Blocked session offers a simulated decision; replying marks the session working.
- Move to Later, restore from Later, simulate agent completion, start simulated sessions.
- Composer is text-only: no tools, model/project selectors, branch metadata or send button. Uses the same Mantine TextInput size md as the current home search (42px height), without an outer padded card or shadow. Single-line input; no automatic growth.
- All-working and empty states show a caught-up inbox; fake completion moves a working session into Ready to review.
- No visible send button; Cmd/Ctrl+Enter submits the composer. No real folder picker, runtime, diff, settings or provider connection.
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
