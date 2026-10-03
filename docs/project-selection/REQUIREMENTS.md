# Server folder project selection

Status: proposed plan; no implementation yet.

## Problem and current behavior

Pi Chat derives its project catalogue from existing Pi sessions. A server directory without session history therefore cannot be selected in the UI.

Current integration points:
- `src/server/project-session-service.ts`: groups session history by working directory; merges the active session into the catalogue.
- `src/server/chat-application-service.ts`: already supports `newSession(path)` and `openProject(path)` independently of the catalogue.
- `src/server/websocket-transport.ts` and `src/shared/protocol.ts`: typed app-level commands, usable without an active session.
- `src/web/projects/ProjectSessionDrawer.tsx`: recent projects and their sessions.
- `src/web/home/Home.tsx`: session/project search when no tab is open.
- `src/web/chat/use-pi-chat.ts`: sends project/session commands.

This supersedes the original “no filesystem browser” scope. Keep the session catalogue as recent history; do not turn it into a filesystem index.

## Goal

Select any accessible existing folder on the Pi Chat server and start a Pi session with that folder as its working directory, even when it has no previous sessions. A project is a folder; Git metadata is not required.

## Proposed user flow

1. Provide an **Open folder…** action on Home and in the Projects drawer.
2. Open a shared folder picker, initially at the active project's folder, or the server home directory when no session is open.
3. Show “Folders on the Pi Chat server”, the current absolute path, editable path input, breadcrumbs, Up, Home, and Refresh.
4. List immediate child directories, alphabetically. Clicking a row navigates into it; navigation never starts a session.
5. Provide a Show hidden folders toggle, off by default. Direct path entry can still reach a hidden folder.
6. **Start session here** explicitly creates a new session in the displayed directory. Do not silently resume an old session. Existing-session resume remains available through recent projects.
7. Focus the new tab and close the picker only on successful creation. The folder then appears in recent projects through the existing catalogue mechanism.

Cancel leaves tabs, running agents, and project selection unchanged. Opening a new folder remains possible while another tab is streaming.

## Functional requirements

- Browse server paths, not the browser device. Do not use native file inputs or browser filesystem APIs.
- Accept absolute paths and `~` / `~/…`. Resolve relative input against the displayed directory, never against an implicit process cwd. Display the resolved absolute path.
- Enumerate one directory at a time; no recursive scan or file contents.
- Support existing readable directories, including symlinked directories; use canonical paths for validation and navigation. Broken/inaccessible links must not prevent other entries from being listed.
- Support filesystem roots and server-native separators. Up at a root is disabled.
- Render loading, empty, permission-denied, missing-path, not-a-directory, disconnected, and session-start failure states inside the picker.
- Keep the last successfully listed folder when a navigation request fails.
- Ignore stale results if the user navigates again, closes/reopens the picker, or reconnects. Disable session creation while navigation is unresolved or the connection is unavailable.
- Validate the folder again immediately before creating the runtime; deletion or permission changes after browsing must produce a recoverable error without replacing existing tabs.
- Work with zero open sessions. Browse and start errors must not depend on a session transcript being present.
- Preserve current recent-project selection, resume, session deletion, tab focus, and streaming behavior.

## Boundaries and security

- The baseline assumption is Pi Chat's existing trusted/local server model: browse folders accessible to the server process; no additional sandbox in this feature.
- This picker grants access to server paths and selecting a folder starts an agent with the existing tool permissions. It does not make remote exposure safe or provide authentication.
- If deployment requires restricted roots, implement one shared canonical-path policy for both browsing and session creation, including symlink escapes. A browse-only restriction would be bypassable through existing `newSession` / `openProject` commands.
- Use filesystem APIs, never shell interpolation, for path handling/listing.
- Bound listing responses with pagination (proposed page size: 200). Do not silently truncate. Define stable name ordering and reset pagination on refresh/navigation.
- Listing is read-only. No mkdir, deletion, rename, file upload, or filesystem watcher.

## Proposed architecture

### Server

Add `src/server/directory-browser-service.ts` with injectable filesystem/home dependencies for tests. It normalizes paths, validates directories, and returns bounded directory listings with canonical path, parent path, entries, and continuation information. Keep it separate from session-history discovery.

Add app-level typed request/response messages in `src/shared/protocol.ts`, provisionally:
- `browseDirectories`: request id, path, optional base path, hidden-folder flag, optional cursor.
- `directoryListing`: matching request id and listing.
- `directoryBrowseError`: matching request id and safe user-facing error.

Wire through `ChatApplicationService` and `WebSocketTransport`. Send browsing responses to the requesting socket, not through runtime events or snapshot sequence counters. Add explicit command dispatch branches: the transport currently falls through to `newSession` for remaining command types.

Reuse `newSession(path)` for creation, but provide a correlated app-level success/error outcome so the picker can remain open on failure, including on Home. Avoid relying on `runtimeStatus` errors keyed to an empty active session id. Validate explicit project paths for both new-session and open-project operations at the application boundary.

### Browser

Add `src/web/projects/FolderPicker.tsx` plus focused request/state handling. Share this picker between Home and the drawer; keep `App.tsx` as coordination only.

Listing and navigation state belong to app-level UI/request state, not the session transcript reducer. Session snapshots must not reset the picker. Match responses by request id; invalidate pending state on disconnect and request a fresh listing after reconnect if still open.

Preserve the user's pending start request until its result arrives. A successful unrelated tab operation must not close the picker.

## Incremental delivery / acceptance tests

### 1. Read-only directory service

Test with temporary directories: normal/empty folders, hidden folders, spaces/Unicode, home expansion, relative paths, root parents, symlink directories, broken links, files-as-paths, missing paths, permissions where supported, and pagination. No Pi SDK changes.

### 2. App-level browsing protocol

Add schema and transport tests for request correlation, malformed paths/cursors, zero open tabs, socket-specific replies, and browse errors without runtime events. Verify browsing never invokes the runtime factory or changes the active tab.

### 3. Shared folder picker

DOM tests for navigation, breadcrumbs/Up/Home, path entry, hidden toggle, loading/empty/error states, pagination, cancel, keyboard operation, stale response rejection, and disconnect/reconnect. Connect both entry points without changing Quick Open or command menu behavior.

### 4. Start session in selected folder

Test canonical working directory passed to the factory, newly selected folder with no history, creation failure on Home, revalidation after directory removal, successful focus/catalogue refresh, and existing streaming tabs remaining untouched. Close only after the matching successful request.

### 5. Integration and documentation

Run TypeScript checks, full Vitest suite, and production build. Manually test in a browser: close every tab → Open folder → navigate to a temporary folder with no Pi session → Start session here → verify working directory → reload and check recent projects. Repeat with another tab streaming and with invalid/inaccessible paths.

Update README with server-path behavior and trusted-server security assumptions. Each slice should leave existing tests passing.

## Non-goals

Saved projects/favorites without sessions, folder creation, recursive repository discovery, file browsing, native OS dialogs, multi-server selection, remote authentication, and project changes inside an existing live session.

## Assumptions and decisions to confirm

Recommended defaults, not yet user-confirmed:
- Selecting a folder starts a **new** session; resume remains an explicit recent-session action.
- All server-accessible folders are available under the existing trusted deployment model; restricted roots are a separate deployment decision.
- Canonical symlink target paths become the displayed/session paths.
- No persistent bookmarks in the first version; browsing without starting a session does not create recent history.
