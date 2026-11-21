# Extension embedding

```ts
import { createPiServer } from '@manuelselch/pi-server';
import { getPiChatExtensionRegistry } from '@manuelselch/pi-server/extensions';

const extensions = getPiChatExtensionRegistry();
extensions.registerButton({
  id: 'example.action', slot: 'composer.right', label: 'Example', actionId: 'example.run',
});
const server = await createPiServer({ extensions });
server.httpServer.listen(8788, '127.0.0.1');
// On application shutdown: await server.close();
```

- Keep registration names and `Symbol.for("pi-chat.extension-registry")`: extension packages and the host share the process-wide registry. Do not create a second registry/protocol implementation merely because the server moved repositories.
- Register extension-bearing local Pi packages explicitly by path; sources need not live under the auto-discovery directory. Existing user registration paths/settings are not moved by extraction. Do not import Chat or private server source/distribution paths.
- Public `/extensions` exports the production registry/types, not test reset. `/testing` exposes fake runtime/data/reset for tests; `/testing/loopback` is a compiled isolated fixture, not a general production launcher.
- The application renders optional presentation; runtime ownership is independent of tabs/focus. Disconnect/hide do not close runtimes. Follow the SDK v2 lifecycle and use explicit `session.close` when appropriate.

## Session host

`createPiServer` binds the registry's session host for the server's lifetime; `close()` releases it. Extensions loaded in the same process reach the server's saved-session operations without a protocol connection, which would replace the controlling browser:

```ts
const sessions = getPiChatExtensionRegistry().sessionHost();
if (sessions) await sessions.archive(sessionFile);
```

- `sessionHost()` is undefined when no server hosts the process, such as terminal Pi. Treat that as unsupported rather than writing catalogue metadata yourself: the server is its only writer.
- `archive(path)` has `session.archive` semantics: a busy runtime is rejected with a `sessionBusy` error, metadata is persisted first, an open runtime is then closed, and all ready clients receive `session.list.changed`/`project.list.changed`. Paths outside the Pi session folder are rejected. A failure after persistence may leave the session archived; report it rather than retrying blindly.
- The latest server binding wins; releasing an older one does not withdraw a newer one. Only archiving is offered; unarchive, open and create remain protocol operations.
