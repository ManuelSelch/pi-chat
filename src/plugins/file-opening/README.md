# File-opening plugin

- [Entry](index.ts) exports the SDK-owned contract and [browser adapter](client.ts); no browser plugin loader is needed.
- Chat explicitly registers Server's `createFileOpeningPlugin` and allowlists `fileOpeningContract` at [startup](../../host/index.ts).
- The adapter calls `client.plugin(fileOpeningContract).open({ sessionId, path })` on the existing connection, coalesces pending identical requests and maps structured failures to UI rejections.
- Confirmed runtime removal ends the local wait; disconnect, disposal and timeout use SDK rejection. No automatic retry or cancellation of server-side OS effects is promised.
- Server resolves public runtime IDs and server-local paths against the named session, validates readable regular files and opens in the default macOS application. It does not reveal in Finder or change the folder picker.
- See [plugin boundaries](../../../docs/plugins.md), [adapter integration tests](../../web/app/__test__/use-pi-chat.dom.test.tsx) and [transcript tests](../../web/features/chat/transcript/__test__/file-links.dom.test.tsx).
