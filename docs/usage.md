# Using Pi Chat

## Keyboard shortcuts

| Shortcut | Effect |
| --- | --- |
| `⌘⇧O` / `Ctrl+Shift+O` | Quick Switcher: type a session or project name |
| `⌘O` / `Ctrl+O` | Same, in browsers that hand the key over (not Safari) |
| `⌘K` / `Ctrl+K` | Session actions (new, archive, close tab) plus every Pi slash command |
| `Esc` | Stop the current run; an open dialog or menu closes first |
| `Ctrl+C` | Clear the composer, unless text is selected so Copy still works |

## Sessions

Use Projects to browse projects and persistent sessions, or open a server folder
to start a session without previous Pi history. Tabs keep conversations separate.

Type `/archive` to archive the current idle session and close its tab without
deleting its transcript. Archived sessions remain available under **Archived**
in Projects, where they can be restored. There is no delete-session command.

### Session inbox

**Settings → Feature Toggles → Show open sessions in sidebar** replaces horizontal
tabs with the Inbox and is on by default. Explicit browser preferences are preserved.
The same group contains chimes, folder paths and archived-session visibility;
Transcript settings remain separate. **Needs you** contains blocked
questions/approvals. **Ready** includes all unarchived idle conversations except
those in Later, including saved history after a server restart. Selecting an
unloaded conversation opens it; history is never reopened automatically.
**Working** can be collapsed independently. Selecting a session does not answer
or dismiss a prompt.

- **Move to Later** parks a saved, idle conversation, closing its runtime if loaded.
  Later is untimed, collapsed by default, and remembered in this browser for
  this server. Expand it and select a conversation to reopen it explicitly.
  Unsaved, working and blocked sessions cannot be parked.
- The header **×** returns to the original Home search. Nonempty sessions,
  background work and their drafts stay unchanged; select a sidebar row to
  return. Empty idle sessions are closed and removed from live inventory.
- **Archive** is separate from Later. It preserves the saved transcript without
  showing a success notice or Undo action. Restore sessions through archived history.
- Closing, moving to Later or archiving the current session returns to Home,
  even when other sessions are open. Acting on a different session in the sidebar
  leaves the current conversation visible.
- Drafts survive switching and parking/resuming during the page lifetime,
  but not browser reloads.
- Single-session linked-worktree rows show just the project and branch. Hover
  the row for its conversation title; title search and action names are unchanged.
  Worktrees with multiple unarchived conversations retain smaller title subtitles
  to distinguish them, including conversations in Later. Main checkouts keep
  the conversation title prominent. Recency uses compact `1m`, `2h`, `3d` labels.
  Status dots sit beside project names. While a session is running, its row and
  header hide Move to Later (pause icon) and Archive actions; Close view remains available.
- The sidebar's bottom gear opens Settings. If the sidebar is hidden, reopen
  it with the header toggle. Phone navigation remains a modal drawer until
  dismissed; opening Settings dismisses it.
- Turning Inbox off restores tabs without losing open sessions or Later
  membership. Use Quick Switcher for projects and history, or disable Inbox
  to use Projects browsing and its Archived sections.

## Skills

Invoke a loaded skill with `/skill:name [task]`. Skill instructions appear as a
collapsed **[skill] name** disclosure; expand it to inspect the source path and
instructions. Any task text appears separately as your message. Agent reads of
`SKILL.md` use the same compact label. Pi's `enableSkillCommands` setting controls
menu discovery, not manually typed invocations.

## Bash commands

Type `!command` to run bash in the session's server-side working directory. Its
output is included in the next model prompt. Use `!!command` to show the result
without including it in model context.

Bash output is displayed after the command completes, not streamed. Bash-only
sessions are not guaranteed to survive a restart before an assistant response
creates the session file. Bash commands wait until the current model run is idle.

## Steering

Press Enter with ordinary text while Pi is running to steer the ongoing task.
Pi receives it after the current assistant turn and its tool calls, without
aborting the run. Pending messages appear above the composer until Pi consumes
them, and survive browser reconnects/reloads through the native Pi queue.

Shift+Enter still inserts a newline; Escape stops the run. Slash commands and
argument completion remain available during a run: Pi executes extension
commands immediately and queues expanded skill/prompt templates as steering.

`/compact` uses Pi's native behavior: stop the active turn, then compact without
resuming it. `/reload` delegates to the SDK even during a run (unlike the
terminal's UI-level reload restriction). Follow-up queuing is not exposed.

## Command argument completion

After `/command `, Pi Chat shows suggestions from the extension's existing
`getArgumentCompletions(prefix)` callback, including async providers. Use arrows
to navigate, Enter/Tab or the mouse to insert, and Escape to dismiss. Selecting
an argument does not execute the command; press Enter again to submit.

The prefix is the full first-line argument text before the caret. Selecting a
suggestion replaces that prefix with its `value`, preserving text after the
caret. Pi owns filtering and ordering. No Pi Chat-specific extension API is
needed. Native command dialogs, filesystem completion, and general
`addAutocompleteProvider()` hooks are not part of this support.

## File content previews

Expanded `read` and `write` cards render `.md`/`.markdown` files as Markdown
(with remote images disabled) and highlight common source/config formats using
the filename extension. Unknown formats stay literal text. Edit diffs retain
line numbers and red/green backgrounds with syntax colours on the code lines;
line-by-line highlighting may not capture multiline strings/comments fully.

Arguments, errors, and non-file tool results remain plain text. Highlighting is
loaded on demand and uses the same light/dark palette as Markdown code fences.
