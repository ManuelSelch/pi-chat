# Using Pi Chat

## Keyboard shortcuts

| Shortcut | Effect |
| --- | --- |
| `⌘⇧O` / `Ctrl+Shift+O` | Quick Switcher: type a session or project name |
| `⌘O` / `Ctrl+O` | Same, in browsers that hand the key over (not Safari) |
| `⌘K` / `Ctrl+K` | Session actions (new, close, later, archive) plus every Pi slash command |
| `Esc` | Stop the current run; an open dialog or menu closes first |
| `Ctrl+C` | Clear the composer, unless text is selected so Copy still works |

## Sessions

Use Projects to browse projects and persistent sessions, or open a server folder
to start a session without previous Pi history. Tabs keep conversations separate.

Session actions are available from the ⌘K menu, the Quick Switcher `/` scope, and
typed exactly as `/close`, `/later`, or `/archive`:

- **Close Session** closes the current session's runtime; it is always available
  and closes immediately, including while the session is running.
- **Later** parks a saved, idle conversation into Later (Inbox mode only).
- **Archive Session** archives the current idle session without deleting its
  transcript. Archived sessions remain available under **Archived** in Projects,
  where they can be restored.

Later and Archive Session stay listed while a session is running, blocked or
unsaved but are disabled until it becomes an idle saved conversation. There is no
delete-session command or custom rename action; titles come from Pi.

Projects keeps Quick Chats separate from repository groups. Pinned projects
come before recent projects, whose order uses latest unarchived conversation
activity across their checkouts. Archived activity does not promote a project.
Other projects contains visible projects without unarchived conversations;
removing project-history membership there does not delete files.

Related Git checkouts share a repository group while retaining checkout-specific
sessions/actions. Registered worktrees can appear before they have conversations.
Unavailable Git/path metadata degrades to the available project information;
opening a group alone does not start a session. Folder-path visibility is a
browser preference, not a change to checkout identity.

Desktop navigation stays open alongside the conversation; compact desktop
layouts reserve sidebar space, while phones use a modal drawer. Selecting or
creating a session keeps navigation open. Real dialogs still take focus.

### Session inbox

**Settings → Feature Toggles → Show open sessions in sidebar** replaces horizontal
tabs with the Inbox and is on by default. Explicit browser preferences are preserved.
The same group contains chimes, folder paths, archived-session visibility and
**Compact transcript**, which is on by default; explicitly stored choices are
preserved. **Needs you** contains blocked
questions/approvals. **Ready** includes all unarchived idle conversations except
those in Later, including saved history after a server restart. Selecting an
unloaded conversation opens it; history is never reopened automatically.
**Working** can be collapsed independently. Selecting a session does not answer
or dismiss a prompt. The Inbox has no search field; use Home search or Quick
Switcher instead. A status group with no sessions, and the entire Later shelf when
empty, are hidden rather than shown as an empty heading.

- **Later** parks a saved, idle conversation, closing its runtime if loaded.
  Later is untimed, collapsed by default, and remembered in this browser for
  this server. Expand it and select a conversation to reopen it explicitly.
  Unsaved, working and blocked sessions cannot be parked; Later is hidden when
  Inbox is off.
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
  the row for its conversation title; action names are unchanged.
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

## Quick Switcher and local actions

Open Quick Switcher from Home or a conversation. Search names, paths, project
context and branches; results distinguish folders, worktrees, sessions and
available local actions. Empty unscoped search shows recent sessions.

| Prefix | Restricts results to |
| --- | --- |
| `#` | Folders/projects |
| `%` | Worktrees |
| `@` | Sessions |
| `/` | Local actions |

Click a scope or cycle with Tab/Shift+Tab, use arrows to select and Enter to
activate; Escape dismisses. Activating a session resumes it, and a folder or
worktree follows the existing project-opening behavior. A no-match query can be
edited without closing the switcher.

Composer and Quick Switcher share New session, Close Session, Later (Inbox mode),
Archive Session, Open folder and Settings actions. Availability follows the current
session, connection and navigation mode; Later and Archive Session are listed but
disabled while the session cannot be parked or archived. Restart is not a
session-menu action; use Settings or `/pi-chat restart`. Quick Switcher activates
local actions directly, not arbitrary extension commands or argument completion.

## Skills

Invoke a loaded skill with `/skill:name [task]`. Skill instructions appear as a
collapsed **[skill] name** disclosure; expand it to inspect the source path and
instructions. Any task text appears separately as your message. Agent reads of
`SKILL.md` use the same compact label. Pi's `enableSkillCommands` setting controls
menu discovery, not manually typed invocations.

## Bash commands

Type `!command` to run bash in the session's server-side working directory. Its
output is included in the next model prompt. Use `!!command` to show the result
without including it in model context. Neither form starts an assistant reply;
`!!` is context exclusion, not secrecy or a sandbox. Commands run with the
server user's permissions, not on the browser device.

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

## Extension prompts and widgets

Extension questions are server-owned interactions, not chat messages. Rich
questions can show Markdown, code and math. Choice questions with **Continue**
wait for explicit submission; ordinary literal selection menus remain immediate.

Minimize a question to read the conversation, then use Reopen to continue.
Selections/reasoning survive switching sessions and reconnecting within this
page, but not browser refresh. Minimize does not submit, cancel or pause expiry.
While disconnected or superseded, questions can be reopened for reading but not
answered. Failed submissions retain the draft for retry. Escape on a minimized
prompt does not answer/cancel it; explicit Stop cancels pending work.

Widgets show ANSI-styled plain text with independent collapse controls, not
Markdown. HTTP(S) OSC 8 hyperlinks supplied by extensions open in a new tab;
Markdown link syntax and bare URLs remain literal. Above-composer widgets form
a responsive bottom-aligned grid; docked and below-composer widgets stay stacked.
Colors follow the runtime's Pi output, not browser-side Markdown interpretation.

## Opening local file links

Activating a local Markdown file link opens it in the default application on the
**server machine**, currently supported on macOS. A remote browser does not open
its own local copy. HTTP(S)/mailto links retain normal browser behavior.

Relative paths resolve against the link's session project. Absolute paths,
parent paths and local `file:` URLs are supported; readable files outside the
project are allowed. Nonlocal file-URL hosts, unsafe schemes, directories and
unsupported platforms produce errors. This action does not send a model prompt,
run bash or add a history entry, and can be used while a model turn runs.

Failures appear as dismissible temporary file/session notices outside chat
history. Success means the OS accepted the request, not that another application
displayed the file. Requests are not replayed after reconnect; stopping a browser
wait cannot undo an already accepted OS open. This is not an inline preview,
upload or download endpoint.

## File content previews

Expanded `read` and `write` cards render `.md`/`.markdown` files as Markdown
(with remote images disabled) and highlight common source/config formats using
the filename extension. Unknown formats stay literal text. Edit diffs retain
line numbers and red/green backgrounds with syntax colours on the code lines;
line-by-line highlighting may not capture multiline strings/comments fully.

Arguments, errors, and non-file tool results remain plain text. Highlighting is
loaded on demand and uses the same light/dark palette as Markdown code fences.
