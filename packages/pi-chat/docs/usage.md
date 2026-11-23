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

- **Sessions** is the only navigation mode: a project-grouped sidebar on desktop and a modal drawer on phones. The header toggle shows/hides it; there is no tab bar or mode preference.
- Home combines search with **Blocked**, **Ready**, collapsed **Working** and collapsed **Later** activity. Empty groups are hidden. Enter on an untouched empty search starts a session.
- Use Home search or Quick Switcher to find sessions/projects; **Open folder…** in the action menu starts a session in another server folder. Folder paths stay hidden in search results but remain searchable.
- Selecting a live conversation focuses it; selecting saved history opens it. History is never reopened automatically. Session navigation does not answer or dismiss pending prompts.
- The header close button and **Close Session** return Home. Empty idle runtimes are closed; nonempty sessions, background work and page-lifetime drafts remain available.
- **Later** parks a saved idle conversation and closes its runtime if loaded. Membership is untimed and stored in this browser for this server. Resume explicitly reopens it; drafts survive parking/resuming until browser reload.
- **Archive Session** preserves the saved transcript but hides the conversation from the sidebar, Home and Quick Switcher. There is no Archived section, restore control, success notice or Undo action in Chat. Archived files are not deleted.
- Closing a view, parking or archiving the selected conversation returns Home even with other sessions open. Background actions leave the current selection unchanged.
- New session, Close Session, Later, Archive Session, Open folder and Settings are shared by the composer and Quick Switcher. Type exact `/close`, `/later` or `/archive` commands, or use the action menu.
- Later and Archive remain listed but disabled for unsaved, running or blocked conversations. Titles come from Pi; there is no custom rename or delete-session command.
- Linked-worktree rows emphasize branch names; conversation subtitles appear when multiple conversations need disambiguation. Main checkouts emphasize conversation titles. Actual Git branch names and session identities are unchanged.
- The bottom gear opens Settings. On phones it dismisses navigation; real dialogs retain focus ownership. Settings contains Feature Toggles, Backend server and Versions, not model/thinking/compaction controls.
- **Feature Toggles** retains chimes, Agentation feedback and Compact transcript. Sidebar navigation, hidden paths and hidden archived history are fixed behavior; old stored preferences are ignored.

## Changes panel

- Toggle the right side panel using the header’s sidebar icon, then select **Changes**. Chat and its composer stay usable alongside the panel.
- **Uncommitted** shows staged, unstaged and non-ignored untracked changes.
- **Branch** selects any local or available remote-tracking branch and compares from its merge-base with HEAD. No parent branch is guessed or fetched.
- **Commit** selects a baseline by commit message; search history or use Older/Newer. The comparison includes everything from that commit to the current working tree, not only the selected commit’s patch.
- Scroll through all unified diffs, or click a filename to jump. Binary files and metadata-only changes show placeholders.
- Use Refresh to reread Git. There is no editing, staging, reverting or automatic polling. Large comparisons fail with an actionable limit message.
- Comparison choices survive panel toggling and project switching during the page lifetime, but not browser reloads.

## UI feedback

- Enable **Settings → Feature Toggles → Agentation UI feedback** to show the annotation toolbar. It is off by default and remembered in this browser.
- Annotate the interface, copy the feedback, and paste it into a Pi conversation. No MCP server is required.
- Disable the toggle to remove the toolbar. The preference is not an access-control mechanism; avoid including sensitive information in copied feedback.

## Quick Switcher and local actions

On Home, focus or type in Search to use the inline Quick Switcher; ⌘O and
⌘⇧O focus it there. Activity remains visible below. In a conversation, the
shortcuts open the Quick Switcher dialog. Search names, paths, project
context and branches; results distinguish folders, worktrees, sessions and
available local actions. Empty unscoped search shows recent sessions. Folder and worktree paths are hidden in results but remain searchable.

| Prefix | Restricts results to |
| --- | --- |
| `#` | Folders/projects |
| `%` | Worktrees |
| `@` | Sessions |
| `/` | Local actions |

Click a scope or cycle with Tab/Shift+Tab, use arrows to select and Enter to
activate; Escape dismisses. On Home, Enter in an untouched empty search starts a
new session; invoking the switcher shortcut or navigating results selects instead. Live sessions appear immediately with their current
titles; selecting one focuses it. Saved-only sessions are reopened. A folder or
worktree follows the existing project-opening behavior. A no-match query can be
edited without closing the switcher.

Composer and Quick Switcher share New session, Close Session, Later,
Archive Session, Open folder and Settings actions. Availability follows the current
session and connection; Later and Archive Session are listed but
disabled while the session cannot be parked or archived. Restart is not a
session-menu action; use `/pi-chat restart`. Quick Switcher activates
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

## Model selection

`/model` opens the existing model popup with an always-visible search field.
**Scoped** shows the models resolved from Pi's `enabledModels` setting; **All
models** shows every model available to this runtime's providers/credentials.
Press **Tab** to toggle scope without losing the search query or search focus.
**Shift+Tab** retains normal focus navigation. Arrow keys and Enter still select;
Cancel/Escape dismiss without changing the model. The scope switch does not edit
Pi's configured shortlist. Scope/query survive minimization, session switches and
reconnection within this browser page. Use `/model`, `/thinking` and `/compact` for
session settings; Settings has no Session section. The footer remains read-only.

## Extension prompts and widgets

Extension questions are server-owned interactions, not chat messages. Rich
questions can show Markdown, code and math. Choice questions with **Continue**
wait for explicit submission; ordinary literal selection menus remain immediate.

Minimize a question to read the conversation, then use Reopen to continue.
Selections/reasoning survive switching sessions and reconnecting within this
page, but not browser refresh. Minimize does not submit, cancel or pause expiry.
While disconnected, questions can be reopened for reading but not
answered. Failed submissions retain the draft for retry. Escape on a minimized
prompt does not answer/cancel it; explicit Stop cancels pending work.

Widgets show ANSI-styled plain text with independent collapse controls, not
Markdown. Collapsing a widget is remembered by its key across sessions and layout
changes in this tab; reopening it clears that preference. Page reload resets all
widgets to expanded. HTTP(S) OSC 8 hyperlinks supplied by extensions open in a new tab;
Markdown link syntax and bare URLs remain literal. Above-composer widgets form
a bottom-aligned grid of at most two cards per row, with a lone last card
spanning the row; docked and below-composer widgets stay stacked.
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
