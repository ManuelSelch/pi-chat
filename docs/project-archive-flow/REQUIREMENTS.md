# Persistent projects and session archives

Status: draft for review; no implementation authorized by this document.
Branch: `feat/project-archive-flow`.

## Problem

The current workflow is: create session, create worktree, implement feature, merge/remove worktree, delete session. Projects are inferred from session working directories. Deleting the last session removes the project's discovery seed, making occasional projects hard to find again. Deleting conversations also loses useful learning material.

Pi does not provide session archiving. The user approved Pi Chat-owned archive metadata, with the original Pi session file left unchanged and in place.

## Goals

- Keep deliberately saved projects accessible without keeping unfinished-looking sessions around.
- Hide completed sessions from everyday navigation without deleting their transcripts.
- Restore archive state reversibly across browser reloads and server restarts.
- Preserve history after a temporary worktree is removed.
- Retain the existing repository/checkouts hierarchy and path-display preference.

## Scope and confirmation

**Confirmed:** archive state belongs to Pi Chat metadata, not a new Pi JSONL entry or a moved session file. Include explicit project pins. Archived sessions are not inherently read-only; users may continue them when their working directory is available.

**Confirmed navigation:** retain compact tabs for open sessions and the on-demand Projects and sessions panel. The user normally has no more than four sessions running and uses `/new` for a new session in an already-open project. Project pins are saved entries inside the panel, not a pinned/permanent panel.

**Proposed for review:** a collapsed archived-session section inside the existing panel's session list, restore-on-new-work behavior, and archive-aware cleanup integration.

Do not interpret this plan as permission to implement every proposed feature or modify the personal extensions repository automatically.

## Current boundaries

- `src/server/projects/pi-session-store.ts`: lists Pi session files and deletes them through trash, with unlink fallback.
- `src/server/projects/project-session-service.ts`: builds directory-scoped session lists, merges the active session, and discovers registered worktrees from known directories.
- `src/server/projects/worktree-discovery.ts`: read-only Git discovery.
- `src/server/application/chat-application-service.ts`: owns session/tab lifecycle and catalogue invalidation. Deletion closes an open session and rejects streaming sessions.
- `src/shared/protocol.ts`: typed commands and catalogue data.
- `src/web/sessions/projects/ProjectSessionDrawer.tsx`: repository grouping, checkout selection, session lists, and deletion confirmation.
- Home, Quick Open, composer session actions, and every catalogue consumer must be checked when changing filtering.

Existing worktree requirements in `docs/worktree-projects/REQUIREMENTS.md` remain valid except where this document explicitly changes visibility or missing-directory archive access.

## Terminology

- **Active session:** a non-archived conversation; not necessarily open or currently running.
- **Archived session:** a preserved Pi conversation marked archived by Pi Chat.
- **Pinned project:** a deliberately saved navigation entry independent of session count.
- **Checkout:** the original directory in which a session ran.
- **Running session:** a live runtime executing model/tool/bash work; distinct from Active.

## T3 Code comparison and retained layout

T3's [thread documentation](https://github.com/pingdotgg/t3code/blob/main/docs/user/thread-sidebar.md) and [sidebar logic](https://github.com/pingdotgg/t3code/blob/main/apps/web/src/components/Sidebar.logic.ts) distinguish **Settled** from **Archived**. Settled threads occupy a lower sidebar shelf and can be un-settled into active work. Archived threads are filtered out of the normal sidebar. Its thread pins are also different from the project pins requested here.

For Pi Chat, keep only two session states initially: Active and Archived. Borrow the collapsed finished-history presentation, not T3's permanent sidebar layout.

- Retain tabs as the primary navigation for open sessions; do not replace them with a thread sidebar.
- Keep Projects and sessions as an on-demand drawer with its existing project/checkout selection and session pane. It is primarily used to open another project or retrieve history.
- Show pinned projects first inside the panel, including those with zero active sessions. Pinning a project does not keep the panel open.
- Propose a collapsed `Archived (N)` section below active sessions in the selected checkout's session pane. Opening a session focuses its existing tab or opens a new tab, preserving current deduplication behavior.
- Preserve `/new` for new sessions in the current project and the selected-checkout New session action. Do not require the panel for everyday same-project session creation.
- Closing a tab only releases that open session runtime; it does not archive or delete the conversation. Archive is a distinct completed-work action that also closes its tab.
- Retain repository grouping, checkout-specific session ownership, worktree discovery, and the path-display preference.
- Do not add a permanent sidebar, thread pinning, Settled as a third state, automatic settlement, or drag-and-drop ordering in this scope.

## 1. Durable metadata

1. Store Pi Chat-owned metadata on the server, scoped to the configured Pi agent directory. Do not use browser localStorage as the authoritative store.
2. Keep a versioned schema containing session archive state and project pins. Choose the exact file name during the first implementation slice and document it before cleanup integration.
3. Session archive records contain a validated durable session identity, `archivedAt`, and enough original checkout/repository context to associate history after a worktree disappears. Prefer validated session-header identity over trusting a client-provided ID; disambiguate duplicate/copied IDs rather than sharing their archive flag accidentally.
4. Read metadata once per catalogue operation, not once per session. Serialize mutations and use atomic file replacement to avoid partial writes and lost concurrent updates within the server.
5. A missing metadata file means no archives or pins. A malformed or unsupported file must surface an actionable error; never silently overwrite it with empty metadata.
6. Validate mutation targets against known session files and allowed roots, including canonical-path/symlink handling. Do not permit arbitrary filesystem access through archive commands.
7. Do not alter session message content, titles, timestamps, or Pi JSONL format. Archive timestamps are metadata, not new conversation activity.
8. Failed persistence must not report success or publish an archived catalogue state. Lifecycle side effects already completed, such as closing a tab, must be reported honestly rather than claiming full rollback.
9. Missing session files must not produce fake transcript results. Stale metadata reconciliation must not delete unrelated pins or overwrite recoverable archive context.

## 2. Persistent project navigation

1. Add Pin/Unpin to project navigation. Pinning persists across reload/restart and retains a selectable project with zero sessions.
2. Show Pinned projects first in the panel's project selection, then unpinned projects with active sessions ordered by existing activity rules. An entry appears only once. Keep project navigation separate from the selected checkout's session list.
3. Unpinning does not delete sessions or files. An empty unpinned entry may disappear from the default list.
4. For Git checkout roots, pin the stable primary repository entry rather than a disposable linked worktree. Store resolved repository context while it is available. Preserve the current rule that subdirectory sessions are not silently reassigned to checkout-root sessions.
5. For non-Git directories, pin the canonical directory. Never group projects by basename or remote URL.
6. Missing pinned folders remain visible with a recoverable unavailable state; New session is disabled. Forget/Unpin remains available.
7. Opening a folder must not automatically pin it unless that behavior is separately approved. Provide an explicit pin affordance without requiring a transcript to be created first.
8. Retain the Open folder action and current checkout-specific New session behavior. Empty discovered linked worktrees remain hidden under current presentation rules unless selected/current or separately needed for navigation.
9. Provide a searchable All projects view for known projects, including archive-only projects. An unpinned archive-only project need not clutter the default active list.

## 3. Archive and restore

1. Archive is the normal completed-session action. Delete remains an explicit destructive overflow action with the existing confirmation.
2. Archiving leaves the JSONL file in place, marks durable metadata, and closes that session's Pi Chat tab if open. Other tabs are unaffected; closing the last tab returns Home.
3. Reject archive while that session is executing model/tool/bash work or has a lifecycle operation in progress. Check server state, not just the selected browser tab's busy flag. Unrelated running sessions do not block it.
4. Require a durable session file/identity. If Pi has not materialized an empty session, offer Close rather than manufacturing a transcript solely to archive it.
5. Restore clears archive state but does not create a runtime or send a prompt. Restored sessions return to active lists using their original conversation activity ordering.
6. Repeated archive or restore commands are idempotent. Mutations invalidate the catalogue and publish authoritative state to connected clients.
7. Show Undo after archive; Undo restores visibility without needing to reopen a runtime. Do not require an archive confirmation dialog.
8. Delete works for active and archived sessions. Remove archive metadata only after successful file deletion; a failed deletion preserves archive state.
9. Archive/restore never merge, remove, recreate, or switch a worktree or branch.
10. Opening an archived session may use the normal session runtime when its original directory exists; it must not automatically send a prompt. Archive state is not a read-only permission.
11. Proposed continuation rule: reading/opening alone leaves it archived; successfully submitting new user work restores it to Active. Enforce this at the application boundary for every work-submission path, not only the composer. Keep explicit Restore available. Confirm this rule before implementation.

## 4. Browse and continue retained conversations

1. The panel's session pane shows active sessions, with a proposed collapsed Archived section beneath them for the selected checkout. Active counts exclude archived sessions; archive counts are labeled separately. No double-counting at repository level. Tabs represent open sessions, not the entire active-session catalogue.
2. Archived sessions are ordered by archive time, with stable tie-breaking. Active ordering remains based on conversation activity.
3. Selecting an archived session with an available checkout opens the usual conversation UI and allows continuation. Normal runtime/extension initialization may occur; do not build a separate mandatory read-only viewer for these sessions.
4. History access must still work when the original checkout no longer exists. In that case, render a transcript-only fallback without initializing a runtime against a missing directory; explain why continuation is unavailable. Keep original path/branch as historical metadata, subject to the existing path-display preference; do not add unconditional full-path tooltips.
5. Restore remains possible with a missing checkout, but Resume stays unavailable until a valid working directory exists. Do not rewrite the original session's working directory silently.
6. Search may include archives through an explicit Include archived option and must display an archive badge. Default Home/Quick Open resume results exclude archives.
7. A global archive/project search entry provides access when the project is unpinned and has no active sessions.
8. Clear empty states distinguish no active sessions, no archived sessions, missing checkout, and missing transcript.
9. Keep rendering compatible with existing message/tool/custom-message behavior. Put persistence-specific transcript parsing behind a server boundary, not in browser components.

## 5. Cleanup and interoperability

1. Pi terminal pickers do not understand Pi Chat metadata. Archived sessions remain ordinary Pi files and may still appear there. Document this limitation explicitly.
2. Existing personal `session-cleanup` automation deletes inactive sessions older than its threshold (default three days), regardless of names. Archive metadata alone does not prevent deletion.
3. Before advertising archives as retained learning records in the user's normal setup, update that cleanup extension to skip validated archived session identities. This is a separate repository/task and requires coordination.
4. The cleanup integration must use the same metadata location/schema and respect the configured agent directory. Both dry-run and actual deletion must exclude archives.
5. If archive metadata cannot be read safely, cleanup must fail closed for potentially protected sessions and report the problem rather than deleting them.
6. Do not promise protection against manual deletion or unrelated tools. Missing externally deleted transcripts produce an honest unavailable state.
7. External Pi activity does not automatically restore an archived session in version one. The Pi Chat archive marker remains until explicit Restore; this limitation must be visible in documentation.

## Non-goals for the first delivery

- Native Pi archive support or changes to Pi's session JSONL schema.
- Moving session files into an archive directory.
- Automatic archiving after merges, inactivity-based archiving, snoozing, settling, or Kanban states.
- Worktree management, automatic checkout recreation, or rebasing old conversations onto another working directory.
- Summaries, learning extraction, semantic search, or a new transcript export format.
- Start new session from this conversation/context transfer. Useful later, but distinct from Restore and requiring its own context policy.
- A distributed multi-process metadata database. If multiple Pi Chat servers share one agent directory, either add cross-process coordination or document/enforce single-writer operation before release.

## Incremental implementation plan

Each slice starts with focused tests, remains independently reviewable, and does not silently expand the scope.

1. **Confirm scope and metadata contract.** Resolve the questions below, choose/document metadata location and session identity rules, and agree on cleanup ownership. No runtime behavior changes.
2. **Add a durable metadata store.** Cover missing/corrupt files, schema versions, serialized writes, atomic persistence, canonical identity checks, and stale references with temporary-directory tests.
3. **Add persistent project pins.** Merge saved project seeds into the catalogue, preserve worktree discovery/grouping, and add Pin/Unpin and empty-project UI. Verify persistence independently of archives.
4. **Add archive/restore application operations.** Extend typed protocol and lifecycle handling, enforce per-session running guards, preserve session files, and refresh all relevant catalogue consumers. Test failures and idempotency.
5. **Add archive navigation inside the existing panel.** Update rows, counts, the collapsed archive section if approved, Undo, empty states, Home/Quick Open behavior, and archive-only project access. Preserve compact tabs, the on-demand drawer, `/new`, and existing open-session deduplication.
6. **Enable archive browsing and continuation.** Reuse normal conversation UI for available checkouts, implement the agreed restore-on-work behavior, and provide validated no-runtime transcript fallback for removed worktrees and missing-file handling.
7. **Integrate retention safeguards.** Coordinate the separate cleanup-extension change, test dry-run/deletion exclusions and fail-closed metadata errors. Until done, label retention support incomplete.
8. **Verify end to end and document.** Run full Vitest suite, TypeScript, production build, and whitespace checks. Browser-test pinning, archive/restore/Undo, reload, removed worktrees, deletion, and last-tab handling; record evidence. Commit only task-owned changes.

## Acceptance scenarios

- Pin a repository, archive its final session, and restart the server: the pinned primary project remains and New session works.
- Unpin an empty project: it leaves default navigation without losing files or archived history; All projects/archive search can find it.
- Archive a persisted idle session: its tab closes, active counts decrease, and its original JSONL content and location are unchanged.
- Archive a running model or bash session: the server rejects it without modifying archive state or interrupting unrelated sessions.
- Archive an unmaterialized empty session: Close is offered; no artificial conversation file is created.
- Restore or Undo: the session returns to active lists without an agent turn or automatic runtime creation.
- Remove a merged worktree: its archived transcript stays readable without an available working directory or extension startup side effects.
- Two unrelated repositories with identical names and sessions with duplicate IDs do not share pins/archive flags accidentally.
- Metadata write failure or corruption: an actionable error appears; no misleading successful archive or destructive metadata reset occurs.
- Delete an archived transcript: after successful deletion it disappears from archive results; failed deletion preserves its metadata.
- Reload/reconnect or a second connected browser receives authoritative archive/pin state; stale selections recover without changing valid browsed checkout state.
- Open an archived session with an available checkout: the normal conversation UI is usable; reading alone leaves archive state unchanged, while accepted new work restores Active if that proposed rule is approved.
- Compact tabs remain the main open-session navigation; closing one does not archive it. `/new` still starts a session in the current project without opening the project panel.
- The panel stays on demand, with pinned project entries surviving zero active sessions. If approved, the selected checkout's Archived section starts collapsed and opening an archived session focuses/creates a tab rather than a new permanent sidebar.
- Archive-aware cleanup dry-run and deletion preserve archived files; unreadable protection metadata does not trigger their deletion.
- Existing session opening, active session ordering, worktree grouping, path preference, and unrelated user files remain unchanged.

## Open questions before implementation

1. Approve a collapsed Archived section beneath active sessions in the existing project panel? Tabs and the on-demand two-pane panel are confirmed; a permanent sidebar is excluded.
2. Should sending new work automatically restore an archived session to Active while merely opening/reading leaves it archived? Recommended. Final UI wording remains open: Archived versus Finished; do not introduce both as separate states.
3. Should Include archived search match titles/first messages initially (existing search scope), with full transcript search deferred? Recommended to keep the first slice small.
4. May the personal session-cleanup extension be changed in a separately verified commit/repository, or should cleanup be disabled manually until integration is ready?
5. Confirm the proposed single-writer metadata limitation, or require simultaneous Pi Chat servers sharing the same agent directory?
