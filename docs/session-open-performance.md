# Session-open profiling

Run `npx tsx scripts/profile-session-open.ts [cwd] [existing-session.jsonl]`.
The script uses the real Pi Chat application and SDK, local settings, credentials,
and extensions. It submits no model prompts. Session-start extension hooks still
run normally, so this is not a side-effect-free sandbox. New-session startup may
update the local remembered-project metadata. Without an explicit session file,
it selects the session with the highest message count for the target directory.

Instrumentation is confined to this standalone process; production code is unchanged.
Timings are inclusive (nested stages must not be summed). Snapshot and catalogue
publication follow the application path used by WebSocketTransport, without an
actual socket/browser. JSON encoding is measured, but browser rendering is not.

## Measured locally

Three new sessions and three opens of an existing session, using the main Pi Chat
checkout as cwd and the installed Pi 1.0.2 SDK. Catalogue contained 142 sessions;
existing active context projected to 103 chat entries.

| Stage | Warm measured time |
| --- | ---: |
| Entire runtime/adapter initialization | 59–77 ms |
| Resource reload (included above) | 8–9 ms |
| Extension binding/session-start (included above) | 26–32 ms |
| Model options refresh (included above) | 4–6 ms |
| Catalogue refresh, **each** | 921–1,005 ms |
| All-session listing, per refresh | approximately 420–435 ms |
| Sequential session-name JSONL scan, isolated | 390–394 ms |
| Git worktree discovery, per refresh | approximately 120–142 ms |
| Transcript projections, combined across open publication | below 6 ms |
| Snapshot JSON encoding | below 1 ms |

First new session in a fresh process: adapter 636 ms, including 523 ms resource
reload/extension loading. First snapshot was available after 1,662 ms; full
snapshot-plus-catalogue flow finished after 2,619 ms.

Warm new sessions: first snapshot 1,040–1,067 ms; full flow 2,007–2,054 ms.
Existing session: first snapshot 1,034–1,048 ms; full flow 1,956–2,001 ms.
An earlier repeated run showed catalogue refresh variability up to 1,292 ms.

## Original root cause

`ChatApplicationService.prepareSnapshot()` awaits a full catalogue rebuild **before
publishing the transcript or focusing the browser tab**. After snapshot publication,
`WebSocketTransport.openTab()` calls `sendCatalogue()`, which rebuilds the same
catalogue again via `currentCatalogue()`.

Each rebuild lists all sessions, scans every JSONL file again to determine title
provenance, and performs Git discovery. The `catalogueCache` field is assigned but
these methods do not reuse it to skip the rebuild. The selected transcript is not
the dominant cost; the global catalogue is.

The second refresh occurs after the initial snapshot, so its whole duration should
not be presented as time-to-first-visible-transcript. Actual browser rendering and
the user's exact three-second delay were not measured by this script.

## Implemented fix and remeasurement

Snapshots no longer include or await a catalogue rebuild. The transport sends the
snapshot, tab focus, and correlated Open acknowledgement before requesting the
one catalogue refresh. Separate catalogue messages already update the browser's
project/session state, so no protocol or UI changes are required.

Prompt and feature completion now explicitly publish their catalogue update after
the transcript snapshot, preserving the old metadata-refresh behavior. Removed
the unused application catalogue cache rather than introducing stale-data caching.
Extension snapshot hooks and atomic event-watermark capture remain unchanged.

Reran the same profiler, sequentially without concurrent build/test load:

| Session | First snapshot before | First snapshot after |
| --- | ---: | ---: |
| New, warm | 1,040–1,067 ms | **55–57 ms** |
| Existing, warm | 1,034–1,048 ms | **69–74 ms** |
| New, cold process | 1,662 ms | **587 ms** |

Catalogue refresh still takes 934–992 ms, but happens once and no longer blocks
opening. Total snapshot-plus-catalogue flow is 991–1,065 ms warm and 1,560 ms cold.

Regression tests hold catalogue scanning open and verify snapshots, tab focus,
and Open acknowledgement are published first, with one scan per opening.
Atomic publication tests now use delayed extension hooks (the actual remaining
async snapshot dependency), retaining close/reopen/controller replacement coverage.
Full Vitest suite: 829 tests passed. Browser E2E: seven tests passed. Production
build and TypeScript checks passed. Real-browser latency itself is not measured;
the timings above are server-side first-snapshot readiness.
