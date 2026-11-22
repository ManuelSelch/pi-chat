# File-opening plugin

- Independent workspace: `@manuelselch/pi-plugin-file-opening`; no Chat or Server imports.
- Root export owns `fileOpeningContract` and inferred types, reusing SDK protocol validators. Calls require an explicit runtime ID and server-local path.
- `/web` exports `createFileOpeningPlugin(request)`: typed RPC, duplicate-click coalescing and local-wait cancellation on confirmed runtime removal. SDK owns deadlines and disconnect/disposal rejection; calls never replay OS effects.
- `/host` exports `createFileOpeningPlugin({ getSession }, files?)`, `FileService`, `FileOpenError` and `SystemFileOpener`. The embedding server supplies runtime lookup; the plugin owns filesystem validation and bounded macOS default-application opening.
- Chat [registers the host provider and allowlists its contract](../../packages/pi-chat/src/host/index.ts), then [composes the browser action](../../packages/pi-chat/src/web/app/AppControllerContext.tsx) into Markdown links. File-link feedback remains outside chat history.
- The host plugin constructs `FileService`; an optional injected service supports tests/custom openers. Server only resolves public session IDs to `{ projectPath }` after readiness. Lookup failures become safe `sessionUnavailable` results inside the plugin.
- `plugin.call` is the sole invocation path. The original `file.open` operation and SDK convenience method are removed; omitting the plugin removes file opening.
- Readable regular files outside the project are allowed. This is not a project sandbox, security scan, download or client-device open. Success means OS acceptance, not a displayed window.
- Separate contract/web/host exports keep Node filesystem and process code out of browser imports; no new UI loader or contribution API is introduced.
- Colocated tests cover contracts, browser waits, path validation and OS invocation. [Server scenarios](../../packages/pi-server/test/integration/file-opening-plugin.test.ts) cover RPC/session integration; [Chat scenarios](../../packages/pi-chat/src/web/features/chat/transcript/__test__/file-links.dom.test.tsx) cover link presentation.
- Root build/dev, lint, package tests/typechecks/coverage and artifact checks include this workspace. See [plugin boundaries](../../docs/plugins.md). Shared configuration and adding plugins are documented in [development tooling](../../docs/plugin-development.md).
