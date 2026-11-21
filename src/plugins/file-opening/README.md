# File-opening plugin

- [Entry](index.ts) composes the file-opening action from an injected SDK request function. `AppControllerProvider` wires it to file-link presentation; `usePiChat` has no file-opening dependency.
- The entry calls `client.plugin(fileOpeningContract).open({ sessionId, path })` over the existing connection and maps structured failures to rejected UI waits. SDK owns RPC deadlines and disconnect/disposal rejection.
- [Pending opens](pending-opens.ts) holds file-link-specific UI policies: coalesce identical pending clicks and end local waits on confirmed runtime removal. Other plugins need neither policy. Calls are never replayed; cancellation cannot undo accepted OS effects.
- Chat registers Server's `createFileOpeningPlugin` and allowlists the SDK-owned contract at [startup](../../host/index.ts). There is no fallback to the separate `file.open` operation or browser plugin loader.
- Server translates public runtime IDs and resolves paths against the named session's project, not the selected tab at response time. It validates readable regular files and uses an injectable, bounded OS opener in the default application, not Finder.
- Readable paths outside the project are allowed. This is not a project sandbox, security scan, download or client-device open operation; the folder picker is unchanged.
- [FileActionsProvider](../../web/features/chat/markdown/stores/FileActions.tsx) presents bounded, dismissible, expiring failures outside chat history. Successful calls produce no toast.
- See [plugin boundaries](../../../docs/plugins.md), [composition tests](../../web/app/__test__/use-pi-chat.dom.test.tsx) and [transcript tests](../../web/features/chat/transcript/__test__/file-links.dom.test.tsx).
